#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Icons that are not in the page's first icon font request still draw.
// Larena (pairs ui-b4a77681f0a7, ui-0c23; admin) saw sf-icon elements inside
// sf-button-icon in a segmented control and in a toolbar never marked
// sf-icon-loaded, so they stayed hidden: bookmark_add, keyboard_arrow_down,
// more_vert, settings and star, each one absent from the first request.
//
// The same toolbar runs in Larena's icon mode too (icons.enabled = false,
// the local full font, "bundled-fallback"): printed with the page, late, and
// re-rendered (local-early, local-late, local-re-render).
//
// Through the real Loader against a subset service served here (it answers
// any request with the distribution's full Material Symbols font and lists
// the names it was asked for, as the real one does). The page holds an
// sf-button with search; an sf-segmented with icon items and a toolbar of
// sf-button-icon arrive later, in three ways:
//   late      -- after the first request came back and its glyph drew;
//   in-flight -- while the first request is on the way (its answer held 600 ms);
//   re-render -- late, and the segmented control's items are set again and a
//                toolbar button's icon changes before the new subset is in.
// In light and dark, for each: every sf-icon in the segmented control and the
// toolbar is marked loaded (its glyph .sf-icon-loaded, the element's loaded
// value true) and lays out one glyph wide within 2500 ms of arriving (the
// first-paint budget of the icon hold); the names reached a request after the
// first; the page raised no error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const BUDGET_MS = 2500;
const SEGMENT_ICONS = ['star', 'settings'];
const TOOLBAR_ICONS = ['bookmark_add', 'keyboard_arrow_down', 'more_vert'];
const LATE = [...SEGMENT_ICONS, ...TOOLBAR_ICONS];
let holdFirstMs = 0;

const page = (theme, local = false, early = false) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>late icons</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icons-late-toolbar', pluginListVersion: 'icons-late-toolbar',
    preloader: {enabled: false}, icons: ${local ? '{enabled: false, accumulate: false}' : "{subsetHost: location.origin + '/subset'}"}, smart: {base: true}, theme: false};
</script>
${local ? '<script>document.documentElement.dataset.sfIconRuntime = "bundled-fallback";</script>' : ''}
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:center}</style>
</head><body><main id="main"><sf-button text="Найти" icon-start="search"></sf-button>${early ? LATE_MARKUP : ''}</main></body></html>`;

const LATE_MARKUP = `<sf-segmented id="seg" aria-label="Вид" value="star"></sf-segmented>
<div id="toolbar" role="toolbar" aria-label="Действия" style="display:flex;gap:4px">
${TOOLBAR_ICONS.map((icon) => `<sf-button-icon icon="${icon}" kind="ghost" aria-label="${icon}"></sf-button-icon>`).join('\n')}
</div>`;
const SEGMENT_ITEMS = SEGMENT_ICONS.map((icon) => ({value: icon, label: icon, icon, 'icon-only': true}));

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);

// Each icon_names request of a page, in order.
let requests = [];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
let base = '';
let cuts = 0;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const [, theme, variant] = /^\/(light|dark)(?:-(local|local-early))?$/u.exec(path) || [];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme, Boolean(variant), variant === 'local-early'));
  }
  if (path === '/subset/ms/css') {
    const index = cuts++;
    // The first answer can be held back, so later icons arrive while it is in flight.
    if (index === 0 && holdFirstMs) await new Promise((done) => setTimeout(done, holdFirstMs));
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    requests.push(icons);
    const fontUrl = `${base}/subset/ms/font/subset-${index}.woff2`;
    const manifest = {hash: `probe-${index}`, mode: 'static-weight', type: 'outlined', origin: null,
      family: 'Material Symbols Outlined', iconCount: icons.length, icons,
      axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}}, fonts: [{hash: `probe-${index}`, weight: 400, url: fontUrl}]};
    const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header,
      'access-control-expose-headers': 'X-SIMAI-Font-Manifest'});
    return response.end(`@font-face {
  font-family: 'Material Symbols Outlined Subset';
  src: url('${fontUrl}') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}

