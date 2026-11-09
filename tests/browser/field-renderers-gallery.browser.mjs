#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The field renderers as the docs gallery draws them (simai/ui-source#34;
// ui-doc examples/guide/property-types/gallery): the set's renderViewField and
// renderEditField(field, value, host, {size: '1/2'}) in three columns of about
// 230 px on a 720 px page, through the real Loader, light and dark, with a
// host that formats nothing:
//   1. string/phone edit of '+7 900 123-45-67' reads the number as Russian:
//      the flag RU, the dial code +7 and the digits 900 123-45-67 in order;
//      a stored +1 and +44 number take US and GB, and +7 7xx Kazakhstan,
//      drawn in the national format +7 701 123-45-67;
//   2. date and datetime view (and cell) print the page's medium reading --
//      25 окт. 2026 г. and 25 окт. 2026 г., 10:30 on a Russian page (the
//      View set's table form, C19), the record's own day and clock -- not the
//      stored text; a host's formatFieldValue still wins; a value that is not
//      a date is shown as it came;
//   3. date and datetime edit stay inside their column, the datetime's whole
//      text visible in its field;
//   4. choices edit (no variant and `badges`) shows the chosen options in the
//      closed control; the checklist ticks them.
// No page errors. With a screenshot folder, each theme is saved there.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
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
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;inline-size:720px;box-sizing:border-box;background:var(--sf-surface);color:var(--sf-on-surface)}
.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start;margin-block-end:12px}</style></head>
<body><div id="rows"></div></body></html>`;

const STATUSES = [
  {value: 'live', label: 'Опубликовано', color: 'success'},
  {value: 'draft', label: 'Черновик', color: 'warning'},
  {value: 'archived', label: 'В архиве'},
];
const ROWS = [
  ['phone-ru', {propertyType: 'string', variant: 'phone', label: 'Телефон'}, '+7 900 123-45-67'],
  ['phone-kz', {propertyType: 'string', variant: 'phone', label: 'Телефон KZ'}, '+7 701 123-45-67'],
  ['phone-us', {propertyType: 'string', variant: 'phone', label: 'Телефон US'}, '+1 212 555-0100'],
  ['phone-gb', {propertyType: 'string', variant: 'phone', label: 'Телефон GB'}, '+44 20 7946 0958'],
  ['date', {propertyType: 'date', label: 'Дата'}, '2026-10-25'],
  ['datetime', {propertyType: 'datetime', label: 'Дата и время'}, '2026-10-25T10:30:00+03:00'],
  ['date-odd', {propertyType: 'date', label: 'Не дата'}, 'когда-нибудь'],
  ['choices', {propertyType: 'choices', label: 'Статусы', options: STATUSES}, ['live', 'draft']],
  ['choices-badges', {propertyType: 'choices', variant: 'badges', label: 'Статусы: метки', options: STATUSES}, ['live', 'draft']],
  ['choices-checklist', {propertyType: 'choices', variant: 'checklist', label: 'Статусы: список', options: STATUSES}, ['live', 'draft']],
];

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  page = shell(theme);
  const context = await browser.newContext({viewport: {width: 720, height: 1400}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('response', (r) => { if (r.status() === 404 && !/\.(woff2|svg)$/u.test(r.url())) errors.push(`404 ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => typeof window.SF?.whenFieldRenderers === 'function', null, {timeout: 20000});
  const drawn = await tab.evaluate(async (rows) => {
    const set = await window.SF.whenFieldRenderers();
    const {html, render} = window.SF;
    const values = Object.fromEntries(rows.map(([key, , value]) => [key, value]));
    const host = {setFieldValue(field, value) { values[field.key] = value; }};
    const formatting = {formatFieldValue: (field) => (field.propertyType === 'date' ? '25 октября 2026' : undefined)};
    const cells = {};
    render(rows.map(([key, field]) => {
      const full = {...field, key};
      const cell = set.renderCellField(full, values[key], {});
      cells[key] = typeof cell === 'string' ? cell : cell === null ? null : 'object';
      return html`<div class="row" data-row=${key}>
        <div>${field.label}</div>
        <div data-view>${set.renderViewField(full, values[key], {})}</div>
        <div data-edit>${set.renderEditField(full, values[key], host, {size: '1/2'})}</div>
      </div>`;
    }), document.getElementById('rows'));
    const hosted = document.createElement('div');
    hosted.id = 'hosted';
    document.body.append(hosted);
    render(html`${set.renderViewField({key: 'date', propertyType: 'date'}, '2026-10-25', formatting)}`, hosted);
    // The page's language is the host's: a node under lang="en" reads in English.
    const english = document.createElement('div');
    english.lang = 'en';
    document.body.append(english);
    const englishCells = {
      date: set.renderCellField({key: 'date', propertyType: 'date'}, '2026-11-02', english),
      datetime: set.renderCellField({key: 'at', propertyType: 'datetime'}, '2026-11-15T10:30:00', english),
    };
    return {cells, englishCells, hostedCell: set.renderCellField({key: 'date', propertyType: 'date'}, '2026-10-25', formatting)};
  }, ROWS);
  await tab.waitForFunction(() => ['sf-input-country', 'sf-input-date', 'sf-dropdown', 'sf-checkbox'].every((tag) => customElements.get(tag))
    && document.querySelector('[data-row="phone-ru"] .sf-country-code[data-iso2]')
    && document.querySelector('[data-row="datetime"] [data-edit] input'), null, {timeout: 20000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.waitForTimeout(500);
  const t = `[${theme}]`;

  // 1. The phone.
  const phones = await tab.evaluate(() => Object.fromEntries(['phone-ru', 'phone-kz', 'phone-us', 'phone-gb'].map((key) => {
    const root = document.querySelector(`[data-row="${key}"] [data-edit] .sf-country-code`);
    return [key, {iso2: root?.dataset.iso2, dial: root?.dataset.dialCode, value: root?.querySelector('input')?.value}];
  })));
  const digits = (text) => String(text || '').replace(/\D/gu, '');
  ok(`${t} phone +7 900: Russia, +7 and the digits in order`, phones['phone-ru'].iso2 === 'RU' && phones['phone-ru'].dial === '+7' && digits(phones['phone-ru'].value) === '79001234567', phones['phone-ru']);
  ok(`${t} phone +7 701: Kazakhstan`, phones['phone-kz'].iso2 === 'KZ' && digits(phones['phone-kz'].value) === '77011234567', phones['phone-kz']);
  // Kazakhstan's numbers read as Russia's: +7 701 123-45-67, not +7 70112 3 45 67.
  ok(`${t} phone +7 701: the national format`, phones['phone-kz'].value === '+7 701 123-45-67', phones['phone-kz']);
  ok(`${t} phone +1: the United States`, phones['phone-us'].iso2 === 'US' && digits(phones['phone-us'].value) === '12125550100', phones['phone-us']);
  ok(`${t} phone +44: the United Kingdom`, phones['phone-gb'].iso2 === 'GB' && digits(phones['phone-gb'].value) === '442079460958', phones['phone-gb']);

  // 2. Date and datetime read.
  const views = await tab.evaluate(() => Object.fromEntries(['date', 'datetime', 'date-odd'].map((key) => [key, document.querySelector(`[data-row="${key}"] [data-view]`)?.textContent.trim()])).valueOf());
  const hostedView = await tab.evaluate(() => document.getElementById('hosted').textContent.trim());
  ok(`${t} date view: 25 окт. 2026 г.`, views.date === '25 окт. 2026 г.', views);
  ok(`${t} datetime view: 25 окт. 2026 г., 10:30, the record's own clock`, views.datetime === '25 окт. 2026 г., 10:30', views);
  ok(`${t} a value that is not a date is shown as it came`, views['date-odd'] === 'когда-нибудь', views);
  ok(`${t} the host's formatFieldValue still wins`, hostedView === '25 октября 2026' && drawn.hostedCell === '25 октября 2026', {hostedView, cell: drawn.hostedCell});
  ok(`${t} under lang="en": Nov 2, 2026 and Nov 15, 2026, 10:30 AM`, drawn.englishCells.date === 'Nov 2, 2026' && /^Nov 15, 2026, 10:30\s?AM$/u.test(drawn.englishCells.datetime ?? ''), drawn.englishCells);
  ok(`${t} date and datetime cells read as the view does`, drawn.cells.date === '25 окт. 2026 г.' && drawn.cells.datetime === '25 окт. 2026 г., 10:30' && drawn.cells['date-odd'] === null, drawn.cells);

  // 3. The date edits stay in their column.
  const boxes = await tab.evaluate(() => Object.fromEntries(['date', 'datetime'].map((key) => {
    const column = document.querySelector(`[data-row="${key}"] [data-edit]`);
    const columnBox = column.getBoundingClientRect();
    const painted = [...column.querySelectorAll('*')].filter((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && !node.closest('[hidden], .sf-datepicker-dropdown, [popover]');
    });
    const right = Math.max(...painted.map((node) => node.getBoundingClientRect().right));
    const input = column.querySelector('input');
    return [key, {column: Math.round(columnBox.width * 10) / 10, columnRight: columnBox.right, right, overflow: Math.max(0, right - columnBox.right), value: input?.value, inputClient: input?.clientWidth, inputScroll: input?.scrollWidth}];
  })));
  ok(`${t} date edit stays inside its column`, boxes.date.overflow < 0.5, boxes.date);
  ok(`${t} datetime edit stays inside its column`, boxes.datetime.overflow < 0.5, boxes.datetime);
  ok(`${t} the datetime's whole text is visible in its field`, /10:30/u.test(boxes.datetime.value || '') && boxes.datetime.inputScroll <= boxes.datetime.inputClient + 1, boxes.datetime);

  // 4. Choices.
  const choices = await tab.evaluate(() => Object.fromEntries(['choices', 'choices-badges'].map((key) => {
    const edit = document.querySelector(`[data-row="${key}"] [data-edit]`);
    const closed = edit.querySelector('sf-dropdown');
    const panel = closed?.querySelector('[role="listbox"], .sf-dropdown-list, .sf-dropdown-menu');
    const visible = [...(closed?.querySelectorAll('*') || [])].filter((node) => !panel?.contains(node) && node.childElementCount === 0 && node.getBoundingClientRect().width > 0)
      .map((node) => node.textContent.trim()).filter(Boolean).join(' | ');
    return [key, {visible, value: closed?.value, values: closed?.values}];
  })));
  for (const key of ['choices', 'choices-badges']) {
    ok(`${t} ${key}: the closed control shows the chosen options`, /Опубликовано/u.test(choices[key].visible) && /Черновик/u.test(choices[key].visible) && !/В архиве/u.test(choices[key].visible), choices[key]);
  }
  const ticked = await tab.evaluate(() => [...document.querySelectorAll('[data-row="choices-checklist"] [data-edit] input[type="checkbox"]')].map((box) => box.checked));
  ok(`${t} choices checklist ticks both`, JSON.stringify(ticked) === JSON.stringify([true, true, false]), ticked);

  if (shots) await tab.screenshot({path: join(shots, `field-renderers-gallery-${theme}.png`), fullPage: true});
  ok(`${t} no page errors`, errors.length === 0, errors);
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((one) => !one.pass);
console.log(JSON.stringify({passed: results.length - failed.length, failed}, null, 2));
if (failed.length) process.exit(1);
