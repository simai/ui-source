#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-segmented's fold (C47 C) under a width that changes across its fold
// point, measured on the built bytes. View round 16 (VN-1) and round 18 found
// the fold made inside the ResizeObserver callback: the browser reported
// «ResizeObserver loop completed with undelivered notifications» on every
// crossing, and in a toolbar row the dropdown's own place (wider than the
// track would get) unfolded it again, about 25 flips in a frame until
// «update loop limit reached {reason: fit}». sf-segmented 1.8.4 (FL-1)
// answers a change of place in the next frame and reads the folded place as
// the track would get it. This probe holds that:
//   - box: the track alone in a block toggled 10 times between its one-line
//     width + 30 px and - 30 px: one flip per change, each state the expected
//     one, no ResizeObserver notice;
//   - row: a one-line toolbar row (a shrinking button, the track, a fixed
//     block) toggled 10 times at its fold width +- 40 px: the same;
//   - sweep: the row narrowed from 1200 px to every width from 900 to 1100
//     (step 10), the band where the dropdown's place exceeded the need: at
//     most one flip per change, no notice, no update-loop warning;
//   - all of it again with the CPU slowed four times.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css', 'component/component/button-group/css/button-group.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'component/component/button-group/js/button-group.js', 'smart/smart/dropdown/js/dropdown.js', 'smart/smart/segmented/js/segmented.js'];

const ROW_ITEMS = [{value: 'table', label: 'Таблица', icon: 'table_rows'}, {value: 'cards', label: 'Карточки', icon: 'grid_view'},
  {value: 'board', label: 'Канбан', icon: 'view_kanban'}, {value: 'calendar', label: 'Календарь', icon: 'calendar_month'}, {value: 'flow', label: 'Поток', icon: 'account_tree'}];
const BOX_ITEMS = [{value: 'day', label: 'День'}, {value: 'week', label: 'Неделя'}, {value: 'month', label: 'Месяц'}, {value: 'quarter', label: 'Квартал'}, {value: 'year', label: 'Год'}];

const BODY = `<style>
  #row{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;box-sizing:border-box;margin-block-end:24px}
  #row > .grow{flex:0 1 auto;min-inline-size:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #row > .end{flex:none;inline-size:217px;block-size:20px}
  #box{box-sizing:border-box}
</style>
<div id="row"><button class="grow" type="button">Все заказы за этот месяц и квартал</button>
  <sf-segmented id="s-row" size="1/2" value="table" items='${JSON.stringify(ROW_ITEMS)}'></sf-segmented><div class="end"></div></div>
<div id="box"><sf-segmented id="s-box" size="1" value="week" items='${JSON.stringify(BOX_ITEMS)}'></sf-segmented></div>`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();

async function open(cpu) {
  const page = await browser.newPage({viewport: {width: 1440, height: 800}});
  const said = {loopLimit: 0};
  page.on('console', (message) => { if (/update loop limit/u.test(message.text())) said.loopLimit += 1; });
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath|ResizeObserver/u.test(error.message)) failures.push({name: 'page error', cpu, said: error.message}); });
  if (cpu > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {rate: cpu});
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
    <script>window.__ro = 0; addEventListener('error', (e) => { if (/ResizeObserver/.test(e.message)) window.__ro += 1; });</script></head>
    <body style="margin:16px">${BODY}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => ['s-row', 's-box'].every((id) => document.getElementById(id)?.querySelector(':scope > .sf-button-group')));
  await page.waitForTimeout(600);
  return {page, said};
}

// Ten toggles of a container between a wide and a narrow width, a few frames
// apart: flips of data-sf-folded per change and the state after each.
const toggle = (page, id, wide, narrow, settle) => page.evaluate(async ([id, wide, narrow, settle]) => {
  const host = document.getElementById(id), box = document.getElementById(id === 's-row' ? 'row' : 'box');
  let flips = 0;
  new MutationObserver(() => { flips += 1; }).observe(host, {attributes: true, attributeFilter: ['data-sf-folded']});
  const steps = [];
  for (let i = 0; i < 10; i += 1) for (const width of [narrow, wide]) {
    flips = 0;
    box.style.inlineSize = `${width}px`;
    await new Promise((done) => setTimeout(done, settle));
    steps.push({width, flips, folded: host.hasAttribute('data-sf-folded')});
  }
  return steps;
}, [id, wide, narrow, settle]);

try {
  for (const cpu of [1, 4]) {
    const settle = cpu > 1 ? 500 : 250;
    const {page, said} = await open(cpu);
    const need = await page.evaluate(async (settle) => {
      document.getElementById('box').style.inlineSize = '1400px';
      await new Promise((done) => setTimeout(done, settle));
      return Math.ceil(document.querySelector('#s-box > .sf-button-group').getBoundingClientRect().width);
    }, settle);
    const box = await toggle(page, 's-box', need + 30, need - 30, settle);
    const fold = await page.evaluate(async (settle) => {
      const row = document.getElementById('row'), host = document.getElementById('s-row');
      for (let width = 1200; width >= 400; width -= 10) {
        row.style.inlineSize = `${width}px`;
        await new Promise((done) => setTimeout(done, settle / 2));
        if (host.hasAttribute('data-sf-folded')) return width;
      }
      return null;
    }, settle);
    check(`row folds at some width (cpu x${cpu})`, fold !== null);
    const row = fold === null ? [] : await toggle(page, 's-row', fold + 40, fold - 40, settle);
    const sweep = await page.evaluate(async (settle) => {
      const row = document.getElementById('row'), host = document.getElementById('s-row');
      let flips = 0;
      new MutationObserver(() => { flips += 1; }).observe(host, {attributes: true, attributeFilter: ['data-sf-folded']});
      const steps = [];
      for (let width = 900; width <= 1100; width += 10) {
        row.style.inlineSize = '1200px';
        await new Promise((done) => setTimeout(done, settle / 2));
        flips = 0;
        row.style.inlineSize = `${width}px`;
        await new Promise((done) => setTimeout(done, settle));
        steps.push({width, flips});
      }
      return steps;
    }, settle);
    const notices = await page.evaluate(() => window.__ro);
    const wrong = (steps, wide) => steps.filter((step) => step.folded !== (step.width !== wide));
    check(`box: each state as expected (cpu x${cpu})`, wrong(box, need + 30).length === 0, {steps: wrong(box, need + 30)});
    check(`box: one flip per change (cpu x${cpu})`, box.every((step) => step.flips === 1), {steps: box.filter((step) => step.flips !== 1)});
    check(`row: each state as expected (cpu x${cpu})`, wrong(row, fold + 40).length === 0, {steps: wrong(row, fold + 40)});
    check(`row: at most one flip per change (cpu x${cpu})`, row.every((step) => step.flips <= 1), {steps: row.filter((step) => step.flips > 1)});
    check(`sweep: at most one flip per change (cpu x${cpu})`, sweep.every((step) => step.flips <= 1), {steps: sweep.filter((step) => step.flips > 1)});
    check(`no ResizeObserver loop notice (cpu x${cpu})`, notices === 0, {notices});
    check(`no update loop limit (cpu x${cpu})`, said.loopLimit === 0, {warnings: said.loopLimit});
    evidence[`cpu x${cpu}`] = {need, fold, notices, loopLimit: said.loopLimit, boxFlips: box.reduce((sum, step) => sum + step.flips, 0),
      rowFlips: row.reduce((sum, step) => sum + step.flips, 0), sweepMaxFlips: Math.max(...sweep.map((step) => step.flips))};
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({evidence, failures}, null, 2));
if (failures.length) {
  console.error(`segmented fold loop: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('segmented fold loop: ok');
