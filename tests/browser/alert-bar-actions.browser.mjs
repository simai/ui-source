#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-alert-bar 1.0.1: an action keeps its label whole. Larena showed
// «Отметить, что видели» cut short at a desktop width of 1296 although the bar
// had room. Here the bar carries that label beside «Посмотреть память» and the
// pager, at 1296 across the page, at 1296 in a 640 px column beside a sidebar
// (where the row used to run out of the bar), and at 390. In every case: each
// action is as wide as its label (nothing shrunk, wrapped or cut, no ellipsis),
// stands inside the bar, and the page has no sideways scroll; the message text
// gives way first, down to its floor, and then the actions wrap onto a line of
// their own.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  // utf-8 on every routed file: the Loader may bring a part as a classic script.
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const items = [
  {id: 'swap', level: 'warning', text: 'Подкачка занята на 92%: серверу не хватает памяти, сайты замедляются.', source: 'Сервер', time: new Date(Date.now() - 300000).toISOString(), action: {label: 'Посмотреть память', href: '#memory'}, acknowledge: {label: 'Прочитано'}},
  {id: 'update', level: 'info', text: 'Доступна новая версия панели 0.3.1.', source: 'Обновление', action: {label: 'Посмотреть', href: '#update'}},
];
const shell = (column) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface)}.layout{display:flex}.side{flex:none;inline-size:${column ? 'calc(100% - 640px)' : '0'}}.main{flex:1 1 auto;min-inline-size:0}</style></head>
<body><div class="layout"><aside class="side"></aside><div class="main"><sf-alert-bar id="bar"><script type="application/json" data-sf-settings>${JSON.stringify({items})}</script></sf-alert-bar><p>Сайты</p></div></div></body></html>`;

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const browser = await chromium.launch();
try {
  for (const {label, width, column} of [{label: '1296', width: 1296, column: false}, {label: '1296 in a 640 px column', width: 1296, column: true}, {label: '390', width: 390, column: false}]) {
    page = shell(column);
    const context = await browser.newContext({viewport: {width, height: 700}, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => document.querySelector('#bar .sf-alert-bar-acknowledge :is(button, a)'), null, {timeout: 25000});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(400);
    const seen = await tab.evaluate(() => {
      const bar = document.querySelector('#bar .sf-alert-bar-row').getBoundingClientRect();
      // The label's natural width: the same text, in the same font, unbounded.
      const natural = (element) => {
        const probe = document.createElement('span');
        const style = getComputedStyle(element);
        Object.assign(probe.style, {position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', font: style.font, letterSpacing: style.letterSpacing});
        probe.textContent = element.textContent.trim();
        document.body.append(probe);
        const value = probe.getBoundingClientRect().width;
        probe.remove();
        return value;
      };
      const actions = [...document.querySelectorAll('#bar .sf-alert-bar-actions > :is(.sf-alert-bar-action, .sf-alert-bar-acknowledge) > :is(button, a)')].map((control) => {
        const text = control.querySelector('.sf-button-text-container') || control;
        const box = control.getBoundingClientRect();
        const line = parseFloat(getComputedStyle(text).lineHeight) || 20;
        const cut = [control, ...control.querySelectorAll('*')].some((element) => {
          const style = getComputedStyle(element);
          return element.scrollWidth > element.clientWidth + 0.5 || (style.textOverflow === 'ellipsis' && style.overflow !== 'visible');
        });
        return {text: text.textContent.trim(), width: text.getBoundingClientRect().width, natural: natural(text), lines: Math.round(text.getBoundingClientRect().height / line), cut, left: box.left, right: box.right, top: box.top};
      });
      const message = document.querySelector('#bar .sf-alert-bar-text').getBoundingClientRect();
      return {bar: {left: bar.left, right: bar.right}, actions, message: {width: message.width}, sideways: document.documentElement.scrollWidth > innerWidth, rows: new Set(actions.map((one) => Math.round(one.top))).size};
    });
    const acknowledge = seen.actions.find((one) => one.text === 'Прочитано');
    ok(`${label}: «Прочитано» is drawn whole`, acknowledge && !acknowledge.cut && acknowledge.lines === 1 && acknowledge.width >= acknowledge.natural - 0.5, JSON.stringify(acknowledge));
    ok(`${label}: every action keeps its label's natural width, on one line, uncut`, seen.actions.length === 2 && seen.actions.every((one) => !one.cut && one.lines === 1 && one.width >= one.natural - 0.5), JSON.stringify(seen.actions));
    ok(`${label}: every action stands inside the bar, no sideways scroll`, seen.actions.every((one) => one.left >= seen.bar.left - 0.5 && one.right <= seen.bar.right + 0.5) && !seen.sideways, JSON.stringify({bar: seen.bar, actions: seen.actions.map(({left, right}) => [left, right]), sideways: seen.sideways}));
    if (column) ok(`${label}: the text keeps its floor and the actions wrap`, seen.message.width >= 159.5 && seen.rows >= 1, JSON.stringify(seen));
    if (width === 1296 && !column) ok(`${label}: with room, the actions stand on one line`, seen.rows === 1, JSON.stringify(seen));
    ok(`${label}: no page errors`, !errors.length, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
