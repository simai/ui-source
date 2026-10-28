#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A highlighted block in a grid row shows all its lines: its code took
// height: 100% of the block, head included, once a grid row gave the block a
// height, and the last lines were clipped; a flex column did not (ui-effects
// site, 2026-10-28). The block is a column now, the code taking the rest.
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
const code = Array.from({length: 14}, (_, at) => `const line${at} = ${at};`).join('\n');
const block = `<div class="sf-highlight" data-title="JavaScript"><pre><code class="language-js">${code}</code></pre></div>`;
const cases = {
  grid: `<div id="g" style="display:grid;grid-auto-rows:auto;gap:16px">${block}</div>`,
  column: `<div id="g" style="display:flex;flex-direction:column;gap:16px">${block}</div>`,
  fixed: `<div id="g" style="display:grid;grid-template-rows:200px">${block}</div>`,
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
  for (const name of Object.keys(cases)) {
    const tab = await browser.newPage({viewport: {width: 900, height: 900}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    await tab.waitForFunction(() => document.querySelector('.sf-highlight__wrap') && document.querySelector('code span[class^="hljs"]'), null, {timeout: 8000}).catch(() => {});
    await tab.waitForTimeout(300);
    seen[name] = await tab.evaluate(() => {
      const box = document.querySelector('.sf-highlight');
      const head = box.querySelector('.sf-highlight__head');
      const wrap = box.querySelector('.sf-highlight__wrap');
      return {block: Math.round(box.getBoundingClientRect().height), head: Math.round(head?.getBoundingClientRect().height ?? 0), wrap: Math.round(wrap.getBoundingClientRect().height), content: Math.round(box.scrollHeight)};
    });
    await tab.close();
  }
  for (const name of ['grid', 'column']) {
    const s = seen[name];
    if (s.content > s.block + 1) failures.push(`${name}: the block (${s.block}px) clips its content (${s.content}px)`);
  }
  if (seen.grid.block !== seen.column.block) failures.push(`grid and column differ: ${seen.grid.block} and ${seen.column.block}`);
  if (seen.fixed.block !== 200 || seen.fixed.head + seen.fixed.wrap > 201) failures.push(`a 200px block: ${JSON.stringify(seen.fixed)}`);
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_GRID_ROW_OK');
