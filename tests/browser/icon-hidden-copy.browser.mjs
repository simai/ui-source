#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An sf-icon in a copy that is not rendered when the page loads (a closed
// panel, a display: none menu or header copy) draws as soon as the copy is
// shown. Larena (pair ui-b4a77681f0a7, /admin/settings/general, icons off,
// the outlined face loaded) read «menu» and «star» loaded: false 4 s after
// load: they sat in a hidden copy, while chevron_left and left_panel_close on
// the same page drew. The loaded state is the font's readiness for the
// family and style, not whether the host is rendered.
//
// Through the real Loader, with icons off (the bundled full font, Larena's
// "bundled-fallback") and on (a subset service served here). Four pages:
//   hidden -- a display: none container holding a bare sf-icon (home), an
//             sf-button-icon menu and a filled sf-button-icon star;
//   late, detached -- the same copy put into a hidden container after load,
//             and made before the Framework loads outside the document;
//   header -- sf-header-site collapse="always" with sf-button-icon menu and
//             a filled star in its actions slot (the closed panel).
// The copy is shown 1 s and 5 s after load (the container's display, the
// header's open()). Every sf-icon in it is then marked loaded and lays out
// one glyph wide within 300 ms. A detached copy with the subset service on
// names its icons only when it is placed, so one request has to go: 1 s, the
// cold budget of the cycle probe. Three loads each; no page error.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const BUDGET_MS = 300;
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);

const COPY = `<sf-icon icon="home"></sf-icon>
<sf-button-icon icon="menu" appearance="ghost" aria-label="Меню"></sf-button-icon>
<sf-button-icon icon="star" filled appearance="ghost" aria-label="В избранное"></sf-button-icon>`;
// hidden   -- the copy is in the page's markup, display: none;
// late     -- the copy is put into a display: none container 500 ms after load;
// detached -- the copy is made before the Framework loads, in a container
//             that is not in the document, and placed when it is shown (the
//             page draws an sf-button-icon of its own, so the tags are there);
// header   -- sf-header-site collapse="always", the copy in its actions slot.
const body = (kind) => kind === 'header'
  ? `<sf-header-site id="copy-host" collapse="always" label="Сайт"><a slot="brand" href="#">SIMAI</a>
<div slot="actions" id="copy" style="display:flex;gap:4px">${COPY}</div></sf-header-site>`
  : kind === 'hidden'
    ? `<sf-button text="Найти" icon-start="search"></sf-button><div id="copy" style="display:none">${COPY}</div>`
    : kind === 'late'
      ? `<sf-button text="Найти" icon-start="search"></sf-button><div id="copy" style="display:none"></div>
<script>setTimeout(() => { document.getElementById('copy').innerHTML = ${JSON.stringify(COPY)}; }, 500);</script>`
      : `<sf-button text="Найти" icon-start="search"></sf-button><sf-button-icon icon="search" aria-label="Найти"></sf-button-icon>
<script>window.__copy = document.createElement('div'); window.__copy.id = 'copy'; window.__copy.style.display = 'none';
window.__copy.innerHTML = ${JSON.stringify(COPY)};</script>`;
const page = (kind, local) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>hidden copy</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icon-hidden-copy', pluginListVersion: 'icon-hidden-copy',
    preloader: {enabled: false}, icons: ${local ? '{enabled: false, accumulate: false}' : "{subsetHost: location.origin + '/subset'}"}, smart: {base: true}, theme: false};
