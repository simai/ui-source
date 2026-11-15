#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--json /absolute/path/to/report.json]
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright.)
//
// A popup takes the size and density of what opens it (owner remark
// 2026-11-15, recipe-list-toolbar: the row menu of sf-view-table size="1"
// had 32 px rows and 14 px text beside 48 px rows and 16 px text). On the
// built bytes, loaded by the real Loader, in an area of normal and of compact
// density (data-sf-density on a section, the menus on <body>), light and dark,
// 1440 and 390:
// - sf-list size="1", "1/2", "2" and unsized: its «⋯» opens the page's one
//   menu (SF.menu.open) at 1, 1/2, 1 and the default 1/2;
// - a host of size 1 and of size 1/2 with a row «⋯» (a native button, and an
//   sf-button-icon the host sized relative): toggleFor() opens a page menu
//   without a size at the host's step, the same menu following each host in
//   turn; a right-click on a row bound by for= opens it at the host's step;
// - an explicit size on the menu wins (size="1/2" from a size-1 host), and
//   SF.menu.open({size}) wins;
// - every row's height and text size equal those of a menu the page sized
//   itself (size="1" or "1/2") opened in the same area, and the ladder:
//   1 is 40/16 (32/14 compact), 1/2 is 32/14 (28/12 compact) at 1440;
// - the menu's surface carries the density of the opener's area.
// Console errors fail the probe.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonAt = process.argv.indexOf('--json');
const reportPath = jsonAt === -1 ? '' : resolve(process.argv[jsonAt + 1]);
const loads = Number(process.env.MENU_SIZE_LOADS || 1);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const ROWS = ['Отчёт.pdf', 'Договор.docx'];
const host = (id, size) => `<x-host id="${id}" size="${size}" style="display:block">
  <ul id="${id}-rows" role="listbox" aria-label="Файлы ${size}" style="list-style:none;margin:0;padding:0;max-inline-size:480px">
    ${ROWS.map((name, at) => `<li role="option" tabindex="${at ? -1 : 0}" aria-selected="false" style="display:flex;align-items:center;block-size:40px;gap:8px">
      <span style="flex:1">${name}</span>
      <button type="button" class="native" aria-label="Ещё: ${name}">⋯</button>
      <sf-button-icon class="drawn" size="1/2" data-sf-size-relative icon="more_horiz" appearance="ghost" aria-label="Ещё (кнопка): ${name}"></sf-button-icon>
    </li>`).join('')}
  </ul>
</x-host>`;

const shell = (theme, density) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;background:var(--sf-surface-page)">
<section id="area" data-sf-density="${density}" style="display:grid;gap:16px">
  <button id="plain" type="button">Обычная кнопка</button>
  <sf-list id="list-1" size="1" label="Список 1"></sf-list>
  <sf-list id="list-h" size="1/2" label="Список 1/2"></sf-list>
  <sf-list id="list-2" size="2" label="Список 2"></sf-list>
  <sf-list id="list-n" label="Список без размера"></sf-list>
  ${host('h1', '1')}
  ${host('hh', '1/2')}
