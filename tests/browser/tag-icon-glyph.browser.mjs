#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The icon of an sf-tag is asked for with the page's icons and draws
// (buttons review 2026-11-09, pair ui-b4a77681f0a7). The tag printed a bare
// <i class="sf-icon">label</i> instead of an sf-icon. An sf-icon tells the
// Loader its name when it connects, so every name on the page goes in the
// first icon font request; the bare glyph was found only by a later scan, so
// label was missing from the page's icon_names request and the tag's glyph
// stayed blank until a second, grown subset came back (on the review stand
// the first request held 28 names and not label).
//
// Through the real Loader against a subset service served here (it answers
// any request with the distribution's full Material Symbols font and lists
// the names it was asked for, as the real one does), in light and in dark:
// The page is the stand's shape: the Loader in the head, an sf-button with an
// icon and the tags in the body as parsed.
//   1. the tag's icon name, the default one of a tag without a name (sell)
//      and the placeholder of an avatar tag without a picture (person) reach
//      the first icon_names request, with the button's;
//   2. each glyph is marked loaded, has a font size and lays its text out one
//      glyph wide (> 0 and as wide as the font size, not its name spelled
//      out), with a loaded face in document.fonts;
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

const TAGS = [
  {id: 'named', attrs: 'kind="icon" icon="label" text="Метка"', icon: 'label'},
  {id: 'named-small', attrs: 'kind="icon" icon="bookmark" text="Закладка" size="1/3"', icon: 'bookmark'},
  {id: 'unnamed', attrs: 'kind="icon" text="Без имени" size="2"', icon: 'sell'},
  {id: 'avatar', attrs: 'kind="avatar" text="Гость"', icon: 'person'},
];
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>tag icon</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'tag-icon-glyph', pluginListVersion: 'tag-icon-glyph',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}main{display:flex;gap:16px;padding:16px;align-items:center}</style>
</head><body><main><sf-button text="Найти" icon-start="search"></sf-button>
${TAGS.map((tag) => `<sf-tag id="${tag.id}" ${tag.attrs}></sf-tag>`).join('\n')}
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

const READ = (ids) => ids.map((id) => {
  const glyph = document.querySelector(`#${id} .sf-tag .sf-icon, #${id} i.sf-icon`);
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
  for (const theme of ['light', 'dark']) {
    const tab = await browser.newPage({viewport: {width: 900, height: 300}, colorScheme: theme});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    requests = [];
    await tab.goto(`${base}/${theme}`);
    await tab.waitForFunction(() => customElements.get('sf-tag') && document.querySelectorAll('sf-tag .sf-tag').length === 4, null, {timeout: 20000})
      .catch(() => failures.push(`${theme}: the tags never drew`));
    // Settle: the font in and every glyph either loaded or given up on.
    await tab.waitForFunction((ids) => ids.every((id) => document.querySelector(`#${id} .sf-icon.sf-icon-loaded`)), TAGS.map((tag) => tag.id), {timeout: 8000})
      .catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(200);
    const rows = await tab.evaluate(READ, TAGS.map((tag) => tag.id));
    seen[theme] = {requests, rows};
    const first = requests[0] ?? [];
    if (!first.includes('search')) failures.push(`${theme}: the first icon_names request lacks the button's search (${first.join(',')})`);
    for (const tag of TAGS) if (!first.includes(tag.icon)) failures.push(`${theme}: ${tag.icon} is not in the first icon_names request (${first.join(',')}); requests: ${requests.length}`);
    for (const [index, row] of rows.entries()) {
      const name = `${theme} #${row.id}`;
      if (row.missing) { failures.push(`${name}: no icon`); continue; }
      if (row.text !== TAGS[index].icon) failures.push(`${name}: the icon reads ${row.text}, not ${TAGS[index].icon}`);
      if (!row.loaded) failures.push(`${name}: the glyph is never marked loaded`);
      if (!(row.fontSize > 0 && row.width > 0)) failures.push(`${name}: the glyph is blank (${row.width}px wide at ${row.fontSize}px)`);
      else if (Math.abs(row.width - row.fontSize) > 1.5) failures.push(`${name}: the text lays out ${row.width}px wide at ${row.fontSize}px, not one glyph`);
      if (!row.faceLoaded) failures.push(`${name}: no loaded face for ${row.text}`);
    }
    if (errors.length) failures.push(`${theme}: console ${JSON.stringify(errors)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 1));
if (failures.length) process.exit(1);
