#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-menu 1.16.0 appearance="rail" name tooltips (group build 21 A; DEV
// msg-a5141634, universal menu study 2026-11-28): a rail row is its icon
// alone, so its name -- with its status word and its count's phrase -- is the
// Framework's tooltip beside it (component.icon-buttons 1.21.0,
// data-sf-name-tip="inline-end"), C59 timing. On the built bytes over the
// Loader, light and dark, LTR and RTL, three loads each:
//
//   1. desktop 1440: a real hover shows nothing at 300 ms and the tooltip by
//      800 ms, its text the row's accessible name («Входящие, 3 …»,
//      «Задачи, внимание»); it stands beside the row at its inline end (right
//      in LTR, left in RTL), clear of the next row; the neighbour shows at
//      once; the pointer leaving hides it; keyboard focus (Tab) shows it at
//      once and Escape hides it, the focus stays; no browser title.
//   2. touch 390: a tap shows nothing and follows the link; a long press
//      shows it while held, no click, and it is gone 2 s after the release.
//   3. first paint: before any hover no .sf-tooltip is in the menu and no
//      tooltip code was asked for; the console is clean.
//   4. off: a rail row whose page wrote its own title keeps the browser's
//      title and gets no Framework tooltip.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const report = process.argv.includes('--report');
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const items = [
  {id: 'home', label: 'Главная', icon: 'home', href: '#home'},
  {id: 'inbox', label: 'Входящие', icon: 'inbox', href: '#inbox', badge: 3, status: 'error'},
  {id: 'tasks', label: 'Задачи', icon: 'task_alt', href: '#tasks', status: 'warning'},
  {id: 'files', label: 'Файлы', icon: 'folder', href: '#files'},
];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (theme, dir) => `<!doctype html><html lang="ru" dir="${dir}" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}};
window.__tipAsked = 0; addEventListener('Tooltip:ready', () => { window.__tipAsked += 1; });</script>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface" style="margin:0">
<div style="display:flex;gap:24px;padding:24px">
  <div style="inline-size:64px"><sf-menu id="rail" appearance="rail" aria-label="Разделы" current="home" items='${JSON.stringify(items)}'></sf-menu></div>
  <main style="flex:1"><p>Страница</p><button id="after" type="button">Дальше</button></main>
</div>
<div style="inline-size:64px;padding:24px"><sf-menu id="titled" appearance="rail" aria-label="Свои подсказки" items='${JSON.stringify([{id: 'own', label: 'Своё', icon: 'star', href: '#own'}])}'></sf-menu></div>
</body></html>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/rail.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pageOf(url.searchParams.get('theme') || 'light', url.searchParams.get('dir') || 'ltr'));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((done) => server.once('listening', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true});
const failures = [];
const measures = {};
const note = (failure) => failures.push(failure);
const ready = (page) => page.waitForFunction(() => document.querySelectorAll('#rail a[data-sf-name-tip="inline-end"]').length === 4
  && document.querySelector('#rail a[data-sf-menu-link="inbox"] .sf-badge-anchored-text, #rail a[data-sf-menu-link="inbox"][aria-label]')
  && document.fonts.status === 'loaded', null, {timeout: 20000});
// The tooltip a row names, as drawn: shown, its text, its box against the row and the next row.
const READ_TIP = (id) => {
  const row = document.querySelector(`#rail a[data-sf-menu-link="${id}"]`);
  const tipId = row?.getAttribute('data-tooltip');
  const tip = tipId ? document.getElementById(tipId) : null;
  const next = row?.closest('li')?.nextElementSibling?.querySelector('a');
  const r = row.getBoundingClientRect();
  const t = tip && !tip.hidden ? tip.getBoundingClientRect() : null;
  const n = next ? next.getBoundingClientRect() : null;
  return {
    shown: Boolean(tip && !tip.hidden && t && t.width > 0),
    text: tip?.querySelector('.sf-tooltip-text')?.textContent ?? '',
    beside: t ? (document.dir === 'rtl' ? t.right <= r.left + 1 : t.left >= r.right - 1) : null,
    clearOfNext: t && n ? t.left >= n.right - 1 || t.right <= n.left + 1 || t.bottom <= n.top + 1 || t.top >= n.bottom - 1 : true,
    tail: Boolean(tip?.querySelector('.sf-tooltip-tail')),
    title: row.getAttribute('title'),
  };
};
try {
  for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) for (let load = 1; load <= 3; load++) {
    {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}, colorScheme: theme});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
      await page.goto(`${base}/rail.html?theme=${theme}&dir=${dir}`);
      await ready(page);
      await page.waitForTimeout(300);
      const m = {};
      m.firstPaint = await page.evaluate(() => !document.querySelector('#rail .sf-tooltip') && !document.querySelector('#rail [data-tooltip]') && window.__tipAsked === 0);
      const centre = (id) => page.evaluate((key) => { const box = document.querySelector(`#rail a[data-sf-menu-link="${key}"]`).getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; }, id);
      await page.mouse.move(700, 600); await page.waitForTimeout(400);
      await page.mouse.move(...await centre('inbox'));
      await page.waitForTimeout(300);
      m.closedAt300 = !(await page.evaluate(READ_TIP, 'inbox')).shown;
      await page.waitForTimeout(500);
      const inbox = await page.evaluate(READ_TIP, 'inbox');
      m.openBy800 = inbox.shown;
      m.inboxText = inbox.text;
      m.countInText = /^Входящие, 3\b/u.test(inbox.text) || /^Входящие.*3/u.test(inbox.text);
      m.beside = inbox.beside;
      m.clearOfNext = inbox.clearOfNext;
      m.tail = inbox.tail;
      m.noTitle = inbox.title === null;
      await page.mouse.move(...await centre('tasks')); await page.waitForTimeout(80);
      const tasks = await page.evaluate(READ_TIP, 'tasks');
      m.neighbourAtOnce = tasks.shown;
      m.tasksText = tasks.text;
      m.tasksStatus = /^Задачи/u.test(tasks.text) && tasks.text.length > 'Задачи'.length;
      await page.mouse.move(700, 600); await page.waitForTimeout(500);
      m.leaveHides = !(await page.evaluate(READ_TIP, 'tasks')).shown;
      // Keyboard: the focus walks from the page into the rail.
      await page.evaluate(() => document.body.focus());
      await page.mouse.move(1400, 880); await page.waitForTimeout(700);
      await page.keyboard.press('Tab'); await page.waitForTimeout(80);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-sf-menu-link'));
      m.focusAtOnce = focused === 'home' && (await page.evaluate(READ_TIP, 'home')).shown;
      m.homeText = (await page.evaluate(READ_TIP, 'home')).text;
      await page.keyboard.press('Escape'); await page.waitForTimeout(80);
      m.escape = !(await page.evaluate(READ_TIP, 'home')).shown && await page.evaluate(() => document.activeElement?.getAttribute('data-sf-menu-link')) === 'home';
      await page.keyboard.press('Tab'); await page.waitForTimeout(80);
      m.nextFocus = (await page.evaluate(READ_TIP, 'inbox')).shown;
      // A row whose page wrote a title keeps the browser's title.
      await page.evaluate(() => document.querySelector('#titled a').setAttribute('title', 'Своё'));
      const [tx, ty] = await page.evaluate(() => { const box = document.querySelector('#titled a').getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; });
      await page.mouse.move(tx, ty); await page.waitForTimeout(900);
      m.titleLeftAlone = await page.evaluate(() => !document.querySelector('#titled a').hasAttribute('data-tooltip'));
      measures[`desktop ${theme} ${dir} ${load}`] = m;
      const ok = m.firstPaint && m.closedAt300 && m.openBy800 && m.countInText && m.beside && m.clearOfNext && m.tail && m.noTitle
        && m.neighbourAtOnce && m.tasksStatus && m.leaveHides && m.focusAtOnce && m.escape && m.nextFocus && m.titleLeftAlone;
      if (!ok) note({case: `rail tooltip, desktop (${theme} ${dir}, load ${load})`, got: m});
      if (errors.length) note({case: `console clean, desktop (${theme} ${dir}, load ${load})`, errors});
      await context.close();
    }
    {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: theme, hasTouch: true, isMobile: true});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
      await page.goto(`${base}/rail.html?theme=${theme}&dir=${dir}`);
      await ready(page);
      const cdp = await context.newCDPSession(page);
      const at = (id) => page.evaluate((key) => { const box = document.querySelector(`#rail a[data-sf-menu-link="${key}"]`).getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; }, id);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
      const m = {};
      let [x, y] = await at('files');
      await touch('touchStart', x, y); await page.waitForTimeout(80); await touch('touchEnd'); await page.waitForTimeout(700);
      m.tapShowsNothing = !(await page.evaluate(READ_TIP, 'files')).shown;
      m.tapFollows = await page.evaluate(() => location.hash) === '#files';
      [x, y] = await at('tasks');
      await page.evaluate(() => { window.clicks = 0; document.querySelector('#rail a[data-sf-menu-link="tasks"]').addEventListener('click', () => { window.clicks += 1; }); });
      await touch('touchStart', x, y); await page.waitForTimeout(300);
      m.notYet = !(await page.evaluate(READ_TIP, 'tasks')).shown;
      await page.waitForTimeout(600);
      const held = await page.evaluate(READ_TIP, 'tasks');
      m.heldShows = held.shown;
      m.heldText = held.text;
      await touch('touchEnd'); await page.waitForTimeout(600);
      m.staysAfter = (await page.evaluate(READ_TIP, 'tasks')).shown;
      await page.waitForTimeout(1400);
      m.goneAfter = !(await page.evaluate(READ_TIP, 'tasks')).shown;
      await page.waitForTimeout(1500);
      m.stillGone = !(await page.evaluate(READ_TIP, 'tasks')).shown;
      m.noClick = await page.evaluate(() => window.clicks === 0 && location.hash === '#files');
      measures[`touch ${theme} ${dir} ${load}`] = m;
      if (!(m.tapShowsNothing && m.tapFollows && m.notYet && m.heldShows && m.goneAfter && m.stillGone && m.noClick)) note({case: `rail tooltip, touch (${theme} ${dir}, load ${load})`, got: m});
      if (errors.length) note({case: `console clean, touch (${theme} ${dir}, load ${load})`, errors});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (report) console.log(JSON.stringify(measures, null, 2));
if (failures.length && !report) {
  console.error(JSON.stringify(failures.slice(0, 6), null, 2));
  console.error(`MENU_RAIL_TOOLTIP_GB21_FAIL ${failures.length}`);
  process.exit(1);
}
console.log(`MENU_RAIL_TOOLTIP_GB21_OK ${Object.keys(measures).length} runs`);
