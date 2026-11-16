#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-button passes a changed aria-label to its inner button (sf-button
// 1.14.0). aria-label is the host's (§3.1), not a setting, so it was not an
// observed attribute and the host-attribute forwarder leaves it out: after a
// new image was dropped, sf-input-image's «Заменить изображение «photo.png»»
// kept the first file's name. This changes, empties and sets the name again,
// once after the first drawing and once in the same task as the element is
// made (timing-hostile), on three loads in fresh contexts, and wants the inner
// control (button and link) to carry the host's current name and no error.
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
  '/name.html': pageOf(`<sf-button id="b" text="Заменить…" aria-label="Заменить изображение «photo.png»"></sf-button>
  <sf-button id="l" text="Открыть" href="#open" aria-label="Открыть «photo.png»"></sf-button>`),
};

const LOADS = 3;
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
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/name.html`);
    await page.waitForFunction(() => document.querySelector('#b > .sf-button') && document.querySelector('#l > a.sf-button'), null, {timeout: 30000});
    const seen = await page.evaluate(async () => {
      const frames = (count = 3) => new Promise((done) => { const step = (left) => left ? requestAnimationFrame(() => step(left - 1)) : done(); step(count); });
      const inner = (host) => host.querySelector(':scope > .sf-button');
      const named = (host) => inner(host)?.getAttribute('aria-label') ?? null;
      const result = {};
      const button = document.getElementById('b');
      const link = document.getElementById('l');
      result.first = [named(button), named(link)];
      button.setAttribute('aria-label', 'Заменить изображение «new.png»');
      link.setAttribute('aria-label', 'Открыть «new.png»');
      await frames();
      result.changed = [named(button), named(link)];
      button.removeAttribute('aria-label');
      await frames();
      result.emptied = named(button);
      button.setAttribute('aria-label', 'Заменить изображение «third.png»');
      await frames();
      result.again = named(button);
      // Made, connected and renamed in one task.
      const late = document.createElement('sf-button');
      late.setAttribute('text', 'Заменить…');
      late.setAttribute('aria-label', 'Заменить изображение «a.png»');
      document.body.append(late);
      late.setAttribute('aria-label', 'Заменить изображение «b.png»');
      await frames(6);
      result.late = named(late);
      return result;
    });
    loads.push(seen);
    const want = {
      first: ['Заменить изображение «photo.png»', 'Открыть «photo.png»'],
      changed: ['Заменить изображение «new.png»', 'Открыть «new.png»'],
      emptied: null,
      again: 'Заменить изображение «third.png»',
      late: 'Заменить изображение «b.png»',
    };
    for (const [key, value] of Object.entries(want)) {
      if (JSON.stringify(seen[key]) !== JSON.stringify(value)) failures.push({load, case: key, seen: seen[key], want: value});
    }
    if (errors.length) failures.push({load, errors});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({loads: loads.length, first: loads[0]}));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_NAME_UPDATE_OK');
