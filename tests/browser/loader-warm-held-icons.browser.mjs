#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// R078: with a warm profile (the icon subset remembered in localStorage) and
// the icon host held 25 s, the Loader splash never lifted. The core runtime
// asked for the remembered font during parse (a <link rel=preload> and an
// @font-face url), a pending font held the window's load event, the page scan
// waited for load, so sf-loader-ready never came, and the splash hid only on
// that event.
//
// Through the real core runtime and Loader against a subset service served
// here. The page has the splash on (the default preloader, no first-paint
// markup) and Smart icon controls.
//
//   held     -- three loads, each in a fresh context seeded with a remembered
//               manifest whose font file the service holds for HELD_MS. The
//               splash is gone within SPLASH_MS of navigation, sf-loader-ready
//               comes within READY_MS, the window's load does not wait for the
//               held font, and every icon draws within ICONS_MS (the full font
//               after the subset deadline).
//   healthy  -- three loads, the same page with a fast service: cold (fresh
//               context, nothing remembered), then warm (remembered, font in
//               the HTTP cache). The splash goes on sf-loader-ready, within
//               SPLASH_MS, and every icon draws.
//
// No page error and no console error in any load.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const HELD_MS = 25000;
const CSS_MS = 150;
const FONT_MS = 150;
const SPLASH_MS = 1500;
const READY_MS = 1500;
const ICONS_MS = 6000;
const ICONS = ['menu', 'search', 'settings', 'star'];

const page = () => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>warm held icons</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'loader-warm-held-icons', pluginListVersion: 'loader-warm-held-icons',
    icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}};
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:flex;gap:16px;padding:16px;align-items:center}</style>
</head><body><main id="main">
<sf-button-icon id="b-menu" kind="ghost" aria-label="Меню" icon="menu"></sf-button-icon>
<sf-button id="b-search" icon-start="search" text="Найти"></sf-button>
<sf-icon id="i-settings" icon="settings"></sf-icon>
<sf-button-icon id="b-star" kind="ghost" aria-label="В избранное" icon="star"></sf-button-icon>
</main></body></html>`;

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);
const fontBytes = await readFile(fontFile);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let base = '';
let held = false;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const manifestFor = (icons, fontUrl) => ({hash: `probe-${icons.join('-')}`, mode: 'static-weight', type: 'outlined', origin: null,
  family: 'Material Symbols Outlined', iconCount: icons.length, icons,
  axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}}, fonts: [{hash: 'probe', weight: 400, url: fontUrl}]});
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page());
  }
  const cors = {'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-SIMAI-Font-Manifest'};
  if (path === '/subset/ms/css') {
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    await sleep(held ? HELD_MS : CSS_MS);
    if (response.destroyed) return undefined;
    const fontUrl = `${base}/subset/ms/font/subset-${icons.join('-')}.woff2`;
    const header = Buffer.from(JSON.stringify(manifestFor(icons, fontUrl))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    response.writeHead(200, {...cors, 'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header, 'cache-control': 'public, max-age=3600'});
    return response.end(`@font-face {
  font-family: 'Material Symbols Outlined Subset';
  src: url('${fontUrl}') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}
`);
  }
  if (path.startsWith('/subset/ms/font/')) {
    await sleep(held ? HELD_MS : FONT_MS);
    if (response.destroyed) return undefined;
    response.writeHead(200, {...cors, 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable'});
    return response.end(fontBytes);
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
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-cache'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

// Times from navigation start: the splash's last visible frame, sf-loader-ready,
// load, and when every icon drew.
const WATCH = `(() => {
  const marks = {splashSeen: null, splashGone: null, ready: null, load: null, iconsDrawn: null};
  window.__marks = marks;
  window.addEventListener('sf-loader-ready', () => { marks.ready = Math.round(performance.now()); });
  window.addEventListener('load', () => { marks.load = Math.round(performance.now()); });
  const visible = () => [...document.querySelectorAll('.sf-loader')].some((el) => {
    if (el.classList.contains('hidden')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  });
  const drawn = () => {
    const icons = [...document.querySelectorAll('main sf-icon')];
    return icons.length >= ${ICONS.length} && icons.every((el) => {
      const glyph = el.querySelector(':scope > i.sf-icon');
      if (!glyph || el.loaded !== true || !glyph.classList.contains('sf-icon-loaded')) return false;
      const style = getComputedStyle(glyph);
      const size = parseFloat(style.fontSize);
      const range = document.createRange();
      range.selectNodeContents(glyph);
      const width = range.getBoundingClientRect().width;
      let check = false;
      try { check = document.fonts.check(style.fontWeight + ' ' + size + 'px ' + style.fontFamily, el.getAttribute('icon')); } catch {}
      return size > 0 && Math.abs(width - size) <= 1.5 && check;
    });
  };
  const tick = () => {
    const t = Math.round(performance.now());
    if (visible()) { if (marks.splashSeen === null) marks.splashSeen = t; marks.splashGone = null; }
    else if (marks.splashSeen !== null && marks.splashGone === null) marks.splashGone = t;
    if (marks.iconsDrawn === null && document.body && drawn()) marks.iconsDrawn = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const failures = [];
const evidence = {held: [], healthy: []};
const browser = await chromium.launch();
try {
  const run = async ({scenario, context, seed, label}) => {
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error.message || error)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    if (seed) {
      await tab.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch {} },
        ['SF_ICON_SUBSET_MANIFEST', JSON.stringify(manifestFor([...ICONS].sort(), `${base}/subset/ms/font/remembered.woff2`))]);
    }
    await tab.addInitScript(WATCH);
    await tab.goto(`${base}/page`, {waitUntil: 'commit'});
    await sleep(ICONS_MS + 500);
    const marks = await tab.evaluate(() => window.__marks);
    const row = {label, ...marks, errors: errors.filter((text) => !/ERR_ABORTED|net::/u.test(text)).slice(0, 4)};
    evidence[scenario].push(row);
    const gone = marks.splashSeen === null ? 0 : marks.splashGone;
    if (gone === null || gone > SPLASH_MS) failures.push(`${label}: splash still up at ${gone ?? 'the end'} (limit ${SPLASH_MS} ms)`);
    if (marks.ready === null || marks.ready > READY_MS) failures.push(`${label}: sf-loader-ready at ${marks.ready} (limit ${READY_MS} ms)`);
    if (marks.iconsDrawn === null || marks.iconsDrawn > ICONS_MS) failures.push(`${label}: icons drawn at ${marks.iconsDrawn} (limit ${ICONS_MS} ms)`);
    if (scenario === 'held' && (marks.load === null || marks.load > READY_MS)) failures.push(`${label}: window load at ${marks.load} (the held font holds it)`);
    if (row.errors.length) failures.push(`${label}: console errors ${JSON.stringify(row.errors)}`);
    await tab.close();
  };

  held = true;
  for (let load = 1; load <= LOADS; load += 1) {
    const context = await browser.newContext();
    await run({scenario: 'held', context, seed: true, label: `held ${load}`});
    await context.close();
  }
  held = false;
  const context = await browser.newContext();
  await run({scenario: 'healthy', context, seed: false, label: 'healthy cold'});
  for (let load = 2; load <= LOADS; load += 1) {
    await run({scenario: 'healthy', context, seed: false, label: `healthy warm ${load}`});
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
  server.closeAllConnections?.();
}

console.log(JSON.stringify({probe: 'loader-warm-held-icons', passed: failures.length === 0, failures, evidence}, null, 1));
process.exit(failures.length ? 1 : 0);
