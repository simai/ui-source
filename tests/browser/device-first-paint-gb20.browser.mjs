#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// Device scope before the script (group build 20 integration I3, DEV answer 3,
// 2026-11-27). sf-tabs leaves the other layout's tabs out when it draws
// (SF.device, phone below PHONE_BELOW = 600 px of its place), but static
// first-paint markup is printed at one width. A tab that carries devices
// says them on its button (data-sf-devices), and core.css hides a printed
// item scoped to the desktop in the phone layout and one scoped to the
// phone in the desktop layout, by core's page layout word, until its element
// is defined.
//
// - live, with the script, at 1280 and at 390: the tabs draw their layout's
//   tabs only («Сделки» desktop, «Поделиться» phone), the marked buttons say
//   data-sf-devices, the selected tab carries no mark; the drawn markup is
//   kept as a server would print it;
// - static: each printed markup in a page with core.css and core.js but
//   before sf-tabs' own script (its bundle held back, so the element stays
//   undefined, as a page on a slow network draws it), at 390 and at 1440,
//   light and dark, `loads` cold loads each: <html> carries core's layout
//   word (data-sf-layout, PHONE_BELOW of the page), the
//   desktop-scoped tab is not drawn at 390 and drawn at 1440, the
//   phone-scoped tab is drawn at 390 and not at 1440, the unscoped tabs are
//   drawn at both; console clean.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const ITEMS = [
  {id: 'main', label: 'Основное'},
  {id: 'deals', label: 'Сделки', devices: ['desktop']},
  {id: 'share', label: 'Поделиться', devices: ['phone']},
  {id: 'tasks', label: 'Задачи'},
];
const head = (theme, script) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">${script ? '<script src="/distr/core/js/core.js"></script>' : ''}</head><body class="bg-surface">`;
const live = (theme) => `${head(theme, true)}
<sf-tabs id="t" aria-label="Карточка" items='${JSON.stringify(ITEMS)}'></sf-tabs><p>Текст под вкладками</p></body></html>`;
const printed = new Map();
const still = (theme, key) => `${head(theme, true)}
<sf-tabs id="t" aria-label="Карточка">${printed.get(key)}</sf-tabs><p>Текст под вкладками</p></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (path === '/live' || path === '/static') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    const theme = url.searchParams.get('theme');
    return response.end(path === '/live' ? live(theme) : still(theme, url.searchParams.get('from')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = {live: {}, static: []};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch({headless: true});

// The tabs drawn in the row: their label, their mark, whether they take a box.
const READ = () => [...document.querySelectorAll('#t [role="tab"]')].map((tab) => {
  const box = tab.getBoundingClientRect();
  return {label: (tab.getAttribute('aria-label') || tab.textContent).trim().replace(/\s+/gu, ' '), devices: tab.getAttribute('data-sf-devices'),
    selected: tab.getAttribute('aria-selected') === 'true', drawn: box.width > 0 && box.height > 0 && getComputedStyle(tab).display !== 'none'};
});

async function open(path, width, theme) {
  const page = await browser.newPage({viewport: {width, height: 600}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.goto(`${origin}${path}`);
  return {page, errors};
}

// Live: the drawn markup at each layout, kept as a server prints it.
for (const [key, width] of [['desktop', 1280], ['phone', 390]]) {
  const {page, errors} = await open(`/live?theme=theme-light`, width, 'theme-light');
  await page.waitForFunction(() => customElements.get('sf-tabs') && document.querySelectorAll('#t [role="tab"]').length >= 3, null, {timeout: 20000});
  await page.waitForTimeout(300);
  const tabs = await page.evaluate(READ);
  report.live[key] = {width, tabs, errors};
  const labels = tabs.map((tab) => tab.label);
  check(`live ${width}: the ${key} layout draws its tabs only`, key === 'desktop'
    ? labels.includes('Сделки') && !labels.includes('Поделиться') : labels.includes('Поделиться') && !labels.includes('Сделки'), {labels});
  check(`live ${width}: a scoped tab says its devices on its button`, tabs.filter((tab) => ['Сделки', 'Поделиться'].includes(tab.label)).every((tab) => tab.devices === (tab.label === 'Сделки' ? 'desktop' : 'phone')), {tabs});
  check(`live ${width}: the selected and the unscoped tabs carry no mark`, tabs.filter((tab) => tab.selected || ['Основное', 'Задачи'].includes(tab.label)).every((tab) => tab.devices === null), {tabs});
  check(`live ${width}: console clean`, errors.length === 0, {errors});
  printed.set(key, await page.evaluate(() => document.getElementById('t').innerHTML));
  await page.close();
}

// Static: before the element's script, each printed markup at 390 and at 1440.
for (const from of ['desktop', 'phone']) {
  for (const width of [390, 1440]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      for (let load = 1; load <= LOADS; load += 1) {
        const page = await browser.newPage({viewport: {width, height: 600}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
        // sf-tabs' bundle is held: the request never answers while the page is read.
        await page.route(/\/distr\/smart\/tabs\//u, () => new Promise(() => {}));
        await page.goto(`${origin}/static?theme=${theme}&from=${from}`);
        await page.waitForLoadState('load');
        await page.waitForTimeout(200);
        const state = await page.evaluate(() => ({defined: Boolean(customElements.get('sf-tabs')), layout: document.documentElement.getAttribute('data-sf-layout')}));
        const tabs = await page.evaluate(READ);
        const one = (label) => tabs.find((tab) => tab.label === label);
        const where = `static ${from} markup @${width} ${theme} #${load}`;
        report.static.push({from, width, theme, load, tabs});
        check(`${where}: the element is not defined yet`, !state.defined, state);
        check(`${where}: core marks the page layout`, state.layout === (width < 600 ? 'phone' : 'desktop'), state);
        check(`${where}: the unscoped tabs are drawn`, one('Основное')?.drawn && one('Задачи')?.drawn, {tabs});
        if (from === 'desktop') check(`${where}: the desktop tab is ${width < 600 ? 'hidden below' : 'drawn above'} the phone layout signal`, one('Сделки') && one('Сделки').drawn === (width >= 600), {tabs});
        else check(`${where}: the phone tab is ${width < 600 ? 'drawn below' : 'hidden above'} the phone layout signal`, one('Поделиться') && one('Поделиться').drawn === (width < 600), {tabs});
        check(`${where}: console clean`, errors.length === 0, {errors});
        await page.unrouteAll({behavior: 'ignoreErrors'}).catch(() => {});
        await page.close();
      }
    }
  }
}

await browser.close();
server.close();
console.log(JSON.stringify({report: {live: report.live, static: report.static.length}, failures}, null, 1));
if (failures.length) {
  console.log(`DEVICE_FIRST_PAINT_GB20_FAIL ${failures.length}`);
  process.exit(1);
}
console.log('DEVICE_FIRST_PAINT_GB20_OK');
