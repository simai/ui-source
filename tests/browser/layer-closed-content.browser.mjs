#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads] [widths, e.g. 1440,390]
//
// The content of a closed sf-modal or sf-drawer (ui-control evidence
// 2026-11-11-modal-followups):
//
//   a. The page's children -- loose, slotted as content, slotted to the
//      drawer's edge -- stay in the document from the element's connection
//      to its first drawing (static holdsSlotNodesUntilDrawn): a page that
//      looked its sf-menu up by id once sf-modal was defined found nothing on
//      20 of 20 loads.
//   b. A Smart element in a closed window starts while the window is closed,
//      after the page's first paint, and is not shown: the Loader leaves a
//      closed container for later (its root is inert), so a page that waited
//      for customElements.whenDefined('sf-menu') before opening the window
//      waited for ever. A closed container inside the window (a [hidden] tab
//      panel) keeps its own deferral: its tag is not fetched.
//
// Through the real Loader, per scene, theme and width, `loads` times on an
// ordinary load and as many on a timing-hostile one (every sheet and script
// held back 0-800 ms at random, CPU x4):
//   1. whenDefined of the host: the menu (and the edge control) found by id;
//   2. whenDefined('sf-menu') settles while the window is still closed, and
//      the page gives the menu its items then;
//   3. in no frame before opening is the menu, or anything of the window,
//      shown, and once the window has drawn the text below it does not move;
//   4. the menu has drawn its rows inside the closed window; the tag in the
//      window's hidden tab panel is still not defined;
//   5. opened, the window shows the menu with its rows;
//   6. the page raised no error.
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

const ITEMS = [{id: 'a', label: 'Обзор', href: '#a'}, {id: 'b', label: 'Файлы', href: '#b'}, {id: 'c', label: 'Доступ', href: '#c'}];
// A tag nothing else on the page asks for, behind a closed tab panel.
const DEFERRED = 'sf-progress-ring';
const menu = '<sf-menu id="mm" label="Разделы"></sf-menu>';
const tab = `<div role="tabpanel" hidden><${DEFERRED} id="deferred" value="40"></${DEFERRED}></div>`;
const SCENES = {
  'modal-loose': `<sf-modal id="w" heading="Окно">${menu}<p style="margin:0">Текст окна.</p>${tab}</sf-modal>`,
  'modal-slot': `<sf-modal id="w" heading="Окно"><div slot="content">${menu}<p style="margin:0">Текст окна.</p>${tab}</div></sf-modal>`,
  'drawer-loose': `<sf-drawer id="w" title="Шторка">${menu}<p style="margin:0">Текст шторки.</p>${tab}</sf-drawer>`,
  'drawer-edge': `<sf-drawer id="w" title="Шторка"><span slot="edge" id="edge">Край</span>${menu}${tab}</sf-drawer>`,
};

const page = (scene, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>closed layer content</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'layer-closed-content', pluginListVersion: 'layer-closed-content',
    preloader: {enabled: false}, smart: {base: true}, theme: false};
  const probe = window.__probe = {hostFound: null, menuDefined: null, closedWhenDefined: null, shownFrames: 0, frames: 0, opened: false, shifts: 0, belowMoves: 0};
  const host = '${scene.startsWith('drawer') ? 'sf-drawer' : 'sf-modal'}';
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) probe.shifts += e.value; }).observe({type: 'layout-shift', buffered: true});
  customElements.whenDefined(host).then(() => {
    probe.hostFound = {menu: Boolean(document.getElementById('mm')), edge: Boolean(document.getElementById('edge'))};
  });
  customElements.whenDefined('sf-menu').then(() => {
    probe.menuDefined = Math.round(performance.now());
    const w = document.getElementById('w');
    probe.closedWhenDefined = !(w.openState ?? w.hasAttribute('open'));
    document.getElementById('mm').items = ${JSON.stringify(ITEMS)};
  });
  // What of the window shows in each frame before it opens.
  let below = null;
  const frame = () => {
    if (probe.opened) return;
    probe.frames++;
    const shown = (node) => node?.isConnected && node.checkVisibility({visibilityProperty: true, opacityProperty: true}) && node.getBoundingClientRect().width > 0;
    const panel = document.querySelector('[data-sf-modal-panel], [data-sf-drawer-panel]');
    // The menu's host is display: contents and has no box: its rows do.
    if (shown(document.querySelector('#mm li')) && !document.getElementById('mm').closest('sf-modal, sf-drawer') || shown(panel)) probe.shownFrames++;
    // Once the window has drawn (before that the page shows its content
    // where it stands, as it does before any code), nothing it starts
    // moves the page.
    const top = panel ? document.getElementById('below')?.getBoundingClientRect().top : undefined;
    if (top !== undefined) { if (below !== null && top !== below) probe.belowMoves++; below = top; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-1);color:var(--sf-on-surface)}</style>
