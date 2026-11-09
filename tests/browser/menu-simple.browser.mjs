#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [runs]
// The simple menus of owner decision C30 (study control/research/
// 2026-11-09-menu-simple.md, prototype prototypes/menu-simple.html) on the
// built bytes: one sf-menu, four looks -- the site row, the site column, the
// simple admin and the phone -- in the light and the dark theme, each load
// `runs` times (3 by default) with a clean console.
//
// overflow: the row (overflow more) at 390, 768, 1000 and 1280 never spills
//   past its nav or the page, keeps the section that holds the current page
//   while it fits beside «Ещё», hides from the end, reads «Меню» when nothing
//   is left, and sf-menu-overflow says which items left;
// flip: a row's side panels stand beside their panel (no overlap), level with
//   the row that opened them, inside the window; at the right edge they open
//   to the left with a turned chevron; a side branch's chevron is never down;
// keys: WAI-ARIA disclosure navigation -- Tab, Enter and Space on a branch,
//   Escape back to the button, and the arrows of the row, its panels and a
//   region;
// geometry: a compact admin row is 32 high with a count, the second level's
//   words under the first level's; a column indents one step (space-1) per
//   level; the current page is the C23 plate, an open branch is unfilled, a
//   closed branch that holds the current page draws the 3 x 16 bar and a
//   row's section that holds it the 2 px line; the phone panel shows the tree
//   with the path open;
// region: a mega region is as wide as the header and under it; hover opens
//   after 300 ms and closes 500 ms after the pointer left.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const RUNS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const leaf = (id, label) => ({id, label, href: `#${id}`});
const SITE = [
  {id: 'catalog', label: 'Каталог', children: [
    {id: 'pumps', label: 'Насосное оборудование', children: [
      {id: 'centrifugal', label: 'Центробежные насосы', children: [leaf('console', 'Консольные'), leaf('multistage', 'Многоступенчатые'), leaf('monoblock', 'Моноблочные')]},
      {id: 'drainage', label: 'Дренажные и фекальные', children: [leaf('drain', 'Дренажные'), leaf('sewage', 'Фекальные')]},
      leaf('dosing', 'Дозировочные насосы')]},
    {id: 'valves', label: 'Трубопроводная арматура', children: [{id: 'gate', label: 'Задвижки', children: [leaf('wedge', 'Клиновые'), leaf('knife', 'Шиберные')]}, leaf('ball', 'Краны шаровые')]},
    leaf('parts', 'Запчасти и расходники')]},
  {id: 'services', label: 'Услуги', children: [
    {id: 'start', label: 'Начало работ', children: [leaf('selection', 'Подбор оборудования'), leaf('design', 'Проектирование')]},
    {id: 'service', label: 'Сервисное обслуживание', children: [leaf('to', 'Плановое ТО'), leaf('repair', 'Ремонт насосов')]},
    leaf('rent', 'Аренда насосов')]},
  leaf('projects', 'Проекты'),
  {id: 'about', label: 'О компании', children: [leaf('history', 'История'), leaf('jobs', 'Вакансии')]},
  {id: 'partners', label: 'Партнёрам', children: [leaf('dealers', 'Дилерам'), {id: 'designers', label: 'Проектировщикам', children: [leaf('bim', 'BIM-модели'), {id: 'docs', label: 'Документация', children: [leaf('passports', 'Паспорта'), leaf('drawings', 'Чертежи')]}]}]},
  leaf('news', 'Новости'),
  leaf('contacts', 'Контакты'),
];
const MEGA = SITE.map((item) => (item.id === 'catalog' ? {...item, region: 'catalog'} : item.id === 'services' ? {...item, region: 'services'} : item));
const ADMIN = [
  {id: 'desk', label: 'Рабочий стол', href: '#desk', icon: 'dashboard'},
  {id: 'shop', label: 'Магазин', icon: 'storefront', children: [{id: 'orders', label: 'Заказы', href: '#orders', count: 12}, leaf('goods', 'Товары'), leaf('clients', 'Клиенты')]},
  {id: 'site', label: 'Сайт', icon: 'language', children: [leaf('pages', 'Страницы')]},
];
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const page = (search) => {
  const hover = search.get('hover') === '1' ? ' open-on="hover"' : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0}.side{inline-size:20rem;padding:var(--sf-space-1\\/2)}</style></head><body>
