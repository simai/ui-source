#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-button-icon whose icon changed and which was then moved -- appended
// elsewhere, or carried by sf-drawer -- threw "Cannot set properties of null
// (setting 'data')" inside sf-icon's render. The button patched a changed
// icon by writing the glyph's text into sf-icon's drawing, which took lit's
// markers out of it and left sf-icon's icon attribute on the old name; the
// move drew both again. This changes, moves and redraws four ways -- one of
// them in a single task, timing-hostile -- in fresh contexts, and wants no
// error and the right glyph, with sf-icon's attribute naming it. A fifth
// case writes a bare sf-icon's glyph from outside and changes it: the Smart
// base draws it afresh instead of throwing.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body, {theme = 'theme-light', boot = '{icons: {enabled: false}}'} = {}) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = ${boot};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

const pages = {
  '/move.html': pageOf(`<div id="a"><sf-button-icon id="b1" icon="home" aria-label="Дом"></sf-button-icon>
    <sf-button-icon id="b2" icon="home" aria-label="Дом"></sf-button-icon>
    <sf-button-icon id="b3" icon="home" aria-label="Дом"></sf-button-icon></div>
  <div id="b"></div>
  <sf-icon id="i5" icon="home"></sf-icon>
  <main style="display:flex">
    <sf-drawer id="d" side="left" docked open size="1/2">
      <div><sf-button-icon id="b4" icon="home" aria-label="Дом"></sf-button-icon> text</div>
    </sf-drawer>
    <div>canvas</div>
  </main>`),
};

const LOADS = 8;
const failures = [];
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const loads = [];
try {
  for (let load = 0; load < LOADS; load += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${base}/move.html`);
    await page.waitForFunction(() => customElements.get('sf-button-icon') && customElements.get('sf-drawer')
      && [...document.querySelectorAll('sf-button-icon')].every((el) => el.querySelector('sf-icon i.sf-icon')) && document.querySelector('#i5 i.sf-icon'), null, {timeout: 15000});
    await page.waitForTimeout(300);
    const result = await page.evaluate(async () => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
      const settle = async () => { for (let i = 0; i < 6; i += 1) await frame(); };
      const b = document.getElementById('b');
      // 1. change, let the patch apply, then move.
      const b1 = document.getElementById('b1');
      b1.setAttribute('icon', 'search');
      await settle();
      b.appendChild(b1);
      await settle();
      // 2. timing-hostile: change and move in the same task, twice.
      const b2 = document.getElementById('b2');
      b2.setAttribute('icon', 'search');
      b.appendChild(b2);
      b2.setAttribute('icon', 'star');
      document.getElementById('a').appendChild(b2);
      await settle();
      // 3. change, patch, move, change again, move back, re-render (a lit setting).
      const b3 = document.getElementById('b3');
      b3.setAttribute('icon', 'search');
      await settle();
      b.appendChild(b3);
      await frame();
      b3.setAttribute('icon', 'star');
      document.getElementById('a').appendChild(b3);
      await settle();
      b3.setAttribute('appearance', 'tonal');
      await settle();
      // 4. a drawer moving its column under body: change, then close/open the drawer.
      const b4 = document.getElementById('b4');
      b4.setAttribute('icon', 'search');
      await settle();
      const d = document.getElementById('d');
      d.removeAttribute('docked');
      await settle();
      d.setAttribute('docked', '');
      await settle();
      // 5. the Smart base on its own: foreign code wrote the glyph of a bare
      // sf-icon (lit's markers gone), then the icon changes and it moves.
      const i5 = document.getElementById('i5');
      i5.querySelector('i.sf-icon').textContent = 'search';
      i5.setAttribute('icon', 'star');
      b.appendChild(i5);
      await settle();
      const icon5 = {want: 'star', attr: i5.getAttribute('icon'), text: i5.querySelector('i.sf-icon')?.textContent.trim()};
      icon5.ok = icon5.text === 'star' && !i5.hasAttribute('data-sf-error');
      const read = (el, want) => {
        const icon = el.querySelector('sf-icon');
        const glyph = icon?.querySelector('i.sf-icon');
        return {want, attr: icon?.getAttribute('icon'), text: glyph?.textContent.trim(),
          ok: icon?.getAttribute('icon') === want && glyph?.textContent.trim() === want && !el.hasAttribute('data-sf-error') && !icon.hasAttribute('data-sf-error')};
      };
      return {b1: read(b1, 'search'), b2: read(b2, 'star'), b3: read(b3, 'star'), b4: read(b4, 'search'), i5: icon5};
    });
    result.errors = errors;
    loads.push(result);
    if (errors.length || !Object.values(result).every((entry) => Array.isArray(entry) || entry.ok)) failures.push({load, ...result});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({loads: LOADS, failures, sample: loads[0]}, null, 2));
if (failures.length) {
  console.error(`${failures.length} of ${LOADS} load(s) failed`);
  process.exit(1);
}
