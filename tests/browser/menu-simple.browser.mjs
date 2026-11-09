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
//   to the left and the chevron stays › (R059);
// keys: WAI-ARIA disclosure navigation with top-level links (C30, R058) -- a
//   section that is a page is a split control, its name a link and its
//   chevron a button «<раздел>: подразделы»; Tab goes link, chevron, next;
//   Enter and Space on the chevron, ↓ on either, Escape back to the chevron,
//   and the arrows of the row, its panels and a region; touch: a tap on the
//   chevron toggles, a tap on the name navigates;
// marks (R057, R060): the row's current section has a 2 px primary line
//   lying on sf-header-site's bottom border and a medium label (indicator
//   line), or the C23 plate (indicator fill); an open section has the
//   neutral select plate and ⌃; a closed panel row that holds the current
//   page is medium with a primary ›, no bar;
// geometry: a compact admin row is 32 high with a count, the second level's
//   words under the first level's; a column indents one step (space-1) per
//   level; the current page is the C23 plate, an open branch is unfilled, a
//   closed branch that holds the current page draws the 3 x 16 bar and a
//   row's section that holds it the 2 px line; the phone panel shows the tree
//   with the path open;
// region and hover: a mega region is as wide as the header and under it and
//   has no row of the section itself; with a mouse a panel opens after
//   300 ms, a region after 500 ms, both close 500 ms after the mouse left
//   (open-on hover, the default); open-on click ignores the mouse resting.
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
// Every section with subsections is a page of its own, but О компании: the
// row draws the pages as split controls and О компании as one button.
const pages = (items) => items.map((item) => ({...item, href: item.href || (item.id === 'about' ? '' : `#${item.id}`), children: item.children ? pages(item.children) : []}));
const ROW = pages(SITE);
const MEGA = ROW.map((item) => (item.id === 'catalog' ? {...item, region: 'catalog'} : item.id === 'services' ? {...item, region: 'services'} : item));
const ADMIN = [
  {id: 'desk', label: 'Рабочий стол', href: '#desk', icon: 'dashboard'},
  {id: 'shop', label: 'Магазин', icon: 'storefront', children: [{id: 'orders', label: 'Заказы', href: '#orders', count: 12}, leaf('goods', 'Товары'), leaf('clients', 'Клиенты')]},
  {id: 'site', label: 'Сайт', icon: 'language', children: [leaf('pages', 'Страницы')]},
];
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const page = (search) => {
  const hover = (search.get('click') === '1' ? ' open-on="click"' : '') + (search.get('fill') === '1' ? ' indicator="fill"' : '');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0}.side{inline-size:20rem;padding:var(--sf-space-1\\/2)}</style></head><body>
