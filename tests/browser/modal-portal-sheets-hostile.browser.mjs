#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// An open sf-modal under held-back sheets (ui-control evidence
// 2026-11-11-modal-followups-accept, L2): the window's portal stays out of
// view until the sheets it draws with are applied, also when they come after
// the host gate's 3 s (styleReadyTimeout); it never shows as a card in the
// page flow. Through the real Loader, every frame from the first until the
// window settles:
//   hostile  every sheet and script held back 200-1200 ms (seeded per load);
//            centre, right, left, [autofocus] x 1440 / 1440 compact / 390
//            touch x light / dark x `loads` (3: 72 loads);
//   late     the same, and the modal's own sheets held back 3.5-5 s, past
//            the host gate (centre, right x the three views x light/dark x
//            `loads`: 36 loads).
// Per load: no frame where the window's surface is visible outside its fixed
// layer; at the end the window shows in its layer with the focus inside it;
// the page raised no error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loads = Number(process.argv[3] || 3);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];

const body = '<p slot="content" style="margin:0">Текст окна.</p><div slot="footer"><sf-button>Применить</sf-button></div>';
const SCENES = {
  centre: `<sf-modal heading="Окно" open>${body}</sf-modal>`,
  right: `<sf-modal position="right" heading="Фильтры" open>${body}</sf-modal>`,
  left: `<sf-modal position="left" heading="Разделы" open>${body}</sf-modal>`,
  autofocus: '<sf-modal heading="Имя" open><div slot="content"><input id="nm" autofocus class="sf-input" aria-label="Имя"></div></sf-modal>',
};
const VIEWS = [['1440', 1440, false, false], ['1440c', 1440, true, false], ['390', 390, false, true]];

const page = (scene, theme, compact) => `<!doctype html><html lang="ru" class="theme-${theme}"${compact ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><title>modal portal sheets</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'modal-portal-sheets', pluginListVersion: 'modal-portal-sheets',
    preloader: {enabled: false}, smart: {base: true}, theme: false};
  const probe = window.__probe = {frames: 0, card: 0, firstCard: null, shownAt: null, errors: []};
  window.addEventListener('error', (event) => probe.errors.push(String(event.message)));
  const t0 = performance.now();
  const frame = (t) => {
    probe.frames++;
    const surface = document.querySelector('[data-sf-modal-surface]');
    if (surface) {
      const r = surface.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && surface.checkVisibility({visibilityProperty: true, opacityProperty: true});
      const root = surface.closest('.sf-modal');
      const layer = root && getComputedStyle(root).position === 'fixed';
      if (visible && !layer) { probe.card++; probe.firstCard ??= Math.round(t - t0); }
      if (visible && layer) probe.shownAt ??= Math.round(t - t0);
    }
    if (t - t0 < 8000) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-1);color:var(--sf-on-surface)}</style>
</head><body><main><p style="margin:0">Страница над окном.</p>${SCENES[scene]}<p style="margin:0">Страница под окном.</p></main></body></html>`;

let seed = 7;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let delay = () => 0;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const named = /^\/([a-z]+)\/(light|dark)\/(0|1)$/u.exec(path);
  if (named && SCENES[named[1]]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(named[1], named[2], named[3] === '1'));
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
    const content = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    const wait = delay(path, ext);
    if (wait) await new Promise((done) => setTimeout(done, wait));
    response.writeHead(200, {'content-type': types[ext] || 'application/octet-stream'});
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
const results = [];
const runs = [];
for (const scene of Object.keys(SCENES)) for (const view of VIEWS) for (const theme of ['light', 'dark']) runs.push(['hostile', scene, view, theme]);
for (const scene of ['centre', 'right']) for (const view of VIEWS) for (const theme of ['light', 'dark']) runs.push(['late', scene, view, theme]);
try {
  for (const [mode, scene, [view, width, compact, touch], theme] of runs) for (let load = 1; load <= loads; load++) {
    const salt = Math.floor(random() * 1000);
    const late = 3500 + Math.floor(random() * 1500);
    delay = (path, ext) => {
      if (ext !== '.css' && ext !== '.js') return 0;
      if (mode === 'late' && /\/modal\//u.test(path) && ext === '.css') return late;
      return 200 + ((path.length * 37 + salt) % 1000);
    };
    const context = await browser.newContext({viewport: {width, height: 900}, isMobile: touch, hasTouch: touch});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`${base}/${scene}/${theme}/${compact ? 1 : 0}`);
    await tab.waitForFunction(() => window.__probe.shownAt !== null, null, {timeout: 12000}).catch(() => {});
    await tab.waitForTimeout(400);
    const probe = await tab.evaluate(() => ({
      ...window.__probe,
      focus: (() => {
        const a = document.activeElement;
        return a?.closest('[data-sf-modal-panel]') ? (a.id || a.localName) : `page:${a?.localName}`;
      })(),
    }));
    await context.close();
    const name = `${mode} ${scene} ${view} ${theme} #${load}`;
    const row = {name, card: probe.card, firstCard: probe.firstCard, shownAt: probe.shownAt, frames: probe.frames, focus: probe.focus, late: mode === 'late' ? late : null};
    results.push(row);
    if (probe.card) failures.push({...row, failed: 'a card in the page flow'});
    if (probe.shownAt === null) failures.push({...row, failed: 'the window never showed in its layer'});
    if (probe.focus.startsWith('page:')) failures.push({...row, failed: 'the focus is not in the window'});
    if (scene === 'autofocus' && probe.focus !== 'nm') failures.push({...row, failed: 'the [autofocus] field has not the focus'});
    if (mode === 'late' && probe.shownAt !== null && probe.shownAt < late) failures.push({...row, failed: 'shown before its sheets'});
    if (errors.length || probe.errors.length) failures.push({...row, failed: 'page error', errors: [...errors, ...probe.errors]});
  }
} finally {
  await browser.close();
  server.close();
}

const summary = {loads: results.length, cardLoads: results.filter((row) => row.card).length, cardFrames: results.reduce((sum, row) => sum + row.card, 0),
  shownAt: {min: Math.min(...results.map((row) => row.shownAt ?? Infinity)), max: Math.max(...results.map((row) => row.shownAt ?? 0))}};
console.log(JSON.stringify({summary, results: process.env.MODAL_PORTAL_ROWS ? results : undefined}, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('MODAL_PORTAL_SHEETS_OK');
