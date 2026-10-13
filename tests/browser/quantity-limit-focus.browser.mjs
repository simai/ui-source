#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A quantity's step button that reaches the limit under keyboard focus is
// disabled, and a disabled button dropped the focus to <body>. Focus moves to
// the value instead, as the stepper pattern does -- at the maximum with the
// plus button and at the minimum with the minus button.
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
<label class="sf-quantity sf-quantity--size-1" id="q"><span class="sf-quantity-label"><span class="sf-quantity-text">Количество</span></span><span class="sf-quantity-wrap"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Меньше"><i class="sf-icon">remove</i></button><input type="text" value="1" step="1" min="0" max="2"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Больше"><i class="sf-icon">add</i></button></span></label>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
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
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => document.querySelector('#q')?.dataset && Object.keys(document.querySelector('#q').dataset).length, null, {timeout: 15000})
    .catch(() => failures.push('the quantity never bound'));
  const where = () => tab.evaluate(() => {
    const active = document.activeElement;
    return active === document.body ? 'body' : active?.tagName === 'INPUT' ? 'value' : active?.getAttribute('aria-label') || active?.tagName;
  });
  for (const [label, presses, value] of [['Больше', 2, '2'], ['Меньше', 3, '0']]) {
    await tab.locator(`#q button[aria-label="${label}"]`).focus();
    for (let index = 0; index < presses; index += 1) {
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(50);
    }
    const state = {value: await tab.locator('#q input').inputValue(), focus: await where(),
      disabled: await tab.locator(`#q button[aria-label="${label}"]`).isDisabled()};
    seen[label] = state;
    if (state.value !== value) failures.push(`${label}: value ${state.value}, expected ${value}`);
    if (!state.disabled) failures.push(`${label}: the button is not disabled at the limit`);
    if (state.focus !== 'value') failures.push(`${label}: focus went to ${state.focus}, expected the value`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
