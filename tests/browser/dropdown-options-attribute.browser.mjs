#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Options given as the options attribute (JSON) are the dropdown's data, as the
// property is: the chosen option's text shows in the field. Given as an
// attribute, the field stood empty for the matching value (ui-effects site,
// 2026-10-28); a later change of the attribute redraws the list.
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
<sf-dropdown id="attr" size="1" mode="select" label="Буква" value="b" options='[{"text":"Альфа","value":"a"},{"text":"Бета","value":"b"}]'></sf-dropdown>
<sf-dropdown id="prop" size="1" mode="select" label="Буква" value="b"></sf-dropdown>
<script>document.querySelector('#prop').options = [{text: 'Альфа', value: 'a'}, {text: 'Бета', value: 'b'}];</script>
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
  await tab.waitForFunction(() => customElements.get('sf-dropdown') && document.querySelector('#attr button[aria-haspopup]') && document.querySelector('#prop button[aria-haspopup]'), null, {timeout: 15000})
    .catch(() => failures.push('the dropdowns never drew'));
  await tab.waitForTimeout(300);
  const field = (id) => tab.evaluate((selector) => document.querySelector(selector)?.querySelector('.sf-dropdown-field input')?.value ?? null, `#${id}`);
  seen.attribute = await field('attr');
  seen.property = await field('prop');
  if (!String(seen.attribute).includes('Бета')) failures.push(`options as an attribute: the field shows «${seen.attribute}», not «Бета»`);
  if (!String(seen.property).includes('Бета')) failures.push(`options as a property: the field shows «${seen.property}», not «Бета»`);

  await tab.evaluate(() => document.querySelector('#attr').setAttribute('options', JSON.stringify([{text: 'Гамма', value: 'b'}])));
  await tab.waitForTimeout(300);
  seen.changed = await field('attr');
  if (!String(seen.changed).includes('Гамма')) failures.push(`a changed options attribute: the field shows «${seen.changed}», not «Гамма»`);
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('DROPDOWN_OPTIONS_ATTRIBUTE_OK');
