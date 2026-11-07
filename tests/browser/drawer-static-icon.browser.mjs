#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A static sf-icon written inside a docked sf-drawer sometimes never drew: it
// was upgraded and connected and its innerHTML stayed empty (simai/ui-source#56,
// 2 of 8 loads for ui-mail; 6 of 10 here before the fix). The drawer moves its
// content into its portal while the icon's first render waits for its sheets;
// the render is cut short, the next first render clears the host again, and
// lit's part on the host -- its markers gone with the clear -- committed
// nothing for the same values. A race, so this loads the page in a fresh
// context many times and wants every load drawn.
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
  '/drawer.html': pageOf(`<sf-icon id="outside" icon="tune" size="2"></sf-icon>
  <main style="display:flex">
    <sf-drawer id="d" side="left" docked open size="1/2">
      <div><sf-icon id="inside" icon="tune" size="2"></sf-icon> text</div>
    </sf-drawer>
    <div>canvas</div>
  </main>`),
};

const LOADS = 12;
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
    await page.goto(`${base}/drawer.html`);
    await page.waitForFunction(() => customElements.get('sf-icon') && customElements.get('sf-drawer'), null, {timeout: 10000});
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const read = (id) => {
        const icon = document.getElementById(id);
        return {drawn: Boolean(icon?.querySelector(':scope i.sf-icon')), upgraded: icon?.constructor === customElements.get('sf-icon'),
          inPortal: Boolean(icon?.closest('[data-sf-drawer-portal]'))};
      };
      return {inside: read('inside'), outside: read('outside')};
    });
    loads.push(result);
    if (!result.inside.drawn || !result.outside.drawn) failures.push({load, ...result});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({loads: LOADS, drawnInside: loads.filter((entry) => entry.inside.drawn).length,
  inPortal: loads.filter((entry) => entry.inside.inPortal).length, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} of ${LOADS} load(s) left an icon undrawn`);
  process.exit(1);
}
