#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Every setting is a property of the same name (§5.1): writing the property
// moves the attribute and the element draws the new value. A component that
// writes its own getter for a setting used to shadow the base's pair and lose
// the setter with it, so the assignment changed nothing and said nothing
// (sf-badge status, sf-dropdown size, sf-input size, sf-textarea rows,
// sf-toast duration; measured 2026-10-31). The base now puts its setter back
// beside such a getter, once per class.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) {
  if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);
}

// Each row: the element, the setting, the value to write and what the
// attribute must say afterwards. The first five hold a getter of their own;
// the last two do not, so they prove the ordinary path still works.
const CASES = [
  {tag: 'sf-badge', markup: '<sf-badge id="badge" text="3" status="info"></sf-badge>', property: 'status', value: 'warning', attribute: 'status', says: 'warning'},
  {tag: 'sf-textarea', markup: '<sf-textarea id="textarea" label="Текст" rows="2"></sf-textarea>', property: 'rows', value: 5, attribute: 'rows', says: '5'},
  {tag: 'sf-dropdown', markup: '<sf-dropdown id="dropdown" label="Город" size="1"></sf-dropdown>', property: 'size', value: '2', attribute: 'size', says: '2'},
  {tag: 'sf-toast', markup: '<sf-toast id="toast" heading="Готово"></sf-toast>', property: 'duration', value: 300, attribute: 'duration', says: '300'},
  {tag: 'sf-input', markup: '<sf-input id="input" label="Имя" size="1"></sf-input>', property: 'size', value: '2', attribute: 'size', says: '2'},
  {tag: 'sf-input', markup: '', id: 'input', property: 'label', value: 'Фамилия', attribute: 'label', says: 'Фамилия'},
  {tag: 'sf-badge', markup: '', id: 'badge', property: 'text', value: '9', attribute: 'text', says: '9'},
];

const body = `<main>${CASES.map((one) => one.markup).join('\n')}</main>`;
const page_html = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page_html);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({locale: 'ru-RU', viewport: {width: 1000, height: 800}});
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
  const tags = [...new Set(CASES.map((one) => one.tag))];
  await page.waitForFunction((names) => names.every((name) => customElements.get(name)), tags, {timeout: 25000});
  await page.waitForTimeout(500);
  const seen = await page.evaluate((cases) => cases.map((one) => {
    const element = document.getElementById(one.id || one.markup.match(/id="([^"]+)"/u)[1]);
    let threw = null;
    try { element[one.property] = one.value; } catch (error) { threw = String(error).slice(0, 120); }
    return {
      property: `${element.localName}.${one.property}`,
      attribute: element.getAttribute(one.attribute),
      read: element[one.property],
      threw,
    };
  }), CASES.map((one) => ({id: one.id, markup: one.markup, property: one.property, value: one.value, attribute: one.attribute})));
  for (const [index, got] of seen.entries()) {
    const want = CASES[index];
    if (got.threw) failures.push({name: got.property, said: got.threw});
    else if (got.attribute !== want.says) failures.push({name: got.property, attribute: got.attribute, expected: want.says, read: got.read});
  }
  console.log(JSON.stringify({written: seen.map((one) => [one.property, one.attribute])}));
  await page.close();
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('SETTING_PROPERTIES_OK');
