#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-settings in a side sheet at its start, timing-hostile (GB21 return R2,
// ui-control evidence 2026-11-28-gb21-return). The page is the docs' side
// sheet example -- sf-drawer show-close="false" with a look="panel" panel
// inside (remember, reset-label, close-label) -- beside a sheet with its own
// close, an sf-modal without its header and a <dialog>, each with a panel.
//
// A panel that drew before the sheet took it into its panel (sf-drawer moves
// its content at its own first drawing) connected again holding its own frame,
// took that frame for the page's trigger and drew it into itself: a
// HierarchyRequestError (insertBefore: the new child contains the parent) and
// an empty panel, on about one load in ten (more when the sheet's module came
// late). The server here delays the sheet's files on some loads and the
// panel's on others, so both orders are met on every run:
//
// - fresh loads (a new context each, 24: half with a kept value), reloads
//   in one context (24), and an open-close loop (15) by the panel's close;
// - every load: no page error, no console error; every panel drawn (its rows
//   exist); the sheet's panel shows the kept value when one was kept;
// - each open in the loop: the panel's rows and one close in the sheet.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};

// The order of the two modules on this load: 'drawer' late, 'settings' late, or none.
let late = '';
const LATE_MS = 350;
const ITEMS = JSON.stringify({items: [
  {id: 'size', type: 'choice', text: 'Размер текста', value: 'm', options: [{id: 's', text: 'Мелкий'}, {id: 'm', text: 'Обычный'}, {id: 'l', text: 'Крупный'}]},
  {id: 'hyphens', type: 'switch', text: 'Переносы', value: false},
]});
const ONE = JSON.stringify({items: [{id: 'hyphens', type: 'switch', text: 'Переносы', value: false}]});
const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body><main>
<sf-button id="open" text="Шторка" data-drawer="open" aria-controls="sheet"></sf-button>
<sf-button id="open-own" text="Шторка со своим крестиком" data-drawer="open" aria-controls="sheet-own"></sf-button>
<button id="open-modal" type="button" data-sf-modal-open="win">Окно</button>
<sf-settings id="s-inline" look="panel" label="В потоке"><script type="application/json" data-sf-settings>${ONE}</script></sf-settings>
</main>
<sf-drawer id="sheet" placement="inline-end" size="1/2" show-close="false" label="Настройки чтения">
  <sf-settings id="s" look="panel" label="Настройки чтения" remember="reader" reset-label="Как было" close-label="Закрыть настройки" style="--sf-settings-panel-width: 100%; --sf-settings-panel-height: 100%"><script type="application/json" data-sf-settings>${ITEMS}</script></sf-settings>
</sf-drawer>
<sf-drawer id="sheet-own" placement="inline-end" size="1/2" label="Свой крестик">
  <sf-settings id="s-own" look="panel" label="Настройки"><script type="application/json" data-sf-settings>${ONE}</script></sf-settings>
</sf-drawer>
<sf-modal modal-id="win" show-header="false" show-footer="false"><div slot="content">
  <sf-settings id="s-modal" look="panel" label="Окно" close-label="Закрыть окно"><script type="application/json" data-sf-settings>${ONE}</script></sf-settings>
</div></sf-modal>
</body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(PAGE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  const send = () => {
    response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type, 'cache-control': 'no-store'});
    response.end(readFileSync(file));
  };
  if (late && path.startsWith(`/distr/smart/${late}/`)) setTimeout(send, LATE_MS);
  else send();
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;
const ORDERS = ['', 'drawer', 'settings'];

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();
const KEPT = '{"size":"l","hyphens":false}';

