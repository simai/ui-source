#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The dropdown's search field: its placeholder is the page language's word, not
// «Placeholder», and the native change it fires when it is left stays inside --
// a listener on sf-dropdown heard a second, empty change after every search.
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
  for (const [lang, word] of [['ru', 'Поиск'], ['en', 'Search']]) {
    const tab = await browser.newPage();
    await tab.goto(`http://127.0.0.1:${server.address().port}/${lang}`);
    await tab.waitForFunction(() => customElements.get('sf-dropdown') && document.querySelector('#d button[aria-haspopup]'), null, {timeout: 15000})
      .catch(() => failures.push(`${lang}: the dropdown never drew`));
    await tab.evaluate(() => {
      window.changes = [];
      document.querySelector('#d').addEventListener('change', (event) => window.changes.push(event.detail ?? null));
    });
    await tab.locator('#d button[aria-haspopup]').click();
    const search = tab.locator('.sf-list:not([hidden]) .sf-input input').first();
    await search.waitFor({timeout: 5000}).catch(() => failures.push(`${lang}: no search field`));
    const placeholder = await search.getAttribute('placeholder').catch(() => null);
    await search.fill('Каз').catch(() => {});
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(200);
    const changes = await tab.evaluate(() => window.changes);
    seen[lang] = {placeholder, changes};
    if (placeholder !== word) failures.push(`${lang}: the search reads ${JSON.stringify(placeholder)}, expected ${word}`);
    if (changes.length) failures.push(`${lang}: leaving the search fired ${changes.length} change(s) on sf-dropdown: ${JSON.stringify(changes)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
