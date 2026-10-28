#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-icon keeps the classes someone else put on its glyph through a re-render:
// the template wrote the whole class attribute and Docara's sf-icon-complete
// face class was lost, so names outside the fast subset drew as broken
// ligatures (simai/docara#35). Its own classes still follow its attributes.
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
<sf-icon id="i" icon="edit_square" size="1"></sf-icon>
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
  await tab.waitForFunction(() => document.querySelector('#i > i.sf-icon'), null, {timeout: 15000})
    .catch(() => failures.push('the icon never drew'));
  const glyph = () => tab.evaluate(() => [...document.querySelector('#i > i.sf-icon').classList].sort());
  seen.first = await glyph();
  await tab.evaluate(() => document.querySelector('#i > i.sf-icon').classList.add('sf-icon-complete', 'site-face'));
  await tab.evaluate(() => document.querySelector('#i').setAttribute('icon', 'more_horiz'));
  await tab.waitForTimeout(200);
  seen.afterIcon = await glyph();
  await tab.evaluate(() => document.querySelector('#i').setAttribute('size', '2'));
  await tab.waitForTimeout(200);
  seen.afterSize = await glyph();
  seen.text = await tab.evaluate(() => document.querySelector('#i > i.sf-icon').textContent.trim());
  for (const [name, list] of [['after an icon change', seen.afterIcon], ['after a size change', seen.afterSize]]) {
    if (!list.includes('sf-icon-complete') || !list.includes('site-face')) failures.push(`${name}: the foreign classes are gone: ${list.join(' ')}`);
  }
  if (!seen.afterSize.includes('sf-icon--size-2') || seen.afterSize.includes('sf-icon--size-1')) failures.push(`the own size class did not follow: ${seen.afterSize.join(' ')}`);
  if (seen.text !== 'more_horiz') failures.push(`the glyph is «${seen.text}»`);
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('ICON_KEEPS_FOREIGN_CLASSES_OK');
