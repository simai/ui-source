#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// A copy the browser refuses, pressed from the keyboard (acceptance of C48,
// 2026-11-11). The source is selected so the keys copy it, and the focus stays
// on the control (M2): before, a selection outside the control took the focus
// to the page and the next Tab started again at the top. Every copying
// control: sf-button-copy with a value and with a target, <button data-sf-copy>,
// sf-button-icon and sf-button with the route, a text button with a target, the
// class route, Highlight's copy. Enter and Space; then Tab lands on the control
// after it (for Highlight's copy, the code's scrolling viewport). A field target takes the focus by design and is not here.
// Also: the keys copy what the button would (L3: Highlight's empty line is
// empty, not a space), and two refusals one after the other show one result
// (L4).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loads = Number(process.argv[3] ?? 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const CONTROLS = [
  ['c-value', '<sf-button-copy id="c-value" value="sk_test_51H" label="Скопировать ключ"></sf-button-copy>'],
  ['c-target', '<sf-button-copy id="c-target" size="1/2" target="#txt" label="Скопировать текст"></sf-button-copy>'],
  ['plain', '<button id="plain" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface" data-sf-copy="plain text" aria-label="Скопировать текст"><span class="sf-icon" aria-hidden="true">content_copy</span></button>'],
  ['hicon', '<sf-button-icon id="hicon" icon="content_copy" label="Скопировать текст" appearance="ghost" data-sf-copy-target="#txt"></sf-button-icon>'],
  ['htext', '<sf-button id="htext" icon-start="content_copy" text="Копировать адрес" data-sf-copy="https://ui.simai.io/"></sf-button>'],
  ['ptext', '<button id="ptext" class="sf-button sf-button--size-1 sf-button--outline sf-button--primary" data-sf-copy-target="#txt">Копировать текст</button>'],
  ['legacy', '<button id="legacy" class="btn-clipboard sf-button sf-button--size-1 sf-button--outline" data-copy="old value">Старый data-copy</button>'],
];
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';document.execCommand=()=>false;</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body><main>
<div id="txt">Текст <b>элемента</b> целиком</div>
${CONTROLS.map(([id, html]) => `<p>${html} <button id="n-${id}">После</button></p>`).join('\n')}
<pre><code id="code" class="language-js" data-lines>const a = 1;

const b = 2;</code></pre>
<button id="n-hl">После кода</button>
</main></body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const runs = [];
const browser = await chromium.launch();
try {
  for (let load = 1; load <= loads; load += 1) {
    const context = await browser.newContext({viewport: {width: 1200, height: 900}, reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const cdp = await context.newCDPSession(tab);
    for (const name of ['clipboard-write', 'clipboard-read']) await cdp.send('Browser.setPermission', {permission: {name}, setting: 'denied', origin});
    await tab.goto(`${origin}/`);
    await tab.waitForFunction(() => document.querySelector('.sf-highlight__copy') && document.querySelector('#c-value button') && document.querySelector('#htext button'), null, {timeout: 20000});
    await tab.waitForTimeout(500);
    const ids = [...CONTROLS.map(([id]) => id), 'hl'];
    const control = (id) => (id === 'hl' ? '.sf-highlight__copy' : `#${id}`);
    for (const key of ['Enter', ' ']) {
      for (const id of ids) {
        await tab.evaluate((selector) => {
          getSelection().removeAllRanges();
          const element = document.querySelector(selector);
          (element.localName === 'button' ? element : element.querySelector('button')).focus();
        }, control(id));
        await tab.keyboard.press(key === ' ' ? 'Space' : key);
        await tab.waitForTimeout(150);
        const after = await tab.evaluate((selector) => {
          const element = document.querySelector(selector);
          const button = element.localName === 'button' ? element : element.querySelector('button');
          return {focused: document.activeElement === button, selected: String(getSelection()).length > 0};
        }, control(id));
        await tab.keyboard.press('Tab');
        // The control after it: the marker button, or for Highlight's copy the
        // code's own scrolling viewport, the next stop inside the block.
        const next = await tab.evaluate(() => {
          const active = document.activeElement;
          if (active?.closest?.('pre, .sf-highlight') && !active.matches('.sf-highlight__copy')) return 'n-hl';
          return active?.id || active?.localName;
        });
        const run = {load, key: key === ' ' ? 'Space' : key, id, ...after, next};
        runs.push(run);
        if (!after.focused || !after.selected || next !== `n-${id}`) failures.push(run);
        // Let the result go before the next press.
        await tab.evaluate(() => window.SF?.__copyResult?.reset?.());
      }
    }
    // L3: the keys copy Highlight's code as the button does, the empty line empty.
    const keys = await tab.evaluate(async () => {
      getSelection().removeAllRanges();
      document.querySelector('.sf-highlight__copy').click();
      await new Promise((done) => setTimeout(done, 150));
      const data = new DataTransfer();
      document.dispatchEvent(new ClipboardEvent('copy', {clipboardData: data, bubbles: true, cancelable: true}));
      return data.getData('text/plain');
    });
    if (keys !== 'const a = 1;\n\nconst b = 2;') failures.push({load, check: 'keys copy the code with an empty line', keys});
    // L4: two refusals one after the other: one result on screen.
    const shown = await tab.evaluate(async () => {
      document.querySelector('#c-value button').click();
      await new Promise((done) => setTimeout(done, 150));
      document.querySelector('#c-target button').click();
      await new Promise((done) => setTimeout(done, 150));
      return [...document.querySelectorAll('.sf-copy-button-result, .sf-clipboard-result')].filter((box) => !box.hidden && box.getBoundingClientRect().width > 0).length;
    });
    if (shown !== 1) failures.push({load, check: 'one result at a time', shown});
    if (errors.length) failures.push({load, errors});
    console.log(`load ${load}: ${runs.filter((run) => run.load === load && run.focused && run.next === `n-${run.id}`).length}/${ids.length * 2} keep focus and Tab on; keys ${JSON.stringify(keys)}; results shown ${shown}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log(`COPY_REFUSAL_KEYBOARD_OK ${runs.length} presses`);