</head><body><main><p style="margin:0">Над окном.</p>${SCENES[scene]}<p id="below" style="margin:0">Под окном.</p></main></body></html>`;

let hostile = false;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const named = /^\/([a-z-]+)\/(light|dark)$/u.exec(path);
  if (named && SCENES[named[1]]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(named[1], named[2]));
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
    if (hostile && (ext === '.css' || ext === '.js')) await new Promise((done) => setTimeout(done, Math.round(Math.random() * 800)));
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
  for (const scene of Object.keys(SCENES).filter((one) => !process.env.LAYER_SCENES || process.env.LAYER_SCENES.split(',').includes(one))) for (const theme of ['light', 'dark']) for (const width of widths) for (const mode of ['normal', 'hostile']) {
    hostile = mode === 'hostile';
    for (let load = 0; load < loads; load++) {
      const context = await browser.newContext({viewport: {width, height: 800}});
      const tab = await context.newPage();
      if (hostile) {
        const cdp = await context.newCDPSession(tab);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
      }
      const errors = [];
      tab.on('pageerror', (error) => errors.push(String(error.message)));
      tab.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });
      await tab.goto(`${base}/${scene}/${theme}`, {waitUntil: 'load'});
      await tab.waitForFunction(() => window.__probe.menuDefined !== null, null, {timeout: hostile ? 15000 : 8000}).catch(() => {});
      await tab.waitForFunction(() => document.querySelectorAll('#mm li').length >= 3, null, {timeout: 3000}).catch(() => {});
      await tab.waitForTimeout(300);
      const closed = await tab.evaluate((deferred) => ({
        ...window.__probe,
        rows: document.querySelectorAll('#mm li').length,
        deferredDefined: Boolean(customElements.get(deferred)),
        stillClosed: !document.getElementById('w').openState,
      }), DEFERRED);
      await tab.evaluate(() => { window.__probe.opened = true; document.getElementById('w').open(); });
      await tab.waitForFunction(() => {
        const row = document.querySelector('#mm li');
        return row?.checkVisibility({visibilityProperty: true, opacityProperty: true}) && document.querySelectorAll('#mm li').length >= 3;
      }, null, {timeout: 5000}).catch(() => {});
      await tab.waitForTimeout(hostile ? 600 : 300);
      const opened = await tab.evaluate(() => {
        const node = document.getElementById('mm');
        const row = node?.querySelector('li');
        return {shown: Boolean(row?.checkVisibility({visibilityProperty: true, opacityProperty: true}) && row.getBoundingClientRect().width > 0), rows: node ? node.querySelectorAll('li').length : 0,
          inLayer: Boolean(node?.closest('[data-sf-modal-panel], [data-sf-drawer-panel]')),
          // The outermost box that hides it, when it is hidden.
          hiddenBy: (() => {
            let by = '';
            for (let one = row; one && one !== document.body; one = one.parentElement) {
              const style = getComputedStyle(one);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') by = `${one.localName}.${String(one.className).split(' ')[0]} ${style.display}/${style.visibility}/${style.opacity}`;
            }
            return by;
          })()};
      });
      const bad = [];
      if (!closed.hostFound?.menu) bad.push('menu out of the document when the host was defined');
      if (scene === 'drawer-edge' && !closed.hostFound?.edge) bad.push('edge out of the document when the host was defined');
      if (closed.menuDefined === null) bad.push('whenDefined(sf-menu) never settled while closed');
      else if (!closed.closedWhenDefined) bad.push('window not closed when sf-menu was defined');
      if (!closed.stillClosed) bad.push('window opened by itself');
      if (closed.shownFrames) bad.push(`shown before opening in ${closed.shownFrames} frames`);
      if (closed.belowMoves) bad.push(`the text below moved ${closed.belowMoves} times`);
      if (closed.menuDefined !== null && closed.rows < 3) bad.push(`menu drew ${closed.rows} rows while closed`);
      if (closed.deferredDefined) bad.push(`${DEFERRED} in a hidden tab panel was fetched`);
      if (!opened.shown || opened.rows < 3 || !opened.inLayer) bad.push(`opened: ${JSON.stringify(opened)}`);
      if (errors.length) bad.push(`errors: ${errors.join(' | ').slice(0, 300)}`);
      results.push({scene, theme, width, mode, load: load + 1, closed, opened, errors, bad});
      console.log(`${scene} ${theme} ${width} ${mode} ${load + 1}: ${bad.length ? 'FAIL ' + bad.join('; ') : 'ok'} (sf-menu defined at ${closed.menuDefined} ms, ${closed.frames} closed frames, CLS ${closed.shifts.toFixed(4)})`);
      if (bad.length) failures.push(`${scene} ${theme} ${width} ${mode} ${load + 1}: ${bad.join('; ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (process.env.LAYER_PROBE_JSON) (await import('node:fs')).writeFileSync(process.env.LAYER_PROBE_JSON, JSON.stringify(results, null, 1));
console.log(JSON.stringify({loads: results.length, failures: failures.length}, null, 0));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS layer-closed-content');
