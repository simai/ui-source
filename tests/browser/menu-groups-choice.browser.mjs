#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Larena's section navigation and choice cards (msg-993e1e39 items 4 and 3)
// on the built bytes with the real Loader, at 1440 and 390 px, light and dark.
//
// sf-menu 1.3.0, a grouped section navigation (appearance navigation,
// sticky, collapse narrow): a group's heading is the half rung's control
// height, its words on the rows' text axis; the rows are the size 1 control
// height; the status dot stands before the counter at the row's end; the
// collapsible heading is a disclosure button; sticky keeps the menu in view
// while the page scrolls; under md the menu is a selector button showing the
// current section, named «<label>: <section>», that opens the column.
//
// sf-input-choice 1.1.0 (C28), the default tile layout: cards in a grid that
// stacks on a phone; the icon stands on the name line at the line's height;
// the control is the class radio or checkbox, its box the name line, centred
// on it; a chosen card's box does not move; the label row and the message line are sf-input's text 1/2; the
// arrows move and choose in the radio group; the field's label sits on the
// same left edge as an sf-input above it. No sideways scroll, no page errors.
// With a screenshot folder, each case is saved there as a PNG.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page' || path.startsWith('/page/')) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const SECTIONS = JSON.stringify([
  {id: 'site', label: 'Сайт', group: true, items: [
    {id: 'address', label: 'Адрес', href: '#address', icon: 'language', status: 'warning'},
    {id: 'code', label: 'Код', href: '#code', icon: 'code'},
    {id: 'data', label: 'Данные', href: '#data', icon: 'database', count: 12},
  ]},
  {id: 'watch', label: 'Наблюдение', group: true, collapsible: true, items: [
    {id: 'health', label: 'Состояние', href: '#health', icon: 'monitor_heart', status: 'success'},
    {id: 'journal', label: 'Журнал', href: '#journal', icon: 'history', count: 3},
  ]},
]);
const KINDS = JSON.stringify([
  {value: 'site', label: 'Сайт', caption: 'Страницы, разделы и меню', icon: 'language'},
  {value: 'shop', label: 'Магазин', caption: 'Каталог, корзина и заказы', icon: 'storefront', badge: 'Pro'},
  {value: 'docs', label: 'Документация', caption: 'Статьи с поиском и оглавлением', icon: 'menu_book'},
]);
const TARGETS = JSON.stringify([
  {value: 'local', label: 'Этот сервер', caption: 'Быстро, но пропадёт вместе с сервером'},
  {value: 's3', label: 'Хранилище S3', caption: 'Отдельно от сервера'},
  {value: 'ftp', label: 'FTP', caption: 'Устаревший способ', disabled: true},
]);

const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface)}
.layout{display:flex;gap:24px;padding:16px;align-items:flex-start;box-sizing:border-box;max-inline-size:100%}
.layout>sf-menu{flex:0 0 240px}.content{flex:1 1 auto;min-inline-size:0;display:flex;flex-direction:column;gap:24px}
.tall{block-size:1600px;border:1px dashed var(--sf-outline-variant)}
@media (max-width:43.9375rem){.layout{flex-direction:column}.layout>sf-menu{flex:none;inline-size:100%}}</style></head>
<body><div class="layout">
  <sf-menu id="nav" label="Разделы сайта" appearance="navigation" sticky collapse="narrow" current="address" items='${SECTIONS}'></sf-menu>
  <div class="content">
    <sf-input id="ref" label="Название сайта" value="Пример" style="inline-size:100%"></sf-input>
    <sf-input-choice id="kind" label="Тип сайта" name="kind" value="shop" hint="Тип можно сменить позже." items='${KINDS}'></sf-input-choice>
    <sf-input-choice id="targets" label="Куда сохранять копии" name="targets" multiple columns="3" value="local,s3" items='${TARGETS}'></sf-input-choice>
    <sf-input-choice id="bad" label="Тариф" name="plan" required invalid error-message="Выберите тариф." items='${KINDS}'></sf-input-choice>
    <div class="tall"></div>
  </div>
</div></body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) < tolerance;
const browser = await chromium.launch();
const numbers = {};