<sf-header-site id="h" collapse="${search.get('collapse') || 'none'}">
  <a slot="brand" href="#home">Технопром</a>
  <sf-menu id="row" label="Разделы сайта" orientation="horizontal" appearance="navigation" overflow="more" current="console"${hover} items='${json(search.get('mega') === '1' ? MEGA : ROW)}'>
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
async function open(theme, width, search = '', options = {}) {
  const tab = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme, ...options});
  const consoleErrors = [];
  tab.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  tab.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  await tab.addInitScript(() => {
    window.__overflow = [];
    document.addEventListener('sf-menu-overflow', (event) => window.__overflow.push({id: event.target.id, hidden: event.detail.hidden}));
    window.__navigated = [];
    document.addEventListener('sf-menu-navigate', (event) => {
      event.preventDefault();
      window.__navigated.push(event.detail.id);
    });
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

      // ---- row: the split control, its keys, panels and marks (1280)
      {
        const {tab, consoleErrors} = await open(theme, 1280);
        const k = key('row keys 1280');
        const active = () => tab.evaluate(() => {
          const node = document.activeElement;
          return node?.dataset.sfMenuToggle ? `toggle:${node.dataset.sfMenuToggle}` : node?.dataset.sfMenuLink ? `link:${node.dataset.sfMenuLink}` : node?.tagName;
        });
        const link = tab.locator('#row [data-sf-menu-link="catalog"]');
        const toggle = tab.locator('#row [data-sf-menu-toggle="catalog"]');
        // The split control: a link to the section and a chevron button named after it.
        const split = await tab.evaluate(() => {
          const li = document.querySelector('#row [data-sf-menu-item="catalog"]');
          const a = li.querySelector(':scope > .sf-menu-element > a[href]');
          const b = li.querySelector(':scope > .sf-menu-element > button');
          const about = document.querySelector('#row [data-sf-menu-item="about"] > .sf-menu-element');
          return {href: a?.getAttribute('href'), name: b?.getAttribute('aria-label'), expanded: b?.getAttribute('aria-expanded'), controls: Boolean(b && document.getElementById(b.getAttribute('aria-controls'))),
            glyph: b?.querySelector('.sf-icon')?.textContent, aboutButton: about?.matches('button') && about.getAttribute('aria-expanded') === 'false'};
        });
        check(split.href === '#catalog' && split.name === 'Каталог: подразделы' && split.expanded === 'false' && split.controls, `${k}: a section that is a page is a link plus a chevron button «Каталог: подразделы» (${JSON.stringify(split)})`);
        check(split.glyph === 'keyboard_arrow_down', `${k}: the row's chevron is ⌄ while closed (${split.glyph})`);
        check(split.aboutButton, `${k}: a section that is no page stays one button`);
        await link.focus();
        await tab.keyboard.press('Tab');
        check(await active() === 'toggle:catalog', `${k}: Tab goes from the name to its chevron`);
        await tab.keyboard.press('Tab');
        check(await active() === 'link:services', `${k}: Tab goes from the chevron to the next section`);
        await toggle.focus();
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: Enter on the chevron opens Каталог`);
        check(await active() === 'toggle:catalog', `${k}: the focus stays on the chevron after Enter`);
        const first = await tab.evaluate(() => {
          const li = document.querySelector('#row [data-sf-menu-item="catalog"]');
          const panel = li.querySelector(':scope > ul.sf-menu');
          const control = li.getBoundingClientRect();
          const box = panel.getBoundingClientRect();
          const rows = [...panel.querySelectorAll(':scope > li > .sf-menu-element')].map((row) => row.getBoundingClientRect().height);
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--sf-surface-transparent-select)';
          document.body.append(probe);
          const select = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const element = li.querySelector(':scope > .sf-menu-element');
          return {gap: box.top - control.bottom, popover: panel.matches(':popover-open'), rows, shadow: getComputedStyle(panel).boxShadow,
            plate: getComputedStyle(element).backgroundColor, select, glyph: element.querySelector('button .sf-icon').textContent,
            line: getComputedStyle(li, '::after').content};
        });
        check(Math.abs(first.gap - 4) <= 0.5, `${k}: the first panel stands space-1/4 (4) under its section (${first.gap})`);
        check(first.popover, `${k}: the first panel is in the top layer`);
        check(first.rows.every((height) => Math.abs(height - 40) <= 0.5), `${k}: the panel's rows are 40 (${first.rows})`);
        check(first.shadow !== 'none', `${k}: the panel has the overlay shadow`);
        check(first.plate === first.select && first.glyph === 'keyboard_arrow_up', `${k}: the open section has the neutral select plate and ⌃ (${first.plate} / ${first.select}, ${first.glyph})`);
        check(first.line !== 'none', `${k}: the open section that holds the current page keeps its line`);
        // R057: the path in the panel -- Насосное оборудование holds the current page.
        const path = await tab.evaluate(() => {
          const row = document.querySelector('#row [data-sf-menu-item="pumps"] > .sf-menu-element');
          const other = document.querySelector('#row [data-sf-menu-item="valves"] > .sf-menu-element');
          const probe = document.createElement('span');
          probe.style.color = 'var(--sf-primary)';
          document.body.append(probe);
          const primary = getComputedStyle(probe).color;
          probe.remove();
          return {weight: getComputedStyle(row.querySelector('a')).fontWeight, chevron: getComputedStyle(row.querySelector('button .sf-icon')).color, primary,
            bar: getComputedStyle(row, '::before').content, otherWeight: getComputedStyle(other.querySelector('a')).fontWeight, otherChevron: getComputedStyle(other.querySelector('button .sf-icon')).color,
            name: row.querySelector('button').getAttribute('aria-label')};
        });
        check(path.weight === '500' && path.chevron === path.primary, `${k}: a closed panel row holding the current page is medium with a primary › (${path.weight}, ${path.chevron})`);
        check(path.bar === 'none' || path.bar === 'normal', `${k}: no bar in the panel (${path.bar})`);
        check(path.otherWeight === '400' && path.otherChevron !== path.primary, `${k}: a row that does not hold it stays plain (${path.otherWeight}, ${path.otherChevron})`);
        check(path.name === 'Насосное оборудование: подразделы', `${k}: a panel row's chevron is named after its section (${path.name})`);
        await tab.keyboard.press('ArrowDown');
        await tab.waitForTimeout(80);
        check(await active() === 'link:pumps', `${k}: ArrowDown enters the panel at its first row`);
        await tab.keyboard.press('ArrowDown');
        check(await active() === 'link:valves', `${k}: ArrowDown walks the panel`);
        await tab.keyboard.press('End');
        check(await active() === 'link:parts', `${k}: End goes to the panel's last row`);
        await tab.keyboard.press('Home');
        check(await active() === 'link:pumps', `${k}: Home goes to the panel's first row`);
        await tab.keyboard.press('ArrowRight');
        await tab.waitForTimeout(150);
        check(await active() === 'link:centrifugal', `${k}: ArrowRight opens the side level and enters it`);
        await tab.keyboard.press('ArrowRight');
        await tab.waitForTimeout(150);
        check(await active() === 'link:console', `${k}: ArrowRight goes a level deeper (level 4)`);
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
          check(one.glyph === 'chevron_right' && !/^matrix\(-1/u.test(one.transform), `${k}: ${one.id}'s chevron is › (${one.glyph}, ${one.transform})`);
        }
        seen[`side-${theme}-${run}`] = side;
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(150);
        check(await active() === 'toggle:centrifugal', `${k}: Escape closes the deepest level and gives the focus to its chevron`);
        await tab.keyboard.press('ArrowLeft');
        await tab.waitForTimeout(150);
        check(await active() === 'toggle:pumps' && await tab.evaluate(() => !document.querySelector('#row').isOpen('pumps')), `${k}: ArrowLeft closes the side level and gives the focus to its chevron`);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(150);
        check(await active() === 'toggle:catalog' && await toggle.getAttribute('aria-expanded') === 'false', `${k}: Escape back to Каталог's chevron, closed`);
        await tab.keyboard.press('Space');
        await tab.waitForTimeout(120);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: Space on the chevron opens the section`);
        await tab.keyboard.press('Space');
        await tab.waitForTimeout(120);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: Space closes it`);
        // ↓ on the name opens the panel too and enters it.
        await link.focus();
        await tab.keyboard.press('ArrowDown');
        await tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'true' && await active() === 'link:pumps', `${k}: ArrowDown on the name opens the panel and enters it`);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(120);
        await link.focus();
        await tab.keyboard.press('ArrowRight');
        check(await active() === 'link:services', `${k}: ArrowRight walks the row`);
        await tab.keyboard.press('End');
        check(await active() === 'link:contacts', `${k}: End goes to the row's last section`);
        await tab.keyboard.press('Home');
        check(await active() === 'link:catalog', `${k}: Home goes to the row's first section`);
        await tab.keyboard.press('ArrowLeft');
        check(await active() === 'link:contacts', `${k}: ArrowLeft wraps to the end`);
        // Enter on the name goes to the section's page and opens nothing.
        await link.focus();
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(120);
        check(await tab.evaluate(() => window.__navigated.includes('catalog')) && await toggle.getAttribute('aria-expanded') === 'false', `${k}: Enter on the name goes to the section's page, nothing opens`);
        // Tab walks out: the panel closes.
        await toggle.focus();
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(120);
        await tab.locator('#h button[slot="tools"], #h [slot="tools"]').first().focus();
        await tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: focus leaving the row closes its panel`);
        // R060: the current section's line lies on sf-header-site's bottom border.
        const mark = await tab.evaluate(() => {
          const li = document.querySelector('#row [data-sf-menu-item="catalog"]');
          const after = getComputedStyle(li, '::after');
          const header = document.querySelector('#h .sf-site-header').getBoundingClientRect();
          const box = li.getBoundingClientRect();
          const lineBottom = box.bottom - parseFloat(after.bottom);
          const element = li.querySelector(':scope > .sf-menu-element');
          const probe = document.createElement('span');
          probe.style.color = 'var(--sf-primary)';
          document.body.append(probe);
          const primary = getComputedStyle(probe).color;
          probe.remove();
          return {content: after.content, height: after.height, background: after.backgroundColor, primary, lineBottom, headerBottom: header.bottom,
            border: getComputedStyle(document.querySelector('#h .sf-site-header')).borderBottomWidth,
            weight: getComputedStyle(element.querySelector('a')).fontWeight, fill: getComputedStyle(element).backgroundColor,
            left: box.left + parseFloat(after.left), right: box.right - parseFloat(after.right), controlLeft: element.getBoundingClientRect().left, controlRight: element.getBoundingClientRect().right};
        });
        seen[`line-${theme}-${run}`] = mark;
        check(mark.content !== 'none' && mark.height === '2px' && mark.background === mark.primary, `${k}: the current section has a 2 px primary line (${mark.height}, ${mark.background})`);
        check(Math.abs(mark.lineBottom - mark.headerBottom) <= 0.5 && mark.border === '1px', `${k}: the line lies on the header's bottom border, covering it (${mark.lineBottom} / ${mark.headerBottom}, border ${mark.border})`);
        check(mark.left >= mark.controlLeft - 0.5 && mark.right <= mark.controlRight + 0.5 && mark.right - mark.left > 40, `${k}: the line runs under the whole control (${Math.round(mark.left)}..${Math.round(mark.right)})`);
        check(mark.weight === '500' && transparent(mark.fill), `${k}: the current section is medium and has no plate (${mark.weight}, ${mark.fill})`);
        // A first-level page that is itself current: the line, not the plate.
        await tab.evaluate(() => document.querySelector('#row').setAttribute('current', 'news'));
        await tab.waitForTimeout(150);
        const news = await tab.evaluate(() => {
          const li = document.querySelector('#row [data-sf-menu-item="news"]');
          const row = li.querySelector(':scope > .sf-menu-element');
          return {line: getComputedStyle(li, '::after').height, fill: getComputedStyle(row).backgroundColor, weight: getComputedStyle(row).fontWeight, current: row.getAttribute('aria-current'),
            catalogLine: getComputedStyle(document.querySelector('#row [data-sf-menu-item="catalog"]'), '::after').content};
        });
        check(news.current === 'page' && news.line === '2px' && transparent(news.fill) && news.weight === '500', `${k}: a current first-level page has the line, no plate (${JSON.stringify(news)})`);
        check(news.catalogLine === 'none', `${k}: the section that no longer holds it loses its line`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- indicator fill: the C23 plate on the current section, no line
      {
        const {tab, consoleErrors} = await open(theme, 1280, '?fill=1');
        const k = key('indicator fill');
        const fill = await tab.evaluate(() => {
          const li = document.querySelector('#row [data-sf-menu-item="catalog"]');
          const element = li.querySelector(':scope > .sf-menu-element');
          return {plate: getComputedStyle(element).backgroundColor, weight: getComputedStyle(element.querySelector('a')).fontWeight, line: getComputedStyle(li, '::after').content,
            list: document.querySelector('#row ul.sf-menu').classList.contains('sf-menu--indicator-fill')};
        });
        seen[`fill-${theme}-${run}`] = fill;
        check(fill.list && fill.plate === PLATE[theme] && fill.weight === '500', `${k}: the current section is the C23 plate, medium (${fill.plate})`);
        check(fill.line === 'none' || fill.line === 'normal', `${k}: no line (${fill.line})`);
        await tab.evaluate(() => document.querySelector('#row').open('services'));
        await tab.waitForTimeout(150);
        const opened = await tab.evaluate(() => {
          const element = document.querySelector('#row [data-sf-menu-item="services"] > .sf-menu-element');
          return getComputedStyle(element).backgroundColor;
        });
        check(opened !== PLATE[theme] && !transparent(opened), `${k}: an open section is the neutral plate, never the primary one (${opened})`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
      }

      // ---- touch: a tap on the chevron toggles, a tap on the name navigates
      {
        const {tab, consoleErrors} = await open(theme, 1280, '', {hasTouch: true});
        const k = key('touch');
        const toggle = tab.locator('#row [data-sf-menu-toggle="services"]');
        await toggle.tap();
        await tab.waitForTimeout(200);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: a tap on the chevron opens the section`);
        await toggle.tap();
        await tab.waitForTimeout(200);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: a second tap closes it`);
        await tab.locator('#row [data-sf-menu-link="services"]').tap();
        await tab.waitForTimeout(600);
        check(await tab.evaluate(() => window.__navigated.includes('services')) && await toggle.getAttribute('aria-expanded') === 'false', `${k}: a tap on the name goes to the page and opens nothing`);
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
            // R059: the side follows the room, the chevron never turns.
            check(one.glyph === 'chevron_right' && !/^matrix\(-1/u.test(one.transform), `${k}: ${one.id}'s chevron stays › on either side (${one.glyph}, ${one.transform}, ${one.side})`);
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

      // ---- hover (the default) on a panel, then open-on click
      {
        const {tab, consoleErrors} = await open(theme, 1280);
        const k = key('hover');
        const name = tab.locator('#row [data-sf-menu-link="partners"]');
        const partners = tab.locator('#row [data-sf-menu-toggle="partners"]');
        await name.hover();
        await tab.waitForTimeout(150);
        check(await partners.getAttribute('aria-expanded') === 'false', `${k}: a panel is still closed 150 ms into the hover`);
        await tab.waitForTimeout(250);
        check(await partners.getAttribute('aria-expanded') === 'true', `${k}: a panel opens 300 ms into the hover (on the name)`);
        // Into the panel and to a side level: it stays open.
        await tab.locator('#row [data-sf-menu-link="designers"]').hover();
        await tab.waitForTimeout(450);
        check(await partners.getAttribute('aria-expanded') === 'true' && await tab.evaluate(() => document.querySelector('#row').isOpen('designers')), `${k}: the panel stays while the mouse is in it, its side level opens on hover`);
        await tab.mouse.move(640, 880);
        await tab.waitForTimeout(250);
        check(await partners.getAttribute('aria-expanded') === 'true', `${k}: still open 250 ms after the mouse left`);
        await tab.waitForTimeout(450);
        check(await partners.getAttribute('aria-expanded') === 'false', `${k}: closed 500 ms after the mouse left`);
        check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
        await tab.close();
        const click = await open(theme, 1280, '?click=1');
        const toggle = click.tab.locator('#row [data-sf-menu-toggle="partners"]');
        await click.tab.locator('#row [data-sf-menu-link="partners"]').hover();
        await click.tab.waitForTimeout(700);
        check(await toggle.getAttribute('aria-expanded') === 'false', `${k}: open-on click: resting the mouse opens nothing`);
        await toggle.click();
        await click.tab.waitForTimeout(150);
        check(await toggle.getAttribute('aria-expanded') === 'true', `${k}: open-on click: a click on the chevron opens`);
        check(!click.consoleErrors.length, `${k}: click console clean ${click.consoleErrors.join(' | ')}`);
        await click.tab.close();
      }

      // ---- region (mega) at 1280: hover after 500 ms, keys, no row of the section itself
      {
        const {tab, consoleErrors} = await open(theme, 1280, '?mega=1');
        const k = key('region');
        const services = tab.locator('#row [data-sf-menu-toggle="services"]');
        await tab.locator('#row [data-sf-menu-link="services"]').hover();
        await tab.waitForTimeout(350);
        check(await services.getAttribute('aria-expanded') === 'false', `${k}: a region is still closed 350 ms into the hover`);
        await tab.waitForTimeout(250);
        check(await services.getAttribute('aria-expanded') === 'true', `${k}: a region opens 500 ms into the hover`);
        const region = await tab.evaluate(() => {
          const panel = document.querySelector('#row [data-sf-menu-item="services"] > .sf-menu-region');
          const header = document.querySelector('#h .sf-site-header, #h header');
          const box = panel.getBoundingClientRect();
          const head = header.getBoundingClientRect();
          return {width: box.width, headerWidth: head.width, top: box.top, headerBottom: head.bottom, left: box.left, headerLeft: head.left,
            columns: panel.querySelectorAll('.sf-menu-region-column').length, heads: [...panel.querySelectorAll('.sf-menu-region-head')].map((one) => one.getBoundingClientRect().height),
            self: Boolean(panel.querySelector('[data-sf-menu-link="services"]')), foot: [...panel.querySelectorAll('.sf-menu-region-foot a')].map((one) => one.dataset.sfMenuLink)};
        });
        seen[`region-${theme}-${run}`] = region;
        check(Math.abs(region.width - region.headerWidth) <= 1 && Math.abs(region.left - region.headerLeft) <= 1, `${k}: the region is as wide as the header (${region.width} / ${region.headerWidth})`);
        check(Math.abs(region.top - region.headerBottom) <= 1, `${k}: the region opens under the header (${region.top} / ${region.headerBottom})`);
        check(region.columns === 2 && region.heads.every((height) => height >= 39.5), `${k}: without a template the region draws the children as columns (${region.columns})`);
        check(!region.self && region.foot.join() === 'rent', `${k}: no row of the section itself in the region (foot: ${region.foot.join()})`);
        await tab.mouse.move(640, 880);
        await tab.waitForTimeout(250);
        check(await services.getAttribute('aria-expanded') === 'true', `${k}: still open 250 ms after leaving`);
        await tab.waitForTimeout(450);
        check(await services.getAttribute('aria-expanded') === 'false', `${k}: closed 500 ms after leaving`);
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
        check(await tab.evaluate(() => document.activeElement?.dataset.sfMenuToggle) === 'catalog' && await catalog.getAttribute('aria-expanded') === 'false', `${k}: Escape closes the region, the focus back on its chevron`);
        const regionMark = await tab.evaluate(() => getComputedStyle(document.querySelector('#row [data-sf-menu-item="catalog"]'), '::after').height);
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