<sf-header-site id="h" collapse="${search.get('collapse') || 'none'}">
  <a slot="brand" href="#home">Технопром</a>
  <sf-menu id="row" label="Разделы сайта" orientation="horizontal" appearance="navigation" overflow="more" current="console"${hover} items='${json(search.get('mega') === '1' ? MEGA : SITE)}'>
    <template slot="region-catalog"><div class="probe-region"><a href="#pumps">Насосное оборудование</a> <a href="#valves">Трубопроводная арматура</a> <a href="#parts">Запчасти</a></div></template>
  </sf-menu>
  <button slot="tools" type="button">Заявка</button>
</sf-header-site>
<main style="display:flex;gap:var(--sf-space-2);padding:var(--sf-space-1)">
  <div class="side"><sf-menu id="column" label="Каталог" appearance="navigation" current="console" items='${json(SITE)}'></sf-menu></div>
  <div class="side" data-sf-density="compact"><sf-menu id="admin" label="Админка" appearance="navigation" current="orders" items='${json(ADMIN)}'></sf-menu></div>
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
const seen = {};
const passes = [];
const check = (ok, message) => {
  if (ok) passes.push(message);
  else failures.push(message);
};
const PLATE = {light: 'rgba(0, 115, 237, 0.2)', dark: 'rgba(0, 115, 237, 0.32)'};
const transparent = (colour) => /rgba\(\d+, \d+, \d+, 0\)|transparent/u.test(colour);

