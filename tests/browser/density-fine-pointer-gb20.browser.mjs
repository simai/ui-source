#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// Compact below the breakpoint for a fine pointer only (C435, clarifying
// C146 (1); group build 20 integration I6, DEV msg-e6aaf2ea, 2026-11-27).
// A compact region (data-sf-density="compact") with a table, a size 1
// button and a size 1 field, and a menu row:
//
// - 768, fine pointer (a mouse): compact as the desktop draws it -- table
//   row, head row, button and field 32 (were 36, the phone ladder);
// - 768, coarse pointer (touch): no compact below the breakpoint -- the table
//   rows, the button and the field keep the phone ladder (36), never 32; the
//   menu row keeps the touch target, 44;
// - 1440 fine: compact 32 as before (C22); 1440 and 390 coarse: the menu row
//   44 at every width (touch screens rule 12, C36);
// - data-sf-density="normal" inside the compact region at 768 fine takes the
//   phone ladder back (36), not the desktop's normal step (40);
// - the body text is 14 everywhere; console clean; `loads` cold loads each.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px}</style></head><body class="bg-surface">
<div data-sf-density="compact" id="region">
<table class="table" id="t"><thead><tr><th>Название</th><th>Сумма</th></tr></thead><tbody><tr><td>Заказ 10482</td><td>9 800,00 ₽</td></tr><tr><td>Заказ 10483</td><td>1 200,00 ₽</td></tr></tbody></table>
<p id="text">Текст абзаца</p>
<sf-button id="b" text="Сохранить"></sf-button>
<sf-input id="i" label="Название" value="Заказ"></sf-input>
<a class="sf-menu-element" id="m" href="#m">Строка меню</a>
<div data-sf-density="normal"><sf-button id="n" text="Обычная"></sf-button></div>
</div>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/favicon.ico') { response.writeHead(204); return response.end(); }
  if (path === '/page') { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return response.end(page); }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const rows = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch({headless: true});
for (const [width, pointer] of [[768, 'fine'], [768, 'coarse'], [1440, 'fine'], [1440, 'coarse'], [390, 'coarse']]) {
  for (let load = 1; load <= LOADS; load += 1) {
    const touch = pointer === 'coarse';
    const context = await browser.newContext({viewport: {width, height: 900}, hasTouch: touch, isMobile: touch && width < 768});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    await tab.goto(`${origin}/page`, {waitUntil: 'load'});
    await tab.waitForFunction(() => document.querySelector('#b button') && document.querySelector('#n button') && document.querySelector('#i input'), null, {timeout: 20000});
    await tab.waitForTimeout(300);
    const m = await tab.evaluate(() => {
      const h = (element) => (element ? Math.round(element.getBoundingClientRect().height * 10) / 10 : null);
      const input = document.querySelector('#i input');
      return {pointer: matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse', row: h(document.querySelector('#t tbody tr')), head: h(document.querySelector('#t thead tr')),
        button: h(document.querySelector('#b button')), field: h(input.closest('.sf-input-wrapper, .sf-input-field, .sf-input') || input), menu: h(document.getElementById('m')),
        normal: h(document.querySelector('#n button')), text: getComputedStyle(document.getElementById('text')).fontSize};
    });
    const where = `${width} ${pointer} #${load}`;
    rows.push({width, pointer, load, ...m, errors: errors.length});
    check(`${where}: the page reports the pointer`, m.pointer === pointer, m);
    if (pointer === 'fine') {
      check(`${where}: compact table rows, button and field are 32`, [m.row, m.head, m.button, m.field].every((value) => value === 32), m);
      if (width < 960) check(`${where}: normal inside compact is the phone ladder (36)`, m.normal === 36, m);
    } else {
      if (width < 960) check(`${where}: touch keeps the phone ladder, never compact (36)`, [m.row, m.head, m.button, m.field].every((value) => value === 36), m);
      check(`${where}: the menu row keeps the touch target (44)`, m.menu >= 44, m);
    }
    check(`${where}: body text 14`, m.text === '14px', m);
    check(`${where}: console clean`, errors.length === 0, {errors});
    await context.close();
  }
}
await browser.close();
server.close();
console.log(JSON.stringify({rows: rows.filter((row) => row.load === 1), failures}, null, 1));
if (failures.length) {
  console.log(`DENSITY_FINE_POINTER_GB20_FAIL ${failures.length}`);
  process.exit(1);
}
console.log('DENSITY_FINE_POINTER_GB20_OK');
