#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-dropdown 1.6.0: a field with nothing chosen says so. An unset choice field
// without a default has no valid value; Larena drew the first choice in its
// place (heading align, section background) because the box was blank. Here, at
// 1280 and at 390, on a Russian and an English page:
// - with no value, the field reads the language's word («Не выбрано», «Not
//   selected»), no option is selected, the value and the form value are empty;
// - a placeholder of the field's own wins over the word;
// - the keyboard opens the list without choosing (ArrowDown, Escape), and a
//   pick with Enter sets the value -- the first and only change;
// - the field stands inside the page, the word is not cut, no sideways scroll.
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
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const options = '<sf-list-item value="left" text="По левому краю"></sf-list-item><sf-list-item value="center" text="По центру"></sf-list-item><sf-list-item value="right" text="По правому краю"></sf-list-item>';
const shell = (lang) => `<!doctype html><html lang="${lang}" class="theme-light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}form{display:flex;flex-direction:column;gap:16px;max-inline-size:480px}</style></head>
<body><form id="form">
<sf-dropdown id="unset" name="align" label="Выравнивание заголовка" search="false">${options}</sf-dropdown>
<sf-dropdown id="own" name="background" label="Фон секции" placeholder="Как у страницы" search="false">${options}</sf-dropdown>
</form></body></html>`;

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const browser = await chromium.launch();
try {
  for (const {lang, width, word} of [{lang: 'ru', width: 1280, word: 'Не выбрано'}, {lang: 'ru', width: 390, word: 'Не выбрано'}, {lang: 'en', width: 1280, word: 'Not selected'}, {lang: 'en', width: 390, word: 'Not selected'}]) {
    const label = `${lang} ${width}`;
    page = shell(lang);
    const context = await browser.newContext({viewport: {width, height: 700}, locale: lang === 'ru' ? 'ru-RU' : 'en-US', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => document.querySelector('#unset .sf-dropdown-field input:not([type=hidden])') && document.querySelector('#own .sf-dropdown-field input:not([type=hidden])'), null, {timeout: 25000});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(300);
    await tab.evaluate(() => {
      window.changes = [];
      document.querySelector('#unset').addEventListener('change', (event) => window.changes.push(event.detail?.value));
    });
    const state = () => tab.evaluate(() => {
      const host = document.querySelector('#unset');
      const input = host.querySelector('.sf-dropdown-field input:not([type=hidden])');
      const box = host.querySelector('.sf-dropdown-field').getBoundingClientRect();
      const ownInput = document.querySelector('#own .sf-dropdown-field input:not([type=hidden])');
      return {
        placeholder: input.placeholder,
        shown: input.value,
        value: host.value,
        attribute: host.getAttribute('value'),
        form: new FormData(document.querySelector('#form')).get('align'),
        selected: [...document.querySelectorAll('.sf-list-item.selected')].filter((item) => host.contains(item) || host._list?.contains(item)).length,
        ariaSelected: [...(host._list || host).querySelectorAll('[role=option][aria-selected=true]')].length,
        own: ownInput.placeholder,
        open: host.querySelector('.sf-dropdown')?.classList.contains('open') || false,
        fits: box.left >= -0.5 && box.right <= innerWidth + 0.5,
        cut: input.scrollWidth > input.clientWidth + 0.5,
        sideways: document.documentElement.scrollWidth > innerWidth,
        summary: host.querySelector('.sf-dropdown-value')?.textContent || '',
      };
    });
    const first = await state();
    ok(`${label}: an unset field reads «${word}»`, first.placeholder === word && first.shown === '', JSON.stringify(first));
    ok(`${label}: nothing is chosen, value and form value are empty`, first.selected === 0 && first.value === '' && (first.form === '' || first.form === null), JSON.stringify(first));
    ok(`${label}: the field's own placeholder wins`, first.own === 'Как у страницы', JSON.stringify(first));
    ok(`${label}: the word is announced, not a choice`, first.summary === word, JSON.stringify(first));
    ok(`${label}: the field stands inside the page, the word is whole, no sideways scroll`, first.fits && !first.cut && !first.sideways, JSON.stringify(first));

    await tab.focus('#unset .sf-dropdown-field > button');
    await tab.keyboard.press('ArrowDown');
    await tab.waitForTimeout(200);
    const opened = await state();
    ok(`${label}: ArrowDown opens the list and chooses nothing`, opened.open && opened.value === '' && opened.selected === 0 && opened.ariaSelected === 0, JSON.stringify(opened));
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(200);
    const closed = await state();
    ok(`${label}: Escape leaves it unset`, !closed.open && closed.value === '' && closed.placeholder === word && closed.shown === '', JSON.stringify(closed));

    await tab.keyboard.press('ArrowDown');
    await tab.waitForTimeout(200);
    await tab.keyboard.press('ArrowDown');
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(200);
    const picked = await state();
    const changes = await tab.evaluate(() => window.changes);
    ok(`${label}: a pick with Enter sets the value, once`, picked.value === 'center' && picked.form === 'center' && picked.shown === 'По центру' && changes.length === 1 && changes[0] === 'center', JSON.stringify({picked, changes}));
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
