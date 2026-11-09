#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [runs]
// The C30 amendments (owner, 2026-11-09; decisions C05, C06, C07, C30 in
// ui-control 9a86d1a1; prototype prototypes/menu-simple.html #r084,
// #r065-sec, #r071-sec, #r083) on the built bytes, in the light and the dark
// theme, each load `runs` times (3 by default) with a clean console. The
// browser keeps its real scrollbars (no --hide-scrollbars), so the column's
// scrollbar takes room as it does on a desktop.
//
// R084: a row's panel that scrolls keeps the path's line one pixel inside its
//   border; one that does not scroll is not clipped and the line covers the
//   border pixel;
// R072 e / R065 a: a bordered column draws the 2 px line on its own start
//   border at the closed branch that holds the current page, clear of the
//   corner's curve on its first row; a column without a border has the
//   medium label alone; the compact rail takes the same line on its start
//   edge (DEV answer b); a bordered menu with search has one frame (minor 1);
// R070: a column's group headings are a row's height, the rows' size and
//   weight of type, on-surface-variant, the words on the first level's line;
// R083 / C05: the plates stand space-1/4 in from the column's edge on both
//   sides, the words space-1/2 in from the plate, a step per level, at normal
//   and compact density;
// C07: a column whose scrollbar takes room gives the scrollbar's gap back,
//   so a plate stands as far from the thumb as from the start edge;
// R071 a: search -- the field, the filter (parents kept, ё = е, headings),
//   the highlight, the live count, sf-menu-search, the keys, «Ничего не
//   найдено», ↗ on a link with a target;
// C06: the field's magnifier stands over the rows' icons, the field a row's
//   height, at normal and compact density;
// density: sf-input with no size follows data-sf-density=compact (32), one
//   with an explicit size keeps it (C22: an explicit size wins).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {PATH_LINE, lineOk} from './menu-path-line.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const RUNS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const leaf = (id, label, extra = {}) => ({id, label, href: `#${id}`, ...extra});
const CATALOG = [
  {id: 'pumps', label: 'Насосное оборудование', href: '#pumps', children: [leaf('centrifugal', 'Центробежные насосы'), leaf('screw', 'Винтовые насосы')]},
  leaf('valves', 'Арматура'),
  {id: 'parts', label: 'Запчасти', href: '#parts', children: [leaf('seals', 'Уплотнения')]},
  leaf('home', 'Главная'),
];
const SETTINGS = [
  {id: 'team', label: 'Команда', group: true, items: [leaf('members', 'Участники', {icon: 'group'}), leaf('roles', 'Роли', {icon: 'badge'})]},
  {id: 'shop', label: 'Магазин', group: true, items: [
    {id: 'payment', label: 'Оплата', icon: 'payments', children: [leaf('methods', 'Способы оплаты'), leaf('invoices', 'Счета'), leaf('refunds', 'Возвраты')]},
    {id: 'delivery', label: 'Доставка', icon: 'local_shipping', children: [leaf('ways', 'Способы доставки'), leaf('trees', 'Ёлки к празднику')]},
  ]},
  {id: 'account', label: 'Аккаунт', group: true, items: [leaf('profile', 'Профиль', {icon: 'person'}), leaf('password', 'Пароль', {icon: 'key'})]},
  {id: 'help', label: 'Справка', group: true, items: [
    {id: 'docs', label: 'Документация', href: 'https://ui.simai.io/', icon: 'menu_book', target: '_blank'},
    {id: 'status', label: 'Статус сервиса', href: 'https://status.example/', icon: 'monitor_heart', external: true},
  ]},
];
const LONG = Array.from({length: 24}, (_, at) => leaf(`p${at + 1}`, `Пункт ${at + 1}`));
const ROW = [
  {id: 'catalog', label: 'Каталог', href: '#catalog', children: [{id: 'deep', label: 'Насосы', href: '#deep', children: [leaf('target', 'Нужный')]}, ...LONG]},
  {id: 'small', label: 'Услуги', href: '#small', children: [{id: 'svc', label: 'Сервис', href: '#svc', children: [leaf('svc-target', 'Ремонт')]}, leaf('rent', 'Аренда')]},
];
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const page = (search) => {
  const current = search.get('current') || 'centrifugal';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0}main{display:flex;flex-wrap:wrap;gap:var(--sf-space-2);padding:var(--sf-space-1)}.side{inline-size:17rem}.tall{block-size:240px;display:flex;flex-direction:column}</style></head><body>
