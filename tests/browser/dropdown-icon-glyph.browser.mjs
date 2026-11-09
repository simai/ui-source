#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The pictures an sf-dropdown draws for its chosen options are asked for with
// the page's icons and draw (coordinator, 2026-11-09; the defect sf-tag 1.3.2
// fixed on fix/buttons-review-1109). The dropdown printed a bare
// <i class="sf-icon"> for an icon tag (mode="tag") and for the single
// choice's picture in the field. A bare glyph drawn after the page's icon scan
// never told the Loader its name, so the name was missing from the first
// icon_names request and the glyph came late, with a second, grown subset.
// Both are sf-icon elements now; cl-icon is a relation.
//
// Through the real Loader against a subset service served here (it answers
// any request with the distribution's full Material Symbols font and lists
// the names it was asked for, as the real one does), in light and in dark,
// 3 fresh loads each:
//   1. the names of the chosen icon options (label, bookmark in the tags,
//      star in the single field) reach the first icon_names request that
//      carries any name of the dropdown's -- the page's very first request is
//      the button's alone on some loads, the dropdown's module arriving after
//      it -- and never wait for a later scan;
//   2. each glyph is an sf-icon's, marked loaded, lays its text out one glyph
//      wide, with a loaded face in document.fonts;
//   3. the page raised no error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);

const OPTIONS = [
  {value: 'a', text: 'Метка', kind: 'icon', icon: 'label', selected: true},
  {value: 'b', text: 'Закладка', kind: 'icon', icon: 'bookmark', selected: true},
  {value: 'c', text: 'Флаг', kind: 'icon', icon: 'flag'}];
const SINGLE = [{value: 'x', text: 'Звезда', kind: 'icon', icon: 'star', selected: true}, {value: 'y', text: 'Флаг', kind: 'icon', icon: 'flag'}];
const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
// [id, selector of the glyph, the name it reads]
const GLYPHS = [
  ['tag-a', '#tags .sf-tag[data-value="a"] .sf-icon', 'label'],
  ['tag-b', '#tags .sf-tag[data-value="b"] .sf-icon', 'bookmark'],
  ['single', '#single .sf-dropdown-field-visual', 'star'],
];
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>dropdown icon</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'dropdown-icon-glyph', pluginListVersion: 'dropdown-icon-glyph',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:flex;gap:var(--sf-space-1);padding:var(--sf-space-1);align-items:center}main>div{inline-size:var(--sf-g6)}</style>
</head><body><main><sf-button text="Найти" icon-start="search"></sf-button>
<div><sf-dropdown id="tags" mode="tag" label="Метки" name="tags" options='${j(OPTIONS)}'></sf-dropdown></div>
<div><sf-dropdown id="single" label="Знак" name="single" options='${j(SINGLE)}'></sf-dropdown></div>
</main></body></html>`;

// Each icon_names request of a page, in order.
let requests = [];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
let base = '';
let cuts = 0;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
  }
  if (path === '/subset/ms/css') {
    const index = cuts++;
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

const READ = (glyphs) => glyphs.map(([id, selector]) => {
  const glyph = document.querySelector(selector);
  if (!glyph) return {id, missing: true};
  const text = glyph.textContent.trim();
  const range = document.createRange();
  range.selectNodeContents(glyph);
  const width = range.getBoundingClientRect().width;
  const style = getComputedStyle(glyph);
  const fontSize = parseFloat(style.fontSize);
  const family = style.fontFamily.split(',')[0].trim();
  return {
    id,
    text,
    element: glyph.closest('sf-icon') ? 'sf-icon' : 'bare',
    loaded: glyph.classList.contains('sf-icon-loaded'),
    width: Math.round(width * 10) / 10,
    fontSize,
    box: Math.round(glyph.getBoundingClientRect().width * 10) / 10,
    faceLoaded: document.fonts.check(`${style.fontWeight} ${fontSize || 24}px ${family}`, text),
  };
});

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const [theme, load] of ['light', 'dark'].flatMap((one) => [1, 2, 3].map((n) => [one, n]))) {
    const tab = await browser.newPage({viewport: {width: 900, height: 300}, colorScheme: theme});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    requests = [];
    await tab.goto(`${base}/${theme}`);
    const label = `${theme} load ${load}`;
    await tab.waitForFunction(() => customElements.get('sf-dropdown') && document.querySelectorAll('#tags .sf-tag').length === 2
      && document.querySelector('#single .sf-dropdown-field-visual'), null, {timeout: 20000})
      .catch(() => failures.push(`${label}: the dropdowns never drew their choices`));
    // Settle: the font in and every glyph either loaded or given up on.
    await tab.waitForFunction((glyphs) => glyphs.every(([, selector]) => document.querySelector(selector)?.classList.contains('sf-icon-loaded')), GLYPHS, {timeout: 8000})
      .catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(200);
    const rows = await tab.evaluate(READ, GLYPHS);
    seen[`${theme}-${load}`] = {requests, rows};
    // The page's first request is the button's alone on some loads: the
    // dropdown's module arrives after it (Loader timing, not the dropdown).
    // What the dropdown owns is that its chosen pictures are asked for in
    // the first request that carries any name of its own -- the round its
    // sf-icons start when it draws -- and never wait for a later scan. Its
    // other glyphs (the chevron, an option's icon) are recorded beside them.
    const own = new Set([...GLYPHS.map(([, , icon]) => icon), 'keyboard_arrow_down', 'flag']);
    const round = requests.findIndex((names) => names.some((name) => own.has(name)));
    const chosen = requests[round] ?? [];
    if (!(requests[0] ?? []).includes('search')) failures.push(`${label}: the first icon_names request lacks the button's search (${(requests[0] ?? []).join(',')})`);
    for (const [, , icon] of GLYPHS) if (!chosen.includes(icon)) failures.push(`${label}: ${icon} is not in the dropdown's first icon_names request #${round + 1} (${chosen.join(',')}); requests: ${JSON.stringify(requests)}`);
    seen[`${theme}-${load}`].round = round + 1;
    seen[`${theme}-${load}`].chevronRound = requests.findIndex((names) => names.includes('keyboard_arrow_down')) + 1;
    for (const [index, row] of rows.entries()) {
      const name = `${label} #${row.id}`;
      if (row.missing) { failures.push(`${name}: no icon`); continue; }
      if (row.text !== GLYPHS[index][2]) failures.push(`${name}: the icon reads ${row.text}, not ${GLYPHS[index][2]}`);
      if (row.element !== 'sf-icon') failures.push(`${name}: a bare glyph, not an sf-icon's`);
      if (!row.loaded) failures.push(`${name}: the glyph is never marked loaded`);
      if (!(row.fontSize > 0 && row.width > 0)) failures.push(`${name}: the glyph is blank (${row.width}px wide at ${row.fontSize}px)`);
      else if (Math.abs(row.width - row.fontSize) > 1.5) failures.push(`${name}: the text lays out ${row.width}px wide at ${row.fontSize}px, not one glyph`);
      if (!row.faceLoaded) failures.push(`${name}: no loaded face for ${row.text}`);
    }
    if (errors.length) failures.push(`${label}: console ${JSON.stringify(errors)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 1));
console.log(`DROPDOWN_ICON_GLYPH ${failures.length ? 'FAIL' : 'PASS'} (${Object.keys(seen).length} loads)`);
if (failures.length) process.exit(1);
