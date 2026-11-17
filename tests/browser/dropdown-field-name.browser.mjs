#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The class dropdown's visible field is named (examples pass EX-1, 2026-11-17):
// the text input inside .sf-dropdown-field is what the accessibility tree
// shows as the field, and it said only its placeholder («Выберите город»),
// while the Smart sf-dropdown names its readonly input by the drawn label.
// Now the class field is named as the Smart one is: by the visible label,
// else by the page's aria-label, else by its aria-labelledby; the page's own
// name on the input wins. Read from the browser's accessibility tree (CDP),
// at 1440 and 390, light and dark.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const list = (name) => `<div class="sf-list flex flex-col"><div class="sf-list-container-wrap"><div class="sf-list-container flex flex-col">
  <div class="sf-list-item sf-list-item--text sf-list-item--size-1 cursor-pointer selected" data-value="kazan"><div class="sf-list-item-wrap flex flex-1"><div class="sf-list-item-container">Казань</div></div></div>
  <div class="sf-list-item sf-list-item--text sf-list-item--size-1 cursor-pointer" data-value="ufa"><div class="sf-list-item-wrap flex flex-1"><div class="sf-list-item-container">Уфа</div></div></div>
</div></div></div>`;
const field = (input) => `<div class="sf-dropdown-field cursor-pointer items-cross-center transition flex relative">
  <input class="sf-dropdown-hidden-input" type="hidden" name="city">${input}
  <button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--size-1 absolute" aria-label="Открыть список"><i class="sf-icon" aria-hidden="true">keyboard_arrow_down</i></button>
</div>`;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}main{display:flex;flex-direction:column;gap:16px;max-inline-size:480px}</style></head>
<body><main>
<div id="labelled" class="sf-dropdown sf-dropdown--size-1 sf-dropdown--outlined sf-dropdown--text flex flex-col" value="kazan">
  <span class="sf-dropdown-label"><span class="sf-dropdown-text">Город</span></span>${field('<input type="text" placeholder="Выберите город">')}${list()}</div>
<div id="page-label" class="sf-dropdown sf-dropdown--size-1 sf-dropdown--outlined sf-dropdown--text flex flex-col" aria-label="Город доставки">${field('<input type="text" placeholder="Выберите город">')}${list()}</div>
<p id="outer">Город получателя</p>
<div id="page-refs" class="sf-dropdown sf-dropdown--size-1 sf-dropdown--outlined sf-dropdown--text flex flex-col" aria-labelledby="outer">${field('<input type="text" placeholder="Выберите город">')}${list()}</div>
<div id="own" class="sf-dropdown sf-dropdown--size-1 sf-dropdown--outlined sf-dropdown--text flex flex-col">
  <span class="sf-dropdown-label"><span class="sf-dropdown-text">Город</span></span>${field('<input type="text" placeholder="Выберите город" aria-label="Свой город">')}${list()}</div>
</main></body></html>`;
let html = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/favicon.ico') { response.writeHead(204); return response.end(); }
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(html);
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
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    const label = `${width} ${theme}`;
    html = page(theme);
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-dropdown')].every((root) => root.querySelector('.sf-dropdown-field > button[aria-haspopup]')), null, {timeout: 25000});
    await tab.waitForTimeout(300);
    const cdp = await context.newCDPSession(tab);
    const name = async (id) => {
      const {root} = await cdp.send('DOM.getDocument', {depth: -1});
      const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: `#${id} .sf-dropdown-field input[type=text]`});
      const {nodes} = await cdp.send('Accessibility.getPartialAXTree', {nodeId, fetchRelatives: false});
      const node = nodes.find((one) => !one.ignored) || nodes[0];
      const from = (node.name?.sources || []).find((source) => source.value?.value === node.name?.value && !source.superseded);
      return {role: node.role?.value, name: node.name?.value || '', from: from ? (from.attribute || from.type) : ''};
    };
    const labelled = await name('labelled');
    ok(`${label}: the field is named by the visible label, not its placeholder`, labelled.name === 'Город' && labelled.from !== 'placeholder', JSON.stringify(labelled));
    const pageLabel = await name('page-label');
    ok(`${label}: no label: the page's aria-label names the field`, pageLabel.name === 'Город доставки', JSON.stringify(pageLabel));
    const pageRefs = await name('page-refs');
    ok(`${label}: no label: the page's aria-labelledby names the field`, pageRefs.name === 'Город получателя', JSON.stringify(pageRefs));
    const own = await name('own');
    ok(`${label}: the input's own name wins`, own.name === 'Свой город', JSON.stringify(own));
    ok(`${label}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
