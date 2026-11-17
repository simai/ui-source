#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// A calendar in the page fits its column (examples pass EX-5): the class
// sf-datepicker took the window's width -- seven days of the control height,
// at most the window less a gutter -- so in a 286 px column on a wide screen it
// stood 296 and passed the column by 10. Now a calendar that is not a popup
// is at most as wide as its column and the days' grid shrinks with it; a
// popup (role dialog) keeps its own width in a narrow wrapper. At 1440 and
// 390, light and dark.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const days = Array.from({length: 35}, (_, at) => `<button class="sf-datepicker-day flex flex-col content-main-center items-cross-center${at === 15 ? ' active' : ''}" type="button" aria-label="${at + 1} сентября 2026"><span class="sf-datepicker-day-date">${(at % 30) + 1}</span></button>`).join('');
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span class="sf-datepicker-weekday">${day}</span>`).join('');
const calendar = (id, role) => `<div id="${id}" class="sf-datepicker flex flex-col" role="${role}" aria-label="Календарь, сентябрь 2026">
  <div class="sf-datepicker-top grid items-cross-center">
    <button type="button" class="sf-icon-button sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1 flex" aria-label="Предыдущий месяц"><i class="sf-icon" aria-hidden="true">chevron_left</i></button>
    <div class="sf-datepicker-period flex content-main-center items-cross-center">Сентябрь 2026</div>
    <button type="button" class="sf-icon-button sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1 flex" aria-label="Следующий месяц"><i class="sf-icon" aria-hidden="true">chevron_right</i></button>
  </div>
  <div class="sf-datepicker-row grid grid-col-7" aria-hidden="true">${weekdays}</div>
  <div class="sf-datepicker-main"><div class="sf-datepicker-row grid grid-col-7">${days}</div></div>
</div>`;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}</style></head>
<body><div id="column" style="inline-size:286px">${calendar('in-column', 'group')}</div>
<div id="wide">${calendar('in-page', 'group')}</div>
<div id="wrap" style="position:relative;inline-size:120px;block-size:40px"><div style="position:absolute;inset-block-start:100%;inset-inline-start:0">${calendar('popup', 'dialog')}</div></div></body></html>`;
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
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/page`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(600);
    const m = await tab.evaluate(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      const column = box('#column');
      const past = [...document.querySelectorAll('#in-column, #in-column *')].map((node) => node.getBoundingClientRect()).filter((one) => one.width).map((one) => one.right - column.right);
      const daysWide = [...document.querySelectorAll('#in-column .sf-datepicker-main .sf-datepicker-day')].map((day) => day.getBoundingClientRect().width);
      return {column: column.width, calendar: box('#in-column').width, past: Math.max(...past), day: Math.min(...daysWide), page: box('#in-page').width, popup: box('#popup').width};
    });
    ok(`${label}: the calendar stands inside its 286 px column`, m.past <= 0.5 && m.calendar <= m.column + 0.5, JSON.stringify(m));
    ok(`${label}: the days shrink with it and stay in the grid`, m.day > 0 && m.day * 7 <= m.calendar, JSON.stringify(m));
    ok(`${label}: a calendar with room keeps its own width`, m.page >= m.calendar - 0.5 && m.page < 400, JSON.stringify(m));
    ok(`${label}: a popup keeps its own width in a narrow wrapper`, Math.abs(m.popup - m.page) <= 0.5, JSON.stringify(m));
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
