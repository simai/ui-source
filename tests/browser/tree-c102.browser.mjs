#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--loads 3]
// sf-tree, owner decision C102 (ui-control control/docs-review/decisions.md;
// research control/research/2026-11-12-tree.md section 7) and TR-15, NI-2,
// NI-3, measured on the built bytes through the Loader (core.css,
// smart-base.js, core.js; the rule of sf-tree brings its relations) at 1440
// and 390, light and dark, each page loaded --loads times (3), the console
// read for errors:
//   icons   a branch folder / folder_open, a leaf by kind or extension,
//           draft when nothing says it; no children = leaf unless
//           kind="folder"; icon names win; icons all | branches | none;
//           file-types none; every glyph is one glyph of the icon font
//   toggle  chevron + type icon; chevron alone with icons none
//   static  a list (ul/li, no role tree), no Tab stop, no chevrons, rows of
//           a text line, names in the code face, note / mark / more; the
//           class markup .sf-tree--static is left alone by the class tree
//   lazy    «Загрузка…» with the spinner, the error row, retry, children
//   check   aria-checked true / false / mixed, cascade, the mark on-primary
//           (TR-15), Space
//   pages   kind page on a branch, home, link, a hidden page with its word
//   keys    * opens the siblings; expand-all / collapse-all
//   reorder before / after / inside, never into itself
//   C109    the level step is the chevron and the row gap: a child's chevron
//           stands under its parent's icon (NI-1, NI-2); the gap is H2 of
//           C105, 12 at 1440 and 8 at 390, one variable (NI-3); sizes 1/2,
//           1 and 2 on the ladder (NI-6); the static tree steps by its icon
//           and the gap, a child's icon under its parent's name
//   C107    the type icon and the chevron are on-surface-variant; a selected
//           row's glyphs take its ink
// Prints TREE_C102_OK and a JSON report.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loadsAt = process.argv.indexOf('--loads');
const LOADS = loadsAt > 0 ? Number(process.argv[loadsAt + 1]) : 3;
const ORIGIN = 'http://probe.test';
const CDN = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';
const failures = [];
const report = {};

const PAGE = `<!doctype html><html lang="ru" class="__THEME__"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${CDN}core/css/core.css">
<script>window.sfPath='${CDN}';window.sfSmartPath='${CDN.replace(/\/$/u, '')}';window.SF_BOOT_CONFIG={theme:false,smart:{base:true},minified:true,preloader:{enabled:false}};</script>
<script defer src="${CDN}core/js/smart-base.js"></script><script defer src="${CDN}core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface);font-family:var(--sf-text--family)} .box{inline-size:min(100%,32rem);margin-block-end:16px}</style>
</head><body>
<div class="box"><sf-tree id="icons" aria-label="Файлы"></sf-tree></div>
<div class="box"><sf-tree id="branches" icons="branches" aria-label="Только папки"></sf-tree></div>
<div class="box"><sf-tree id="none" icons="none" aria-label="Без значков"></sf-tree></div>
<div class="box"><sf-tree id="bytype" file-types="none" aria-label="Без расширений"></sf-tree></div>
<div class="box"><sf-tree id="static" static aria-label="Структура проекта"></sf-tree></div>
<div class="box"><div class="sf-tree sf-tree--static flex flex-col" id="static-markup"><ul class="sf-tree-group" role="list"><li class="sf-tree-item sf-tree-item--folder flex flex-col"><div class="sf-tree-item-container flex items-cross-center"><i class="sf-icon sf-tree-node-icon" aria-hidden="true">folder_open</i><span class="sf-tree-item-name">content</span></div><ul class="sf-tree-group" role="list"><li class="sf-tree-item sf-tree-item--file flex flex-col"><div class="sf-tree-item-container flex items-cross-center"><i class="sf-icon sf-tree-node-icon" aria-hidden="true">description</i><span class="sf-tree-item-name">index.md</span><span class="sf-tree-item-note">the home page</span></div></li></ul></li></ul></div></div>
<div class="box"><sf-tree id="lazy" aria-label="Папки"></sf-tree></div>
<div class="box"><sf-tree id="check" selection="check" aria-label="Права"></sf-tree></div>
<div class="box"><sf-tree id="pages" selection="one" aria-label="Страницы сайта"></sf-tree></div>
<div class="box"><sf-tree id="reorder" reorder aria-label="Порядок"></sf-tree></div>
<div class="box"><sf-tree id="deep" aria-label="Уровни"></sf-tree></div>
<div class="box"><sf-tree id="deep-half" size="1/2" aria-label="Уровни 1/2"></sf-tree></div>
<div class="box"><sf-tree id="deep-two" size="2" aria-label="Уровни 2"></sf-tree></div>
<div class="box"><sf-tree id="deep-none" icons="none" aria-label="Уровни без значков"></sf-tree></div>
<div class="box" data-sf-density="compact"><sf-tree id="deep-compact" aria-label="Уровни плотно"></sf-tree></div>
</body></html>`;