const browser = await chromium.launch();
async function open(theme, width, search = '') {
  const tab = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme});
  const consoleErrors = [];
  tab.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  tab.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  await tab.addInitScript(() => {
    window.__overflow = [];
    document.addEventListener('sf-menu-overflow', (event) => window.__overflow.push({id: event.target.id, hidden: event.detail.hidden}));
    document.addEventListener('sf-menu-navigate', (event) => event.preventDefault());
  });
  await tab.goto(`${origin}/menu/${search}`);
  await tab.waitForFunction(() => document.querySelector('#row nav ul.sf-menu') && document.querySelector('#admin nav ul.sf-menu') && document.querySelector('#column nav ul.sf-menu'), null, {timeout: 15000})
    .catch(() => failures.push(`${theme} ${width}${search}: the menus never drew`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(500);
  return {tab, consoleErrors};
}

const rowState = (tab) => tab.evaluate(() => {
  const nav = document.querySelector('#row nav');
  const list = nav.querySelector(':scope > ul.sf-menu');
  const navBox = nav.getBoundingClientRect();
  const tops = [...list.children].filter((li) => li.matches('[data-sf-menu-item], [data-sf-menu-placeholder]'));
  const shown = tops.filter((li) => !li.hidden && li.getBoundingClientRect().width > 0);
  const more = list.querySelector(':scope > .sf-menu-item--more');
  const last = shown[shown.length - 1];
  return {
    navLeft: navBox.left, navRight: navBox.right, lastRight: last ? last.getBoundingClientRect().right : null,
    shown: shown.map((li) => li.dataset.sfMenuItem),
    placeholders: tops.filter((li) => li.matches('[data-sf-menu-placeholder]')).map((li) => li.dataset.sfMenuPlaceholder),
    moreShown: Boolean(more && !more.hidden),
    moreWords: more?.querySelector('.sf-menu-element-text')?.textContent || '',
    moreHolds: Boolean(more?.querySelector(':scope > .sf-menu-element.sf-menu-element--holds-current')),
    pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    events: window.__overflow.filter((one) => one.id === 'row').map((one) => one.hidden),
    hiddenProp: document.querySelector('#row').overflowHidden,
  };
});

const ORDER = SITE.map((item) => item.id);
try {
  for (let run = 1; run <= RUNS; run += 1) {
    for (const theme of ['light', 'dark']) {
      const key = (name) => `${theme} #${run} ${name}`;
      // ---- overflow at four widths
      for (const width of [390, 768, 1000, 1280]) {
        const {tab, consoleErrors} = await open(theme, width);
        const state = await rowState(tab);
        seen[`overflow-${theme}-${width}-${run}`] = {shown: state.shown, hidden: state.placeholders, more: state.moreShown && state.moreWords};
        const k = key(`overflow ${width}`);
        check(state.pageScroll <= 0, `${k}: no horizontal page scroll (${state.pageScroll})`);
        check(state.lastRight === null || state.lastRight <= state.navRight + 0.5, `${k}: the row ends inside its nav (${state.lastRight} <= ${state.navRight})`);
        check(state.shown.length + state.placeholders.length === ORDER.length + (state.moreShown ? 1 : 0) || state.shown.length + state.placeholders.length === ORDER.length, `${k}: every item is in the row or behind «Ещё»`);
        check(state.moreShown === state.placeholders.length > 0, `${k}: «Ещё» shows exactly when an item left (${state.placeholders.length})`);
        const visible = state.shown.filter((id) => id !== '@more');
        if (state.placeholders.length) {
          // From the end: what stays is a prefix of the order, the current section aside.
          const rest = visible.filter((id) => id !== 'catalog');
          check(rest.every((id, at) => id === ORDER.filter((one) => one !== 'catalog')[at]), `${k}: items leave from the end (${visible.join(',')})`);
          check(state.moreWords === (visible.length ? 'Ещё' : 'Меню'), `${k}: the button reads ${state.moreWords}, expected ${visible.length ? 'Ещё' : 'Меню'}`);
          check(visible.length === 0 || visible.includes('catalog'), `${k}: the section holding the current page stays in the row`);
          check(!visible.length || !state.moreHolds, `${k}: «Ещё» holds no mark while the current section is in the row`);
        }
        const last = state.events[state.events.length - 1] || [];
        check(JSON.stringify(last) === JSON.stringify(state.placeholders), `${k}: sf-menu-overflow's last hidden ${JSON.stringify(last)} is what left ${JSON.stringify(state.placeholders)}`);
        check(JSON.stringify(state.hiddenProp) === JSON.stringify(state.placeholders), `${k}: overflowHidden is ${JSON.stringify(state.hiddenProp)}`);
        if (width === 1280) check(state.placeholders.length === 0, `${k}: all seven sections fit at 1280`);
        if (width === 390) check(state.placeholders.length > 0, `${k}: sections leave the row at 390`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- row: panels, flip, chevrons, keys (1000, «Ещё» at the right edge)
      {
        const {tab, consoleErrors} = await open(theme, 1280);
        const k = key('row keys 1280');
        const toggle = tab.locator('#row [data-sf-menu-toggle="catalog"]');
        await toggle.focus();
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: Enter opens Каталог`);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'catalog', `${k}: the focus stays on the button after Enter`);
        const first = await tab.evaluate(() => {
          const panel = document.querySelector('#row [data-sf-menu-item="catalog"] > ul.sf-menu');
          const button = document.querySelector('#row [data-sf-menu-toggle="catalog"]').getBoundingClientRect();
          const box = panel.getBoundingClientRect();
          const rows = [...panel.querySelectorAll(':scope > li > .sf-menu-element')].map((row) => row.getBoundingClientRect().height);
          return {gap: box.top - button.bottom, left: box.left - button.left, popover: panel.matches(':popover-open'), rows, shadow: getComputedStyle(panel).boxShadow};
        });
        check(Math.abs(first.gap - 4) <= 0.5, `${k}: the first panel stands space-1/4 (4) under its button (${first.gap})`);
        check(first.popover, `${k}: the first panel is in the top layer`);
        check(first.rows.every((height) => Math.abs(height - 40) <= 0.5), `${k}: the panel's rows are 40 (${first.rows})`);
        check(first.shadow !== 'none', `${k}: the panel has the overlay shadow`);
        await tab.keyboard.press('ArrowDown');
        await tab.waitForTimeout(80);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'pumps', `${k}: ArrowDown enters the panel at its first row`);
        await tab.keyboard.press('ArrowDown');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'valves', `${k}: ArrowDown walks the panel`);
        await tab.keyboard.press('End');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuLink) === 'parts', `${k}: End goes to the panel's last row`);
        await tab.keyboard.press('Home');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'pumps', `${k}: Home goes to the panel's first row`);
        await tab.keyboard.press('ArrowRight');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'centrifugal', `${k}: ArrowRight opens the side panel and enters it`);
        await tab.keyboard.press('ArrowRight');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuLink) === 'console', `${k}: ArrowRight goes a level deeper (level 4)`);
        const side = await tab.evaluate(() => {
          const out = [];
          for (const id of ['pumps', 'centrifugal']) {
            const li = document.querySelector(`#row [data-sf-menu-item="${id}"]`);
            const parent = li.parentElement.getBoundingClientRect();
            const panel = li.querySelector(':scope > ul.sf-menu');
            const box = panel.getBoundingClientRect();
            const firstRow = panel.querySelector(':scope > li > .sf-menu-element').getBoundingClientRect();
            const glyph = li.querySelector(':scope > .sf-menu-element .sf-icon-button .sf-icon');
            out.push({id, overlap: Math.min(box.right, parent.right) - Math.max(box.left, parent.left), gap: box.left - parent.right, levelDelta: firstRow.top - li.getBoundingClientRect().top,
              inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight, side: panel.dataset.sfSide, glyph: glyph?.textContent, transform: getComputedStyle(glyph).transform});
          }
          return out;
        });
        for (const one of side) {
          check(one.overlap <= 0.5, `${k}: ${one.id}'s side panel does not overlap its panel (${one.overlap})`);
          check(Math.abs(one.gap - 4) <= 1 || one.side === 'inline-start', `${k}: ${one.id}'s side panel stands space-1/4 past its panel (${one.gap})`);
          check(Math.abs(one.levelDelta) <= 1, `${k}: ${one.id}'s side panel's first row is level with it (${one.levelDelta})`);
          check(one.inside, `${k}: ${one.id}'s side panel is inside the window`);
          check(one.glyph === 'chevron_right', `${k}: ${one.id}'s chevron points to the side (${one.glyph})`);
        }
        seen[`side-${theme}-${run}`] = side;
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'centrifugal', `${k}: Escape closes the innermost panel and gives the focus to its button`);
        await tab.keyboard.press('ArrowLeft');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'pumps'
          && await tab.evaluate(() => !document.querySelector('#row').isOpen('pumps')), `${k}: ArrowLeft closes the side panel and gives the focus to its branch`);
        await tab.keyboard.press('Escape');
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'catalog' && await toggle.getAttribute('aria-expanded') === 'false', `${k}: Escape back to Каталог, closed`);
        await tab.keyboard.press('Space');
        await tab.waitForTimeout(120);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: Space opens the branch`);
        await tab.keyboard.press('Space');
        await tab.waitForTimeout(120);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: Space closes the branch`);
        await tab.keyboard.press('ArrowRight');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'services', `${k}: ArrowRight walks the row`);
        await tab.keyboard.press('End');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuLink) === 'contacts', `${k}: End goes to the row's last item`);
        await tab.keyboard.press('Home');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'catalog', `${k}: Home goes to the row's first item`);
        await tab.keyboard.press('ArrowLeft');
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuLink) === 'contacts', `${k}: ArrowLeft wraps to the end`);
        // Tab walks out: the panel closes.
        await toggle.focus();
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(120);
        await tab.locator('#h button[slot="tools"], #h [slot="tools"]').first().focus();
        await tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: focus leaving the row closes its panel`);
        // The row's mark: the section holding the current page.
        const mark = await tab.evaluate(() => {
          const row = document.querySelector('#row [data-sf-menu-toggle="catalog"]');
          const after = getComputedStyle(row, '::after');
          return {height: after.height, background: after.backgroundColor, weight: getComputedStyle(row).fontWeight, content: after.content};
        });
        check(mark.content !== 'none' && mark.height === '2px' && mark.weight === '500', `${k}: Каталог holds the current page: 2 px line, medium (${JSON.stringify(mark)})`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- flip at the right edge: «Ещё» › Партнёрам › Проектировщикам › Документация at 1000
      {
        const {tab, consoleErrors} = await open(theme, 1000);
        const k = key('flip 1000');
        const row = tab.locator('#row');
        const where = await tab.evaluate(() => document.querySelector('#row').overflowHidden);
        const viaMore = where.includes('partners');
        if (viaMore) await row.evaluate((menu) => menu.open('@more'));
        await row.evaluate((menu) => menu.open('partners'));
        await tab.waitForTimeout(150);
        await row.evaluate((menu) => menu.open('designers'));
        await tab.waitForTimeout(150);
        await row.evaluate((menu) => menu.open('docs'));
        await tab.waitForTimeout(250);
        const flip = await tab.evaluate(() => ['partners', 'designers', 'docs'].map((id) => {
          const li = document.querySelector(`#row [data-sf-menu-item="${id}"]`);
          const panel = li.querySelector(':scope > ul.sf-menu');
          const box = panel.getBoundingClientRect();
          const parent = li.parentElement.getBoundingClientRect();
          const glyph = li.querySelector(':scope > .sf-menu-element .sf-icon-button .sf-icon');
          return {id, level: li.dataset.sfMenuLevel, side: panel.dataset.sfSide, left: box.left, right: box.right, top: box.top, bottom: box.bottom, inner: innerWidth,
            overlap: li.dataset.sfMenuLevel === '1' ? 0 : Math.min(box.right, parent.right) - Math.max(box.left, parent.left), glyph: glyph?.textContent, transform: getComputedStyle(glyph).transform};
        }));
        seen[`flip-${theme}-${run}`] = {viaMore, flip};
        const flipped = flip.filter((one) => one.side === 'inline-start');
        check(flipped.length > 0, `${k}: a side panel at the right edge opens to the left (${flip.map((one) => one.side).join(',')})`);
        for (const one of flip) {
          check(one.left >= -0.5 && one.right <= one.inner + 0.5 && one.top >= -0.5 && one.bottom <= 900.5, `${k}: ${one.id}'s panel stays inside the window (${Math.round(one.left)}..${Math.round(one.right)})`);
          check(one.overlap <= 0.5, `${k}: ${one.id}'s panel does not overlap its parent panel (${one.overlap})`);
          if (one.level !== '1') {
            check(one.glyph === 'chevron_right', `${k}: ${one.id}'s chevron is chevron_right (${one.glyph})`);
            const turned = /^matrix\(-1/u.test(one.transform);
            check(turned === (one.side === 'inline-start'), `${k}: ${one.id}'s chevron is turned exactly when its panel flipped (${one.transform}, ${one.side})`);
          }
        }
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- geometry: column, admin, C23
      {
        const {tab, consoleErrors} = await open(theme, 1280);
        const k = key('geometry');
        const geo = await tab.evaluate(() => {
          const text = (id) => document.querySelector(`#column [data-sf-menu-item="${id}"] > .sf-menu-element .sf-menu-element-text`).getBoundingClientRect().left;
          const probe = document.createElement('div');
          document.querySelector('#column').parentElement.append(probe);
          probe.style.width = 'var(--sf-space-1)';
          const step = parseFloat(getComputedStyle(probe).width);
          probe.remove();
          const current = document.querySelector('#column [aria-current="page"]');
          const openBranch = document.querySelector('#column [data-sf-menu-toggle="centrifugal"]');
          const admin = [...document.querySelectorAll('#admin ul.sf-menu > li > .sf-menu-element, #admin ul.sf-menu > li > ul > li > .sf-menu-element')]
            .filter((row) => row.getBoundingClientRect().height > 0)
            .map((row) => ({text: row.querySelector('.sf-menu-element-text').textContent, height: row.getBoundingClientRect().height, x: row.querySelector('.sf-menu-element-text').getBoundingClientRect().left, count: Boolean(row.querySelector('.sf-badge'))}));
          return {xs: ['catalog', 'pumps', 'centrifugal', 'console'].map(text), step, plate: getComputedStyle(current).backgroundColor, currentWeight: getComputedStyle(current).fontWeight,
            openFill: getComputedStyle(openBranch).backgroundColor, admin};
        });
        seen[`geometry-${theme}-${run}`] = geo;
        const steps = geo.xs.slice(1).map((x, at) => x - geo.xs[at]);
        check(steps.every((one) => Math.abs(one - geo.step) <= 0.5), `${k}: the column indents one step (${geo.step}) per level (${steps.join(', ')})`);
        check(geo.plate === PLATE[theme] && geo.currentWeight === '500', `${k}: the current page is the C23 plate (${geo.plate}, ${geo.currentWeight})`);
        check(transparent(geo.openFill), `${k}: an open branch is not filled (${geo.openFill})`);
        check(geo.admin.length >= 6 && geo.admin.every((row) => Math.abs(row.height - 32) <= 0.5), `${k}: compact admin rows are 32, the count row too (${geo.admin.map((row) => row.height).join(',')})`);
        const firstLevel = geo.admin.find((row) => row.text === 'Магазин');
        const secondLevel = geo.admin.filter((row) => ['Заказы', 'Товары', 'Клиенты'].includes(row.text));
        check(secondLevel.length === 3 && secondLevel.every((row) => Math.abs(row.x - firstLevel.x) <= 0.5), `${k}: the second level's words stand under the first level's (${firstLevel?.x} / ${secondLevel.map((row) => row.x).join(',')})`);
        // A closed branch that holds the current page: the bar.
        await tab.evaluate(() => document.querySelector('#column').close('centrifugal'));
        await tab.waitForTimeout(150);
        const bar = await tab.evaluate(() => {
          const row = document.querySelector('#column [data-sf-menu-toggle="centrifugal"]');
          const before = getComputedStyle(row, '::before');
          const probe = document.createElement('span');
          probe.style.color = 'var(--sf-primary)';
          document.body.append(probe);
          const primary = getComputedStyle(probe).color;
          probe.remove();
          return {width: before.width, height: before.height, background: before.backgroundColor, primary, fill: getComputedStyle(row).backgroundColor, content: before.content};
        });
        check(bar.content !== 'none' && bar.width === '3px' && bar.height === '16px' && bar.background === bar.primary && transparent(bar.fill), `${k}: a closed branch holding the current page draws the 3 x 16 bar, unfilled (${JSON.stringify(bar)})`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- the phone: the tree in sf-header-site's panel, the path open
      {
        const {tab, consoleErrors} = await open(theme, 390, '?collapse=md');
        const k = key('phone 390');
        await tab.locator('#h .sf-site-header-menu-button button').click();
        await tab.waitForTimeout(450);
        const phone = await tab.evaluate(() => {
          const menu = document.querySelector('#row');
          const rows = [...menu.querySelectorAll('.sf-menu-element')].filter((row) => row.getBoundingClientRect().height > 0);
          return {orientation: menu.getAttribute('orientation'), open: menu.openIds, current: menu.querySelector('[aria-current="page"]')?.textContent.trim(),
            currentShown: (menu.querySelector('[aria-current="page"]')?.getBoundingClientRect().height || 0) > 0,
            heights: [...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height)))], more: Boolean(menu.querySelector('.sf-menu-item--more')),
            back: Boolean(menu.querySelector('[data-sf-menu-back]')), pageScroll: document.documentElement.scrollWidth - innerWidth};
        });
        seen[`phone-${theme}-${run}`] = phone;
        check(phone.orientation === 'vertical', `${k}: the menu is a column in the panel`);
        check(['catalog', 'pumps', 'centrifugal'].every((id) => phone.open.includes(id)) && phone.currentShown, `${k}: the path to the current page is open (${phone.open.join(',')})`);
        check(!phone.more && !phone.back, `${k}: no «Ещё» and no drill-in in the panel`);
        check(phone.heights.length === 1, `${k}: every row of the tree is one height (${phone.heights.join(',')})`);
        check(phone.pageScroll <= 0, `${k}: no horizontal page scroll`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- region (mega) and hover at 1280
      {
        const {tab, consoleErrors} = await open(theme, 1280, '?mega=1&hover=1');
        const k = key('region + hover');
        const services = tab.locator('#row [data-sf-menu-toggle="services"]');
        await services.hover();
        await tab.waitForTimeout(150);
        check(await services.getAttribute('aria-expanded') === 'false', `${k}: hover: still closed at 150 ms`);
        await tab.waitForTimeout(300);
        check(await services.getAttribute('aria-expanded') === 'true', `${k}: hover: open after 300 ms`);
        const region = await tab.evaluate(() => {
          const panel = document.querySelector('#row [data-sf-menu-item="services"] > .sf-menu-region');
          const header = document.querySelector('#h .sf-site-header, #h header');
          const box = panel.getBoundingClientRect();
          const head = header.getBoundingClientRect();
          return {width: box.width, headerWidth: head.width, top: box.top, headerBottom: head.bottom, left: box.left, headerLeft: head.left,
            columns: panel.querySelectorAll('.sf-menu-region-column').length, heads: [...panel.querySelectorAll('.sf-menu-region-head')].map((one) => one.getBoundingClientRect().height)};
        });
        seen[`region-${theme}-${run}`] = region;
        check(Math.abs(region.width - region.headerWidth) <= 1 && Math.abs(region.left - region.headerLeft) <= 1, `${k}: the region is as wide as the header (${region.width} / ${region.headerWidth})`);
        check(Math.abs(region.top - region.headerBottom) <= 1, `${k}: the region opens under the header (${region.top} / ${region.headerBottom})`);
        check(region.columns === 2 && region.heads.every((height) => height >= 39.5), `${k}: without a template the region draws the children as columns (${region.columns})`);
        await tab.mouse.move(640, 880);
        await tab.waitForTimeout(250);
        check(await services.getAttribute('aria-expanded') === 'true', `${k}: hover: still open 250 ms after leaving`);
        await tab.waitForTimeout(450);
        check(await services.getAttribute('aria-expanded') === 'false', `${k}: hover: closed 500 ms after leaving`);
        // The template region, by the keys.
        const catalog = tab.locator('#row [data-sf-menu-toggle="catalog"]');
        await catalog.focus();
        await tab.keyboard.press('ArrowDown');
        await tab.waitForTimeout(150);
        const inRegion = await tab.evaluate(() => ({focus: document.activeElement?.getAttribute('href'), template: Boolean(document.querySelector('#row .sf-menu-region .probe-region'))}));
        check(inRegion.template && inRegion.focus === '#pumps', `${k}: ArrowDown enters the template region at its first link (${inRegion.focus})`);
        await tab.keyboard.press('ArrowDown');
        check(await tab.evaluate(() => document.activeElement?.getAttribute('href')) === '#valves', `${k}: ArrowDown walks the region's links`);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(150);
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'catalog' && await catalog.getAttribute('aria-expanded') === 'false', `${k}: Escape closes the region, the focus back on its button`);
        const regionMark = await tab.evaluate(() => getComputedStyle(document.querySelector('#row [data-sf-menu-toggle="catalog"]'), '::after').height);
        check(regionMark === '2px', `${k}: a region's section holding the current page keeps the line (${regionMark})`);
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
console.log(`menu-simple: ${passes.length} passed, ${failures.length} failed`);
process.exitCode = failures.length ? 1 : 0;