.sf-icon {
  font-family: 'Material Symbols Outlined Subset';
  font-weight: var(--sf-icon--weight, 400);
  font-style: normal;
  line-height: 1;
  display: inline-flex;
  white-space: nowrap;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' var(--sf-icon--fill, 0), 'wght' var(--sf-icon--weight, 400), 'GRAD' var(--sf-icon--grade, 0), 'opsz' var(--sf-icon--optical-size, 24);
}
`);
  }
  if (path.startsWith('/subset/ms/font/')) {
    response.writeHead(200, {'content-type': 'font/woff2'});
    return response.end(await readFile(fontFile));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

const READ = () => [...document.querySelectorAll('#seg sf-icon, #toolbar sf-icon')].map((element) => {
  const glyph = element.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon');
  const text = glyph?.textContent.trim() || '';
  let width = 0;
  if (glyph) {
    const range = document.createRange();
    range.selectNodeContents(glyph);
    width = Math.round(range.getBoundingClientRect().width * 10) / 10;
  }
  const fontSize = glyph ? parseFloat(getComputedStyle(glyph).fontSize) : 0;
  return {icon: element.getAttribute('icon'), text, glyphLoaded: Boolean(glyph?.classList.contains('sf-icon-loaded')),
    loaded: element.loaded === true, width, fontSize, visibility: glyph ? getComputedStyle(glyph).visibility : 'none'};
});
const settled = (rows) => rows.length === LATE.length && rows.every((row) =>
  row.glyphLoaded && row.loaded && row.visibility !== 'hidden' && row.fontSize > 0 && Math.abs(row.width - row.fontSize) <= 1.5);

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const mode of ['late', 'in-flight', 're-render', 'local-late', 'local-early', 'local-re-render']) {
      const local = mode.startsWith('local');
      const label = `${theme} ${mode}`;
      const tab = await browser.newPage({viewport: {width: 900, height: 300}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      requests = [];
      holdFirstMs = mode === 'in-flight' ? 600 : 0;
      const started = Date.now();
      await tab.goto(`${base}/${theme}${local ? (mode === 'local-early' ? '-local-early' : '-local') : ''}`);
      if (mode === 'local-early') {
        await tab.evaluate((items) => customElements.whenDefined('sf-segmented').then(() => { document.getElementById('seg').items = items; }), SEGMENT_ITEMS);
      } else if (mode === 'in-flight') {
        const until = Date.now() + 8000;
        while (!requests.length && Date.now() < until) await new Promise((done) => setTimeout(done, 10));
        if (!requests.length) failures.push(`${label}: the first icon request never went`);
      } else {
        await tab.waitForFunction(() => document.querySelector('sf-button .sf-icon.sf-icon-loaded'), null, {timeout: 10000})
          .catch(() => failures.push(`${label}: the button's search never drew`));
      }
      const firstRequest = [...(requests[0] || [])];
      const arrived = mode === 'local-early' ? started : Date.now();
      if (mode !== 'local-early') await tab.evaluate(({markup, items}) => {
        document.getElementById('main').insertAdjacentHTML('beforeend', markup);
        document.getElementById('seg').items = items;
      }, {markup: LATE_MARKUP, items: SEGMENT_ITEMS});
      if (mode.endsWith('re-render')) {
        await tab.waitForTimeout(30);
        await tab.evaluate((items) => {
          document.getElementById('seg').items = items.map((item) => ({...item}));
          const button = document.querySelector('#toolbar sf-button-icon');
          button.setAttribute('icon', 'star');
          button.setAttribute('icon', 'bookmark_add');
        }, SEGMENT_ITEMS);
      }
      let rows = [];
      while (Date.now() - arrived < BUDGET_MS) {
        rows = await tab.evaluate(READ);
        if (settled(rows)) break;
        await tab.waitForTimeout(50);
      }
      const took = Date.now() - arrived;
      seen[label] = {requests: requests.map((names) => names.join(',')), took, rows};
      if (local && requests.length) failures.push(`${label}: the subset service was asked with the subset disabled`);
      if (!local) for (const icon of LATE) if (firstRequest.includes(icon)) failures.push(`${label}: ${icon} was already in the first request; the page does not test late icons`);
      if (rows.length !== LATE.length) failures.push(`${label}: ${rows.length} sf-icon elements in the segmented control and toolbar, not ${LATE.length}`);
      for (const row of rows) {
        if (!row.glyphLoaded || !row.loaded) failures.push(`${label}: ${row.icon} not marked loaded within ${BUDGET_MS} ms (glyph ${row.glyphLoaded}, element ${row.loaded})`);
        else if (row.visibility === 'hidden' || !(row.fontSize > 0) || Math.abs(row.width - row.fontSize) > 1.5) failures.push(`${label}: ${row.icon} does not draw one glyph (${row.width}px at ${row.fontSize}px, ${row.visibility})`);
      }
      const asked = new Set(requests.slice(1).flat());
      if (!local) for (const icon of LATE) if (!asked.has(icon)) failures.push(`${label}: ${icon} was never asked for after the first request`);
      if (errors.length) failures.push(`${label}: console ${JSON.stringify(errors)}`);
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('ICONS_LATE_TOOLBAR_OK');
