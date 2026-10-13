#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The input mask on a page that loads Core and lets the Loader bring the field:
// the documented pattern grammar (`+{7} (000) 000-00-00` used to print its
// braces and re-read its own 7 as input), the template shown with
// mask-lazy="false" and a typed first digit after a click past the template,
// a Number mask from JSON options, and the markup form on label.sf-input.
// And a page that runs the field's script before Core (SF_PRELOADED, the way
// Docara loads every page and example frame, all deferred): the field, bound
// as its script ran after parsing, found no SF.Mask at
// bind time and stayed unmasked for good.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<sf-input id="phone" label="Телефон" mask mask-pattern="+{7} (000) 000-00-00"></sf-input>
<sf-input id="template" label="Телефон" mask mask-pattern="+{7} (000) 000-00-00" mask-lazy="false" mask-placeholder-char="_"></sf-input>
<sf-input id="number" label="Сумма" mask mask-options='{"mask":"Number","thousandsSeparator":" ","scale":2,"radix":","}'></sf-input>
<label class="sf-input" id="markup" data-mask="true" data-mask-pattern="00.00.0000"><span class="sf-input-field"><input type="text"></span></label>
</body></html>`;
const preloaded = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';
window.SF_PRELOADED={modules:['inputs'],loadedPlugins:{inputs:{}}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/inputs/css/inputs.css">
<script defer src="/distr/core/js/smart-base.js"></script>
<script defer src="/distr/component/inputs/js/inputs.js"></script>
<script defer src="/distr/core/js/core.js"></script></head><body>
<label class="sf-input" id="early" data-mask="true" data-mask-pattern="+{7} (000) 000-00-00"><span class="sf-input-field"><input type="text"></span></label>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/' || path === '/preloaded') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(path === '/' ? page : preloaded);
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

const expected = {
  phone: {typed: '9161234567', value: '+7 (916) 123-45-67'},
  template: {typed: '916', value: '+7 (916) ___-__-__', before: '+7 (___) ___-__-__'},
  number: {typed: '1234567,5', value: '1 234 567,5'},
  markup: {typed: '12032026', value: '12.03.2026'},
};
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => document.querySelectorAll('.sf-input').length >= 4
    && [...document.querySelectorAll('.sf-input')].every((root) => root.__sfInputMask), null, {timeout: 15000})
    .catch(() => failures.push('not every field bound its mask'));
  for (const [id, {typed, value, before}] of Object.entries(expected)) {
    const input = tab.locator(`#${id} input`);
    if (before) {
      const shown = await input.inputValue();
      if (shown !== before) failures.push(`${id}: shows ${JSON.stringify(shown)} before typing, expected ${JSON.stringify(before)}`);
      const box = await input.boundingBox();
      await tab.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
    } else {
      await input.click();
    }
    await tab.keyboard.type(typed);
    seen[id] = await input.inputValue();
    if (seen[id] !== value) failures.push(`${id}: typed ${typed}, got ${JSON.stringify(seen[id])}, expected ${JSON.stringify(value)}`);
  }
  const early = await browser.newPage();
  await early.goto(`http://127.0.0.1:${server.address().port}/preloaded`);
  await early.waitForFunction(() => document.querySelector('#early').__sfInputMask, null, {timeout: 10000})
    .catch(() => failures.push('early: the field whose script ran before Core never bound its mask'));
  await early.locator('#early input').click();
  await early.keyboard.type('9161234567');
  seen.early = await early.locator('#early input').inputValue();
  if (seen.early !== '+7 (916) 123-45-67') failures.push(`early: got ${JSON.stringify(seen.early)}`);
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
