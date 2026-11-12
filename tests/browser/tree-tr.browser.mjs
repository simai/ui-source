#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-tree defects of the tree study (owner remark R186, ui-control
// control/research/2026-11-12-tree.md), measured on the built bytes at 1440
// and 393:
//   TR-5   a branch marked has-children (data or markup) shows the chevron,
//          expand applies and sf-tree-toggle comes, so a host loads the
//          children; they arrive and the branch stays open; a file still
//          refuses; ArrowRight on an open branch with nothing loaded stays.
//   TR-14  in a 12rem column every row stays on the ladder (40 desktop, 36
//          phone), no name runs out of the column, a cut name's row carries
//          the whole name as aria-label and a Framework tooltip (hover and
//          keyboard focus show it, the pointer leaving hides it, no
//          aria-describedby repeating the name); widened, nothing is cut; a
//          sheet that arrives after the first drawing still gets its tooltips.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/tree/css/tree.css', 'component/component/tree-item/css/tree-item.css', 'component/component/tooltip/css/tooltip.css', 'component/component/icon-buttons/css/icon-buttons.css', 'component/component/icons/css/icons.css', 'smart/smart/tree/css/tree.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'component/component/tooltip/js/tooltip.js', 'smart/smart/tree/js/tree.js', 'smart/smart/tree-item/js/tree-item.js'];
const LONG = 'Протокол заседания комиссии по приёмке работ второго этапа';
const FILE = 'Очень-длинное-имя-файла-без-пробелов-годовой-отчёт-2026.pdf';
const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const [width, ladder] of [[1440, 40], [393, 36]]) {
    const page = await browser.newPage({viewport: {width, height: 800}});
    const origin = 'http://probe.test';
    const serve = (path, route) => (existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.woff2') ? 'font/woff2' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''}));
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
      return serve(join(out, url.pathname), route);
    });
    await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
      const [product, ...rest] = tail.split('/');
      return serve(join(out, product, product, ...rest), route);
    });
    await page.goto(`${origin}/`);
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
      <div id="col" style="inline-size:12rem;overflow-wrap:break-word"><sf-tree id="long" aria-label="Файлы"></sf-tree></div>
      <sf-tree id="lazy" aria-label="Папки"></sf-tree>
      <sf-tree id="markup" aria-label="Разметка"><sf-tree-item value="m1" label="Проекты" has-children></sf-tree-item><sf-tree-item value="m2" label="Отчёт.pdf" kind="file"></sf-tree-item></sf-tree>
    </body></html>`);
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
    await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'}).catch(() => {});
    await page.waitForFunction(() => customElements.get('sf-tree') && document.querySelector('#markup .sf-tree-item[data-value="m1"]'), null, {timeout: 8000});
    await page.evaluate(() => document.fonts.ready);
    const got = await page.evaluate(async ({LONG, FILE}) => {
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const r = {};
      // TR-5
      const lazy = document.getElementById('lazy');
      let source = [{id: 'p', label: 'Проекты', 'has-children': true}, {id: 'a', label: 'Архив', hasChildren: true}, {id: 'f', label: 'Отчёт.pdf', kind: 'file'}];
      lazy.items = source;
      await wait(200);
      const heard = [];
      lazy.addEventListener('sf-tree-toggle', (event) => {
        heard.push(`${event.detail.id}:${event.detail.open}`);
        if (event.detail.open && event.detail.id === 'p') {
          source = source.map((entry) => (entry.id === 'p' ? {...entry, children: [{id: 'p1', label: 'Сайт', kind: 'file'}]} : entry));
          lazy.items = source;
        }
      });
      r.chevrons = lazy.querySelectorAll('.sf-tree-toggle').length;
      r.expanded = [...lazy.querySelectorAll('[role=treeitem]')].map((row) => row.getAttribute('aria-expanded'));
      r.expand = lazy.expand({id: 'p'}).outcome;
      await wait(200);
      r.rows = [...lazy.querySelectorAll('[role=treeitem]')].map((row) => `${row.dataset.sfEntry}@${row.getAttribute('aria-level')}:${row.getAttribute('aria-expanded')}`);
      r.expandFile = lazy.expand({id: 'f'}).outcome;
      lazy.querySelector('[data-sf-entry="a"] .sf-tree-toggle')?.click();
      await wait(100);
      r.heard = heard;
      const archive = lazy.querySelector('[data-sf-entry="a"]');
      archive.focus();
      archive.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
      await wait(50);
      r.focusAfterRight = document.activeElement?.dataset?.sfEntry;
      const markup = document.getElementById('markup');
      r.markupChevrons = markup.querySelectorAll('.sf-tree-toggle').length;
      r.markupExpand = markup.expand({id: 'm1'}).outcome;
      // TR-14
      const long = document.getElementById('long');
      long.items = [
        {id: 'd', label: 'Документы', open: true, children: [{id: 'l1', label: FILE, kind: 'file'}, {id: 's1', label: 'a.txt', kind: 'file'}]},
        {id: 'l2', label: LONG, kind: 'file'},
        {id: 's2', label: 'Фото', kind: 'file'},
      ];
      await wait(400);
      const column = document.getElementById('col').getBoundingClientRect();
      r.names = [...long.querySelectorAll('[role=treeitem]')].map((row) => {
        const name = row.querySelector('.sf-tree-item-name');
        return {
          id: row.dataset.sfEntry,
          height: Math.round(row.querySelector('.sf-tree-item-container').getBoundingClientRect().height),
          past: Math.round(name.getBoundingClientRect().right - column.right),
          cut: name.scrollWidth > name.clientWidth,
          label: row.getAttribute('aria-label'),
          tip: row.getAttribute('data-tooltip'),
          described: row.getAttribute('aria-describedby'),
        };
      });
      const row = long.querySelector('[data-sf-entry="l2"]');
      row.dispatchEvent(new PointerEvent('pointerenter', {pointerType: 'mouse'}));
      await wait(100);
      const surface = row.getAttribute('data-tooltip') && document.getElementById(row.getAttribute('data-tooltip'));
      r.hover = surface ? {shown: !surface.hidden, text: surface.textContent.trim(), role: surface.getAttribute('role')} : null;
      row.dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'mouse'}));
      await wait(50);
      r.leftHidden = surface ? surface.hidden : null;
      document.getElementById('col').style.inlineSize = '60rem';
      await wait(400);
      r.widened = [...long.querySelectorAll('[role=treeitem]')].filter((one) => one.hasAttribute('data-tooltip')).length;
      document.getElementById('col').style.inlineSize = '12rem';
      await wait(400);
      return r;
    }, {LONG, FILE});
    await page.focus('#long [data-sf-entry="d"]');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    got.keyboard = await page.evaluate(() => {
      const row = document.activeElement;
      const surface = row?.getAttribute('data-tooltip') && document.getElementById(row.getAttribute('data-tooltip'));
      return {row: row?.dataset?.sfEntry, shown: surface ? !surface.hidden : null};
    });
    got.lateSheet = await page.evaluate(async (LONG) => {
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const hold = document.createElement('style');
      hold.textContent = 'sf-tree#late > .sf-tree .sf-tree-item-name{white-space:normal!important}';
      document.head.append(hold);
      const box = document.createElement('div');
      box.style.inlineSize = '12rem';
      box.innerHTML = '<sf-tree id="late" aria-label="Поздно"></sf-tree>';
      document.body.append(box);
      box.firstElementChild.items = [{id: 'x', label: LONG, kind: 'file'}];
      await wait(300);
      const before = box.querySelector('[data-sf-entry="x"]').hasAttribute('data-tooltip');
      hold.remove();
      await wait(300);
      return {before, after: box.querySelector('[data-sf-entry="x"]').hasAttribute('data-tooltip')};
    }, LONG);
    report[width] = got;
    const at = (name) => `${width}: ${name}`;
    if (got.chevrons !== 2 || got.expanded.join() !== 'false,false,') failures.push({case: at('TR-5 has-children branches show the chevron and aria-expanded'), got: [got.chevrons, got.expanded]});
    if (got.expand !== 'applied' || got.rows.join() !== 'p@1:true,p1@2:null,a@1:false,f@1:null') failures.push({case: at('TR-5 expand applies; the loaded children arrive under the open branch'), got: [got.expand, got.rows]});
    if (got.heard.join() !== 'p:true,a:true') failures.push({case: at('TR-5 sf-tree-toggle comes for a branch with nothing loaded (expand and the chevron)'), got: got.heard});
    if (got.expandFile !== 'refused') failures.push({case: at('TR-5 a file is never a branch'), got: got.expandFile});
    if (got.focusAfterRight !== 'a') failures.push({case: at('TR-5 ArrowRight on an open branch with nothing loaded stays'), got: got.focusAfterRight});
    if (got.markupChevrons !== 1 || got.markupExpand !== 'applied') failures.push({case: at('TR-5 <sf-tree-item has-children> in markup'), got: [got.markupChevrons, got.markupExpand]});
    const tall = got.names.filter((name) => name.height !== ladder);
    if (tall.length) failures.push({case: at(`TR-14 every row is ${ladder}px`), got: tall});
    const past = got.names.filter((name) => name.past > 0);
    if (past.length) failures.push({case: at('TR-14 no name runs out of the column'), got: past});
    const long = got.names.filter((name) => ['l1', 'l2'].includes(name.id));
    if (!long.every((name) => name.cut && name.tip && name.label === (name.id === 'l1' ? FILE : LONG) && !name.described)) failures.push({case: at('TR-14 a cut name: aria-label is the whole name, a tooltip, no repeating description'), got: long});
    const short = got.names.filter((name) => ['s1', 's2'].includes(name.id));
    // A name that fits has no tooltip. s2 is a root row and fits; s1 stands a
    // level in, and in this 12rem column at 1440 the C109 step (chevron +
    // H2 gap, 36) leaves its name 28 px, so «a.txt» may be cut there: whether
    // it is, its tooltip must agree with it.
    if (short.some((name) => (name.id === 's2' && name.cut) || Boolean(name.tip) !== name.cut || Boolean(name.label) !== name.cut)) failures.push({case: at('TR-14 a name that fits has no tooltip'), got: short});
    if (!got.hover || !got.hover.shown || got.hover.text !== LONG || got.hover.role !== 'tooltip' || got.leftHidden !== true) failures.push({case: at('TR-14 hover shows the whole name, leaving hides it'), got: [got.hover, got.leftHidden]});
    if (got.keyboard.row !== 'l1' || got.keyboard.shown !== true) failures.push({case: at('TR-14 keyboard focus shows the tooltip'), got: got.keyboard});
    if (got.widened !== 0) failures.push({case: at('TR-14 widened, nothing is cut'), got: got.widened});
    if (got.lateSheet.after !== true) failures.push({case: at('TR-14 a late sheet still gets the tooltip'), got: got.lateSheet});
    await page.close();
  }
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TREE_TR_OK');
