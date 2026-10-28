#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The wrap toggle in a code block's head: a button beside copy, named in the
// page language, aria-pressed false; pressed, long lines wrap inside the block
// (no sideways scroll) and it says true; pressed again, they scroll again. A
// block with data-wrap="true" starts wrapped, and data-wrap-control="none"
// has no toggle (owner request through the effects catalogue, 2026-10-29).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const head = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>`;
const line = `const message = '${'a long line of code that does not fit the block '.repeat(6)}';`;
const block = (attributes = '') => `<div class="sf-highlight" ${attributes} style="width:480px"><pre><code class="language-js">${line}</code></pre></div>`;
const cases = {
  plain: block(),
  wrapped: block('data-wrap="true"'),
  none: block('data-wrap-control="none"'),
};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (cases[path.slice(1)]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`${head}${cases[path.slice(1)]}</body></html>`);
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
  const state = (tab) => tab.evaluate(() => {
    const box = document.querySelector('.sf-highlight');
    const toggle = box.querySelector('.sf-highlight__wrap-toggle');
    const pre = box.querySelector('pre');
    const head = [...box.querySelector('.sf-highlight__head').children].map((node) => node.className.split(' ')[0]);
    return {toggle: Boolean(toggle), name: toggle?.getAttribute('aria-label') ?? null, pressed: toggle?.getAttribute('aria-pressed') ?? null,
      sideways: pre.scrollWidth > pre.clientWidth + 1, head};
  });
  const open = async (name) => {
    const tab = await browser.newPage({viewport: {width: 900, height: 700}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    await tab.waitForFunction(() => document.querySelector('.sf-highlight__copy') && document.querySelector('code span[class^="hljs"]'), null, {timeout: 8000}).catch(() => {});
    await tab.waitForTimeout(200);
    return tab;
  };
  let tab = await open('plain');
  seen.plain = await state(tab);
  await tab.locator('.sf-highlight__wrap-toggle').click().catch(() => {});
  await tab.waitForTimeout(100);
  seen.pressed = await state(tab);
  await tab.locator('.sf-highlight__wrap-toggle').click().catch(() => {});
  await tab.waitForTimeout(100);
  seen.released = await state(tab);
  await tab.close();
  tab = await open('wrapped'); seen.wrapped = await state(tab); await tab.close();
  tab = await open('none'); seen.none = await state(tab); await tab.close();
  if (!seen.plain.toggle || seen.plain.name !== 'Переносить строки' || seen.plain.pressed !== 'false' || !seen.plain.sideways) failures.push(`plain: ${JSON.stringify(seen.plain)}`);
  if (seen.plain.head.indexOf('sf-highlight__wrap-toggle') !== seen.plain.head.indexOf('sf-highlight__copy') - 1) failures.push(`the toggle does not stand right before copy: ${seen.plain.head.join(' ')}`);
  if (seen.pressed.pressed !== 'true' || seen.pressed.sideways) failures.push(`pressed: ${JSON.stringify(seen.pressed)}`);
  if (seen.released.pressed !== 'false' || !seen.released.sideways) failures.push(`released: ${JSON.stringify(seen.released)}`);
  if (seen.wrapped.pressed !== 'true' || seen.wrapped.sideways) failures.push(`data-wrap="true": ${JSON.stringify(seen.wrapped)}`);
  if (seen.none.toggle) failures.push('data-wrap-control="none" still drew the toggle');
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_WRAP_TOGGLE_OK');
