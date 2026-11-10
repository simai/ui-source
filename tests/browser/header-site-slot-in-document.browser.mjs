#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// The page's slot nodes of sf-header-site stay in the document until the bar
// draws them (pair ui-a0370c0c99fb acceptance, D1). The bar took its slot
// nodes -- the nav, the brand, the tools -- out of the page when it
// connected and put them back when it drew, one or more tasks later. A page
// that waited for customElements.whenDefined('sf-menu') and then looked its
// menu up by id got null whenever sf-menu was defined inside that gap
// (prototypes/menu-simple.html at 390: 8 of 20 loads, «Cannot set properties
// of null (setting 'items')», an empty side panel).
//
// Through the real Loader, a collapse="always" bar written into the page by
// a script (the prototype's shape), in light and in dark, `loads` times each:
//   1. when the bar connects (its sf-connected event) and on every task after
//      it until it has drawn, the menu, the brand and the tool are found by
//      id in the document;
//   2. the page's own whenDefined('sf-menu') callback finds the menu and
//      sets its items; after the drawing the menu stands in the side panel
//      with every first-level row;
//   3. sf-menu keeps its items when it is moved: taken out and put back, and
//      given new items while out of the document, it draws them when it is
//      back;
//   4. the page raised no error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loads = Number(process.argv[3] || 5);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];

const ITEMS = [
  {id: 'catalog', label: 'Каталог', href: '#catalog', children: [{id: 'pumps', label: 'Насосы', href: '#pumps'}]},
  {id: 'service', label: 'Сервис', href: '#service'},
  {id: 'about', label: 'О компании', href: '#about'},
];

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>header slots</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'header-site-slot', pluginListVersion: 'header-site-slot',
    preloader: {enabled: false}, smart: {base: true}, theme: false};
  window.__probe = {missing: [], connected: null, items: null, drawn: false, tasks: 0};
  const ids = ['m', 'brand', 'tool'];
  const look = (when) => {
    const gone = ids.filter((id) => !document.getElementById(id));
    if (gone.length) window.__probe.missing.push(when + ':' + gone.join(','));
  };
  document.addEventListener('sf-connected', (event) => {
    if (event.target.localName !== 'sf-header-site' || window.__probe.connected) return;
    window.__probe.connected = true;
    look('connected');
    // Every task after the connection until the bar has drawn.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      window.__probe.tasks++;
      look('task');
      if (!window.__probe.drawn && window.__probe.tasks < 5000) channel.port2.postMessage(0);
    };
    channel.port2.postMessage(0);
  });
  document.addEventListener('sf-after-render', (event) => {
    if (event.target.localName === 'sf-header-site') window.__probe.drawn = true;
  });
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}</style>
</head><body><div id="app"></div>
<script>
  document.getElementById('app').innerHTML = '<sf-header-site id="head" collapse="always" label="Меню">'
    + '<a slot="brand" id="brand" href="#">Технопром</a>'
    + '<sf-menu id="m" appearance="navigation" collapse="none" label="Разделы сайта"></sf-menu>'
    + '<sf-button-icon slot="tools" id="tool" icon="search" aria-label="Поиск" appearance="ghost" scheme="on-surface"></sf-button-icon>'
    + '</sf-header-site>';
  customElements.whenDefined('sf-menu').then(() => {
    const menu = document.getElementById('m');
    window.__probe.items = Boolean(menu);
    menu.items = ${JSON.stringify(ITEMS)};
  });
</script>
</body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) {
    response.writeHead(404);
    return response.end();
  }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) {
    response.writeHead(403);
    return response.end();
  }
  try {
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    response.writeHead(200, {'content-type': types[ext] || 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const failures = [];
const results = [];
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 0; load < loads; load++) {
      const context = await browser.newContext({viewport: {width: 390, height: 800}});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(String(error.message)));
      tab.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });
      await tab.goto(`${base}/${theme}`, {waitUntil: 'load'});
      await tab.waitForFunction(() => window.__probe.drawn && document.querySelector('#m li'), null, {timeout: 15000}).catch(() => {});
      await tab.waitForTimeout(300);
      const state = await tab.evaluate(async () => {
        const menu = document.getElementById('m');
        const rows = () => menu ? menu.querySelectorAll(':scope li').length : 0;
        const firstLevel = () => menu ? menu.items.length : 0;
        const result = {
          ...window.__probe,
          inPanel: Boolean(menu?.closest('.sf-site-header-panel')),
          brandPlaced: Boolean(document.getElementById('brand')?.closest('.sf-site-header-brand')),
          toolPlaced: Boolean(document.getElementById('tool')?.closest('.sf-site-header-tools')),
          strayInHost: Array.from(document.getElementById('head').children).filter((node) => node.localName !== 'header').length,
          items: firstLevel(),
          rows: rows(),
        };
        // 3. Moved: out of the document and back, the same items drawn.
        const panelNav = menu.parentElement;
        menu.remove();
        await new Promise((done) => setTimeout(done, 50));
        panelNav.append(menu);
        await new Promise((done) => setTimeout(done, 200));
        result.movedItems = firstLevel();
        result.movedRows = rows();
        // New items while it is out of the document, drawn when it is back.
        menu.remove();
        menu.items = [{id: 'one', label: 'Один', href: '#one'}, {id: 'two', label: 'Два', href: '#two'}];
        await new Promise((done) => setTimeout(done, 50));
        panelNav.append(menu);
        await new Promise((done) => setTimeout(done, 200));
        result.detachedSetItems = firstLevel();
        result.detachedSetLabels = Array.from(menu.querySelectorAll(':scope li a, :scope li button')).map((node) => node.textContent.trim()).filter(Boolean);
        return result;
      });
      state.errors = errors;
      results.push({theme, load, ...state});
      const bad = [];
      if (!state.connected) bad.push('never connected');
      if (state.missing.length) bad.push(`out of the document: ${state.missing.slice(0, 3).join(' ')}`);
      if (state.items !== ITEMS.length) bad.push(`items ${state.items}`);
      if (state.rows < ITEMS.length) bad.push(`rows ${state.rows}`);
      if (!state.inPanel || !state.brandPlaced || !state.toolPlaced) bad.push('not placed');
      if (state.strayInHost) bad.push(`${state.strayInHost} stray children in the host`);
      if (state.movedItems !== ITEMS.length || state.movedRows !== state.rows) bad.push(`moved: items ${state.movedItems} rows ${state.movedRows}`);
      if (state.detachedSetItems !== 2 || !state.detachedSetLabels.includes('Один') || !state.detachedSetLabels.includes('Два')) bad.push(`items set while out: ${state.detachedSetItems} ${state.detachedSetLabels.join('|')}`);
      if (errors.length) bad.push(`errors: ${errors.join(' | ')}`);
      console.log(`${theme} load ${load + 1}: ${bad.length ? 'FAIL ' + bad.join('; ') : 'ok'} (tasks watched ${state.tasks}, rows ${state.rows})`);
      if (bad.length) failures.push(`${theme} ${load + 1}: ${bad.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({loads: results.length, failures: failures.length}, null, 0));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS header-site-slot-in-document');
