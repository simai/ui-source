#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// One focus frame on a focused dropdown: the field draws the ring for the whole
// control and the read-only input inside gives its own up. Core's global
// :focus-visible stood outside the layers and outranked that, so a keyboard
// focus drew two frames, one inside the other (ui-effects site, 2026-10-28).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<sf-dropdown id="d" size="1" appearance="outlined" mode="select" label="Город">
  <sf-list-item kind="text" text="Москва"></sf-list-item>
  <sf-list-item kind="text" text="Казань"></sf-list-item>
</sf-dropdown>
<button id="after">после</button>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/ru' || path === '/en') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`http://127.0.0.1:${server.address().port}/ru`);
  await tab.waitForFunction(() => document.querySelector('#d button[aria-haspopup]'), null, {timeout: 15000})
    .catch(() => failures.push('the dropdown never drew'));
  // The input inside, focused after a key press so the browser treats it as
  // keyboard focus (:focus-visible), as a page that moves focus to it does.
  await tab.keyboard.press('Shift');
  await tab.evaluate(() => document.querySelector('#d .sf-dropdown-field input').focus());
  await tab.waitForTimeout(150);
  seen.focus = await tab.evaluate(() => {
    const field = document.querySelector('#d .sf-dropdown-field');
    const active = document.activeElement;
    const ring = (node) => { const s = getComputedStyle(node); return s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0 ? 'none' : `${s.outlineStyle} ${s.outlineWidth}`; };
    const rings = [...document.querySelectorAll('#d *')].filter((node) => ring(node) !== 'none').map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].slice(0, 2).join('.')}`);
    return {active: active ? `${active.tagName.toLowerCase()}.${[...active.classList].slice(0, 2).join('.')}` : null, field: ring(field), rings};
  });
  if (!seen.focus.active) failures.push('nothing in the dropdown took focus');
  if (seen.focus.rings.length !== 1) failures.push(`expected one focus frame, got ${seen.focus.rings.length}: ${seen.focus.rings.join(', ')}`);
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('DROPDOWN_ONE_FOCUS_FRAME_OK');
