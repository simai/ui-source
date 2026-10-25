#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-accordion (owner, 2026-10-25), measured on the built bytes, with the
// class accordion's runtime loaded beside it as the loader loads it:
// - sections from `items` (JSON and the property), from <details> in the
//   markup (the same live nodes, their listeners kept) and from a slot;
// - headers are buttons inside headings, aria-expanded and aria-controls
//   right, panels regions named by their headers;
// - a click toggles once (the class runtime binds nothing to these
//   sections), single mode closes the one that was open, and each change is
//   one sf-accordion:toggle {id, open, source};
// - Enter and Space toggle; ArrowDown and ArrowUp walk the headers and wrap,
//   Home and End go to the ends, a disabled header is passed over;
// - open(id), close(id), toggle(id) report source method;
// - one section is a plain section, single-section="toggle" keeps a button;
// - the marker turns, the icon before the title does not; plus-minus;
// - at 1000 and 390 wide: each size's header is the sf-button height of the
//   size, the three appearances draw as the class's, a long title wraps, and
//   nothing scrolls sideways.
import {resolve, join} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/badges/css/badges.css',
  'component/component/accordion/css/accordion.css', 'smart/smart/accordion/css/accordion.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/badges/js/badges.js', 'component/component/accordion/js/accordion.js', 'smart/smart/accordion/js/accordion.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const ITEMS = [
  {id: 'main', title: 'Основное', content: 'Название, адрес и описание', open: true, icon: 'tune'},
  {id: 'seo', title: 'SEO', content: 'Заголовок страницы', badge: '3'},
  {id: 'access', title: 'Доступ', content: 'Кто видит раздел', disabled: true},
  {id: 'faq', title: 'Вопросы', slot: 'faq'},
];
const LONG = 'Очень длинное название раздела, которое не помещается в одну строку узкой панели настроек';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  const sized = SIZES.map((size) => `<div class="row" data-row="${size}" style="display:flex;gap:16px;align-items:flex-start">
      <div style="flex:1 1 0;min-inline-size:0;display:grid;gap:8px">
        ${['default', 'outline', 'flush'].map((appearance) => `<sf-accordion data-size="${size}" data-appearance="${appearance}" size="${size}" appearance="${appearance}"
          items='${json([{id: 'a', title: 'Раздел', content: 'Текст', open: true}, {id: 'b', title: 'Ещё'}])}'></sf-accordion>`).join('')}
        <div style="inline-size:min(14rem, 100%)"><sf-accordion data-long size="${size}" items='${json([{id: 'a', title: LONG}, {id: 'b', title: 'Ещё'}])}'></sf-accordion></div>
      </div>
      <sf-button size="${size}" appearance="outline" scheme="on-surface" text="Кнопка"></sf-button>
    </div>`).join('');
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;display:grid;gap:24px">
    <button id="before" type="button">До</button>
    <sf-accordion id="data" single items='${json(ITEMS)}'>
      <div slot="faq"><p>Ответ</p><button id="faq-button" type="button">В ответе</button></div>
    </sf-accordion>
    <sf-accordion id="markup" marker="plus-minus">
      <details open data-id="delivery"><summary>Доставка</summary><p>Курьером за два дня.</p><button id="live" type="button">Живая</button></details>
      <details data-id="return" data-badge="14"><summary>Возврат</summary><p>В течение 14 дней.</p></details>
    </sf-accordion>
    <sf-accordion id="one" items='${json([{id: 'only', title: 'Содержимое', content: 'Поля блока'}])}'></sf-accordion>
    <sf-accordion id="one-toggle" single-section="toggle" items='${json([{id: 'only', title: 'Позже наполнится', content: 'Поля'}])}'></sf-accordion>
    <sf-accordion id="prop"></sf-accordion>
    ${sized}
    <button id="after" type="button">После</button>
  </body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-accordion') && customElements.get('sf-button') && customElements.get('sf-badge')
    && document.querySelectorAll('#data .sf-accordion').length === 4, null, {timeout: 8000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__events = [];
    document.addEventListener('sf-accordion:toggle', (event) => {
      window.__events.push({host: event.target.id, id: event.detail.id, open: event.detail.open, source: event.detail.source});
    });
    window.__live = 0;
    document.getElementById('live').addEventListener('click', () => { window.__live += 1; });
  });
  const events = () => page.evaluate(() => window.__events.splice(0));

  const state = (id) => page.evaluate((key) => {
    const host = document.getElementById(key);
    return [...host.querySelectorAll(':scope > .sf-accordion-group > .sf-accordion')].map((article) => {
      const heading = article.querySelector(':scope > .sf-accordion-heading');
      const trigger = heading.querySelector(':scope > .sf-accordion-trigger');
      const content = article.querySelector(':scope > .sf-accordion-content');
      const labelledby = content.getAttribute('aria-labelledby');
      const marker = [...trigger.querySelectorAll(':scope > .sf-icon')].find((icon) => !icon.classList.contains('sf-accordion-lead'));
      const lead = trigger.querySelector(':scope > .sf-accordion-lead');
      return {
        id: article.dataset.sfAccordionId, tag: trigger.localName, heading: heading.getAttribute('role'), level: heading.getAttribute('aria-level'),
        title: trigger.querySelector('.sf-accordion-title')?.textContent.trim(),
        expanded: trigger.getAttribute('aria-expanded'), controls: trigger.getAttribute('aria-controls') === content.id,
        disabled: trigger.disabled ?? null, hidden: content.hidden, shown: content.getBoundingClientRect().height > 0,
        region: content.getAttribute('role'), named: labelledby ? document.getElementById(labelledby) === trigger : null,
        active: article.classList.contains('active'), static: article.classList.contains('sf-accordion--static'),
        marker: marker?.textContent.trim() ?? null, markerTurn: marker ? getComputedStyle(marker).transform : null,
        leadTurn: lead ? getComputedStyle(lead).transform : null,
        badge: trigger.querySelector('sf-badge')?.getAttribute('text') ?? null,
        text: content.textContent.replace(/\s+/gu, ' ').trim(),
        classBound: article.dataset.sfAccordionInit === '1' && !article.classList.contains('sf-accordion--legacy'),
      };
    });
  }, id);

  // Sections from data.
  const data = await state('data');
  evidence.data = data;
  check('data: four sections, in order', data.map((one) => one.id).join() === 'main,seo,access,faq', {got: data.map((one) => one.id)});
  check('data: buttons inside headings of level 3', data.every((one) => one.tag === 'button' && one.heading === 'heading' && one.level === '3'), {data});
  check('data: the first is open, the rest closed', data.map((one) => one.expanded).join() === 'true,false,false,false'
    && data.map((one) => one.hidden).join() === 'false,true,true,true' && data[0].active && !data[1].active, {data});
  check('data: aria-controls and region names', data.every((one) => one.controls && one.region === 'region' && one.named), {data});
  check('data: the disabled section is a disabled button', data[2].disabled === true && data[0].disabled === false, {data});
  check('data: the badge and the slot', data[1].badge === '3' && data[3].text.startsWith('Ответ'), {seo: data[1], faq: data[3]});
  check('data: the class runtime left the sections to the element', data.every((one) => one.classBound), {data});
  check('data: the marker turns open, the icon before the title does not', data[0].markerTurn !== 'none' && data[0].leadTurn === 'none'
    && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(data[1].markerTurn), {open: data[0], closed: data[1]});

  // A click toggles once; single mode closes the one that was open.
  await page.click('#data .sf-accordion[data-sf-accordion-id="seo"] .sf-accordion-trigger');
  await page.waitForTimeout(150);
  const clicked = await state('data');
  const clickEvents = await events();
  check('click: SEO opens and Основное closes', clicked[1].expanded === 'true' && !clicked[1].hidden && clicked[0].expanded === 'false' && clicked[0].hidden, {clicked});
  check('click: one event for each section that changed, the asked one first', JSON.stringify(clickEvents) === JSON.stringify([
    {host: 'data', id: 'seo', open: true, source: 'user'}, {host: 'data', id: 'main', open: false, source: 'user'}]), {clickEvents});
  await page.click('#data .sf-accordion[data-sf-accordion-id="access"] .sf-accordion-trigger', {force: true});
  await page.waitForTimeout(100);
  check('click: a disabled section does not open', (await state('data'))[2].expanded === 'false' && (await events()).length === 0);

  // Keyboard.
  await page.focus('#data .sf-accordion[data-sf-accordion-id="main"] .sf-accordion-trigger');
  const focused = () => page.evaluate(() => document.activeElement?.closest?.('.sf-accordion')?.dataset.sfAccordionId ?? document.activeElement?.id ?? null);
  const walk = [];
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'ArrowUp']) {
    await page.keyboard.press(key);
    walk.push(await focused());
  }
  evidence.walk = walk;
  check('keyboard: arrows walk the headers past the disabled one and wrap, Home and End go to the ends',
    walk.join() === 'seo,faq,main,faq,faq,main,faq', {walk});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const entered = await state('data');
  check('keyboard: Enter opens the focused section (single closes SEO)', entered[3].expanded === 'true' && entered[1].expanded === 'false', {entered});
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  check('keyboard: Space closes it', (await state('data'))[3].expanded === 'false');
  const keyEvents = await events();
  check('keyboard: three events, source user', keyEvents.length === 3 && keyEvents.every((one) => one.source === 'user'), {keyEvents});
  // Tab order: the enabled headers, the slotted button only while its section is open.
  await page.focus('#before');
  const tabs = [];
  for (let at = 0; at < 4; at += 1) { await page.keyboard.press('Tab'); tabs.push(await focused()); }
  check('keyboard: Tab goes through the enabled headers, then on', tabs.join() === 'main,seo,faq,delivery', {tabs});

  // Methods.
  const method = await page.evaluate(() => {
    const host = document.getElementById('data');
    return {opened: host.open('main'), again: host.open('main'), closed: host.close('main'), toggled: host.toggle('seo'),
      unknown: host.open('nope'), ids: host.openIds, isOpen: host.isOpen('seo')};
  });
  await page.waitForTimeout(100);
  const methodEvents = await events();
  check('methods: open, close and toggle say whether anything changed', method.opened && !method.again && method.closed && method.toggled
    && !method.unknown && method.ids.join() === 'seo' && method.isOpen, {method});
  check('methods: each change is an event with source method', methodEvents.length === 3 && methodEvents.every((one) => one.source === 'method'), {methodEvents});

  // <details> in the markup.
  const markup = await state('markup');
  evidence.markup = markup;
  check('markup: two sections from <details>, titles from <summary>', markup.map((one) => `${one.id}:${one.title}`).join() === 'delivery:Доставка,return:Возврат', {markup});
  check('markup: open from the details, plus and minus, the badge', markup[0].expanded === 'true' && markup[0].marker === 'remove'
    && markup[1].marker === 'add' && markup[1].badge === '14' && markup[0].markerTurn === 'none', {markup});
  check('markup: no <details> left in the light DOM', await page.evaluate(() => !document.querySelector('#markup > details')));
  await page.click('#live');
  check('markup: the content is the same live nodes, its listener kept', await page.evaluate(() => window.__live) === 1);
  await page.click('#markup .sf-accordion[data-sf-accordion-id="return"] .sf-accordion-trigger');
  await page.waitForTimeout(100);
  const both = await state('markup');
  check('markup: without single both stay open', both[0].expanded === 'true' && both[1].expanded === 'true', {both});
  await events();

  // One section.
  const one = await state('one');
  const oneToggle = await state('one-toggle');
  check('one section: a plain section, its content shown, no marker', one.length === 1 && one[0].tag === 'span' && one[0].static
    && one[0].shown && !one[0].hidden && one[0].marker === null && one[0].expanded === null, {one});
  check('one section: single-section="toggle" keeps the button', oneToggle[0].tag === 'button' && oneToggle[0].expanded === 'false', {oneToggle});
  check('one section: nothing of it is in the tab order', await page.evaluate(() => !document.querySelector('#one button, #one [tabindex]')));

  // The items property.
  await page.evaluate(() => { document.getElementById('prop').items = [{id: 'x', title: 'Первый', open: true}, {id: 'y', title: 'Второй'}]; });
  await page.waitForTimeout(150);
  const prop = await state('prop');
  check('property: items set from code draw', prop.map((section) => section.id).join() === 'x,y' && prop[0].expanded === 'true', {prop});

  // Sizes and appearances, at two widths.
  for (const width of [1000, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(300);
    const measured = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-row]')].map((row) => {
        const button = row.querySelector('sf-button button').getBoundingClientRect().height;
        const headers = [...row.querySelectorAll('sf-accordion[data-appearance]')].map((host) => {
          const article = host.querySelector('.sf-accordion');
          const style = getComputedStyle(article);
          return {appearance: host.dataset.appearance, height: article.querySelector('.sf-accordion-trigger').getBoundingClientRect().height,
            background: style.backgroundColor, border: parseFloat(style.borderTopWidth), bottom: parseFloat(style.borderBottomWidth),
            radius: parseFloat(style.borderTopLeftRadius)};
        });
        const long = row.querySelector('sf-accordion[data-long] .sf-accordion-trigger');
        const group = row.querySelector('sf-accordion[data-long] .sf-accordion-group');
        return {size: row.dataset.row, button, headers, long: long.getBoundingClientRect().height,
          overflow: group.scrollWidth > group.clientWidth};
      });
      return {rows, scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth};
    });
    evidence[width] = measured.rows.map((row) => ({size: row.size, button: row.button, headers: row.headers.map((entry) => entry.height), long: row.long}));
    for (const row of measured.rows) {
      for (const entry of row.headers) {
        check(`${width}px size ${row.size} ${entry.appearance}: the header is the sf-button height of the size`, near(entry.height, row.button), {height: entry.height, button: row.button});
      }
      const [filled, outline, flush] = row.headers;
      check(`${width}px size ${row.size}: default is filled and rounded, outline bordered, flush square with a line below`,
        filled.background !== 'rgba(0, 0, 0, 0)' && filled.radius > 0 && filled.border === 0
        && outline.background === 'rgba(0, 0, 0, 0)' && outline.border > 0
        && flush.background === 'rgba(0, 0, 0, 0)' && flush.radius === 0 && flush.border === 0 && flush.bottom > 0, {filled, outline, flush});
      check(`${width}px size ${row.size}: a long title wraps and the header grows`, row.long > row.button + 1, {long: row.long, button: row.button});
      check(`${width}px size ${row.size}: nothing overflows`, !row.overflow);
    }
    check(`${width}px: the page does not scroll sideways`, !measured.scroll);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(evidence, null, 1));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('ACCORDION_SMART_OK');
