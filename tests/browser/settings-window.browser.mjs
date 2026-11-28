#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-settings 1.12.0 (group build 21 area B; Docara K-13, decision C437) on the
// built bytes with the real Loader, at 1440 and 390 px, light and dark:
//
// - a panel of look="panel" in a side sheet (sf-drawer show-close="false"),
//   in an sf-modal without its header, and in a page's <dialog>: the panel
//   draws its close button, named by close-label, at the end of its head;
//   a press by the mouse, by the keyboard (Enter, Space) and by a touch asks
//   sf-settings-close (reason close) and closes the window; a cancelled
//   request keeps it open; sf-settings-closed follows;
// - a window that draws its own close (sf-drawer's default) keeps it: the
//   panel draws none, so there are never two;
// - a panel in the flow outside any window draws none; a popup panel keeps
//   its close and closes by the mouse, Enter, a touch and Escape;
// - reset-label is the footer reset's text, the Framework word without it;
// - --sf-settings-panel-width / -height: 100% give the panel the sheet's
//   width and height, only its body scrolls; the defaults keep the popup
//   step (20rem at 1440);
// - remember: the values a person chose are written as {id: value} under
//   localStorage sf-pref:sf-settings/<name>; on each of three reloads the
//   head reader the docs print (core PREPAINT_READER) answers them before the body
//   is parsed -- before the first paint -- and the panel's first drawing
//   already shows them (no frame with the declared value).
// No page errors, no 404, no sideways scroll.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';
import {PREPAINT_READER} from '../../src/core/js/preferences.js';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
const pages = new Map();
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages.has(path)) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages.get(path));
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

const ITEMS = [
  {id: 'size', type: 'choice', text: 'Размер текста', value: 'm', options: [{id: 's', text: 'Мелкий'}, {id: 'm', text: 'Обычный'}, {id: 'l', text: 'Крупный'}]},
  {id: 'width', type: 'choice', text: 'Ширина строки', value: 'normal', options: [{id: 'narrow', text: 'Узкая'}, {id: 'normal', text: 'Обычная'}, {id: 'wide', text: 'Широкая'}]},
  {id: 'hyphens', type: 'switch', text: 'Переносы', value: false},
];
const island = (items) => `<script type="application/json" data-sf-settings>${JSON.stringify({items}).replace(/</gu, '\\u003c')}</script>`;
const settings = (id, attrs = '') => `<sf-settings id="${id}" look="panel" label="Настройки чтения"${attrs}>${island(ITEMS)}</sf-settings>`;
const FILL = ' style="--sf-settings-panel-width: 100%; --sf-settings-panel-height: 100%"';

// Each case: the page's body. The window is opened by the probe.
const CASES = {
  drawer: `<sf-button-icon id="open" icon="tune" aria-label="Настройки чтения" data-drawer="open" aria-controls="sheet"></sf-button-icon>
    <sf-drawer id="sheet" placement="inline-end" size="1/2" show-close="false" label="Настройки чтения">${settings('s', ` remember="reader" reset-label="Как было" close-label="Закрыть настройки"${FILL}`)}</sf-drawer>`,
  'drawer-own-close': `<sf-button-icon id="open" icon="tune" aria-label="Настройки чтения" data-drawer="open" aria-controls="sheet"></sf-button-icon>
    <sf-drawer id="sheet" placement="inline-end" size="1/2" label="Настройки чтения">${settings('s', FILL)}</sf-drawer>`,
  modal: `<button id="open" type="button" data-sf-modal-open="win">Открыть</button>
    <sf-modal modal-id="win" show-header="false" show-footer="false"><div slot="content">${settings('s', ' close-label="Закрыть окно"')}</div></sf-modal>`,
  dialog: `<button id="open" type="button" onclick="document.getElementById('dlg').showModal()">Открыть</button>
    <dialog id="dlg" style="padding:0;border:0;background:transparent">${settings('s')}</dialog>`,
  popup: `<sf-settings id="s" look="panel" label="Настройки чтения" reset-label="Как было"><sf-button-icon id="open" icon="tune" aria-label="Настройки чтения"></sf-button-icon>${island(ITEMS)}</sf-settings>`,
  inline: `${settings('s')}`,
};

