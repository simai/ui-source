#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A single sf-accordion section is a plain section (simai/ui-source#19, #29;
// ui-mail P-07: a 64px toggle header over one or two fields), on the built
// bytes:
//   - the only section of an .sf-accordion-group: no button -- a plain
//     element with the title in its place, nothing in the tab order, no
//     chevron, content shown even when the markup started it hidden, the
//     panel labelled by the heading; clicking the heading changes nothing;
//   - a section marked sf-accordion--single outside a group: the same;
//   - a group of two keeps its toggles;
//   - a second section appended to a single group: both are toggles again,
//     the first stays open and keeps its id; removing it makes the first plain
//     again;
//   - data-single-section="toggle" keeps a single section a toggle;
//   - the legacy markup (the section is its own control) keeps its toggle;
//   - the header keeps the size's control height when it is plain.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/accordion/css/accordion.css'];
const SCRIPTS = ['core/core/js/core.js', 'component/component/accordion/js/accordion.js'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const section = (id, title, {open = true, extra = ''} = {}) => `
  <article class="sf-accordion sf-accordion--flush sf-accordion--size-1/2 ${extra}" id="${id}">
    <h3 class="sf-accordion-heading">
      <button class="sf-accordion-trigger" type="button" aria-expanded="${open}">
        <span class="sf-accordion-title">${title}</span>
        <i class="sf-icon" aria-hidden="true">chevron_right</i>
      </button>
    </h3>
    <div class="sf-accordion-content" role="region" ${open ? '' : 'hidden'}>Поля раздела «${title}»</div>
  </article>`;

const html = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;inline-size:320px">
<div class="sf-accordion-group" id="g-single">${section('single', 'Содержимое', {open: false})}</div>
${section('marked', 'Отмеченный', {extra: 'sf-accordion--single'})}
<div class="sf-accordion-group" id="g-two">${section('two-a', 'Первый')}${section('two-b', 'Второй', {open: false})}</div>
<div class="sf-accordion-group" id="g-keep" data-single-section="toggle">${section('keep', 'Список')}</div>
<div class="sf-accordion-group" id="g-legacy"><div class="sf-accordion" id="legacy"><span class="sf-accordion-title">Старый</span><i class="sf-icon">chevron_right</i><div class="sf-accordion-content">Текст</div></div></div>
</body></html>`;

const read = (page, id) => page.evaluate((id) => {
  const root = document.getElementById(id);
  const trigger = root.querySelector('.sf-accordion-trigger');
  const content = root.querySelector('.sf-accordion-content');
  const icon = root.querySelector('.sf-accordion-trigger .sf-icon');
  return {
    tag: trigger?.tagName ?? null, id: trigger?.id ?? null, expanded: trigger?.getAttribute('aria-expanded') ?? null,
    static: root.classList.contains('sf-accordion--static'), contentShown: !content.hidden && getComputedStyle(content).display !== 'none',
    labelledBy: content.getAttribute('aria-labelledby'), title: root.querySelector('.sf-accordion-title')?.textContent,
    iconShown: icon ? getComputedStyle(icon).display !== 'none' : null, height: trigger ? trigger.getBoundingClientRect().height : null,
    focusable: [...root.querySelectorAll('button, [tabindex]')].filter((element) => element.tabIndex >= 0).length,
    cursor: trigger ? getComputedStyle(trigger).cursor : null,
  };
}, id);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 800, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(html);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'});
  await page.waitForFunction(() => document.getElementById('two-a')?.dataset.sfAccordionInit === '1');
  await page.waitForTimeout(200);
  const controlHeight = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.blockSize = 'var(--sf-ui-1\\/2--control-height)';
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });

  let single = await read(page, 'single');
  evidence.single = single;
  check('the only section of a group has no button', single.tag === 'SPAN' && single.static, single);
  check('its content is shown, though the markup started it hidden', single.contentShown, single);
  check('nothing in it is in the tab order', single.focusable === 0, single);
  check('no chevron', single.iconShown === false, single);
  check('the heading keeps the title and labels the panel', single.title === 'Содержимое' && single.labelledBy === single.id && Boolean(single.id), single);
  check('the plain heading keeps the size\'s control height', Math.abs(single.height - controlHeight) < 0.5, {height: single.height, controlHeight});
  check('the plain heading does not look pressable', single.cursor !== 'pointer', single);
  await page.locator('#single .sf-accordion-title').click();
  check('clicking the heading changes nothing', (await read(page, 'single')).contentShown);

  const marked = await read(page, 'marked');
  evidence.marked = marked;
  check('a section marked single is plain outside a group too', marked.tag === 'SPAN' && marked.contentShown, marked);

  const two = await read(page, 'two-a');
  check('a group of two keeps its toggles', two.tag === 'BUTTON' && two.expanded === 'true' && !two.static, two);
  check('the second of two keeps its own state', (await read(page, 'two-b')).contentShown === false);

  const keep = await read(page, 'keep');
  check('data-single-section="toggle" keeps the one section a toggle', keep.tag === 'BUTTON' && !keep.static, keep);

  const legacy = await page.evaluate(() => ({role: document.getElementById('legacy').getAttribute('role'), static: document.getElementById('legacy').classList.contains('sf-accordion--static')}));
  check('the legacy markup keeps its toggle', legacy.role === 'button' && !legacy.static, legacy);

  // A second section joins: both are toggles; the first keeps its id and state.
  await page.evaluate((markup) => document.getElementById('g-single').insertAdjacentHTML('beforeend', markup), section('joined', 'Добавленный', {open: false}));
  await page.waitForFunction(() => document.getElementById('joined')?.dataset.sfAccordionInit === '1');
  await page.waitForTimeout(100);
  const rejoined = await read(page, 'single');
  evidence.rejoined = rejoined;
  check('a second section turns the first back into a toggle', rejoined.tag === 'BUTTON' && !rejoined.static && rejoined.id === single.id, rejoined);
  check('the first stays open: what the reader sees does not vanish', rejoined.expanded === 'true' && rejoined.contentShown, rejoined);
  await page.locator('#single .sf-accordion-trigger').click();
  check('and toggles again', (await read(page, 'single')).contentShown === false);
  await page.locator('#single .sf-accordion-trigger').click();

  // It leaves: the first is plain again.
  await page.evaluate(() => document.getElementById('joined').remove());
  await page.waitForTimeout(100);
  const alone = await read(page, 'single');
  check('one left alone is plain again', alone.tag === 'SPAN' && alone.contentShown, alone);
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('ACCORDION_SINGLE_OK');