async function open({width, theme}) {
  page = shell(theme);
  const context = await browser.newContext({viewport: {width, height: 800}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-menu') && customElements.get('sf-input-choice')
    && document.querySelector('#nav nav') && document.querySelectorAll('sf-input-choice .sf-choice-card').length === 9, null, {timeout: 20000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(500);
  return {tab, context, errors};
}

const TOKENS = () => {
  const probe = document.createElement('div');
  document.body.append(probe);
  const read = (css) => { probe.style.cssText = `position:absolute;inline-size:${css}`; return parseFloat(getComputedStyle(probe).inlineSize); };
  const value = {
    control1: read('var(--sf-ui-1--control-height)'), controlHalf: read('var(--sf-ui-1\\/2--control-height)'),
    line1: read('var(--sf-text-height-1)'), lineHalf: read('var(--sf-text-height-1\\/2)'),
    iconHalf: read('var(--sf-icon-size-1\\/2)'), space1: read('var(--sf-space-1)'),
  };
  probe.remove();
  return value;
};

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    const label = `${width} ${theme}`;
    const {tab, context, errors} = await open({width, theme});
    const t = await tab.evaluate(TOKENS);
    const narrow = width < 704;

    // ---------------------------------------------------------- sf-menu
    if (!narrow) {
      const m = await tab.evaluate(() => {
        const r = (el) => el.getBoundingClientRect();
        const heading = document.querySelector('#nav [data-sf-menu-item="site"] > .sf-menu-group-heading');
        const toggle = document.querySelector('#nav [data-sf-menu-toggle="watch"]');
        const row = document.querySelector('#nav a[data-sf-menu-link="address"]');
        const rowText = row.querySelector('.sf-menu-element-text');
        const headText = heading.querySelector('.sf-menu-group-label');
        const dot = row.querySelector('.sf-dot');
        const dataRow = document.querySelector('#nav a[data-sf-menu-link="data"]');
        const count = dataRow.querySelector('.sf-badge');
        const list = document.querySelector('#nav [data-sf-menu-item="site"] > ul');
        const style = getComputedStyle(heading);
        return {
          heading: r(heading).height, toggle: r(toggle).height, row: r(row).height,
          headLeft: r(headText).left, rowTextLeft: r(rowText).left, iconLeft: r(row.querySelector('.sf-menu-element-icon')).left,
          dotRight: r(dot).right, rowRight: r(row).right, countRight: r(count).right, dotSize: r(dot.querySelector('.sf-dot-item')).width,
          headingFont: style.fontSize, headingColor: style.color,
          named: document.getElementById(list.getAttribute('aria-labelledby'))?.textContent.trim(),
          linkName: row.textContent.replace(/\s+/gu, ' ').trim(), current: row.getAttribute('aria-current'),
          currentFill: getComputedStyle(row).backgroundColor, toggleExpanded: toggle.getAttribute('aria-expanded'),
        };
      });
      numbers[`menu ${label}`] = m;
      ok(`menu ${label}: a group heading is the half rung's control height (${t.controlHalf}), a collapsible one too`, near(m.heading, t.controlHalf) && near(m.toggle, t.controlHalf), JSON.stringify(m));
      ok(`menu ${label}: a row is the size 1 control height (${t.control1})`, near(m.row, t.control1), JSON.stringify(m));
      ok(`menu ${label}: the heading's words start where a row starts its icon (one text axis)`, near(m.headLeft, m.iconLeft, 1), JSON.stringify({head: m.headLeft, icon: m.iconLeft}));
      ok(`menu ${label}: the heading names its list; the status word ends the link's name; the current row is the page`, m.named === 'Сайт' && /Адрес.*внимание/u.test(m.linkName) && m.current === 'page', JSON.stringify(m));
      ok(`menu ${label}: the status dot and the counter stand at the row's end`, m.rowRight - m.dotRight < t.space1 + 2 && m.rowRight - m.countRight < t.space1 + 2, JSON.stringify(m));
      // sticky: scroll the page; the menu stays in view.
      await tab.evaluate(() => window.scrollTo(0, 900));
      await tab.waitForTimeout(200);
      const top = await tab.evaluate(() => document.getElementById('nav').getBoundingClientRect().top);
      ok(`menu ${label}: sticky keeps the menu in view while the page scrolls`, top >= -0.5 && top < 40, String(top));
      await tab.evaluate(() => window.scrollTo(0, 0));
      // The collapsible group closes and opens with Enter.
      await tab.focus('#nav [data-sf-menu-toggle="watch"]');
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(150);
      const closed = await tab.evaluate(() => document.querySelector('#nav [data-sf-menu-item="watch"] > ul').hidden);
      if (shots && width === 1440) await tab.screenshot({path: join(shots, `menu-groups-closed-${theme}.png`), clip: {x: 0, y: 0, width: 300, height: 420}});
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(150);
      const reopened = await tab.evaluate(() => !document.querySelector('#nav [data-sf-menu-item="watch"] > ul').hidden);
      ok(`menu ${label}: Enter closes and opens a collapsible group`, closed && reopened, JSON.stringify({closed, reopened}));
      await tab.evaluate(() => document.activeElement?.blur());
      await tab.waitForTimeout(100);
      if (shots) await tab.screenshot({path: join(shots, `menu-groups-${width}-${theme}.png`), clip: {x: 0, y: 0, width: Math.min(width, 300), height: 420}});
    } else {
      const s = await tab.evaluate(() => {
        const r = (el) => el.getBoundingClientRect();
        const button = document.querySelector('#nav [data-sf-menu-panel-toggle]');
        return button && {h: r(button).height, name: button.getAttribute('aria-label'), text: button.textContent.replace(/\s+/gu, ' ').trim(),
          icon: button.querySelector('.sf-menu-element-icon')?.textContent.trim(), hidden: document.getElementById(button.getAttribute('aria-controls')).hidden};
      });
      numbers[`menu ${label}`] = s;
      ok(`menu ${label}: under md the menu is a selector showing the current section, named by the menu and the section`, s && s.name === 'Разделы сайта: Адрес' && s.text.includes('Адрес') && s.icon === 'language' && s.hidden, JSON.stringify(s));
      if (shots) await tab.screenshot({path: join(shots, `menu-selector-closed-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: 120}});
      await tab.click('#nav [data-sf-menu-panel-toggle]');
      await tab.waitForTimeout(200);
      const opened = await tab.evaluate(() => !document.getElementById(document.querySelector('#nav [data-sf-menu-panel-toggle]').getAttribute('aria-controls')).hidden
        && document.querySelectorAll('#nav .sf-menu-group-heading').length === 2);
      ok(`menu ${label}: the selector opens the grouped column`, opened, String(opened));
      const rows = await tab.evaluate(() => ({row: document.querySelector('#nav a[data-sf-menu-link="code"]').getBoundingClientRect().height,
        heading: document.querySelector('#nav .sf-menu-group-heading').getBoundingClientRect().height}));
      numbers[`menu ${label} open`] = {...rows, selector: s?.h};
      // On a phone the class row with an icon is the icon's 24 px plus its
      // padding, 40 px, over the rung's 36 (the class menu's own geometry,
      // the same without groups): the selector is that row's height.
      ok(`menu ${label}: the selector is a row's height, a heading the half rung's`, near(rows.row, s.h) && near(rows.heading, t.controlHalf), JSON.stringify({rows, t}));
      if (shots) await tab.screenshot({path: join(shots, `menu-selector-open-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: 520}});
      await tab.click('#nav a[data-sf-menu-link="code"]');
      await tab.waitForTimeout(200);
      const closedAfter = await tab.evaluate(() => document.querySelector('#nav [data-sf-menu-panel-toggle]').getAttribute('aria-expanded'));
      ok(`menu ${label}: choosing a section closes the selector`, closedAfter === 'false', closedAfter);
    }

    // ---------------------------------------------------------- sf-input-choice
    const c = await tab.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const cards = [...document.querySelectorAll('#kind .sf-choice-card')];
      const card = cards[0];
      const icon = card.querySelector('.sf-choice-icon');
      const title = card.querySelector('.sf-choice-title');
      const mark = card.querySelector('.sf-choice-control .sf-radio-button-box');
      const label = document.querySelector('#kind .sf-choice-label');
      const message = document.querySelector('#kind .sf-choice-message');
      const ref = document.querySelector('#ref .sf-input-field');
      const refLabel = document.querySelector('#ref .sf-input-text');
      const badge = document.querySelector('#kind .sf-badge');
      const checked = document.querySelector('#kind .sf-choice-card--checked');
      return {
        tops: cards.map((one) => Math.round(r(one).top)), lefts: cards.map((one) => Math.round(r(one).left)), widths: cards.map((one) => Math.round(r(one).width)),
        icon: [r(icon).width, r(icon).height], title: r(title).height, titleMid: r(title).top + r(title).height / 2, iconMid: r(icon).top + r(icon).height / 2,
        alias: card.querySelector('.sf-choice-mark') === card.querySelector('.sf-choice-control'),
        mark: [r(mark).width, r(mark).height], markMid: r(mark).top + r(mark).height / 2,
        labelFont: getComputedStyle(label).fontSize, messageFont: getComputedStyle(message).fontSize,
        labelLeft: r(label).left, gridLeft: r(document.querySelector('#kind .sf-choice-grid')).left, refLeft: r(ref).left, refLabelLeft: refLabel ? r(refLabel).left : null,
        refLabelFont: refLabel ? getComputedStyle(refLabel).fontSize : null,
        badge: r(badge).height, docsHeight: r(cards[2]).height, checkedBorder: getComputedStyle(checked).borderTopColor,
        targetCols: [...new Set([...document.querySelectorAll('#targets .sf-choice-card')].map((one) => Math.round(r(one).top)))].length,
        badBorder: getComputedStyle(document.querySelector('#bad .sf-choice-card')).borderTopColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    numbers[`choice ${label}`] = c;
    ok(`choice ${label}: the icon is the name line's height, square, on the line`, near(c.icon[0], t.line1) && near(c.icon[1], t.line1) && near(c.iconMid, c.titleMid, 1), JSON.stringify(c.icon));
    ok(`choice ${label}: the title is on the size 1 line`, near(c.title, t.line1), JSON.stringify(c));
    ok(`choice ${label}: the control is the class radio, its box the name line, centred on it`, near(c.mark[0], t.line1) && near(c.mark[1], t.line1) && near(c.markMid, c.titleMid, 1), JSON.stringify({mark: c.mark, t: t.line1}));
    ok(`choice ${label}: .sf-choice-mark is kept on the control as a legacy alias`, c.alias, '');
    ok(`choice ${label}: a badge stands on the title's line without growing it`, c.badge <= t.line1 + 0.5, JSON.stringify({badge: c.badge, line: t.line1}));
    ok(`choice ${label}: the label and the message are sf-input's text 1/2${c.refLabelFont ? ', the label the size of sf-input\'s' : ''}`, c.labelFont === c.messageFont && (!c.refLabelFont || c.refLabelFont === c.labelFont), JSON.stringify(c));
    ok(`choice ${label}: the label and the cards stand on the field's left edge, as sf-input above`, near(c.labelLeft, c.gridLeft) && near(c.gridLeft, c.refLeft, 1), JSON.stringify(c));
    if (narrow) ok(`choice ${label}: a phone stacks the cards`, new Set(c.lefts).size === 1 && c.targetCols === 3, JSON.stringify(c));
    else ok(`choice ${label}: the cards stand in one row; columns 3 is one row of three`, new Set(c.tops).size === 1 && c.targetCols === 1, JSON.stringify(c));
    ok(`choice ${label}: invalid draws the error edge`, c.badBorder !== c.checkedBorder, JSON.stringify(c));
    ok(`choice ${label}: no sideways scroll`, !c.overflow, '');
    // The arrows move and choose.
    await tab.focus('#kind .sf-choice-card--checked .sf-choice-input');
    await tab.keyboard.press('ArrowRight');
    await tab.waitForTimeout(150);
    const moved = await tab.evaluate(() => ({value: document.getElementById('kind').value, focus: document.activeElement?.value,
      docsHeight: document.querySelectorAll('#kind .sf-choice-card')[2].getBoundingClientRect().height,
      ring: getComputedStyle(document.activeElement.closest('.sf-choice-card')).outlineStyle}));
    ok(`choice ${label}: a card chosen keeps its height (the edge is drawn inside)`, near(moved.docsHeight, c.docsHeight), JSON.stringify({before: c.docsHeight, after: moved.docsHeight}));
    ok(`choice ${label}: ArrowRight moves to the next card and chooses it, the ring on the card`, moved.value === 'docs' && moved.focus === 'docs' && moved.ring !== 'none', JSON.stringify(moved));
    if (shots) {
      await tab.evaluate(() => document.activeElement?.blur());
      await tab.waitForTimeout(100);
      await tab.locator('#kind .sf-choice').screenshot({path: join(shots, `choice-kind-${width}-${theme}.png`)});
      await tab.locator('#targets .sf-choice').screenshot({path: join(shots, `choice-targets-${width}-${theme}.png`)});
      await tab.locator('#bad .sf-choice').screenshot({path: join(shots, `choice-invalid-${width}-${theme}.png`)});
    }
    ok(`${label}: no page errors`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
server.close();
if (shots) writeFileSync(join(shots, 'numbers.json'), `${JSON.stringify(numbers, null, 2)}\n`);
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