<sf-menu id="row" label="Строка" orientation="horizontal" appearance="navigation" collapse="none" current="${search.get('rowCurrent') || 'target'}" items='${json(ROW)}'></sf-menu>
<main>
  <div class="side"><sf-menu id="bordered" label="Каталог в рамке" appearance="navigation" bordered current="${current}" items='${json(CATALOG)}'></sf-menu></div>
  <div class="side"><sf-menu id="plain" label="Каталог" appearance="navigation" current="${current}" items='${json(CATALOG)}'></sf-menu></div>
  <div class="side"><sf-menu id="rail" label="Рельс" appearance="compact" current="${current}" items='${json(CATALOG.map((item) => ({...item, icon: 'folder'})))}'></sf-menu></div>
  <div class="side"><sf-menu id="groups" label="Настройки" appearance="navigation" current="password" items='${json(SETTINGS)}'></sf-menu></div>
  <div class="side tall"><sf-menu id="search" label="Поиск по настройкам" appearance="navigation" search current="password" items='${json(SETTINGS)}'></sf-menu></div>
  <div class="side tall" data-sf-density="compact"><sf-menu id="search-compact" label="Плотный поиск" appearance="navigation" search current="password" items='${json(SETTINGS)}'></sf-menu></div>
  <div class="side tall" data-sf-density="compact"><sf-menu id="scrolling" label="Длинная колонка" appearance="navigation" search bordered current="p20" items='${json([{id: 'long', label: 'Длинная', children: LONG}, leaf('after', 'После')])}'></sf-menu></div>
  <div class="side" data-sf-density="compact"><sf-menu id="admin" label="Админка" appearance="navigation" current="orders" items='${json([{id: 'desk', label: 'Рабочий стол', href: '#desk', icon: 'dashboard'}, {id: 'shop2', label: 'Магазин', icon: 'storefront', children: [leaf('orders', 'Заказы')]}])}'></sf-menu></div>
  <div class="side" data-sf-density="compact">
    <sf-input id="input-auto" placeholder="Без размера"></sf-input>
    <sf-input id="input-one" size="1" placeholder="size=1"></sf-input>
  </div>