const DEMO = [
  {id: 'docs', label: 'Документы', open: true, children: [
    {id: 'pdf', label: 'Договор.pdf'}, {id: 'xlsx', label: 'Смета.xlsx'}, {id: 'empty', label: 'Пустая папка', kind: 'folder'},
  ]},
  {id: 'img', label: 'Изображения', open: true, children: [{id: 'png', label: 'Обложка.png'}, {id: 'svg', label: 'logo.svg'}]},
  {id: 'zip', label: 'Архив.zip'}, {id: 'md', label: 'README.md'}, {id: 'mp3', label: 'Запись.mp3'}, {id: 'mp4', label: 'Обзор.mp4'},
  {id: 'js', label: 'index.js'}, {id: 'json', label: 'docara.json'}, {id: 'plain', label: 'Заметка'},
  {id: 'trash', label: 'Корзина', icon: 'delete'}, {id: 'noicon', label: 'Без значка', icon: false},
  {id: 'pagebranch', label: 'Раздел', kind: 'page', children: [{id: 'pageleaf', label: 'Страница', kind: 'page'}]},
  {id: 'link', label: 'Блог', kind: 'link'},
  // ui-pro sf-property-view passes a section icon through closed-icon.
  {id: 'section', label: 'Основное', openIcon: 'tune', closedIcon: 'tune'},
];
const WANT_ICONS = {docs: 'folder_open', pdf: 'description', xlsx: 'table_chart', empty: 'folder', img: 'folder_open', png: 'image', svg: 'image', zip: 'folder_zip', md: 'description', mp3: 'audio_file', mp4: 'movie', js: 'code', json: 'data_object', plain: 'draft', trash: 'delete', noicon: null, pagebranch: 'article', link: 'link', section: 'tune'};
const PROJECT = [
  {label: 'docara.json', mark: true}, {label: 'redirects.json'},
  {label: 'assets', children: [{label: 'logo.svg'}, {label: 'favicon.svg'}]},
  {label: 'content', children: [{label: 'en', children: [{label: 'index.md'}, {label: 'install.page.json', note: 'optional settings of this one page'}]}]},
  {label: 'examples', kind: 'folder'},
  {label: 'translations.lock.json', note: 'optional accepted translation state'},
  {label: '…', more: true},
];
const PERM = [
  {id: 'shop', label: 'Магазин', open: true, children: [{id: 'orders', label: 'Заказы', selected: true}, {id: 'goods', label: 'Товары', selected: true}, {id: 'reports', label: 'Отчёты'}]},
  {id: 'site', label: 'Сайт', open: true, children: [{id: 'pages', label: 'Страницы'}, {id: 'menu', label: 'Меню'}]},
  {id: 'settings', label: 'Настройки'},
];
const PAGES = [
  {id: 'home', label: 'Главная', kind: 'page', icon: 'home'},
  {id: 'about', label: 'О компании', kind: 'page', open: true, children: [
    {id: 'history', label: 'История', kind: 'page'}, {id: 'team', label: 'Команда', kind: 'page', selected: true}, {id: 'jobs', label: 'Вакансии', kind: 'page', hidden: true},
  ]},
  {id: 'blog', label: 'Блог на Хабре', kind: 'link', href: '#blog'},
];
const ORDER = [
  {id: 'a', label: 'Раздел А', kind: 'page', open: true, children: [{id: 'a1', label: 'Страница 1', kind: 'page'}, {id: 'a2', label: 'Страница 2', kind: 'page'}]},
  {id: 'b', label: 'Раздел Б', kind: 'page'},
  {id: 'f', label: 'Отчёт.pdf'},
];
const DEEP = [{id: 'l1', label: 'Уровень 1', open: true, children: [{id: 'l2', label: 'Уровень 2', open: true, children: [{id: 'l3', label: 'Уровень 3', children: [{id: 'l4', label: 'Лист'}]}]}]}];