function watch(tab) {
  const errors = [];
  tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`.slice(0, 200)));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 200)); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  return errors;
}

// After a load: every panel drawn, the sheet's panel inside the sheet, and its value.
async function settle(tab) {
  await tab.waitForFunction(() => customElements.get('sf-drawer') && customElements.get('sf-settings') && customElements.get('sf-modal'), null, {timeout: 30000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.waitForTimeout(500);
  return tab.evaluate(() => {
    const rows = (id) => document.getElementById(id)?.querySelectorAll('.sf-settings-row-main').length ?? 0;
    const s = document.getElementById('s');
    return {rows: ['s', 's-own', 's-modal', 's-inline'].map(rows), inSheet: Boolean(s?.closest('[data-sf-drawer-panel]')), size: s?.values?.size};
  });
}
const alive = (state) => state.rows.every((n) => n > 0) && state.inSheet;

// Fresh loads: a new context each; half keep a value before the page.
{
  let failed = 0; const notes = [];
  for (let at = 0; at < 24; at += 1) {
    late = ORDERS[at % 3];
    const kept = at >= 12;
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'ru-RU', reducedMotion: 'reduce'});
    if (kept) await context.addInitScript((value) => { try { localStorage.setItem('sf-pref:sf-settings/reader', value); } catch {} }, KEPT);
    const tab = await context.newPage(); const errors = watch(tab);
    let state = null;
    try {
      await tab.goto(`${base}/page`);
      state = await settle(tab);
    } catch (error) { errors.push(error.message.split('\n')[0]); }
    const good = state && alive(state) && !errors.length && (!kept || state.size === 'l');
    if (!good) { failed += 1; notes.push(`#${at} late=${late || 'none'} kept=${kept} ${JSON.stringify(state)} ${errors.join(' | ')}`); }
    await context.close();
  }
  ok(`fresh loads: 24, every panel drawn, kept values shown, no errors (failed ${failed})`, failed === 0, notes.join(' || '));
}

// Reloads in one context: the second half keeps a value.
{
  let failed = 0; const notes = [];
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'ru-RU', reducedMotion: 'reduce'});
  const tab = await context.newPage(); let errors = watch(tab);
  for (let at = 0; at < 24; at += 1) {
    late = ORDERS[at % 3];
    errors.length = 0;
    let state = null;
    try {
      if (at === 12) await tab.evaluate((value) => localStorage.setItem('sf-pref:sf-settings/reader', value), KEPT);
      if (at === 0) await tab.goto(`${base}/page`); else await tab.reload();
      state = await settle(tab);
    } catch (error) { errors.push(error.message.split('\n')[0]); }
    const good = state && alive(state) && !errors.length && (at < 12 || state.size === 'l');
    if (!good) { failed += 1; notes.push(`#${at} late=${late || 'none'} ${JSON.stringify(state)} ${errors.join(' | ')}`); }
  }
  await context.close();
  ok(`reloads: 24 in one context, every panel drawn, kept values shown, no errors (failed ${failed})`, failed === 0, notes.join(' || '));
}

// Open-close loop: 15 opens by the opener, each closed by the panel's close;
// a fresh page each round of five, the sheet's module late on one of three.
{
  let failed = 0; const notes = [];
  for (let round = 0; round < 3; round += 1) {
    late = ORDERS[round];
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage(); const errors = watch(tab);
    try {
      await tab.goto(`${base}/page`);
      await settle(tab);
      for (let at = 0; at < 5; at += 1) {
        await tab.click('#open button');
        await tab.waitForFunction(() => document.getElementById('sheet').openState && document.querySelector('#s .sf-settings-panel-close button'), null, {timeout: 10000}).catch(() => null);
        await tab.waitForTimeout(250);
        const m = await tab.evaluate(() => {
          const panel = document.querySelector('#s .sf-settings-panel');
          const shown = (one) => one.getClientRects().length > 0 && getComputedStyle(one).visibility !== 'hidden';
          return {
            open: Boolean(document.getElementById('sheet').openState),
            rows: document.querySelectorAll('#s .sf-settings-row-main').length,
            closes: [...document.querySelectorAll('[data-sf-drawer-portal] button[aria-label], #sheet button[aria-label]')]
              .filter((one) => shown(one) && /акры/u.test(one.getAttribute('aria-label'))).length,
            panel: Boolean(panel),
          };
        });
        await tab.click('#s .sf-settings-panel-close button').catch((error) => errors.push(`no close: ${error.message.split('\n')[0]}`));
        await tab.waitForFunction(() => !document.getElementById('sheet').openState, null, {timeout: 5000}).catch(() => errors.push('the sheet stayed open'));
        await tab.waitForTimeout(250);
        if (!(m.open && m.rows > 0 && m.closes === 1) || errors.length) {
          failed += 1; notes.push(`round ${round} #${at} late=${late || 'none'} ${JSON.stringify(m)} ${errors.join(' | ')}`); errors.length = 0;
        }
      }
    } catch (error) { failed += 1; notes.push(`round ${round}: ${error.message.split('\n')[0]}`); }
    await context.close();
  }
  ok(`open-close loop: 15 opens, the panel drawn with one close each time, closed by it, no errors (failed ${failed})`, failed === 0, notes.join(' || '));
}

await browser.close();
server.close();
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
