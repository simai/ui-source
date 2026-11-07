#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-button-icon kind=close is the icon button's size: its cross stands in the
// box an icon gets, the line of the size. The close part's own padding matched
// that line on the desktop only, so on the mobile ladder a close button stood
// 30px at size 1/2 beside a 28px icon button, and 38 beside 36 at size 1 (found
// building sf-alert-bar). Measured at every size, desktop and phone, in both
// themes; a closable tag, which draws its close box itself, keeps its size.
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

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const body = `<div style="padding:24px;display:flex;flex-direction:column;gap:12px;align-items:flex-start">
  ${SIZES.map((size) => `<div style="display:flex;gap:12px;align-items:flex-start" data-size="${size}">
    <sf-button-icon icon="add" size="${size}" aria-label="Add"></sf-button-icon>
    <sf-button-icon kind="close" size="${size}" aria-label="Close"></sf-button-icon>
    <sf-button-icon kind="close" appearance="ghost" scheme="on-surface" size="${size}" aria-label="Close"></sf-button-icon>
  </div>`).join('')}
  <sf-tag id="tag" text="Tag" closable size="1/2"></sf-tag>
</div>`;
const pages = {'/light.html': pageOf(body), '/dark.html': pageOf(body, {theme: 'theme-dark'})};

const failures = [];
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const measured = {};
try {
  for (const theme of ['light', 'dark']) {
    for (const [name, viewport] of [['desktop', {width: 1200, height: 900}], ['mobile', {width: 390, height: 900}]]) {
      const page = await browser.newPage({viewport});
      await page.goto(`${base}/${theme}.html`);
      await page.waitForFunction(() => customElements.get('sf-button-icon') && customElements.get('sf-button-close'), null, {timeout: 10000});
      await page.waitForFunction(() => document.querySelectorAll('[data-size] .sf-close-icon').length === 10, null, {timeout: 10000});
      await page.waitForTimeout(500);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-size]')].map((row) => {
        const [icon, close, ghost] = [...row.children].map((host) => {
          const box = host.querySelector('button').getBoundingClientRect();
          const glyph = host.querySelector('.sf-close-icon, .sf-icon')?.getBoundingClientRect();
          return {width: box.width, height: box.height, glyph: glyph ? [glyph.width, glyph.height, glyph.left - box.left, glyph.top - box.top] : null};
        });
        return {size: row.dataset.size, icon, close, ghost};
      }));
      const tag = await page.evaluate(() => {
        const tag = document.querySelector('#tag');
        const label = tag.querySelector('.sf-tag')?.getBoundingClientRect();
        const close = tag.querySelector('.sf-icon-button--close')?.getBoundingClientRect();
        return {tag: label?.height, close: close?.height};
      });
      measured[`${theme}-${name}`] = {rows, tag};
      for (const row of rows) {
        for (const kind of ['close', 'ghost']) {
          const close = row[kind];
          if (Math.abs(close.width - row.icon.width) > 0.5 || Math.abs(close.height - row.icon.height) > 0.5) {
            failures.push({theme, viewport: name, size: row.size, kind, icon: [row.icon.width, row.icon.height], close: [close.width, close.height]});
          }
          // The cross stands in the middle of the box.
          if (close.glyph) {
            const [w, h, x, y] = close.glyph;
            if (Math.abs(x - (close.width - w) / 2) > 0.75 || Math.abs(y - (close.height - h) / 2) > 0.75) {
              failures.push({theme, viewport: name, size: row.size, kind, check: 'cross centred', glyph: close.glyph, box: [close.width, close.height]});
            }
          }
        }
      }
      if (!(tag.close <= tag.tag)) failures.push({theme, viewport: name, check: 'a closable tag keeps its close inside its line', ...tag});
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({measured, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
