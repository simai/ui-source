#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A code block whose text comes after the highlighter: an empty block at load
// (in an sf-tabs panel and on its own) filled 500 ms later is highlighted, and
// a highlighted block whose text a page replaces is highlighted again. The
// empty block was marked done at once and skipped for good, and an observer of
// added elements never saw text written into it (ui-effects site, 2026-10-28).
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
const fill = `<script>setTimeout(() => { document.getElementById('c').textContent = 'const a = 1;'; }, 500);</script>`;
const items = `items='[{"id":"a","label":"A"},{"id":"b","label":"B"}]'`;
const cases = {
  'empty-in-tabs': `<sf-tabs ${items}><div slot="panel-0"><pre><code id="c" class="language-js"></code></pre></div><div slot="panel-1"><p>x</p></div></sf-tabs>${fill}`,
  'empty-alone': `<pre><code id="c" class="language-js"></code></pre>${fill}`,
  'replaced': `<pre><code id="c" class="language-js">const a = 1;</code></pre><script>setTimeout(() => { document.getElementById('c').textContent = 'let b = 2;'; }, 1500);</script>`,
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
const state = (tab) => tab.evaluate(() => {
  const code = document.getElementById('c');
  return {text: code?.textContent ?? null, spans: code?.querySelectorAll('span[class^="hljs"]').length ?? 0};
});
const browser = await chromium.launch();
try {
  for (const [name, text] of [['empty-in-tabs', 'const a = 1;'], ['empty-alone', 'const a = 1;'], ['replaced', 'let b = 2;']]) {
    const tab = await browser.newPage();
    await tab.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    await tab.waitForFunction((want) => {
      const code = document.getElementById('c');
      return code?.textContent === want && code.querySelector('span[class^="hljs"]');
    }, text, {timeout: 6000}).catch(() => {});
    seen[name] = await state(tab);
    if (seen[name].text !== text || seen[name].spans === 0) failures.push(`${name}: ${JSON.stringify(seen[name])}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_LATE_TEXT_OK');
