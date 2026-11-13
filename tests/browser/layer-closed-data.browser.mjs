#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads] [widths, e.g. 1440,390]
//
// A closed sf-modal or sf-drawer starts its content early, its code and not
// its data (ui-control evidence 2026-11-11-modal-followups-2-accept):
//   M2  an sf-include in the closed layer fetches its src once the layer
//       opens, never before; its code is defined while the layer is closed;
//   L2  an sf-menu the page adds to the already drawn closed layer after the
//       load is started too: whenDefined('sf-menu') settles while closed;
//   old SF_BOOT_CONFIG.startClosedLayerContent = false keeps the old timing:
//       the include fetches on opening, and the late sf-menu waits for it.
// Per scene (modal, drawer), theme and width, `loads` times in each mode.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loads = Number(process.argv[3] || 2);
const widths = (process.argv[4] || '1440,390').split(',').map(Number);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const include = '<sf-include id="inc" src="/data/frag.html"></sf-include>';
const SCENES = {
  modal: `<sf-modal id="w" heading="Окно"><div slot="content" id="box">${include}</div></sf-modal>`,
  drawer: `<sf-drawer id="w" title="Шторка"><div id="box">${include}</div></sf-drawer>`,
};
const FRAGMENT = '<p id="part" style="margin:0">Часть с сервера.</p>';

const page = (scene, theme, mode) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>closed layer data</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'layer-closed-data', pluginListVersion: 'layer-closed-data',
    preloader: {enabled: false}, smart: {base: true}, theme: false${mode === 'old' ? ', startClosedLayerContent: false' : ''}};
  const probe = window.__probe = {includeDefined: null, menuDefined: null, menuClosed: null};
  customElements.whenDefined('sf-include').then(() => { probe.includeDefined = !(document.getElementById('w').openState ?? false) ? 'closed' : 'open'; });
  // Content the page adds to the drawn, closed layer after the load.
  window.addEventListener('load', () => setTimeout(() => {
    const menu = document.createElement('sf-menu');
    menu.id = 'mm';
    menu.setAttribute('label', 'Разделы');
    document.querySelector('#box').append(menu);
    customElements.whenDefined('sf-menu').then(() => {
      probe.menuDefined = Math.round(performance.now());
      probe.menuClosed = !document.getElementById('w').openState;
    });
  }, 600));
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-1);color:var(--sf-on-surface)}</style>
</head><body><main><p style="margin:0">Над окном.</p>${SCENES[scene]}<p style="margin:0">Под окном.</p></main></body></html>`;

let fetches = 0;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/data/frag.html') {
    fetches++;
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(FRAGMENT);
  }
  const named = /^\/([a-z]+)\/(light|dark)\/(new|old)$/u.exec(path);
  if (named && SCENES[named[1]]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(named[1], named[2], named[3]));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  const file = mount && resolve(mount[1], path.slice(mount[0].length));
  if (!file || !file.startsWith(mount[1] + sep)) {
    response.writeHead(404);
    return response.end();
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream'});
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const failures = [];
const rows = [];
try {
  for (const mode of ['new', 'old']) for (const scene of Object.keys(SCENES)) for (const theme of ['light', 'dark']) for (const width of widths) for (let load = 1; load <= loads; load++) {
    const context = await browser.newContext({viewport: {width, height: 800}});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error.message)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    fetches = 0;
    await tab.goto(`${base}/${scene}/${theme}/${mode}`, {waitUntil: 'load'});
    // Long enough for the early start and the late content's walk.
    if (mode === 'new') await tab.waitForFunction(() => window.__probe.menuDefined !== null, null, {timeout: 10000}).catch(() => {});
    await tab.waitForTimeout(2500);
    const closed = await tab.evaluate(() => ({...window.__probe, stillClosed: !document.getElementById('w').openState}));
    const closedFetches = fetches;
    await tab.evaluate(() => document.getElementById('w').open());
    await tab.waitForFunction(() => document.getElementById('part')?.checkVisibility(), null, {timeout: 6000}).catch(() => {});
    await tab.waitForFunction(() => window.__probe.menuDefined !== null, null, {timeout: 6000}).catch(() => {});
    await tab.waitForTimeout(300);
    const opened = await tab.evaluate(() => ({part: Boolean(document.getElementById('part')?.checkVisibility()), menuDefined: window.__probe.menuDefined}));
    const row = {mode, scene, theme, width, load, closedFetches, openedFetches: fetches, closed, opened};
    rows.push(row);
    const bad = [];
    if (!closed.stillClosed) bad.push('opened by itself');
    if (closedFetches !== 0) bad.push(`${closedFetches} fetches of the include while closed`);
    if (fetches !== 1) bad.push(`${fetches} fetches after opening`);
    if (!opened.part) bad.push('the part is not shown after opening');
    if (mode === 'new') {
      if (closed.includeDefined !== 'closed') bad.push('sf-include code not defined while closed');
      if (closed.menuDefined === null || !closed.menuClosed) bad.push('the late sf-menu did not start while closed');
    } else {
      if (closed.includeDefined !== null) bad.push('sf-include defined before opening with the old timing');
      if (closed.menuDefined !== null) bad.push('the late sf-menu started before opening with the old timing');
      if (opened.menuDefined === null) bad.push('the late sf-menu did not start on opening');
    }
    if (errors.length) bad.push(`errors: ${errors.join(' | ').slice(0, 300)}`);
    console.log(`${mode} ${scene} ${theme} ${width} ${load}: ${bad.length ? 'FAIL ' + bad.join('; ') : 'ok'} (include fetches closed ${closedFetches}, after opening ${fetches})`);
    if (bad.length) failures.push(`${mode} ${scene} ${theme} ${width} ${load}: ${bad.join('; ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (process.env.LAYER_PROBE_JSON) (await import('node:fs')).writeFileSync(process.env.LAYER_PROBE_JSON, JSON.stringify(rows, null, 1));
console.log(JSON.stringify({loads: rows.length, failures: failures.length}));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS layer-closed-data');
