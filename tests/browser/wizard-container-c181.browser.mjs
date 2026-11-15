#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-wizard 1.3.3 (owner decision C181 (2)): the window footer of C179 (4) --
// sticky at the window's bottom, Back and the main action sharing the row --
// follows the wizard's own width, below the container step g5 (30rem), not
// the screen's width. On the built bytes with the real Loader, light and dark:
//   1440, a window in a 400 px overlay container   narrow frame: phone footer
//   1440, a window on the page                     wide frame: desktop footer
//   390,  a window on the page (the whole screen)  narrow frame: phone footer
//   390,  a window in a 720 px overlay container   wide frame: desktop footer
// A screen query would draw the 1440 box as the desktop and the 390 box as the
// phone; the frame's own width decides here. No page errors, no failed
// requests. With a screenshot folder, each case is saved there as a PNG.
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

const head = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface);color:var(--sf-on-surface)}</style></head><body>`;

// The second step, so the footer holds Back and the main action.
const wizard = `<sf-button id="open" text="Импорт"></sf-button>
<sf-wizard id="w" place="modal" for="open" heading="Импорт контактов" current="preview">
<sf-wizard-step name="upload" label="Файл"><p>Файл выбран.</p></sf-wizard-step>
<sf-wizard-step name="preview" label="Проверка" action-text="Импортировать"><p>124 контакта, 3 без почты.</p></sf-wizard-step>
<sf-wizard-step name="result" label="Итог" type="result"><p>Готово.</p></sf-wizard-step>
</sf-wizard>`;
const boxed = (width) => `<div id="box" data-sf-overlay-container style="position: relative; inline-size: ${width}px; block-size: 640px">${wizard}</div>`;

let theme = 'light';
const pages = {'/page': wizard, '/box-400': boxed(400), '/box-720': boxed(720)};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`${head(theme)}${pages[path]}</body></html>`);
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

const CASES = [
  {name: 'wide-screen-narrow-box', path: '/box-400', width: 1440, phone: true},
  {name: 'wide-screen-page', path: '/page', width: 1440, phone: false},
  {name: 'phone-screen-page', path: '/page', width: 390, phone: true},
  {name: 'phone-screen-wide-box', path: '/box-720', width: 390, phone: false},
];

const results = [];
const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) {
    for (const item of CASES) {
      theme = scheme;
      const tag = `${item.name}-${scheme}`;
      const context = await browser.newContext({viewport: {width: item.width, height: 800}, locale: 'ru-RU', colorScheme: scheme, reducedMotion: 'reduce'});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      await tab.goto(`${base}${item.path}`);
      await tab.waitForFunction(() => customElements.get('sf-wizard') && customElements.get('sf-button') && document.querySelector('#open button'), null, {timeout: 20000}).catch(() => null);
      await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
      await tab.click('#open button');
      await tab.waitForFunction(() => {
        const frame = document.querySelector('.sf-wizard--window');
        const primary = frame?.querySelector('.sf-wizard-primary > :is(button, a)');
        return frame && primary && frame.getBoundingClientRect().width > 0 && primary.getBoundingClientRect().width > 0;
      }, null, {timeout: 15000}).catch(() => null);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(400);
      const seen = await tab.evaluate(() => {
        const frame = document.querySelector('.sf-wizard--window');
        if (!frame) return null;
        const rect = (el) => el?.getBoundingClientRect();
        const footer = frame.querySelector('.sf-wizard-footer');
        const back = frame.querySelector('.sf-wizard-back > :is(button, a)');
        const primary = frame.querySelector('.sf-wizard-primary > :is(button, a)');
        const modal = frame.closest('.sf-modal');
        return {
          frame: rect(frame).width,
          screen: window.innerWidth,
          box: document.getElementById('box')?.getBoundingClientRect().width ?? null,
          fullscreen: modal?.getAttribute('data-sf-modal-fullscreen') ?? null,
          position: getComputedStyle(footer).position,
          wrap: getComputedStyle(footer).flexWrap,
          back: rect(back).width,
          primary: rect(primary).width,
          sameRow: Math.abs(rect(back).top - rect(primary).top) < 1,
          // The two halves fill the row: Back from the footer's start, the
          // main action to its end, together the footer's width less the gap.
          filled: (rect(back).width + rect(primary).width) / rect(footer).width,
          ends: Math.abs(rect(back).left - rect(footer).left) < 1 && Math.abs(rect(primary).right - rect(footer).right) < 1,
        };
      });
      if (shots) await tab.screenshot({path: join(shots, `${tag}.png`)});
      const fail = [];
      if (!seen) fail.push('no window frame drawn');
      else {
        const narrow = seen.frame < 480;
        if (narrow !== item.phone) fail.push(`frame ${seen.frame.toFixed(1)} px is ${narrow ? 'below' : 'not below'} 30rem`);
        if (item.phone) {
          if (seen.position !== 'sticky') fail.push(`footer position ${seen.position}, sticky expected`);
          if (seen.wrap !== 'nowrap') fail.push(`footer wraps (${seen.wrap})`);
          if (!seen.sameRow || !seen.ends || seen.filled < 0.95 || Math.min(seen.back, seen.primary) < seen.frame * 0.3) fail.push(`Back ${seen.back.toFixed(1)} and the main ${seen.primary.toFixed(1)} do not share the row of ${seen.frame.toFixed(1)}`);
        } else {
          if (seen.position === 'sticky') fail.push('footer is sticky in a wide frame');
          if (seen.filled > 0.9) fail.push(`Back ${seen.back.toFixed(1)} and the main ${seen.primary.toFixed(1)} fill the row of ${seen.frame.toFixed(1)} in a wide frame`);
        }
      }
      if (errors.length) fail.push(`errors: ${errors.join(' | ')}`);
      results.push({case: tag, pass: fail.length === 0, seen, fail});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((row) => !row.pass);
console.log(JSON.stringify({ok: failed.length === 0, cases: results.length, failed: failed.length, results}, null, 2));
if (failed.length) process.exitCode = 1;