const browser = await chromium.launch();
try {
  for (const [width, ladder] of [[1440, 40], [390, 36]]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      for (let load = 1; load <= LOADS; load += 1) {
        const key = `${width}/${theme.replace('theme-', '')}/${load}`;
        const page = await browser.newPage({viewport: {width, height: 900}});
        const errors = [];
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('pageerror', (error) => errors.push(String(error)));
        const serve = (path, route) => (existsSync(path)
          ? route.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.woff2') ? 'font/woff2' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
          : route.fulfill({status: 404, body: ''}));
        await page.route(`${ORIGIN}/**`, (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: PAGE.replace('__THEME__', theme)}));
        await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
          const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
          const [product, ...rest] = tail.split('/');
          return serve(join(out, product, product, ...rest), route);
        });
        await page.goto(`${ORIGIN}/`);
        await page.waitForFunction(() => customElements.get('sf-tree'), null, {timeout: 15000});
        const got = await page.evaluate(async ({DEMO, PROJECT, PERM, PAGES, ORDER, DEEP}) => {
          const wait = (ms) => new Promise((done) => setTimeout(done, ms));
          const $ = (id) => document.getElementById(id);
          const r = {};
          $('icons').items = DEMO; $('branches').items = DEMO; $('none').items = DEMO; $('bytype').items = DEMO;
          $('static').items = PROJECT; $('check').items = PERM; $('pages').items = PAGES; $('reorder').items = ORDER; $('deep').items = DEEP;
          for (const id of ['deep-half', 'deep-two', 'deep-none', 'deep-compact']) $(id).items = DEEP;
          let lazySource = [{id: 'p', label: 'Проекты', hasChildren: true}, {id: 'x', label: 'Архив', 'has-children': true}];
          $('lazy').items = lazySource;
          await document.fonts.ready;
          await wait(600);
          const rows = (tree) => [...tree.querySelectorAll('[role=treeitem]')];
          const iconOf = (row) => row.querySelector(':scope > .sf-tree-item-container > .sf-tree-node-icon')?.textContent.trim() ?? null;
          const byId = (tree) => Object.fromEntries(rows(tree).map((row) => [row.dataset.sfEntry, row]));
          // icons
          const icons = byId($('icons'));
          r.icons = Object.fromEntries(Object.entries(icons).map(([id, row]) => [id, iconOf(row)]));
          r.leafFolders = Object.entries(icons).filter(([, row]) => !row.classList.contains('has-children') && iconOf(row) === 'folder' && row.dataset.sfEntry !== 'empty').length;
          r.branchesIcons = rows($('branches')).filter((row) => iconOf(row)).map((row) => row.dataset.sfEntry);
          r.noneIcons = $('none').querySelectorAll('.sf-tree-node-icon').length;
          r.noneChevrons = $('none').querySelectorAll('.sf-tree-toggle').length;
          r.iconsChevrons = $('icons').querySelectorAll('.sf-tree-toggle').length;
          r.bytypeXlsx = iconOf(byId($('bytype')).xlsx);
          // glyphs: each name one glyph of the icon font
          const probe = document.createElement('i');
          probe.className = 'sf-icon';
          probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;display:inline;inline-size:auto;overflow:visible';
          document.body.append(probe);
          const names = ['folder', 'folder_open', 'draft', 'article', 'description', 'image', 'code', 'data_object', 'table_chart', 'folder_zip', 'movie', 'audio_file', 'link', 'home', 'more_horiz', 'error', 'check', 'remove', 'keyboard_arrow_down', 'chevron_right'];
          r.missingGlyphs = names.filter((name) => { probe.textContent = name; const box = probe.getBoundingClientRect(); return box.width > parseFloat(getComputedStyle(probe).fontSize) * 1.5; });
          probe.remove();
          // NI-3: the gap between chevron, icon and name
          const first = icons.docs.querySelector(':scope > .sf-tree-item-container');
          r.rowGap = parseFloat(getComputedStyle(first).columnGap);
          r.rowHeight = Math.round(first.getBoundingClientRect().height);
          // NI-2: chevron of a child against its parent's
          const deep = byId($('deep'));
          const chevronLeft = (row) => (row.querySelector('.sf-tree-toggle, .sf-tree-toggle-spacer')).getBoundingClientRect().left;
          r.step = [Math.round(chevronLeft(deep.l2) - chevronLeft(deep.l1)), Math.round(chevronLeft(deep.l3) - chevronLeft(deep.l2))];
          r.chevronWidth = Math.round(deep.l1.querySelector('.sf-tree-toggle').getBoundingClientRect().width);
          // C109: where a child's first column lands on its parent's row, and
          // the step, the gap, the column and the row of every size
          // The left of an element's first letter (a text Range on its first
          // non-blank character).
          const firstGlyph = (el) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const i = node.data.search(/\S/u);
              if (i < 0) continue;
              const range = document.createRange();
              range.setStart(node, i); range.setEnd(node, i + 1);
              return Math.round(range.getBoundingClientRect().left);
            }
            return null;
          };
          const colsOf = (row) => {
            const box = row.querySelector(':scope > .sf-tree-item-container');
            const at = (el) => (el ? Math.round(el.getBoundingClientRect().left) : null);
            const name = box.querySelector('.sf-tree-item-name');
            return {tog: at(box.querySelector(':scope > .sf-tree-toggle, :scope > .sf-tree-toggle-spacer')), icon: at(box.querySelector(':scope > .sf-tree-node-icon')), text: firstGlyph(name)};
          };
          r.levels = {};
          for (const id of ['deep', 'deep-half', 'deep-two', 'deep-none', 'deep-compact']) {
            const rowsOf = byId($(id));
            const [p, c] = [colsOf(rowsOf.l1), colsOf(rowsOf.l2)];
            const box = rowsOf.l1.querySelector(':scope > .sf-tree-item-container');
            r.levels[id] = {
              step: c.tog - p.tog,
              childOnIcon: p.icon === null ? null : c.tog - p.icon,
              childOnText: c.tog - p.text,
              gap: parseFloat(getComputedStyle(box).columnGap),
              column: Math.round(box.querySelector('.sf-tree-toggle').getBoundingClientRect().width),
              row: Math.round(box.getBoundingClientRect().height),
              name: getComputedStyle(box.querySelector('.sf-tree-item-name')).fontSize,
            };
          }
          // the static tree: a child's icon under its parent's name
          const sl = [...$('static').querySelectorAll('li.sf-tree-item')];
          const sParent = sl.find((li) => li.querySelector(':scope > ul'));
          const sChild = sParent.querySelector(':scope > ul > li');
          const sp = sParent.querySelector(':scope > .sf-tree-item-container');
          r.staticChildOnText = Math.round(sChild.querySelector('.sf-tree-node-icon').getBoundingClientRect().left) - firstGlyph(sp.querySelector('.sf-tree-item-name'));
          // C107: the row glyphs' ink against the variant role
          const ink = document.createElement('span');
          ink.style.color = 'var(--sf-on-surface-variant)';
          document.body.append(ink);
          r.variant = getComputedStyle(ink).color;
          ink.remove();
          const plainRow = deep.l1.querySelector(':scope > .sf-tree-item-container');
          r.glyphInk = {icon: getComputedStyle(plainRow.querySelector('.sf-tree-node-icon')).color, chevron: getComputedStyle(plainRow.querySelector('.sf-tree-chevron')).color, name: getComputedStyle(plainRow.querySelector('.sf-tree-item-name')).color};
          // static
          const st = $('static');
          const lines = [...st.querySelectorAll('li.sf-tree-item')];
          const nameOf = (li) => li.querySelector(':scope > .sf-tree-item-container > .sf-tree-item-name');
          r.static = {
            roleTree: st.querySelectorAll('[role=tree], [role=treeitem]').length,
            lists: st.querySelectorAll('ul[role=list]').length,
            rows: lines.length,
            tabStops: st.querySelectorAll('[tabindex="0"], button').length,
            chevrons: st.querySelectorAll('.sf-tree-toggle').length,
            height: Math.round(st.querySelector('.sf-tree').getBoundingClientRect().height),
            rowHeights: [...new Set(lines.map((li) => Math.round(li.querySelector(':scope > .sf-tree-item-container').getBoundingClientRect().height)))],
            lineHeight: getComputedStyle(nameOf(lines[0])).lineHeight,
            mono: /mono|menlo|consolas/iu.test(getComputedStyle(nameOf(lines[0])).fontFamily),
            notes: st.querySelectorAll('.sf-tree-item-note').length,
            mark: getComputedStyle(nameOf(lines[0])).fontWeight,
            more: iconOf(lines.at(-1)) ?? lines.at(-1).querySelector('.sf-tree-node-icon')?.textContent,
            cursor: getComputedStyle(lines[0].querySelector('.sf-tree-item-container')).cursor,
            icons: lines.map((li) => li.querySelector(':scope > .sf-tree-item-container > .sf-tree-node-icon')?.textContent),
            ariaLabel: st.querySelector('ul')?.getAttribute('aria-label'),
          };
          const markup = $('static-markup');
          r.staticMarkup = {role: markup.getAttribute('role'), bound: markup.dataset.sfTreeBound ?? null, tabStops: markup.querySelectorAll('[tabindex]').length};
          // lazy
          const lazy = $('lazy');
          const heard = [];
          lazy.addEventListener('sf-tree-toggle', (event) => heard.push(`toggle:${event.detail.id}:${event.detail.open}`));
          lazy.addEventListener('sf-tree-retry', (event) => heard.push(`retry:${event.detail.id}`));
          lazy.expand({id: 'p'});
          await wait(150);
          const loadingRow = lazy.querySelector('.sf-tree-item--loading');
          r.lazy = {
            loading: loadingRow ? {text: loadingRow.textContent.trim(), busy: loadingRow.getAttribute('aria-busy'), level: loadingRow.getAttribute('aria-level'), spinner: Boolean(loadingRow.querySelector('.sf-loader-svg')), spinnerSize: Math.round(loadingRow.querySelector('.sf-tree-item-spinner')?.getBoundingClientRect().width ?? 0)} : null,
          };
          lazySource = lazySource.map((entry) => (entry.id === 'p' ? {...entry, error: true} : entry));
          lazy.items = lazySource;
          await wait(150);
          const errorRow = lazy.querySelector('.sf-tree-item--error');
          r.lazy.error = errorRow ? {text: errorRow.querySelector('.sf-tree-item-name').textContent.trim(), retry: errorRow.querySelector('.sf-tree-item-retry')?.textContent.trim(), icon: iconOf(errorRow)} : null;
          errorRow?.querySelector('.sf-tree-item-retry')?.click();
          await wait(150);
          r.lazy.afterRetry = lazy.querySelector('.sf-tree-item--loading') ? 'loading' : lazy.querySelector('.sf-tree-item--error') ? 'error' : 'none';
          lazySource = lazySource.map((entry) => (entry.id === 'p' ? {...entry, error: false, children: [{id: 'p1', label: 'Бриф.docx'}]} : entry));
          lazy.items = lazySource;
          await wait(150);
          r.lazy.loaded = rows(lazy).map((row) => `${row.dataset.sfEntry}@${row.getAttribute('aria-level')}:${iconOf(row)}`);
          r.lazy.heard = heard;
          // check
          const check = $('check');
          const checks = () => Object.fromEntries(rows(check).map((row) => [row.dataset.sfEntry, row.getAttribute('aria-checked')]));
          r.check = {multiselectable: check.querySelector('[role=tree]').getAttribute('aria-multiselectable'), initial: checks(), selectedAttr: check.querySelectorAll('[aria-selected]').length};
          const box = byId(check).orders.querySelector('.sf-checkbox-box');
          const mark = box?.querySelector('.sf-icon');
          r.check.mark = mark ? {glyph: mark.textContent, color: getComputedStyle(mark).color, box: getComputedStyle(box).backgroundColor} : null;
          // the checkbox's own on-primary, from a plain sf-checkbox on the page
          const plain = document.createElement('label');
          plain.className = 'sf-checkbox sf-checkbox--size-1 flex';
          plain.innerHTML = '<span class="sf-checkbox-box transition flex"><input type="checkbox" checked><i class="sf-icon" aria-hidden="true">check</i></span>';
          document.body.append(plain);
          await wait(50);
          r.check.plainMark = getComputedStyle(plain.querySelector('.sf-icon')).color;
          plain.remove();
          const selects = [];
          check.addEventListener('sf-tree-select', (event) => selects.push(event.detail.ids.join(',')));
          byId(check).shop.querySelector('.sf-tree-item-name').click();
          await wait(120);
          r.check.afterShop = checks();
          byId(check).goods.focus();
          byId(check).goods.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
          await wait(120);
          r.check.afterSpaceGoods = checks();
          r.check.selects = selects;
          r.check.selectedIds = [...check.selectedIds];
          // pages
          const pages = byId($('pages'));
          r.pages = {
            home: iconOf(pages.home), about: iconOf(pages.about), history: iconOf(pages.history), blog: iconOf(pages.blog),
            hiddenWord: pages.jobs.querySelector('.sf-tree-item-hidden-word')?.textContent ?? null,
            hiddenInk: getComputedStyle(pages.jobs.querySelector('.sf-tree-item-name')).color,
            pageInk: getComputedStyle(pages.history.querySelector('.sf-tree-item-name')).color,
            hiddenDisabled: pages.jobs.getAttribute('aria-disabled'),
          };
          // keys: * and expand-all / collapse-all
          const order = $('reorder');
          order.collapseAll();
          await wait(100);
          r.keys = {afterCollapseAll: rows(order).length};
          byId(order).b.focus();
          byId(order).b.dispatchEvent(new KeyboardEvent('keydown', {key: '*', bubbles: true}));
          await wait(100);
          r.keys.afterStar = rows(order).length;
          order.collapseAll();
          order.expandAll();
          await wait(100);
          r.keys.afterExpandAll = rows(order).length;
          // reorder
          const moves = [];
          order.addEventListener('sf-tree-move', (event) => moves.push(event.detail));
          const drag = (fromId, toId, at) => {
            const from = byId(order)[fromId];
            const to = byId(order)[toId];
            const data = new DataTransfer();
            from.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
            const boxTo = to.querySelector('.sf-tree-item-container').getBoundingClientRect();
            const y = boxTo.top + boxTo.height * at;
            const over = new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: data, clientY: y, clientX: boxTo.left + 40});
            to.querySelector('.sf-tree-item-name').dispatchEvent(over);
            const shown = to.getAttribute('data-sf-drop-position');
            to.querySelector('.sf-tree-item-name').dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: data, clientY: y, clientX: boxTo.left + 40}));
            from.dispatchEvent(new DragEvent('dragend', {bubbles: true, dataTransfer: data}));
            return {shown, accepted: over.defaultPrevented};
          };
          r.reorder = {
            draggable: rows(order).filter((row) => row.draggable).length,
            before: drag('f', 'a1', 0.1),
            after: drag('f', 'a1', 0.9),
            inside: drag('f', 'b', 0.5),
            fileInside: drag('a1', 'f', 0.5),
            intoItself: drag('a', 'a2', 0.5),
          };
          r.reorder.moves = moves.map((move) => `${move.ids.join(',')}>${move.parent}|${move.before}`);
          return r;
        }, {DEMO, PROJECT, PERM, PAGES, ORDER, DEEP});
        got.errors = errors.filter((text) => !/favicon/u.test(text));
        report[key] = got;
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