const head = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<script>
  ${PREPAINT_READER}
  (function () {
    var values = sfPreference('sf-settings/reader');
    window.__early = {values: values, body: Boolean(document.body)};
    if (values && typeof values.size === 'string') document.documentElement.dataset.readerSize = values.size;
    // The panel's first drawing: which size option is checked when the row first exists.
    window.__first = null;
    new MutationObserver(function (list, observer) {
      var row = document.querySelector('#s [data-sf-setting="size"][aria-checked="true"]');
      if (row) { window.__first = row.getAttribute('data-sf-option'); observer.disconnect(); }
    }).observe(document.documentElement, {childList: true, subtree: true, attributes: true});
  })();
</script>
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface);font-family:var(--sf-font-family, system-ui)}main{padding:16px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;box-sizing:border-box}</style></head>`;
for (const [name, body] of Object.entries(CASES)) {
  for (const theme of ['light', 'dark']) pages.set(`/${name}-${theme}`, `${head(theme)}<body><main>${body}<p id="after">После</p></main>
<script>window.__events=[];for(const type of ['close','closed']){document.addEventListener('sf-settings-'+type,(e)=>window.__events.push([type,e.detail&&e.detail.reason]));}</script></body></html>`);
}

// PROBE_SERVE_ONLY=1: serve the pages and wait (a person looks at them).
if (process.env.PROBE_SERVE_ONLY) {
  console.log(`serving ${base}/<case>-<theme>: ${[...pages.keys()].join(' ')}`);
  await new Promise(() => {});
}

// The close's native button (sf-button-icon hands its data-* to it).
const CLOSE = '#s .sf-settings-panel-close button';
const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

async function load(tab, url) {
  await tab.goto(url);
  await tab.waitForFunction(() => customElements.get('sf-settings') && document.querySelector('#s .sf-settings-panel'), null, {timeout: 30000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
}

async function newTab({width, theme, touch = false}) {
  const context = await browser.newContext({viewport: {width, height: 800}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce', hasTouch: touch, isMobile: touch});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  return {context, tab, errors};
}

// Opens the window of a case and waits for the panel to stand in it.
async function openWindow(tab, name, {touch = false} = {}) {
  if (name === 'inline') return;
  const opener = name === 'popup' ? '#open button' : name.startsWith('drawer') ? '#open button' : '#open';
  if (touch) await tab.tap(opener); else await tab.click(opener);
  await tab.waitForFunction((n) => {
    const panel = document.querySelector('#s .sf-settings-panel');
    if (!panel || panel.hidden) return false;
    const box = panel.getBoundingClientRect();
    if (n === 'dialog') return document.getElementById('dlg').open && box.width > 0;
    if (n === 'modal') return box.width > 0 && document.querySelector('sf-modal').openState;
    return box.width > 0;
  }, name, {timeout: 10000});
  await tab.waitForTimeout(400);
}

const windowOpen = (name) => (name === 'dialog' ? `document.getElementById('dlg').open`
  : name === 'modal' ? `Boolean(document.querySelector('sf-modal').openState)`
  : name === 'popup' ? `!document.querySelector('#s .sf-settings-panel').hidden`
  : `Boolean(document.getElementById('sheet').openState)`);

const MEASURE = () => {
  const panel = document.querySelector('#s .sf-settings-panel');
  const button = panel.querySelector('.sf-settings-panel-close button');
  const r = (el) => el && el.getBoundingClientRect();
  const head = r(panel.querySelector('.sf-settings-panel-head'));
  const reset = panel.querySelector('[data-sf-reset]');
  const body = panel.querySelector('.sf-settings-panel-body');
  const sheet = panel.closest('[data-sf-drawer-body]');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;inline-size:var(--sf-popup-panel-width)';
  document.body.append(probe);
  const step = Math.round(probe.getBoundingClientRect().width);
  probe.remove();
  return {
    closes: panel.querySelectorAll('.sf-settings-panel-close').length,
    drawerCloses: [...document.querySelectorAll('[data-sf-drawer-portal] button[aria-label]')].filter((one) => !panel.contains(one) && /акры/u.test(one.getAttribute('aria-label'))).length,
    closeName: button?.getAttribute('aria-label') ?? '',
    closeAtEnd: button && head ? Math.round(head.right - r(button).right) : null,
    closeInHead: button && head ? r(button).top >= head.top - 0.5 && r(button).bottom <= head.bottom + 0.5 : null,
    reset: (reset?.querySelector('button') ?? reset)?.textContent.trim() ?? '',
    width: Math.round(r(panel).width),
    height: Math.round(r(panel).height),
    step,
    sheetWidth: sheet ? Math.round(sheet.clientWidth - parseFloat(getComputedStyle(sheet).paddingLeft) - parseFloat(getComputedStyle(sheet).paddingRight)) : null,
    sheetHeight: sheet ? Math.round(sheet.clientHeight - parseFloat(getComputedStyle(sheet).paddingTop) - parseFloat(getComputedStyle(sheet).paddingBottom)) : null,
    body: body ? getComputedStyle(body).overflowY : '',
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
};

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    for (const name of Object.keys(CASES)) {
      const label = `${name} ${width} ${theme}`;
      const {context, tab, errors} = await newTab({width, theme});
      try {
      await load(tab, `${base}/${name}-${theme}`);
      await openWindow(tab, name);
      const m = await tab.evaluate(MEASURE);
      const drawsClose = !['drawer-own-close', 'inline'].includes(name);
      ok(`${label}: the panel ${drawsClose ? 'draws one close button' : 'draws no close of its own'}`, m.closes === (drawsClose ? 1 : 0), JSON.stringify(m));
      if (name === 'drawer-own-close') ok(`${label}: the sheet keeps its own close: one close in the window`, m.closes === 0 && m.drawerCloses >= 1, JSON.stringify(m));
      if (drawsClose) {
        const expected = {drawer: 'Закрыть настройки', modal: 'Закрыть окно'}[name] ?? 'Закрыть';
        ok(`${label}: the close is named by close-label (or the Framework word) and ends the head`, m.closeName === expected && m.closeInHead && m.closeAtEnd >= 0 && m.closeAtEnd <= 24, JSON.stringify(m));
      }
      ok(`${label}: the reset reads reset-label, else the Framework word`, m.reset === (['drawer', 'popup'].includes(name) ? 'Как было' : 'Сбросить'), JSON.stringify(m));
      if (name === 'drawer' || name === 'drawer-own-close') {
        ok(`${label}: --sf-settings-panel-width/-height 100% fill the sheet; only the body scrolls`, m.sheetWidth && Math.abs(m.width - m.sheetWidth) <= 1 && m.sheetHeight && Math.abs(m.height - m.sheetHeight) <= 1 && m.body === 'auto', JSON.stringify(m));
      }
      if (name === 'popup' && width === 1440) ok(`${label}: the default width is the popup step (--sf-popup-panel-width)`, m.width === m.step, JSON.stringify(m));
      if (name === 'inline' && width === 1440) ok(`${label}: the default width is the popup step (--sf-popup-panel-width), height its content's`, m.width === m.step && m.height > 100 && m.height < 600, JSON.stringify(m));
      ok(`${label}: no sideways scroll`, !m.sideways, JSON.stringify(m));
      if (shots) await tab.screenshot({path: join(shots, `${name}-${width}-${theme}.png`)});

      if (drawsClose) {
        // The mouse.
        await tab.click(CLOSE);
        await tab.waitForTimeout(500);
        let state = await tab.evaluate(`({open: ${windowOpen(name)}, events: window.__events})`);
        ok(`${label}: a click on the close asks close (reason close), closes the window, then closed`, !state.open
          && JSON.stringify(state.events) === JSON.stringify([['close', 'close'], ['closed', name === 'popup' ? 'close' : 'close']]), JSON.stringify(state));
        // The keyboard: Enter, then Space.
        for (const key of ['Enter', 'Space']) {
          await tab.evaluate(() => { window.__events = []; });
          await openWindow(tab, name);
          await tab.focus(CLOSE);
          await tab.keyboard.press(key);
          await tab.waitForTimeout(500);
          state = await tab.evaluate(`({open: ${windowOpen(name)}, events: window.__events})`);
          ok(`${label}: ${key} on the close closes the window`, !state.open && state.events[0]?.[0] === 'close' && state.events.at(-1)?.[0] === 'closed', JSON.stringify(state));
        }
        // A cancelled request keeps the window open.
        await tab.evaluate(() => { window.__events = []; window.__stop = (e) => e.preventDefault(); document.addEventListener('sf-settings-close', window.__stop); });
        await openWindow(tab, name);
        await tab.click(CLOSE);
        await tab.waitForTimeout(400);
        state = await tab.evaluate(`({open: ${windowOpen(name)}, events: window.__events})`);
        ok(`${label}: a cancelled close keeps the window open, no closed`, state.open && !state.events.some((one) => one[0] === 'closed'), JSON.stringify(state));
        await tab.evaluate(() => document.removeEventListener('sf-settings-close', window.__stop));
        if (name === 'popup') {
          await tab.keyboard.press('Escape');
          await tab.waitForTimeout(400);
          state = await tab.evaluate(`({open: ${windowOpen(name)}})`);
          ok(`${label}: Escape closes the popup`, !state.open, JSON.stringify(state));
        } else {
          await tab.click(CLOSE);
          await tab.waitForTimeout(400);
        }
      }
      ok(`${label}: no page errors`, !errors.length, errors.join(' | '));
      } catch (error) {
        ok(`${label}: the case ran to its end`, false, `${error.message.split('\n')[0]} ${JSON.stringify(await tab.evaluate(MEASURE).catch(() => null))}`);
      }
      await context.close();
    }
  }
}

