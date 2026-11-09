#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-tree at size (simai/ui-source#43; standard simai.smart-component 1.3.8
// §18.4, quality profile gate 17): 2 000 and 10 000 entries, measured on the
// built bytes in headless Chromium, CPU x1. Each number is the time to a
// stable DOM -- from the call until the tree's rows say the change and no
// mutation came in the last frame, that frame included -- the method of
// simai/ui-control stand 20 (bench.mjs), median of RUNS (default 3).
//
// Budgets: the first draw of 2 000 entries under 1 000 ms; one change --
// a new items with one label changed, a branch expanded and collapsed, one
// entry selected, one more checked in a tree of selection="many", every entry
// checked by selected-ids -- under 50 ms, and the rows a change rewrites a
// handful, not the tree: a change that redraws every drawn row fails here.
//
// Three shapes: the stand's 40 x 49 tree all open (2 000), 200 x 49 all open
// (10 000), and 10 000 with every branch closed, where an expand draws one
// branch's 49 rows into a short list (no window).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const RUNS = Number(process.env.RUNS || 3);
const FIRST_BUDGET = 1000;
const CHANGE_BUDGET = 50;
// Rows a single-entry change may touch: the entry, its neighbours whose
// tabindex moves, and the rows a window shift brings in or out.
const ROWS_BUDGET = 8;
const styles = ['core/core/css/core.css', 'component/component/tree/css/tree.css', 'component/component/tree-item/css/tree-item.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/tree/js/tree.js', 'smart/smart/tree-item/js/tree-item.js'];
const failures = [];
const report = {runs: RUNS, budgets: {first: FIRST_BUDGET, change: CHANGE_BUDGET, rows: ROWS_BUDGET}, cases: {}};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 800}});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
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
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0"><main id="stage"></main></body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-tree'), null, {timeout: 15000});

  // The in-page harness.
  await page.evaluate(() => {
    const now = () => performance.now();
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(now())));
    const stage = () => document.getElementById('stage');
    // Time to a stable DOM, and the rows the change touched: every treeitem
    // added, removed, or with a mutation inside it.
    async function settle(t0, root, done, timeout = 120000) {
      let last = t0;
      const rows = new Set();
      let added = 0;
      let removed = 0;
      const rowOf = (node) => (node.nodeType === 1 ? node : node.parentElement)?.closest?.('[role="treeitem"]');
      const observer = new MutationObserver((list) => {
        last = now();
        for (const m of list) {
          if (m.type === 'childList') {
            for (const n of m.addedNodes) if (n.nodeType === 1 && n.matches('[role="treeitem"]')) added += 1;
            for (const n of m.removedNodes) if (n.nodeType === 1 && n.matches('[role="treeitem"]')) removed += 1;
          }
          const row = rowOf(m.target);
          if (row) rows.add(row);
        }
      });
      observer.observe(root, {subtree: true, childList: true, attributes: true, characterData: true});
      let seen = -1;
      for (;;) {
        const at = await frame();
        if (done() && last === seen) { observer.disconnect(); return {ms: Math.round((at - t0) * 10) / 10, rowsTouched: rows.size, added, removed}; }
        seen = last;
        if (at - t0 > timeout) { observer.disconnect(); return {ms: Math.round(at - t0), timeout: true, rowsTouched: rows.size, added, removed}; }
      }
    }
    const shapes = {
      open2000: (label) => Array.from({length: 40}, (_, g) => ({label: g === 0 ? label : `Папка ${g + 1}`, value: `f${g}`, open: true, children: Array.from({length: 49}, (_, c) => ({label: `Документ ${g + 1}.${c + 1}`, value: `f${g}-${c}`, kind: 'file'}))})),
      open10000: (label) => Array.from({length: 200}, (_, g) => ({label: g === 0 ? label : `Папка ${g + 1}`, value: `f${g}`, open: true, children: Array.from({length: 49}, (_, c) => ({label: `Документ ${g + 1}.${c + 1}`, value: `f${g}-${c}`, kind: 'file'}))})),
      closed10000: (label) => Array.from({length: 200}, (_, g) => ({label: g === 0 ? label : `Папка ${g + 1}`, value: `f${g}`, children: Array.from({length: 49}, (_, c) => ({label: `Документ ${g + 1}.${c + 1}`, value: `f${g}-${c}`, kind: 'file'}))})),
    };
    const row = (tree, value) => tree.querySelector(`[role="treeitem"][data-value="${value}"]`);
    const name = (tree, value) => row(tree, value)?.querySelector('.sf-tree-item-name')?.textContent ?? '';
    let tree = null;
    window.__treeScale = {
      async first(shape, selection) {
        tree?.remove();
        await frame();
        const items = shapes[shape]('Папка 1');
        const t0 = now();
        tree = document.createElement('sf-tree');
        tree.setAttribute('aria-label', 'Структура');
        if (selection) tree.setAttribute('selection', selection);
        tree.items = items;
        stage().append(tree);
        const result = await settle(t0, stage(), () => name(tree, 'f0') === 'Папка 1');
        return {...result, drawn: tree.querySelectorAll('[role="treeitem"]').length};
      },
      async relabel(shape) {
        const label = `Изменено ${Math.random().toString(36).slice(2, 8)}`;
        const items = shapes[shape](label);
        const t0 = now();
        tree.items = items;
        return settle(t0, tree, () => name(tree, 'f0') === label);
      },
      async toggle(value, open) {
        const t0 = now();
        row(tree, value).querySelector('.sf-tree-toggle').click();
        return settle(t0, tree, () => row(tree, value)?.getAttribute('aria-expanded') === String(open));
      },
      async select(value) {
        const t0 = now();
        row(tree, value).querySelector('.sf-tree-item-name').click();
        return settle(t0, tree, () => row(tree, value)?.getAttribute('aria-selected') === 'true');
      },
      async unselect(value) {
        const t0 = now();
        row(tree, value).querySelector('.sf-tree-item-name').click();
        return settle(t0, tree, () => row(tree, value)?.getAttribute('aria-selected') === 'false');
      },
      async key(value, key, expect) {
        row(tree, value).focus();
        await frame();
        const t0 = now();
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
        return settle(t0, tree, () => document.activeElement?.dataset?.value === expect);
      },
      async checkAll(values) {
        const t0 = now();
        tree.selectedIds = values;
        return settle(t0, tree, () => row(tree, 'f0-0')?.getAttribute('aria-selected') === 'true');
      },
      values(count) { return Array.from({length: count}, (_, i) => `f${Math.floor(i / 49)}-${i % 49}`); },
    };
  });

  const median = (list) => { const sorted = [...list].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const run = async (label, fn, budget) => {
    const results = [];
    for (let i = 0; i < RUNS; i += 1) results.push(await fn(i));
    const ms = median(results.map((one) => one.ms));
    const rowsTouched = Math.max(...results.map((one) => one.rowsTouched ?? 0));
    const entry = {ms, rowsTouched, samples: results.map((one) => one.ms), drawn: results[0].drawn};
    report.cases[label] = entry;
    if (results.some((one) => one.timeout)) failures.push({case: label, reason: 'timeout', entry});
    else if (ms > budget) failures.push({case: label, reason: `median ${ms} ms over ${budget} ms`, entry});
    console.log(`${label}: ${ms} ms, rows touched ${rowsTouched}${entry.drawn !== undefined ? `, drawn ${entry.drawn}` : ''}`);
    return entry;
  };
  const call = (method, ...args) => page.evaluate(([m, a]) => window.__treeScale[m](...a), [method, args]);
  const changeCase = async (label, fn) => {
    const entry = await run(label, fn, CHANGE_BUDGET);
    if (entry.rowsTouched > ROWS_BUDGET) failures.push({case: label, reason: `${entry.rowsTouched} rows rewritten for one change (budget ${ROWS_BUDGET})`, entry});
  };

  for (const shape of ['open2000', 'open10000']) {
    const n = shape === 'open2000' ? 2000 : 10000;
    await run(`${n} open: first draw`, () => call('first', shape, 'one'), n === 2000 ? FIRST_BUDGET : FIRST_BUDGET * 2);
    await call('first', shape, 'one');
    await changeCase(`${n} open: items with one label changed`, () => call('relabel', shape));
    await changeCase(`${n} open: collapse a branch`, async () => { const r = await call('toggle', 'f0', false); await call('toggle', 'f0', true); return r; });
    await changeCase(`${n} open: expand a branch`, async () => { await call('toggle', 'f0', false); return call('toggle', 'f0', true); });
    await changeCase(`${n} open: select one`, (i) => call('select', `f0-${i + 1}`));
    await changeCase(`${n} open: ArrowDown`, (i) => call('key', `f0-${i + 1}`, 'ArrowDown', `f0-${i + 2}`));
    await call('first', shape, 'many');
    await changeCase(`${n} open, many: check one`, (i) => call('select', `f0-${i + 1}`));
    await run(`${n} open, many: check every entry`, async () => call('checkAll', await call('values', n - n / 50)), CHANGE_BUDGET);
    await changeCase(`${n} open, many all checked: uncheck one`, (i) => call('unselect', `f0-${i + 1}`));
    await changeCase(`${n} open, many all checked: check it again`, (i) => call('select', `f0-${i + 1}`));
  }
  await run('10000 closed: first draw', () => call('first', 'closed10000', 'one'), FIRST_BUDGET);
  await call('first', 'closed10000', 'one');
  await changeCase('10000 closed: expand a branch', async (i) => { const r = await call('toggle', `f${i + 1}`, true); await call('toggle', `f${i + 1}`, false); return r; });

  report.consoleErrors = errors;
  if (errors.length) failures.push({case: 'console', errors});
} finally {
  await browser.close();
}
console.log(JSON.stringify(report));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TREE_SCALE_OK');
