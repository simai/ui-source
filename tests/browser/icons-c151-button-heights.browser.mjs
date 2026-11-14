#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// Owner decision C151 point 5 puts an icon in running text on the middle of
// the line. Inside an icon button the glyph keeps the bottom alignment: a
// button laid out without flex hung the middle glyph on its own strut, and
// sf-file-preview's size 1/2 actions stood 28.55 instead of 28 in compact
// density and on a phone (group build 5 acceptance, the C151 return).
//
// Every icon button stands on the ladder, at 1440, 1440 compact
// (data-sf-density="compact") and 390, light and dark:
//
//   - sf-button-icon, sizes 1/3 to 3: 28 / 32 / 40 / 48 / 56 on desktop,
//     24 / 28 / 32 / 40 / 48 compact, 24 / 28 / 36 / 44 / 52 on a phone;
//   - sf-pager's list link and its arrows: the same step as sf-button-icon of
//     the pager's size;
//   - sf-file-preview's actions (row, chip, tile; buttons without flex): the
//     height of sf-button-icon of the same size class;
//   - class markup without .flex: the same;
//   - every height a whole pixel; the icon in running text stays on middle.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const LADDER = {
  desktop: {'1/3': 28, '1/2': 32, '1': 40, '2': 48, '3': 56},
  compact: {'1/3': 24, '1/2': 28, '1': 32, '2': 40, '3': 48},
  phone: {'1/3': 24, '1/2': 28, '1': 36, '2': 44, '3': 52},
};
const body = (density) => `<main ${density ? `data-sf-density="${density}"` : ''} style="padding:16px;display:flex;flex-direction:column;gap:16px">
  <div style="display:flex;gap:12px;align-items:center" id="ladder">
    ${SIZES.map((size) => `<sf-button-icon icon="close" size="${size}" aria-label="Закрыть"></sf-button-icon>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px" id="pager">
    <sf-pager data-step="1/2" appearance="counter" size="1/2" current="19" total="240" list-href="#list"></sf-pager>
    <sf-pager data-step="1" appearance="counter" size="1" current="19" total="240" list-href="#list"></sf-pager>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px;max-inline-size:40rem" id="file-preview">
    <sf-file-preview file-name="Договор поставки.pdf" file-size="2516582" href="#contract"></sf-file-preview>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <sf-file-preview appearance="chip" file-name="Договор поставки.pdf" file-size="2516582"></sf-file-preview>
      <sf-file-preview appearance="tile" stored file-name="Смета на ремонт.xlsx" file-size="2411724" href="#estimate"></sf-file-preview>
    </div>
  </div>
  <div style="display:flex;gap:12px;align-items:center" id="class">
    ${['1/2', '1'].map((size) => `<button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-${size}" aria-label="Закрыть"><i class="sf-icon" aria-hidden="true">close</i></button>`).join('')}
  </div>
  <p id="text" style="margin:0">Текст со значком <sf-icon icon="info" size="1/3"></sf-icon> в строке.</p>
</main>`;
const pageOf = (theme, density) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.sfSmartPath = '/distr'; window.SF_BOOT_CONFIG = {theme: false, smart: {base: true}, preloader: {enabled: false}};</script>
<script defer src="/distr/core/js/smart-base.js"></script><script defer src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-page);color:var(--sf-on-surface);font-family:var(--sf-text--family);font-size:var(--sf-text-size-1);line-height:var(--sf-text-height-1)}</style>
</head><body>${body(density)}</body></html>`;
const pages = {};
for (const theme of ['light', 'dark']) for (const density of ['', 'compact']) pages[`/${theme}${density ? '-compact' : ''}.html`] = pageOf(`theme-${theme}`, density);

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const content = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(content);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const VIEWS = [
  {label: 'desktop', viewport: {width: 1440, height: 900}, density: ''},
  {label: 'compact', viewport: {width: 1440, height: 900}, density: 'compact'},
  {label: 'phone', viewport: {width: 390, height: 900}, density: '', mobile: true},
];
const failures = [];
const measured = {};
const browser = await chromium.launch();
try {
  for (const view of VIEWS) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({viewport: view.viewport, ...(view.mobile ? {isMobile: true, hasTouch: true, deviceScaleFactor: 2} : {})});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/${theme}${view.density ? '-compact' : ''}.html`);
    await page.evaluate(() => Promise.all(['sf-button-icon', 'sf-pager', 'sf-file-preview', 'sf-icon'].map((tag) => customElements.whenDefined(tag))));
    await page.waitForFunction(() => document.querySelectorAll('#file-preview .sf-icon-button').length >= 4 && document.querySelectorAll('#pager .sf-icon-button').length >= 6, null, {timeout: 10000});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const read = await page.evaluate(() => {
      const sizeOf = (button) => (button.className.match(/sf-icon-button--size-(\S+)/) || [])[1]?.replace('\\', '') || '';
      const row = (button) => ({size: sizeOf(button), height: Math.round(button.getBoundingClientRect().height * 100) / 100, display: getComputedStyle(button).display});
      const all = (selector) => [...document.querySelectorAll(selector)].filter((button) => button.getBoundingClientRect().width > 0).map(row);
      const icon = document.querySelector('#text sf-icon .sf-icon') || document.querySelector('#text sf-icon');
      return {
        ladder: [...document.querySelectorAll('#ladder sf-button-icon')].map((host) => row(host.querySelector('.sf-icon-button'))),
        pager: [...document.querySelectorAll('#pager sf-pager')].flatMap((host) => [...host.querySelectorAll('.sf-icon-button')].map((button) => ({...row(button), size: host.dataset.step}))),
        filePreview: all('#file-preview .sf-icon-button'),
        classMarkup: all('#class .sf-icon-button'),
        inline: icon ? getComputedStyle(icon).verticalAlign : '',
      };
    });
    const key = `${view.label}-${theme}`;
    measured[key] = {...read, errors};
    const step = LADDER[view.label];
    const check = (group, rows) => {
      for (const item of rows) {
        const want = step[item.size];
        if (!Number.isInteger(item.height) || item.height !== want) failures.push({view: key, group, size: item.size, height: item.height, want, display: item.display});
      }
    };
    check('sf-button-icon', read.ladder);
    check('sf-pager', read.pager);
    check('sf-file-preview', read.filePreview);
    check('class markup', read.classMarkup);
    if (read.ladder.length !== SIZES.length || read.pager.length < 6 || read.filePreview.length < 4 || read.classMarkup.length !== 2) failures.push({view: key, check: 'every host drew its buttons', counts: [read.ladder.length, read.pager.length, read.filePreview.length, read.classMarkup.length]});
    if (read.inline !== 'middle') failures.push({view: key, check: 'an icon in running text stays on middle', got: read.inline});
    if (errors.length) failures.push({view: key, check: 'console', errors});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({measured, failures}, null, 2));
if (failures.length && !reportOnly) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