// A touch: a phone at 390, each window that the panel closes.
for (const name of ['drawer', 'modal', 'dialog', 'popup']) {
  const label = `${name} 390 touch`;
  const {context, tab, errors} = await newTab({width: 390, theme: 'light', touch: true});
  try {
    await load(tab, `${base}/${name}-light`);
    await openWindow(tab, name, {touch: true});
    await tab.tap(CLOSE);
    await tab.waitForTimeout(500);
    const state = await tab.evaluate(`({open: ${windowOpen(name)}, events: window.__events})`);
    ok(`${label}: a tap on the close closes the window`, !state.open && state.events[0]?.[0] === 'close' && state.events.at(-1)?.[0] === 'closed', JSON.stringify(state));
  } catch (error) {
    ok(`${label}: the case ran to its end`, false, `${error.message.split('\n')[0]} ${JSON.stringify(await tab.evaluate(MEASURE).catch(() => null))}`);
  }
  ok(`${label}: no page errors`, !errors.length, errors.join(' | '));
  await context.close();
}

// remember before the first paint: choose «Крупный», then reload three times.
{
  const {context, tab, errors} = await newTab({width: 1440, theme: 'light'});
  try {
  await load(tab, `${base}/drawer-light`);
  const first = await tab.evaluate(() => ({early: window.__early, first: window.__first}));
  ok('remember: a first visit has nothing kept; the panel draws the declared value', first.early.values === null && first.early.body === false && first.first === 'm', JSON.stringify(first));
  await openWindow(tab, 'drawer');
  await tab.click('#s [data-sf-setting="size"][data-sf-option="l"]');
  await tab.waitForTimeout(300);
  await tab.click('#s [data-sf-setting="hyphens"]');
  await tab.waitForTimeout(300);
  const kept = await tab.evaluate(() => localStorage.getItem('sf-pref:sf-settings/reader'));
  ok('remember: the values are written as {id: value} under sf-pref:sf-settings/reader', kept && JSON.stringify(JSON.parse(kept)) === JSON.stringify({size: 'l', width: 'normal', hyphens: true}), kept);
  for (let load3 = 1; load3 <= 3; load3 += 1) {
    await load(tab, `${base}/drawer-light`);
    const early = await tab.evaluate(() => ({early: window.__early, first: window.__first, mark: document.documentElement.dataset.readerSize, values: document.getElementById('s').values}));
    ok(`remember reload ${load3}: the head reader answers the kept values before the body is parsed, the page applies them`, early.early.body === false && early.early.values?.size === 'l' && early.early.values?.hyphens === true && early.mark === 'l', JSON.stringify(early));
    ok(`remember reload ${load3}: the panel's first drawing already shows the kept value (no frame of the declared one)`, early.first === 'l' && early.values.size === 'l', JSON.stringify(early));
  }
  ok('remember: no page errors over the reloads', !errors.length, errors.join(' | '));
  } catch (error) {
    ok('remember: the case ran to its end', false, error.message.split('\n')[0]);
  }
  await context.close();
}

await browser.close();
server.close();
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