const WANT = {
  check: {orders: 'true', goods: 'true', reports: 'false', shop: 'mixed', site: 'false', pages: 'false', menu: 'false', settings: 'false'},
  afterShop: {orders: 'true', goods: 'true', reports: 'true', shop: 'true'},
  afterSpaceGoods: {orders: 'true', goods: 'false', reports: 'true', shop: 'mixed'},
};
for (const [key, r] of Object.entries(report)) {
  const [width] = key.split('/');
  const ladder = width === '1440' ? 40 : 36;
  const fail = (what) => failures.push(`${key}: ${what}`);
  for (const [id, want] of Object.entries(WANT_ICONS)) if (r.icons[id] !== want) fail(`icon ${id} ${r.icons[id]} (want ${want})`);
  if (r.leafFolders) fail(`${r.leafFolders} leaves drew a folder`);
  if (r.branchesIcons.join() !== 'docs,empty,img,pagebranch') fail(`icons=branches drew ${r.branchesIcons}`);
  if (r.noneIcons !== 0 || r.noneChevrons !== r.iconsChevrons || !r.noneChevrons) fail(`icons=none: ${r.noneIcons} icons, ${r.noneChevrons} chevrons`);
  if (r.bytypeXlsx !== 'draft') fail(`file-types=none xlsx ${r.bytypeXlsx}`);
  if (r.missingGlyphs.length) fail(`glyphs missing ${r.missingGlyphs}`);
  const gap = width === '1440' ? 12 : 8;
  if (r.rowGap !== gap) fail(`row gap ${r.rowGap} (want H2 ${gap})`);
  if (r.rowHeight !== ladder) fail(`row ${r.rowHeight}`);
  if (r.step.some((step) => step !== r.chevronWidth + gap)) fail(`level step ${r.step} (want chevron ${r.chevronWidth} + gap ${gap})`);
  // C109: rung column · row · gap at 1440 and 390. Compact is 20 · 32 · 8 on
  // a desktop; a phone has one density, so compact there is size 1's.
  const RUNGS = width === '1440'
    ? {deep: [24, 40, 12], 'deep-half': [20, 32, 12], 'deep-two': [28, 48, 12], 'deep-none': [24, 40, 12], 'deep-compact': [20, 32, 8]}
    : {deep: [24, 36, 8], 'deep-half': [20, 28, 8], 'deep-two': [28, 44, 8], 'deep-none': [24, 36, 8], 'deep-compact': [24, 36, 8]};
  for (const [id, [column, row, g]] of Object.entries(RUNGS)) {
    const lv = r.levels[id];
    const on = id === 'deep-none' ? lv.childOnText : lv.childOnIcon;
    if (lv.column !== column || lv.gap !== g || lv.step !== column + g || on !== 0) fail(`C109 ${id} ${JSON.stringify(lv)} (want column ${column}, gap ${g}, step ${column + g}, child under the parent's ${id === 'deep-none' ? 'name' : 'icon'})`);
    if (lv.row !== row) fail(`C109 ${id} row ${lv.row} (want ${row})`);
  }
  if (r.staticChildOnText !== 0) fail(`C109 static child icon ${r.staticChildOnText} off the parent's name`);
  if (r.glyphInk.icon !== r.variant || r.glyphInk.chevron !== r.variant || r.glyphInk.name === r.variant) fail(`C107 glyph ink ${JSON.stringify(r.glyphInk)} variant ${r.variant}`);
  const s = r.static;
  // A row is one text line (24 desktop, 20 phone); a note that wraps under
  // its name on a phone makes that row two lines.
  const line = parseFloat(s.lineHeight);
  if (s.roleTree || s.lists < 3 || s.tabStops || s.chevrons || !s.mono || s.notes !== 2 || Number(s.mark) < 600 || s.cursor === 'pointer' || !s.rowHeights.every((h) => h === line || h === 2 * line) || s.ariaLabel !== 'Структура проекта') fail(`static ${JSON.stringify(s)}`);
  if (s.more !== 'more_horiz') fail(`static more ${s.more}`);
  if (r.staticMarkup.role || r.staticMarkup.bound || r.staticMarkup.tabStops) fail(`static markup bound ${JSON.stringify(r.staticMarkup)}`);
  const l = r.lazy;
  if (!l.loading || l.loading.busy !== 'true' || !l.loading.spinner || l.loading.level !== '2' || !/Загрузка/u.test(l.loading.text)) fail(`lazy loading ${JSON.stringify(l.loading)}`);
  if (!l.error || l.error.retry !== 'Повторить' || !/Не удалось/u.test(l.error.text)) fail(`lazy error ${JSON.stringify(l.error)}`);
  if (l.afterRetry !== 'loading') fail(`after retry ${l.afterRetry}`);
  if (l.loaded.join() !== 'p@1:folder_open,p1@2:description,x@1:folder') fail(`lazy loaded ${l.loaded}`);
  if (l.heard.join() !== 'toggle:p:true,retry:p') fail(`lazy heard ${l.heard}`);
  const c = r.check;
  if (c.multiselectable !== 'true' || c.selectedAttr) fail(`check tree ${c.multiselectable} ${c.selectedAttr}`);
  for (const [phase, want] of Object.entries(WANT)) {
    const seen = phase === 'check' ? c.initial : c[phase];
    for (const [id, state] of Object.entries(want)) if (seen[id] !== state) fail(`check ${phase} ${id} ${seen[id]} (want ${state})`);
  }
  if (!c.mark || c.mark.glyph !== 'check' || c.mark.color !== c.plainMark) fail(`TR-15 mark ${JSON.stringify(c.mark)} plain ${c.plainMark}`);
  if (c.selectedIds.join() !== 'orders,reports') fail(`check ids ${c.selectedIds}`);
  const p = r.pages;
  if (p.home !== 'home' || p.about !== 'article' || p.history !== 'article' || p.blog !== 'link' || p.hiddenWord !== 'скрыта' || p.hiddenInk === p.pageInk || p.hiddenDisabled) fail(`pages ${JSON.stringify(p)}`);
  if (r.keys.afterCollapseAll !== 3 || r.keys.afterStar !== 5 || r.keys.afterExpandAll !== 5) fail(`keys ${JSON.stringify(r.keys)}`);
  const o = r.reorder;
  if (o.before.shown !== 'before' || o.after.shown !== 'after' || o.inside.shown !== 'inside' || o.fileInside.shown === 'inside' || o.intoItself.accepted) fail(`reorder ${JSON.stringify(o)}`);
  if (o.moves.slice(0, 3).join() !== 'f>a|a1,f>a|a2,f>b|null') fail(`moves ${o.moves}`);
  if (r.errors.length) fail(`console ${r.errors.slice(0, 3).join(' | ')}`);
}

console.log(JSON.stringify(report));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('TREE_C102_OK');
