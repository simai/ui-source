#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Owner decision C148 (4), `divided`: an inset line under every row of a list
// but its last, on the built bytes through the real Loader, at 1440 and 390, in
// the light and the dark theme:
// - sf-list divided without row actions: lines on rows 1..n-1, none on row n.
//   In sf-list every sf-list-item is the only element of its li.sf-list__row,
//   so a rule that reads `sf-list-item:last-child` matches every row and drew
//   no line at all (group build 5 intent acceptance returned C148 on it);
// - sf-list divided with row actions («⋯» beside each item): the same lines;
// - bare sf-list-item divided, three in one parent, no li: lines on 1..n-1;
// - the line is one hairline in --sf-outline-variant (its `::after` is drawn);
// - no page error.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const items = [
  {id: 'a', text: 'Договоры', supporting: '12 файлов', icon: 'folder'},
  {id: 'b', text: 'Счета', supporting: '4 файла', icon: 'folder'},
  {id: 'c', text: 'Акты', supporting: '2 файла', icon: 'folder'},
];
const settings = (extra) => `<script type="application/json" data-sf-settings>${JSON.stringify({...extra, items})}</script>`;
const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface)}.box{inline-size:min(480px,100%);box-sizing:border-box;padding:8px}</style></head>
<body>
<div class="box"><sf-list id="plain" label="Без действий" divided>${settings({})}</sf-list></div>
<div class="box"><sf-list id="actions" label="С действиями" divided>${settings({actions: [{id: 'del', text: 'Удалить'}]})}</sf-list></div>
<div class="box" id="bare">${items.map((item) => `<sf-list-item text="${item.text}" supporting="${item.supporting}" icon="${item.icon}" divided></sf-list-item>`).join('')}</div>
</body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(shell(url.searchParams.get('theme') || 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail: pass ? '' : detail});

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const label = `${width} ${theme}`;
      const context = await browser.newContext({viewport: {width, height: 1000}, locale: 'ru-RU', reducedMotion: 'reduce'});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(String(error)));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`${base}/page?theme=${theme}`);
      await tab.waitForFunction(() => document.querySelectorAll('#plain .sf-list-item-container').length === 3
        && document.querySelectorAll('#actions .sf-list-item-container').length === 3
        && document.querySelectorAll('#bare .sf-list-item-container').length === 3, null, {timeout: 20000});
      const read = await tab.evaluate(() => {
        const line = (container) => {
          const after = getComputedStyle(container, '::after');
          return after.content === 'none' || after.content === 'normal' ? null : {height: parseFloat(after.height), colour: after.backgroundColor};
        };
        const probe = document.createElement('div');
        probe.style.color = 'var(--sf-outline-variant)';
        document.body.append(probe);
        const role = getComputedStyle(probe).color;
        probe.remove();
        const rows = (selector) => [...document.querySelectorAll(`${selector} .sf-list-item-container`)].map(line);
        return {role, plain: rows('#plain'), actions: rows('#actions'), bare: rows('#bare'), withActions: document.querySelectorAll('#actions .sf-list__row button').length};
      });
      for (const kind of ['plain', 'actions', 'bare']) {
        const rows = read[kind];
        ok(`${label} ${kind}: lines on rows 1..n-1, none on row n`, rows.length === 3 && rows[0] && rows[1] && rows[2] === null, rows);
        ok(`${label} ${kind}: the line is one hairline in --sf-outline-variant`, rows.slice(0, 2).every((row) => row && row.height > 0 && row.height <= 1 && row.colour === read.role), {rows, role: read.role});
      }
      ok(`${label}: the actions list has its row buttons`, read.withActions >= 3, read.withActions);
      ok(`${label}: no page error`, errors.length === 0, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((result) => !result.pass);
for (const result of failed) console.error(`FAIL ${result.name}: ${JSON.stringify(result.detail)}`);
console.log(JSON.stringify({checked: results.length, failed: failed.length}));
if (failed.length) process.exit(1);
console.log('LIST_DIVIDED_OK');