</section>
<sf-menu-context id="m" popup for="h1-rows" aria-label="Меню без размера"></sf-menu-context>
<sf-menu-context id="mx" popup size="1/2" aria-label="Меню 1/2 страницы"></sf-menu-context>
<sf-menu-context id="ref-1" popup size="1" aria-label="Образец 1"></sf-menu-context>
<sf-menu-context id="ref-h" popup size="1/2" aria-label="Образец 1/2"></sf-menu-context>
</body></html>`;

// The ladder at 1440 (owner decisions C22, C79, C134): rows and text.
const LADDER = {normal: {'1': [40, 16], '1/2': [32, 14]}, compact: {'1': [32, 14], '1/2': [28, 12]}};
const ENTRIES = [{id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'rename', text: 'Переименовать', icon: 'edit'}];

const failures = [];
const rows = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

async function load(page, theme, density) {
  current = shell(theme, density);
  await page.goto(`${base}/probe`, {waitUntil: 'load'});
  await page.waitForFunction(() => customElements.get('sf-list') && customElements.get('sf-menu-context') && customElements.get('sf-button-icon'), null, {timeout: 20000});
  await page.evaluate((entries) => {
    for (const list of document.querySelectorAll('sf-list')) {
      list.actions = [{id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'rename', text: 'Переименовать', icon: 'edit'}];
      list.items = [{id: 'a', text: 'Первое'}, {id: 'b', text: 'Второе'}];
    }
    for (const menu of document.querySelectorAll('sf-menu-context')) menu.entries = entries;
  }, ENTRIES);
  await page.waitForFunction(() => [...document.querySelectorAll('sf-list')].every((list) => list.querySelectorAll('.sf-list__row').length === 2), null, {timeout: 10000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

// The open menu: its size attribute, the surface's density, a row's height and text size.
const measure = (page) => page.evaluate(() => {
  const menu = [...document.querySelectorAll('sf-menu-context')].find((one) => one.isOpen);
  const surface = menu?.querySelector(':scope > .sf-context-menu');
  const item = surface?.querySelector('.sf-context-menu-item');
  const label = item?.querySelector('.sf-context-menu-item-label') ?? item;
  return menu ? {
    menu: menu.id || (menu.hasAttribute('data-sf-menu-shared') ? 'shared' : menu.localName),
    size: menu.getAttribute('size'),
    density: surface?.getAttribute('data-sf-density') ?? null,
    sheet: surface?.hasAttribute('data-sf-sheet') ?? false,
    row: item ? Math.round(item.getBoundingClientRect().height * 100) / 100 : null,
    text: label ? parseFloat(getComputedStyle(label).fontSize) : null,
  } : null;
});
const closeAll = (page) => page.evaluate(() => {
  for (const menu of document.querySelectorAll('sf-menu-context')) if (menu.isOpen) menu.close({restoreFocus: false, reason: 'api'});
});

const browser = await playwright.chromium.launch();
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (const density of ['normal', 'compact']) for (let run = 1; run <= loads; run += 1) {
    const stand = `${width} ${theme} ${density}${loads > 1 ? ` #${run}` : ''}`;
    const context = await browser.newContext(width === 390
      ? {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2}
      : {viewport: {width: 1440, height: 1000}});
    const page = await context.newPage();
    await page.emulateMedia({colorScheme: theme});
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await load(page, theme, density);

    const cases = [];
    const take = async (name, want, open) => {
      await closeAll(page);
      await page.waitForTimeout(80);
      await open();
      await page.waitForTimeout(350);
      const got = await measure(page);
      cases.push({name, want, ...got});
      await closeAll(page);
      await page.waitForTimeout(80);
    };
    const toggle = (menu, selector) => page.evaluate(([id, at]) => { document.getElementById(id).toggleFor(document.querySelector(at)); }, [menu, selector]);
    const click = (selector) => page.locator(selector).first().click();

    // What a size looks like in this area: menus the page sized itself.
    await take('reference 1', '1', () => toggle('ref-1', '#plain'));
    await take('reference 1/2', '1/2', () => toggle('ref-h', '#plain'));
    const reference = {'1': cases[0], '1/2': cases[1]};

    await take('sf-list size=1 «⋯» (SF.menu.open)', '1', () => click('#list-1 .sf-list__actions'));
    await take('sf-list size=1/2 «⋯»', '1/2', () => click('#list-h .sf-list__actions'));
    await take('sf-list size=2 «⋯»', '1', () => click('#list-2 .sf-list__actions'));
    await take('sf-list unsized «⋯» (default)', '1/2', () => click('#list-n .sf-list__actions'));
    await take('host 1, native «⋯» (toggleFor)', '1', () => toggle('m', '#h1 .native'));
    await take('host 1/2, native «⋯», same menu', '1/2', () => toggle('m', '#hh .native'));
    await take('host 1 again, same menu', '1', () => toggle('m', '#h1 .native'));
    await take('host 1, relative sf-button-icon «⋯»', '1', () => toggle('m', '#h1 .drawn'));
    await take('host 1, menu size="1/2" of its own', '1/2', () => toggle('mx', '#h1 .native'));
    await take('host 1, SF.menu.open size 1/2', '1/2', () => page.evaluate((entries) => {
      globalThis.SF.menu.open({anchor: document.querySelector('#h1 .native'), entries, label: 'Явный размер', size: '1/2'});
    }, ENTRIES));
    await take('host 1, SF.menu.open without size', '1', () => page.evaluate((entries) => {
      globalThis.SF.menu.open({anchor: document.querySelector('#h1 .native'), entries, label: 'Без размера'});
    }, ENTRIES));
    if (width === 1440) {
      await take('host 1, right-click on a row (for=)', '1', async () => {
        const box = await page.locator('#h1-rows li span').first().boundingBox();
        await page.mouse.click(box.x + 10, box.y + box.height / 2, {button: 'right'});
      });
    }

    for (const one of cases) {
      const row = {stand, ...one, refRow: reference[one.want]?.row, refText: reference[one.want]?.text};
      rows.push(row);
      check(`${stand}: ${one.name}: the menu opened`, one.row !== null && one.row !== undefined, {got: one});
      check(`${stand}: ${one.name}: rows and text as a page menu of size ${one.want}`,
        one.row === reference[one.want]?.row && one.text === reference[one.want]?.text, {got: row});
      check(`${stand}: ${one.name}: the surface carries the area's density`, one.density === density, {got: one.density});
      if (width === 1440 && !one.sheet) {
        const [height, text] = LADDER[density][one.want];
        check(`${stand}: ${one.name}: the ladder value ${height}/${text}`, one.row === height && one.text === text, {got: row});
      }
    }
    check(`${stand}: the console is clean`, errors.length === 0, {errors});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const result = {probe: 'menu-opener-size', result: failures.length ? 'MENU_OPENER_SIZE_FAIL' : 'MENU_OPENER_SIZE_OK', failures, rows};
if (reportPath) writeFileSync(reportPath, `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({probe: result.probe, result: result.result, failures, cases: rows.length}, null, 1));
if (failures.length) process.exitCode = 1;
