#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The class button's ghost look (examples pass EX-7, decision C15): ghost is
// the name and sf-button--link its former one until 2027-01-01 (journal
// class-button-link-to-ghost). A page that writes sf-button--link without
// ghost is noted once in SF.deprecations; a button that carries both (what the
// Smart sf-button and the constructor write) is not. The constructor's type
// 'link' draws ghost and both classes, and is noted as the former option
// value. Both names draw the same. At 1440 and 390, light and dark.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const page = (theme, extra) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}</style></head>
<body><main id="main" style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:16px">
<button id="ghost" type="button" class="sf-button sf-button--size-1 sf-button--ghost sf-button--on-surface"><span class="sf-button-text-container">Отмена</span></button>
<button id="both" type="button" class="sf-button sf-button--size-1 sf-button--ghost sf-button--link sf-button--on-surface"><span class="sf-button-text-container">Отмена</span></button>
<sf-button id="smart" appearance="ghost" scheme="on-surface" text="Отмена"></sf-button>
${extra}
<div id="made"></div></main></body></html>`;
const LINK = '<button id="link" type="button" class="sf-button sf-button--size-1 sf-button--link sf-button--on-surface"><span class="sf-button-text-container">Отмена</span></button>';
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
const linkNotes = () => (window.SF?.deprecations?.list?.() || []).filter((note) => note.from === 'sf-button--link' || (note.attribute === 'type' && note.from === 'link'));
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    const label = `${width} ${theme}`;
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme, locale: 'ru-RU'});
    const errors = [];
    const open = async (extra) => {
      html = page(theme, extra);
      const tab = await context.newPage();
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`${base}/page`);
      await tab.waitForFunction(() => window.SF?.Loader && document.querySelector('#smart button'), null, {timeout: 25000}).catch(() => {});
      await tab.evaluate(() => new Promise((settle) => window.SF.Loader.ready('Buttons', () => settle())));
      await tab.waitForTimeout(300);
      return tab;
    };
    // A page with ghost, both classes and the Smart button: nothing to note.
    const clean = await open('');
    const before = await clean.evaluate(`(${linkNotes})()`);
    ok(`${label}: ghost, ghost with link and the Smart ghost button are not noted`, before.length === 0, JSON.stringify(before));
    const smart = await clean.evaluate(() => [...document.querySelector('#smart button').classList].filter((name) => /--(ghost|link)$/u.test(name)));
    ok(`${label}: the Smart ghost button writes ghost and the former link beside it`, smart.includes('sf-button--ghost') && smart.includes('sf-button--link'), JSON.stringify(smart));
    // The former name alone, added after the page started: noted once.
    const later = await clean.evaluate(async (markup) => {
      document.querySelector('#made').insertAdjacentHTML('beforeend', markup + markup.replace('id="link"', 'id="link2"'));
      await new Promise((settle) => setTimeout(settle, 100));
      return (window.SF.deprecations.list() || []).filter((note) => note.from === 'sf-button--link');
    }, LINK);
    ok(`${label}: sf-button--link alone, added later, is noted once with ghost and its date`, later.length === 1 && later[0].to === 'sf-button--ghost' && later[0].remove_after === '2027-01-01' && later[0].kind === 'class', JSON.stringify(later));
    const looks = await clean.evaluate(() => {
      const read = (id) => { const s = getComputedStyle(document.getElementById(id)); return [s.backgroundColor, s.borderTopColor, s.color, s.paddingInlineStart, s.blockSize].join(' '); };
      return {ghost: read('ghost'), link: read('link')};
    });
    ok(`${label}: ghost and the former link draw the same`, looks.ghost === looks.link, JSON.stringify(looks));
    // The constructor's former type.
    const made = await clean.evaluate(() => new Promise((settle) => window.SF.Loader.ready('Buttons', (Buttons) => {
      const one = new Buttons({param: {type: 'link', scheme: 'on-surface', text: 'Отмена'}}).render();
      const two = new Buttons({param: {type: 'ghost', scheme: 'on-surface', text: 'Отмена'}}).render();
      document.querySelector('#made').append(one, two);
      const pick = (element) => [...element.classList].filter((name) => /--(ghost|link)$/u.test(name)).sort();
      settle({link: pick(one), ghost: pick(two), notes: window.SF.deprecations.list().filter((note) => note.attribute === 'type' && note.from === 'link')});
    })));
    ok(`${label}: the constructor's type 'link' draws ghost with link beside it, as type 'ghost' does`, made.link.join() === 'sf-button--ghost,sf-button--link' && made.ghost.join() === made.link.join(), JSON.stringify(made));
    ok(`${label}: the constructor's type 'link' is noted as the former option value`, made.notes.length === 1 && made.notes[0].to === 'ghost', JSON.stringify(made.notes));
    await clean.close();
    // The former name alone in the page's first markup: noted at start.
    const first = await open(LINK);
    const atStart = await first.evaluate(() => (window.SF.deprecations.list() || []).filter((note) => note.from === 'sf-button--link'));
    ok(`${label}: sf-button--link alone in the first markup is noted`, atStart.length === 1, JSON.stringify(atStart));
    await first.close();
    ok(`${label}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const result of results) console.log(`${result.pass ? 'ok' : 'FAIL'} ${result.name}${result.pass ? '' : ` -- ${result.detail}`}`);
const failed = results.filter((result) => !result.pass).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
