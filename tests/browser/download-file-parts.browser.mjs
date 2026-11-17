#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The class download row (examples pass EX-8): the script found the size part
// only by its former name, sf-download-file-file-size, so a row written with
// the BEM part __size alone (the class's own and the Smart element's markup)
// was never asked for its size; and sf-download-file--ready, the Smart
// element's word for a file to fetch, had no rule. Now the size part is read
// by either name, the class writes --ready on a row that can be pressed, and
// the sheet gives a ready row the pointer and the plate's motion with no
// utility class. At 1440 and 390, light and dark.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const row = (id, size) => `<a id="${id}" class="sf-download-file sf-download-file--ready" href="/files/report.pdf" download="report.pdf"><span class="sf-download-file__body"><span class="sf-download-file__main"><i class="sf-download-file__icon sf-icon" aria-hidden="true">download</i><span class="sf-download-file__text"><span class="sf-download-file__name">Отчёт</span><span class="sf-download-file__meta"><span class="sf-download-file__type">PDF</span><span class="${size}"></span></span></span></span></span></a>`;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}</style></head>
<body><main style="display:flex;flex-direction:column;gap:16px">${row('bem', 'sf-download-file__size')}${row('former', 'sf-download-file__size sf-download-file-file-size')}<button id="ready-button" type="button" class="sf-download-file sf-download-file--ready"><span class="sf-download-file__body"><span class="sf-download-file__main"><span class="sf-download-file__text"><span class="sf-download-file__name">Выгрузка</span></span></span></span></button><div id="made"></div></main></body></html>`;
let html = '';
const FILE = Buffer.alloc(2516582, 1);
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/favicon.ico') { response.writeHead(204); return response.end(); }
  if (path === '/files/report.pdf') {
    response.writeHead(200, {'content-type': 'application/pdf', 'content-length': String(FILE.length)});
    return response.end(request.method === 'HEAD' ? undefined : FILE);
  }
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
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => document.querySelector('#former .sf-download-file__size')?.textContent.trim(), null, {timeout: 25000}).catch(() => {});
    await tab.waitForTimeout(500);
    const sizes = await tab.evaluate(() => ({bem: document.querySelector('#bem .sf-download-file__size').textContent.trim(), former: document.querySelector('#former .sf-download-file__size').textContent.trim()}));
    ok(`${label}: a row with the former size part is asked for its size`, /2,4/u.test(sizes.former), JSON.stringify(sizes));
    ok(`${label}: a row with the BEM size part alone is asked for its size too`, /2,4/u.test(sizes.bem) && sizes.bem === sizes.former, JSON.stringify(sizes));
    const look = await tab.evaluate(() => { const s = getComputedStyle(document.querySelector('#ready-button')); return {cursor: s.cursor, duration: s.transitionDuration, property: s.transitionProperty}; });
    ok(`${label}: a ready row (a button) points, with no utility class`, look.cursor === 'pointer', JSON.stringify(look));
    ok(`${label}: a ready row's plate moves on the motion scale`, look.duration !== '0s' && /background-color/u.test(look.property), JSON.stringify(look));
    const made = await tab.evaluate(() => new Promise((settle) => {
      const run = () => window.SF.Loader.ready('DownloadFile', (DownloadFile) => {
        const one = new DownloadFile({param: {href: '/files/report.pdf', fileName: 'Отчёт.pdf', fileType: 'PDF', fileSize: '2,4 МБ'}}).render();
        const off = new DownloadFile({param: {fileName: 'Нет файла.pdf', disabled: true}}).render();
        document.querySelector('#made').append(one, off);
        settle({ready: one.classList.contains('sf-download-file--ready'), offReady: off.classList.contains('sf-download-file--ready'), offCursor: getComputedStyle(off).cursor});
      });
      if (window.SF?.Loader) run(); else window.addEventListener('sf-loader-init', run, {once: true});
    }));
    ok(`${label}: the class writes --ready on a row that can be pressed, not on a disabled one`, made.ready && !made.offReady && made.offCursor !== 'pointer', JSON.stringify(made));
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
