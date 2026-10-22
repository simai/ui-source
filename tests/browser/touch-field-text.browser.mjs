#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A field's text is never below 16px on a touch phone (simai/ui-source#25,
// ui-chat): iOS Safari zooms the page into a field whose text is smaller than
// 16px when it takes focus. Served through the loader, at 390px, in a touch
// phone (coarse pointer, no hover) and in a plain window of the same width,
// and at 1440px:
//   - on the touch phone every text field reads at least 16px: sf-input and
//     sf-textarea of every step, the dropdown's search, the datepicker's field
//     and the menu's search; a field already at 16px or more keeps its own;
//   - each field stands exactly as tall on the touch phone as in the plain
//     window: only the font size moves, the control height stays the step's;
//   - the plain window of the same width and the desktop are unchanged: a field
//     of size 1/2 still reads its own step there, below 16px.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'),
  smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const html = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:16px">
${SIZES.map((size) => `<sf-input data-field="input ${size}" size="${size}" label="Поле" value="Текст"></sf-input>`).join('\n')}
${SIZES.map((size) => `<sf-textarea data-field="textarea ${size}" size="${size}" label="Текст" value="Текст"></sf-textarea>`).join('\n')}
<sf-datepicker data-field="datepicker" size="1/2" label="Дата"></sf-datepicker>
<sf-dropdown id="dropdown" size="1/2" mode="select" label="Город">
  <sf-list-item kind="text" text="Москва"></sf-list-item>
  <sf-list-item kind="text" text="Казань"></sf-list-item>
</sf-dropdown>
<button id="trigger" type="button">Меню</button>
<sf-context-menu id="menu" popup aria-label="Язык"></sf-context-menu>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(html);
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
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const measure = async (options) => {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.querySelectorAll('sf-input input').length >= 5
    && document.querySelectorAll('sf-textarea textarea').length === 5
    && document.querySelector('sf-datepicker input') && document.querySelector('#dropdown button[aria-haspopup]')
    && customElements.get('sf-context-menu'), null, {timeout: 20000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const fields = await page.evaluate(() => [...document.querySelectorAll('[data-field]')].map((host) => {
    const control = host.querySelector('input, textarea');
    const box = (host.querySelector('.sf-input-field, .sf-textarea-field, .sf-datepicker-field') || control).getBoundingClientRect();
    return {name: host.dataset.field, font: parseFloat(getComputedStyle(control).fontSize), height: box.height};
  }));
  // The dropdown's search.
  await page.locator('#dropdown button[aria-haspopup]').click();
  const search = page.locator('.sf-list:not([hidden]) .sf-input input').first();
  await search.waitFor({timeout: 5000}).catch(() => failures.push({name: 'the dropdown search never drew'}));
  fields.push(await search.evaluate((input) => ({name: 'dropdown search', font: parseFloat(getComputedStyle(input).fontSize),
    height: input.closest('.sf-input-field')?.getBoundingClientRect().height ?? input.getBoundingClientRect().height})).catch(() => ({name: 'dropdown search', font: 0, height: 0})));
  await page.keyboard.press('Escape');
  // The menu's search.
  await page.evaluate(() => {
    const menu = document.getElementById('menu');
    menu.search = {placeholder: 'Найти язык', empty: 'Ничего не найдено'};
    menu.entries = [{id: 'ru', text: 'Русский'}, {id: 'en', text: 'English'}];
    menu.openFor(document.getElementById('trigger'));
  });
  await page.waitForSelector('.sf-context-menu-search-input', {timeout: 5000}).catch(() => failures.push({name: 'the menu search never drew'}));
  fields.push(await page.evaluate(() => {
    const input = document.querySelector('.sf-context-menu-search-input');
    return input ? {name: 'menu search', font: parseFloat(getComputedStyle(input).fontSize), height: input.getBoundingClientRect().height}
      : {name: 'menu search', font: 0, height: 0};
  }));
  const tokens = await page.evaluate(() => Object.fromEntries(['1/3', '1/2', '1', '2', '3'].map((size) => {
    const probe = document.createElement('span');
    probe.style.fontSize = `var(--sf-text-size-${size.replace('/', '\\/')})`;
    document.body.append(probe);
    const font = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return [size, font];
  })));
  const media = await page.evaluate(() => ({coarse: matchMedia('(pointer: coarse)').matches, hover: matchMedia('(hover: hover)').matches}));
  await context.close();
  return {fields, tokens, media};
};

const browser = await chromium.launch();
try {
  const touch = await measure({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 3});
  const plain = await measure({viewport: {width: 390, height: 844}});
  const desktop = await measure({viewport: {width: 1440, height: 900}});
  evidence.touch = touch.fields;
  evidence.plain = plain.fields;
  evidence.desktop = desktop.fields;
  evidence.media = {touch: touch.media, plain: plain.media, desktop: desktop.media};

  check('the touch context is a coarse pointer without hover', touch.media.coarse && !touch.media.hover, touch.media);
  check('the plain context is a fine pointer that hovers', !plain.media.coarse && plain.media.hover, plain.media);
  check('a field\'s text below 16px on a phone exists to begin with (1/2 is under 16px at 390px)', plain.tokens['1/2'] < 16, plain.tokens);
  for (const field of touch.fields) {
    const flat = plain.fields.find((entry) => entry.name === field.name);
    check(`touch 390px ${field.name}: the text is at least 16px`, field.font >= 16, field);
    check(`touch 390px ${field.name}: the field is as tall as in a plain window`, flat && Math.abs(flat.height - field.height) <= 0.01, {touch: field, plain: flat});
    // A field already at 16px or more keeps its own text: the floor never shrinks one.
    check(`touch 390px ${field.name}: the text is its own or the floor, whichever is larger`, flat && field.font === Math.max(16, flat.font), {touch: field, plain: flat});
  }
  for (const [label, run] of [['plain 390px', plain], ['desktop 1440px', desktop]]) {
    for (const size of SIZES) {
      const field = run.fields.find((entry) => entry.name === `input ${size}`);
      check(`${label} input ${size}: unchanged, its text is below the floor where its step is`, run.tokens[size] >= 16 || field.font < 16, {field, token: run.tokens[size]});
    }
    const half = run.fields.find((entry) => entry.name === 'textarea 1/2');
    check(`${label} textarea 1/2: unchanged, below 16px`, half.font < 16, half);
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('TOUCH_FIELD_TEXT_OK');