</script>
${local ? '<script>document.documentElement.dataset.sfIconRuntime = "bundled-fallback";</script>' : ''}
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}</style>
</head><body>${body(kind)}</body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
let base = '';
let cuts = 0;
let requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const [, kind, mode] = /^\/(hidden|late|detached|header)-(local|subset)$/u.exec(path) || [];
  if (kind) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page(kind, mode === 'local'));
  }
  if (path === '/subset/ms/css') {
    const index = cuts++;
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    requests.push(icons.join(','));
    const fontUrl = `${base}/subset/ms/font/subset-${index}.woff2`;
    const manifest = {hash: `probe-${index}`, mode: 'static-weight', type: 'outlined', origin: null,
      family: 'Material Symbols Outlined', iconCount: icons.length, icons,
      axes: {wght: {mode: 'fixed', value: 400, raw: 'default'}}, fonts: [{hash: `probe-${index}`, weight: 400, url: fontUrl}]};
    const header = Buffer.from(JSON.stringify(manifest)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'x-simai-font-manifest': header,
      'access-control-expose-headers': 'X-SIMAI-Font-Manifest', 'cache-control': 'no-store'});
    return response.end(`@font-face { font-family: 'Material Symbols Outlined Subset'; src: url('${fontUrl}') format('woff2'); font-style: normal; font-weight: 400; font-display: block; }
.sf-icon { font-family: 'Material Symbols Outlined Subset'; font-weight: var(--sf-icon--weight, 400); font-style: normal; line-height: 1; display: inline-flex; white-space: nowrap; font-feature-settings: 'liga';
  font-variation-settings: 'FILL' var(--sf-icon--fill, 0), 'wght' var(--sf-icon--weight, 400), 'GRAD' var(--sf-icon--grade, 0), 'opsz' var(--sf-icon--optical-size, 24); }`);
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
    const data = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    return response.end(data);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
base = `http://127.0.0.1:${server.address().port}`;

// Shows the copy, then reads it every frame until each icon is drawn (or the
// budget passes): the time, and the rows at the end.
const SHOW = async ({kind, budget}) => {
  if (kind === 'detached') document.body.append(window.__copy);
  const copy = document.getElementById('copy');
  const read = () => [...copy.querySelectorAll('sf-icon')].map((element) => {
    const glyph = element.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon');
    let width = 0;
    if (glyph) {
      const range = document.createRange();
      range.selectNodeContents(glyph);
      width = Math.round(range.getBoundingClientRect().width * 10) / 10;
    }
    const style = glyph ? getComputedStyle(glyph) : null;
    const fontSize = style ? parseFloat(style.fontSize) : 0;
    return {icon: element.getAttribute('icon'), loaded: element.loaded === true,
      glyphLoaded: Boolean(glyph?.classList.contains('sf-icon-loaded')), width, fontSize,
      visibility: style?.visibility || 'none'};
  });
  const before = read();
  const drawn = (rows) => rows.length === 3 && rows.every((row) => row.loaded && row.glyphLoaded
    && row.visibility !== 'hidden' && row.fontSize > 0 && Math.abs(row.width - row.fontSize) <= 1.5);
  const started = performance.now();
  if (kind === 'header') document.getElementById('copy-host').open();
  else copy.style.display = 'flex';
  let rows = read();
  let frames = 0;
  while (!drawn(rows) && performance.now() - started < budget) {
    await new Promise((done) => requestAnimationFrame(done));
    frames += 1;
    rows = read();
  }
  return {before, rows, frames, ms: Math.round(performance.now() - started), drawn: drawn(rows)};
};

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const kind of ['hidden', 'late', 'detached', 'header']) {
    for (const mode of ['local', 'subset']) {
      for (const at of [1000, 5000]) {
        for (let load = 1; load <= LOADS; load += 1) {
          const label = `${kind} ${mode} show ${at / 1000} s load ${load}`;
          requests = [];
          const context = await browser.newContext({viewport: {width: 1280, height: 400}});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
          tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
          const started = Date.now();
          await tab.goto(`${base}/${kind}-${mode}`);
          await tab.waitForFunction(() => customElements.get('sf-button-icon') && customElements.get('sf-icon')
            && (!document.querySelector('sf-header-site') || customElements.get('sf-header-site')), null, {timeout: 10000})
            .catch(() => failures.push(`${label}: the components never defined`));
          const wait = at - (Date.now() - started);
          if (wait > 0) await tab.waitForTimeout(wait);
          const result = await tab.evaluate(SHOW, {kind, budget: 3000});
          seen[label] = {ms: result.ms, frames: result.frames, requests: [...requests],
            hiddenLoaded: result.before.map((row) => `${row.icon}:${row.loaded}`).join(' '),
            rows: result.drawn ? undefined : result.rows};
          if (!result.drawn) failures.push(`${label}: not drawn ${result.ms} ms after showing ${JSON.stringify(result.rows)}`);
          else {
            const limit = kind === 'detached' && mode === 'subset' ? 1000 : BUDGET_MS;
            if (result.ms > limit) failures.push(`${label}: drawn ${result.ms} ms after showing, limit ${limit} ms`);
          }
          if (errors.length) failures.push(`${label}: console ${JSON.stringify(errors)}`);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('ICON_HIDDEN_COPY_OK');