</main>
</body></html>`;
};

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/menu/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams));
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
const passes = [];
const seen = {};
const check = (ok, message) => {
  if (ok) passes.push(message);
  else failures.push(message);
};
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;

// Real scrollbars: the column's scrollbar takes room as on a desktop.
const browser = await chromium.launch({ignoreDefaultArgs: ['--hide-scrollbars']});
async function open(theme, width = 1440, height = 900, search = '') {
  const tab = await browser.newPage({viewport: {width, height}, colorScheme: theme});
  const consoleErrors = [];
  tab.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  tab.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  await tab.addInitScript(() => {
    window.__search = [];
    document.addEventListener('sf-menu-search', (event) => window.__search.push({id: event.target.id, ...event.detail}));
    document.addEventListener('sf-menu-navigate', (event) => event.preventDefault());
  });
  await tab.goto(`${origin}/menu/${search}`);
  await tab.waitForFunction(() => ['row', 'bordered', 'plain', 'groups', 'search', 'search-compact', 'scrolling', 'admin', 'rail'].every((id) => document.querySelector(`#${id} nav ul.sf-menu`))
    && document.querySelector('#search [data-sf-menu-search] input') && document.querySelector('#input-auto input'), null, {timeout: 15000})
    .catch(() => failures.push(`${theme} ${width}: the menus never drew`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(600);
  return {tab, consoleErrors};
}

// Labels of the rows a column shows now.
const shown = (tab, id) => tab.evaluate((menu) => [...document.querySelectorAll(`#${menu} nav > ul.sf-menu :is(.sf-menu-element-text, .sf-menu-group-label)`)]
  .filter((node) => node.getBoundingClientRect().height > 0).map((node) => node.textContent.trim()), id);

try {
  for (let run = 1; run <= RUNS; run += 1) {
    for (const theme of ['light', 'dark']) {
      const key = (name) => `${theme} #${run} ${name}`;

      // ---- R072 e / R065 a / rail, R083, R070
      {
        const {tab, consoleErrors} = await open(theme);
        let k = key('R072 bordered column');
        await tab.evaluate(() => {
          document.querySelector('#bordered').close('pumps');
          document.querySelector('#plain').close('pumps');
          document.querySelector('#plain').open('parts');
        });
        await tab.waitForTimeout(200);
        const bordered = await tab.evaluate(PATH_LINE, '#bordered [data-sf-menu-item="pumps"] > .sf-menu-element');
        const frame = await tab.evaluate(() => {
          const list = document.querySelector('#bordered nav > ul.sf-menu');
          const style = getComputedStyle(list);
          const probe = document.createElement('div');
          probe.style.cssText = 'border-top: 1px solid var(--sf-outline-variant); padding: var(--sf-space-1\\/4); border-radius: var(--sf-radius--surface)';
          list.parentElement.append(probe);
          const want = getComputedStyle(probe);
          const result = {border: style.borderTopWidth, colour: style.borderTopColor, wantColour: want.borderTopColor, padding: style.paddingTop, inline: style.paddingLeft,
            wantPadding: want.paddingTop, radius: style.borderTopLeftRadius, wantRadius: want.borderTopLeftRadius};
          probe.remove();
          return result;
        });
        seen[`bordered-${theme}-${run}`] = {bordered, frame};
        check(frame.border === '1px' && frame.colour === frame.wantColour && frame.radius === frame.wantRadius && frame.padding === frame.wantPadding && frame.inline === frame.wantPadding,
          `${k}: the bordered column has a hairline of outline-variant at the surface radius and space-1/4 inside (${JSON.stringify(frame)})`);
        check(lineOk(bordered), `${k}: its closed branch holding the current page is medium with the 2 px line on its start border (offset ${bordered.offset}, ${bordered.width}, ${bordered.background}), clear of the corner on the first row (top ${bordered.top} = ${bordered.clear}), the › neutral (${bordered.chevron})`);
        check(bordered.first && bordered.clear > 0, `${k}: the scene tests the corner (first row, clear ${bordered.clear})`);
        const plain = await tab.evaluate(() => {
          const row = document.querySelector('#plain [data-sf-menu-item="pumps"] > .sf-menu-element');
          const other = document.querySelector('#plain [data-sf-menu-item="parts"] > .sf-menu-element');
          return {line: getComputedStyle(row, '::before').content, weight: getComputedStyle(row.querySelector('a')).fontWeight, otherWeight: getComputedStyle(other.querySelector('a')).fontWeight,
            border: getComputedStyle(row.closest('ul.sf-menu')).borderTopWidth};
        });
        k = key('R065 plain column');
        check((plain.line === 'none' || plain.line === 'normal') && plain.weight === '500' && plain.otherWeight === '400' && plain.border === '0px',
          `${k}: a column without a border marks the closed branch with the medium label alone, no bar, no line (${JSON.stringify(plain)})`);
        const rail = await tab.evaluate(() => {
          const row = document.querySelector('#rail [data-sf-menu-item="pumps"] > .sf-menu-element');
          const list = row.closest('ul.sf-menu');
          const before = getComputedStyle(row, '::before');
          const box = row.getBoundingClientRect();
          const probe = document.createElement('span');
          probe.style.color = 'var(--sf-primary)';
          list.append(probe);
          const primary = getComputedStyle(probe).color;
          probe.remove();
          return {holds: row.classList.contains('sf-menu-element--holds-current'), content: before.content, width: before.width, background: before.backgroundColor, primary,
            offset: box.left + (parseFloat(before.left) || 0) - list.getBoundingClientRect().left, top: parseFloat(before.top) || 0, bottom: parseFloat(before.bottom) || 0,
            height: parseFloat(before.height) || 0, rowHeight: box.height, radiusStart: before.borderTopLeftRadius, radiusEnd: before.borderTopRightRadius,
            rowBorder: (parseFloat(getComputedStyle(row).borderTopWidth) || 0) + (parseFloat(getComputedStyle(row).borderBottomWidth) || 0),
            plate: getComputedStyle(row).backgroundColor, listBorder: getComputedStyle(list).borderLeftWidth};
        });
        k = key('rail');
        check(rail.holds && rail.content !== 'none' && rail.width === '2px' && rail.background === rail.primary && Math.abs(rail.offset) <= 0.5
          && rail.top === 0 && rail.bottom === 0 && Math.abs(rail.height - (rail.rowHeight - rail.rowBorder)) <= 0.5 && rail.radiusStart === '0px' && rail.radiusEnd === '2px' && rail.listBorder === '0px',
        `${k}: the compact rail marks the section holding the current page with the path's 2 px primary line on its start edge, the row's full height inside its own transparent border, no 3 px bar (${JSON.stringify(rail)})`);
        check(/, 0\)$/u.test(rail.plate) || rail.plate === 'transparent', `${k}: the row holding the current page has no plate, as everywhere on the path (${rail.plate})`);
        // The rail's current row keeps the C23 plate.
        await tab.evaluate(() => { document.querySelector('#rail').current = 'valves'; });
        await tab.waitForTimeout(150);
        const railCurrent = await tab.evaluate(() => {
          const row = document.querySelector('#rail [data-sf-menu-item="valves"] > .sf-menu-element');
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--sf-primary-container-active)';
          row.closest('ul.sf-menu').append(probe);
          const want = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {plate: getComputedStyle(row).backgroundColor, want, line: getComputedStyle(row, '::before').content};
        });
        check(railCurrent.plate === railCurrent.want && (railCurrent.line === 'none' || railCurrent.line === 'normal'),
          `${k}: the rail's current row keeps the C23 plate and draws no line (${JSON.stringify(railCurrent)})`);
        await tab.evaluate((value) => { document.querySelector('#rail').current = value; }, 'centrifugal');

        // DEV acceptance minor 1: a bordered menu with search has one frame
        // round the head and the rows -- no hairline under the head, no second
        // top line with its corner arc; the path's line inside the frame.
        k = key('bordered search frame');
        await tab.evaluate(() => document.querySelector('#scrolling').close('long'));
        await tab.waitForTimeout(200);
        const framed = await tab.evaluate(() => {
          const nav = document.querySelector('#scrolling nav');
          const head = nav.querySelector('.sf-smart-menu-search');
          const list = nav.querySelector(':scope > ul.sf-menu');
          const row = list.querySelector('[data-sf-menu-item="long"] > .sf-menu-element');
          const probe = document.createElement('div');
          probe.style.cssText = 'border-top: 1px solid var(--sf-outline-variant); border-radius: var(--sf-radius--surface); color: var(--sf-primary)';
          nav.append(probe);
          const want = getComputedStyle(probe);
          const wantColour = want.borderTopColor;
          const wantRadius = want.borderTopLeftRadius;
          const primary = want.color;
          probe.remove();
          const n = getComputedStyle(nav);
          const l = getComputedStyle(list);
          const before = getComputedStyle(row, '::before');
          const navBox = nav.getBoundingClientRect();
          const rowBox = row.getBoundingClientRect();
          return {navTop: n.borderTopWidth, navStart: n.borderLeftWidth, navColour: n.borderTopColor, wantColour, navRadius: n.borderTopLeftRadius, wantRadius,
            headLine: getComputedStyle(head).borderBottomWidth, headTop: head.getBoundingClientRect().top - navBox.top,
            listTop: l.borderTopWidth, listStart: l.borderLeftWidth, listRadius: l.borderTopLeftRadius,
            line: before.content, width: before.width, background: before.backgroundColor, primary,
            offset: rowBox.left + (parseFloat(before.left) || 0) - navBox.left, top: parseFloat(before.top) || 0, weight: getComputedStyle(row.querySelector('a') || row).fontWeight};
        });
        seen[`framed-${theme}-${run}`] = framed;
        check(framed.navTop === '1px' && framed.navStart === '1px' && framed.navColour === framed.wantColour && framed.navRadius === framed.wantRadius,
          `${k}: the frame goes round the whole menu, a hairline of outline-variant at the surface radius (${JSON.stringify(framed)})`);
        check(framed.headLine === '0px' && Math.abs(framed.headTop - 1) <= 0.5 && framed.listTop === '0px' && framed.listStart === '0px' && framed.listRadius === '0px',
          `${k}: one top line -- the head is inside the frame with no hairline under it, the list draws no border of its own (head ${framed.headLine} at ${framed.headTop}, list ${framed.listTop}/${framed.listStart}/${framed.listRadius})`);
        check(framed.line !== 'none' && framed.width === '2px' && framed.background === framed.primary && Math.abs(framed.offset - 1) <= 0.5 && framed.top === 0 && framed.weight === '500',
          `${k}: the closed branch holding the current page has the 2 px line just inside the frame (the list scrolls), full height under the head (offset ${framed.offset}, top ${framed.top})`);
        await tab.evaluate(() => document.querySelector('#scrolling').open('long'));
        await tab.waitForTimeout(200);

        // R083 / C05: plates and words in the column, normal and compact.
        k = key('R083 inset');
        for (const id of ['plain', 'groups', 'admin']) {
          const geo = await tab.evaluate((menu) => {
            const list = document.querySelector(`#${menu} nav > ul.sf-menu`);
            const outer = list.getBoundingClientRect();
            const length = (value) => {
              const probe = document.createElement('div');
              probe.style.cssText = `position:absolute;box-sizing:content-box;padding:0;border:0;inline-size:${value}`;
              list.parentElement.append(probe);
              const width = probe.getBoundingClientRect().width;
              probe.remove();
              return width;
            };
            const want = {inset: length('var(--sf-space-1\\/4)'), pad: length('var(--sf-space-1\\/2)'), step: length('var(--sf-space-1)'), control: length('var(--sf-ui-1--control-height)')};
            const rows = [...list.querySelectorAll('.sf-menu-element')].filter((row) => row.getBoundingClientRect().height > 0).map((row) => {
              const box = row.getBoundingClientRect();
              const first = row.querySelector('.sf-menu-element-icon, .sf-menu-element-text').getBoundingClientRect();
              const level = Number((row.className.match(/level-(\d)/u) || [0, 1])[1]);
              return {label: row.querySelector('.sf-menu-element-text').textContent, level, start: box.left - outer.left, end: outer.right - box.right, first: first.left - box.left, height: box.height,
                icon: Boolean(row.querySelector('.sf-menu-element-icon'))};
            });
            return {want, rows};
          }, id);
          seen[`inset-${id}-${theme}-${run}`] = geo;
          const {want, rows} = geo;
          check(rows.length > 0 && rows.every((row) => near(row.start, want.inset) && near(row.end, want.inset)), `${k} ${id}: every plate stands space-1/4 (${want.inset}) in from both edges (${rows.map((row) => `${row.start}/${row.end}`).join(' ')})`);
          const firstLevel = rows.filter((row) => row.level === 1);
          check(firstLevel.every((row) => near(row.first, want.pad)), `${k} ${id}: a first-level row's icon or words stand space-1/2 (${want.pad}) in from its plate (${firstLevel.map((row) => row.first).join(',')})`);
          check(rows.every((row) => near(row.height, want.control)), `${k} ${id}: rows are the control height ${want.control} (${[...new Set(rows.map((row) => row.height))].join(',')})`);
          if (id === 'plain') {
            const second = rows.filter((row) => row.level === 2);
            check(second.length > 0 && second.every((row) => near(row.first, want.pad + want.step)), `${k} ${id}: the second level is one step (${want.step}) further (${second.map((row) => row.first).join(',')})`);
          }
        }

        // R070: the group headings.
        k = key('R070 headings');
        for (const id of ['groups', 'search-compact']) {
          const heads = await tab.evaluate((menu) => {
            const list = document.querySelector(`#${menu} nav > ul.sf-menu`);
            const row = list.querySelector('.sf-menu-element--level-1');
            const words = (node) => node.querySelector('.sf-menu-element-icon, .sf-menu-element-text').getBoundingClientRect().left;
            const probe = document.createElement('span');
            probe.style.color = 'var(--sf-on-surface-variant)';
            list.append(probe);
            const variant = getComputedStyle(probe).color;
            probe.remove();
            const rowStyle = getComputedStyle(row);
            return {variant, rowHeight: row.getBoundingClientRect().height, rowSize: rowStyle.fontSize, rowWeight: rowStyle.fontWeight, rowLine: rowStyle.lineHeight, rowStart: words(row),
              heads: [...list.querySelectorAll('.sf-menu-group-heading')].filter((head) => head.getBoundingClientRect().height > 0).map((head) => {
                const style = getComputedStyle(head);
                return {height: head.getBoundingClientRect().height, size: style.fontSize, weight: style.fontWeight, line: style.lineHeight, colour: style.color, start: head.querySelector('.sf-menu-group-label').getBoundingClientRect().left};
              })};
          }, id);
          seen[`headings-${id}-${theme}-${run}`] = heads;
          check(heads.heads.length >= 3 && heads.heads.every((head) => near(head.height, heads.rowHeight) && head.size === heads.rowSize && head.weight === heads.rowWeight && head.line === heads.rowLine && head.colour === heads.variant && near(head.start, heads.rowStart)),
            `${k} ${id}: headings are a row's height ${heads.rowHeight}, ${heads.rowSize}/${heads.rowWeight}, on-surface-variant, on the first level's line ${heads.rowStart} (${JSON.stringify(heads.heads[0])})`);
        }

        // C07: the long column's scrollbar takes room; the plate stands as
        // far from the thumb as from the start edge.
        k = key('C07 scrollbar');
        const scroll = await tab.evaluate(() => {
          const list = document.querySelector('#scrolling nav > ul.sf-menu');
          const style = getComputedStyle(list);
          const row = list.querySelector('.sf-menu-element--level-1');
          const box = row.getBoundingClientRect();
          const outer = list.getBoundingClientRect();
          const border = parseFloat(style.borderLeftWidth);
          const bar = list.offsetWidth - list.clientWidth - border - parseFloat(style.borderRightWidth);
          const length = (value) => {
            const probe = document.createElement('div');
            probe.style.cssText = `position:absolute;box-sizing:content-box;padding:0;border:0;inline-size:${value}`;
            list.append(probe);
            const width = probe.getBoundingClientRect().width;
            probe.remove();
            return width;
          };
          const inset = length('var(--sf-space-1\\/4)');
          const thumbInset = length('var(--sf-scroll-thumb-inset)');
          return {scroll: list.classList.contains('sf-menu--scroll'), scrollbar: list.classList.contains('sf-menu--scrollbar'), bar, inset, thumbInset,
            start: box.left - outer.left - border, toBar: (outer.right - border - bar) - box.right, paddingEnd: parseFloat(style.paddingRight)};
        });
        seen[`scroll-${theme}-${run}`] = scroll;
        check(scroll.scroll && scroll.scrollbar && scroll.bar > 0, `${k}: the long column scrolls and its scrollbar takes room (${scroll.bar}px)`);
        check(near(scroll.start, scroll.inset) && near(scroll.paddingEnd, Math.max(0, scroll.inset - scroll.thumbInset)) && near(scroll.toBar + scroll.thumbInset, scroll.inset),
          `${k}: plate → thumb (${scroll.toBar} + ${scroll.thumbInset}) = edge → plate (${scroll.start}), end padding ${scroll.paddingEnd}`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- R084: a panel that scrolls, one that does not
      {
        const {tab, consoleErrors} = await open(theme, 1280, 420);
        const k = key('R084 panel scroll');
        await tab.locator('#row [data-sf-menu-toggle="catalog"]').click();
        await tab.waitForTimeout(300);
        const long = await tab.evaluate(PATH_LINE, '#row [data-sf-menu-item="deep"] > .sf-menu-element');
        const longPanel = await tab.evaluate(() => {
          const panel = document.querySelector('#row [data-sf-menu-item="catalog"] > ul.sf-menu');
          return {overflow: getComputedStyle(panel).overflowY, scrolls: panel.scrollHeight > panel.clientHeight + 1, bottom: panel.getBoundingClientRect().bottom};
        });
        seen[`panel-long-${theme}-${run}`] = {long, longPanel};
        check(longPanel.scrolls && longPanel.overflow === 'auto' && long.scroll && longPanel.bottom <= 420.5, `${k}: a panel taller than the window scrolls inside it (${JSON.stringify(longPanel)})`);
        check(lineOk(long), `${k}: its path line stands one pixel inside the border (offset ${long.offset}, border ${long.border}), the › neutral`);
        await tab.close();
        const second = await open(theme, 1280, 420, '?rowCurrent=svc-target');
        await second.tab.locator('#row [data-sf-menu-toggle="small"]').click();
        await second.tab.waitForTimeout(300);
        const small = await second.tab.evaluate(PATH_LINE, '#row [data-sf-menu-item="svc"] > .sf-menu-element');
        const smallPanel = await second.tab.evaluate(() => getComputedStyle(document.querySelector('#row [data-sf-menu-item="small"] > ul.sf-menu')).overflowY);
        seen[`panel-small-${theme}-${run}`] = {small, smallPanel};
        check(!small.scroll && smallPanel === 'visible' && lineOk(small) && near(small.offset, 0), `${k}: a panel that fits is not clipped and the line covers its border pixel (offset ${small.offset}, overflow ${smallPanel})`);
        check(!consoleErrors.length && !second.consoleErrors.length, `${k}: console clean ${[...consoleErrors, ...second.consoleErrors].join(' | ')}`);
        await second.tab.close();
      }

      // ---- R071 a: search; C06; density of sf-input
      {
        const {tab, consoleErrors} = await open(theme);
        let k = key('R071 search');
        const field = tab.locator('#search [data-sf-menu-search] input');
        const head = await tab.evaluate(() => {
          const host = document.querySelector('#search [data-sf-menu-search]');
          const input = host.querySelector('input');
          return {placeholder: input.getAttribute('placeholder'), name: input.getAttribute('aria-label') || input.labels?.[0]?.textContent || '', filled: host.querySelector('.sf-input')?.className || '',
            live: document.querySelector('#search .sf-smart-menu-search [role="status"]')?.getAttribute('aria-live')};
        });
        check(head.placeholder === 'Поиск' && head.name === 'Поиск' && /sf-input--filled/u.test(head.filled) && /radius-rounded/u.test(head.filled) && head.live === 'polite',
          `${k}: the field is a filled, rounded sf-input «Поиск», named, over a polite live region (${JSON.stringify(head)})`);
        const all = await shown(tab, 'search');
        await field.click();
        await tab.keyboard.type('опл');
        await tab.waitForTimeout(200);
        let rows = await shown(tab, 'search');
        let state = await tab.evaluate(() => ({status: document.querySelector('#search .sf-smart-menu-search [role="status"]').textContent.trim(), event: window.__search.filter((one) => one.id === 'search').at(-1),
          marks: CSS.highlights?.get('sf-menu-match')?.size ?? -1, marked: [...(CSS.highlights?.get('sf-menu-match') || [])].map((range) => range.toString()),
          rule: [...document.styleSheets].some((sheet) => { try { return [...sheet.cssRules].some((rule) => String(rule.cssText).includes('::highlight(sf-menu-match)')); } catch { return false; } })}));
        seen[`search-${theme}-${run}`] = {rows, state};
        check(JSON.stringify(rows) === JSON.stringify(['Магазин', 'Оплата', 'Способы оплаты', 'Счета', 'Возвраты']), `${k}: «опл» keeps Оплата with its three children, open, under its group (${rows.join(', ')})`);
        check(state.marks === 2 && state.marked.every((words) => words.toLowerCase() === 'опл'), `${k}: two words are highlighted (${state.marked.join(', ')})`);
        check(state.rule, `${k}: ::highlight(sf-menu-match) is drawn by the sheet`);
        check(state.status === 'Найдено: 2' && state.event?.query === 'опл' && state.event?.count === 2, `${k}: the live region says «Найдено: 2» and sf-menu-search carries {query, count} (${state.status}, ${JSON.stringify(state.event)})`);
        await field.fill('способ');
        await tab.waitForTimeout(200);
        rows = await shown(tab, 'search');
        check(JSON.stringify(rows) === JSON.stringify(['Магазин', 'Оплата', 'Способы оплаты', 'Доставка', 'Способы доставки']), `${k}: «способ» opens both parents with one child each (${rows.join(', ')})`);
        await field.fill('КОМАНДА');
        await tab.waitForTimeout(200);
        rows = await shown(tab, 'search');
        check(JSON.stringify(rows) === JSON.stringify(['Команда', 'Участники', 'Роли']), `${k}: a heading that matches keeps its whole group, without case (${rows.join(', ')})`);
        await field.fill('елки');
        await tab.waitForTimeout(200);
        rows = await shown(tab, 'search');
        check(rows.includes('Ёлки к празднику') && rows.includes('Доставка'), `${k}: ё matches е (${rows.join(', ')})`);
        await field.fill('zzz');
        await tab.waitForTimeout(200);
        state = await tab.evaluate(() => ({empty: document.querySelector('#search .sf-smart-menu-search-empty')?.textContent.trim(), list: document.querySelector('#search nav > ul.sf-menu').hidden,
          status: document.querySelector('#search .sf-smart-menu-search [role="status"]').textContent.trim(), count: window.__search.filter((one) => one.id === 'search').at(-1)?.count}));
        check(state.empty === 'Ничего не найдено' && state.list && state.status === 'Ничего не найдено' && state.count === 0, `${k}: nothing matches: «Ничего не найдено» (${JSON.stringify(state)})`);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(200);
        rows = await shown(tab, 'search');
        state = await tab.evaluate(() => ({value: document.querySelector('#search [data-sf-menu-search] input').value, current: document.querySelector('#search [aria-current="page"] .sf-menu-element-text')?.textContent.trim(),
          marks: CSS.highlights?.get('sf-menu-match')?.size ?? 0, focus: document.activeElement === document.querySelector('#search [data-sf-menu-search] input'), event: window.__search.filter((one) => one.id === 'search').at(-1)}));
        check(state.value === '' && JSON.stringify(rows) === JSON.stringify(all) && state.current === 'Пароль' && state.marks === 0 && state.focus && state.event?.query === '',
          `${k}: Escape in the field clears it: the whole menu, the current page kept, no highlight, the focus in the field (${JSON.stringify(state)})`);
        // Keys.
        k = key('R071 keys');
        await tab.keyboard.type('опл');
        await tab.waitForTimeout(200);
        const focused = () => tab.evaluate(() => (document.activeElement?.closest('[data-sf-menu-search]') ? 'field' : document.activeElement?.querySelector('.sf-menu-element-text')?.textContent.trim()));
        await tab.keyboard.press('ArrowDown');
        check(await focused() === 'Оплата', `${k}: ↓ from the field enters the first result`);
        await tab.keyboard.press('ArrowDown');
        check(await focused() === 'Способы оплаты', `${k}: ↓ walks the results`);
        await tab.keyboard.press('ArrowUp');
        check(await focused() === 'Оплата', `${k}: ↑ walks back`);
        await tab.keyboard.press('ArrowUp');
        check(await focused() === 'field', `${k}: ↑ from the first result goes back to the field`);
        await tab.keyboard.press('ArrowDown');
        await tab.keyboard.press('ArrowDown');
        await tab.keyboard.press('Escape');
        check(await focused() === 'field' && await field.inputValue() === 'опл', `${k}: Escape in the results goes back to the field, the words kept`);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(200);
        // ↗
        k = key('R071 external');
        const external = await tab.evaluate(() => ['docs', 'status'].map((id) => {
          const link = document.querySelector(`#search [data-sf-menu-link="${id}"]`);
          const glyph = link.querySelector('.sf-menu-element-external');
          const words = link.querySelector('.sf-menu-element-text').getBoundingClientRect();
          return {target: link.getAttribute('target'), rel: link.getAttribute('rel'), glyph: glyph?.textContent, hidden: glyph?.getAttribute('aria-hidden'), after: glyph ? glyph.getBoundingClientRect().left >= words.right : false,
            end: glyph ? Math.abs(glyph.getBoundingClientRect().right - (link.getBoundingClientRect().right - parseFloat(getComputedStyle(link).paddingRight))) : -1,
            name: link.textContent.replace(/\s+/gu, ' ').trim()};
        }));
        seen[`external-${theme}-${run}`] = external;
        check(external[0].target === '_blank' && external[0].rel === 'noopener' && external[0].glyph === 'arrow_outward' && external[0].hidden === 'true' && external[0].after && external[0].end <= 0.5 && /откроется в новой вкладке/u.test(external[0].name),
          `${k}: a link with target _blank ends with ↗, rel noopener, «откроется в новой вкладке» in its name (${JSON.stringify(external[0])})`);
        check(external[1].target === null && external[1].glyph === 'arrow_outward' && !/новой вкладке/u.test(external[1].name), `${k}: external: true draws ↗ without a new tab (${JSON.stringify(external[1])})`);

        // C06: the magnifier over the rows' icons, normal and compact.
        k = key('C06 field');
        for (const id of ['search', 'search-compact']) {
          const c06 = await tab.evaluate((menu) => {
            const host = document.querySelector(`#${menu}`);
            const glyph = host.querySelector('[data-sf-menu-search] .sf-input-field .sf-icon');
            const field = host.querySelector('[data-sf-menu-search] .sf-input-field');
            const icon = host.querySelector('nav > ul.sf-menu .sf-menu-element-icon');
            const row = icon.closest('.sf-menu-element');
            const head = host.querySelector('.sf-smart-menu-search');
            const list = host.querySelector('nav > ul.sf-menu');
            return {glyph: glyph.getBoundingClientRect().left, glyphSize: glyph.getBoundingClientRect().width, icon: icon.getBoundingClientRect().left, iconSize: icon.getBoundingClientRect().width,
              field: field.getBoundingClientRect().height, row: row.getBoundingClientRect().height, headLine: getComputedStyle(head).borderBottomWidth,
              headWidth: head.getBoundingClientRect().width, listWidth: list.getBoundingClientRect().width,
              fieldStays: (() => { const before = head.getBoundingClientRect().top; list.scrollTop = 40; const after = head.getBoundingClientRect().top; list.scrollTop = 0; return before === after; })()};
          }, id);
          seen[`c06-${id}-${theme}-${run}`] = c06;
          check(near(c06.glyph, c06.icon) && near(c06.glyphSize, c06.iconSize), `${k} ${id}: the magnifier stands over the rows' icons (${c06.glyph} / ${c06.icon}, ${c06.glyphSize} / ${c06.iconSize})`);
          check(near(c06.field, c06.row), `${k} ${id}: the field is a row's height (${c06.field} / ${c06.row})`);
          check(c06.headLine === '1px' && near(c06.headWidth, c06.listWidth) && c06.fieldStays, `${k} ${id}: a hairline under the head across the column, the head stays while the rows scroll`);
        }

        // Density: sf-input with no size follows the compact region.
        k = key('sf-input density');
        const inputs = await tab.evaluate(() => {
          const probe = document.createElement('div');
          probe.style.blockSize = 'var(--sf-ui-1--control-height)';
          document.querySelector('#input-auto').parentElement.append(probe);
          const compact = probe.getBoundingClientRect().height;
          probe.remove();
          const height = (id) => document.querySelector(`#${id} .sf-input-field`).getBoundingClientRect().height;
          return {compact, auto: height('input-auto'), one: height('input-one')};
        });
        seen[`inputs-${theme}-${run}`] = inputs;
        check(inputs.compact === 32 && inputs.auto === 32, `${k}: sf-input without a size is the compact row height, 32 (${inputs.auto})`);
        check(inputs.one === 40, `${k}: sf-input size="1" keeps its explicit size, 40 (C22: an explicit size wins) (${inputs.one})`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const message of passes) console.log(`PASS ${message}`);
for (const message of failures) console.log(`FAIL ${message}`);
console.log(JSON.stringify({seen}, null, 1));
console.log(`menu-amendments: ${passes.length} passed, ${failures.length} failed`);
process.exitCode = failures.length ? 1 : 0;
