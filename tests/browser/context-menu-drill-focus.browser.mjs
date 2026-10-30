#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A drilling sf-context-menu, entered by a real mouse press on the built bytes:
// the row that held the focus leaves with its level, so the focus has to move
// into the level or Escape and the arrows are heard by nobody.
// - opened with openFor: Escape goes back a level, then closes;
// - placed in the page: Escape and the outward arrow go back a level;
// - in both the back press returns the focus to the row it came from.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const ENTRIES = [
  {id: 'theme', type: 'choice', view: 'drill', text: 'Тема', options: [{id: 'light', text: 'Светлая', checked: true}, {id: 'dark', text: 'Тёмная'}]},
  {id: 'sound', type: 'switch', text: 'Звук', value: true},
];
const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<button id="open" type="button">Открыть</button>
<sf-context-menu id="owned" popup submenu="drill" aria-label="Настройки"></sf-context-menu>
<sf-context-menu id="placed" submenu="drill" aria-label="Настройки"></sf-context-menu>
<script>
customElements.whenDefined('sf-context-menu').then(() => {
  for (const id of ['owned', 'placed']) document.getElementById(id).entries = ${JSON.stringify(ENTRIES)};
  document.getElementById('open').addEventListener('click', (event) => document.getElementById('owned').openFor(event.currentTarget));
});
</script></body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGE);
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
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const expect = (name, ok, detail) => { if (!ok) failures.push({name, detail}); };
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1000, height: 800}});
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  await tab.goto(`${origin}/`);
  await tab.waitForFunction(() => document.querySelector('#placed [data-sf-entry="0"]'), null, {timeout: 20000});
  const state = (id) => tab.evaluate((host) => {
    const menu = document.getElementById(host);
    const active = document.activeElement;
    return {inMenu: menu.contains(active) && active !== menu, level: Boolean(menu.querySelector('.sf-context-menu-level-option')),
      row: active?.dataset?.sfEntry ?? null, ring: active?.matches?.(':focus-visible') ?? null, open: menu.hasAttribute('data-open')};
  }, id);
  const settle = () => tab.waitForTimeout(250);

  // Placed: a real press enters the level and the focus goes with it.
  await tab.click('#placed [data-sf-entry="0"]');
  await settle();
  const placedIn = await state('placed');
  expect('placed: the press enters the level and the focus follows', placedIn.level && placedIn.inMenu, placedIn);
  expect('placed: a pointer draws no ring', placedIn.ring === false, placedIn);
  await tab.keyboard.press('Escape');
  await settle();
  const placedBack = await state('placed');
  expect('placed: Escape goes back to the row', !placedBack.level && placedBack.row === '0', placedBack);
  await tab.click('#placed [data-sf-entry="0"]');
  await settle();
  await tab.keyboard.press('ArrowLeft');
  await settle();
  const placedArrow = await state('placed');
  expect('placed: the outward arrow goes back', !placedArrow.level && placedArrow.row === '0', placedArrow);

  // Opened: back a level first, then closed.
  await tab.click('#open');
  await settle();
  await tab.click('#owned [data-sf-entry="0"]');
  await settle();
  const ownedIn = await state('owned');
  expect('owned: the press enters the level and the focus follows', ownedIn.level && ownedIn.inMenu, ownedIn);
  await tab.keyboard.press('Escape');
  await settle();
  const ownedBack = await state('owned');
  expect('owned: Escape goes back first', !ownedBack.level && ownedBack.row === '0', ownedBack);
  await tab.keyboard.press('Escape');
  await settle();
  const closed = await tab.evaluate(() => document.activeElement?.id);
  expect('owned: Escape then closes and gives the focus back', closed === 'open', closed);
  expect('no page errors', errors.length === 0, errors);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('CONTEXT_MENU_DRILL_FOCUS_OK');
