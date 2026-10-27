#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-menu (owner, 2026-10-25), measured on the built bytes, with the class
// menu's runtime and the badges runtime loaded beside it as the loader loads
// them, on a page served at a real path so the location can be followed:
// - items from `items` (JSON and the property) and from a nested list in the
//   markup; a <nav> named by label, links, branch buttons with aria-expanded
//   and aria-controls naming their list, no role=menu;
// - the current page marked aria-current="page" from `current`, from the
//   location (and after history navigation), and the column opened to it;
// - a click toggles once (the class runtime leaves the markup alone), one
//   sf-menu-toggle per change (sf-menu:toggle is its dated alias); Enter and Space on a branch toggle it; Tab
//   walks links and buttons;
// - a row: panels placed by SF.Position below the first level and beside the
//   deeper ones, one chain open at a time, closed by a press outside and by
//   focus leaving; Escape closes the innermost panel only, gives the focus
//   back to its button, holds the shared open-surface mark, and stands back
//   when another surface opened after it is on top;
// - sf-menu-navigate is cancellable: prevented, the page does not go;
// - rows are drawn as the class runtime draws the same list (row heights,
//   level indents), compact and documentation-tree as the class draws them;
// - at 390 wide the row becomes the menu button, nothing scrolls sideways,
//   the button opens the same links as a column and Escape closes it; at
//   1000 it is a row again.
import {resolve, join} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/badges/css/badges.css',
  'component/component/menu/css/menu.css', 'smart/smart/menu/css/menu.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'component/component/menu/js/menu.js', 'component/component/badges/js/badges.js', 'smart/smart/menu/js/menu.js'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const TREE = [
  {id: 'about', label: 'О компании', href: '/about/', icon: 'info'},
  {id: 'catalog', label: 'Каталог', children: [
    {id: 'solutions', label: 'Решения', href: '/catalog/solutions/', badge: '3'},
    {id: 'products', label: 'Продукты', href: '/catalog/products/', open: true, children: [
      {id: 'framework', label: 'SIMAI Framework', href: '/catalog/products/framework/'},
      {id: 'docara', label: 'Docara', href: '/catalog/products/docara/'},
    ]},
    {id: 'archive', label: 'Архив', disabled: true, children: [{id: 'y2025', label: '2025', href: '/archive/2025/'}]},
  ]},
  {id: 'news', label: 'Новости', href: '#news', badge: '120'},
  {id: 'contacts', label: 'Контакты', href: '#contacts'},
];
const ROW = [
  {id: 'about', label: 'О компании', href: '#about'},
  {id: 'catalog', label: 'Каталог', children: [
    {id: 'solutions', label: 'Решения', href: '#solutions'},
    {id: 'products', label: 'Продукты', children: [
      {id: 'framework', label: 'SIMAI Framework', href: '#framework'},
      {id: 'docara', label: 'Docara', href: '#docara'},
    ]},
  ]},
  {id: 'services', label: 'Услуги', href: '#services', children: [{id: 'support', label: 'Поддержка', href: '#support'}]},
  {id: 'contacts', label: 'Контакты', href: '#contacts'},
];
// The same column as the class runtime draws it from markup: the reference
// the element's rows are measured against.
const classList = `<ul class="sf-menu" id="class-col">
  <li class="sf-menu-item" icon="info"><a class="sf-menu-element" href="/about/"><span class="sf-menu-element-wrap"><i class="sf-icon sf-menu-element-icon" aria-hidden="true">info</i><span class="sf-menu-element-text">О компании</span></span></a></li>
  <li class="sf-menu-item open">Каталог<ul class="sf-menu">
    <li class="sf-menu-item"><a class="sf-menu-element" href="/catalog/solutions/"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Решения</span><span class="sf-badge" data-count="3"></span></span></a></li>
    <li class="sf-menu-item open"><div class="sf-menu-element"><a class="sf-menu-element-wrap" href="/catalog/products/"><span class="sf-menu-element-text">Продукты</span></a><button type="button" class="sf-icon-button" aria-label="Продукты"><span class="sf-icon" aria-hidden="true">keyboard_arrow_down</span></button></div><ul class="sf-menu">
      <li class="sf-menu-item"><a class="sf-menu-element" href="/catalog/products/framework/">SIMAI Framework</a></li>
      <li class="sf-menu-item"><a class="sf-menu-element" href="/catalog/products/docara/">Docara</a></li>
    </ul></li>
    <li class="sf-menu-item" disabled>Архив<ul class="sf-menu"><li class="sf-menu-item"><a class="sf-menu-element" href="/archive/2025/">2025</a></li></ul></li>
  </ul></li>
  <li class="sf-menu-item"><a class="sf-menu-element" href="#news"><span class="sf-menu-element-wrap"><span class="sf-menu-element-text">Новости</span><span class="sf-badge" data-count="120"></span></span></a></li>
  <li class="sf-menu-item"><a class="sf-menu-element" href="#contacts">Контакты</a></li>
</ul>`;

const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>sf-menu</title></head>
<body style="margin:0;padding:16px;display:grid;gap:24px">
  <button id="before" type="button">До</button>
  <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">
    <div style="inline-size:280px"><sf-menu id="col" label="Разделы" items='${json(TREE)}' current-from-location></sf-menu></div>
    <div style="inline-size:280px"><nav aria-label="Классовое">${classList}</nav></div>
  </div>
  <header id="header" style="display:flex;gap:16px;align-items:center">
    <strong style="flex:none">Логотип</strong>
    <sf-menu id="row" orientation="horizontal" label="Шапка" items='${json(ROW)}'></sf-menu>
  </header>
  <sf-menu id="markup">
    <nav aria-label="Из разметки">
      <ul>
        <li data-icon="home"><a href="#home">Главная</a></li>
        <li data-id="docs" data-open>Документация
          <ul>
            <li data-badge="2"><a href="#start" aria-current="page">Начало</a></li>
            <li><a href="#api">API</a></li>
          </ul>
        </li>
      </ul>
    </nav>
  </sf-menu>
  <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">
    <div style="inline-size:240px"><sf-menu id="tree" appearance="documentation-tree" label="Документация" current="framework" items='${json(TREE)}'></sf-menu></div>
    <sf-menu id="compact" appearance="compact" label="Компактно" items='${json([{id: 'inbox', label: 'Входящие', href: '#inbox', icon: 'inbox', badge: '3'}, {id: 'tasks', label: 'Задачи', icon: 'task_alt', children: [{id: 't1', label: 'Мои', href: '#t1'}]}])}'></sf-menu>
    <sf-menu id="prop" label="Свойство"></sf-menu>
  </div>
  <button id="after" type="button">После</button>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.route('http://menu.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: PAGE}));
  await page.goto('http://menu.test/catalog/solutions/');
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-menu') && document.querySelectorAll('#col .sf-menu-item').length >= 9
    && document.querySelector('#class-col .sf-menu-element-wrap'), null, {timeout: 8000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__events = [];
    for (const name of ['sf-menu-toggle', 'sf-menu-navigate']) {
      document.addEventListener(name, (event) => window.__events.push({type: name, host: event.target.id, id: event.detail.id, open: event.detail.open, source: event.detail.source, href: event.detail.href}));
    }
  });
  const events = () => page.evaluate(() => window.__events.splice(0));
  const startScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('1000: nothing scrolls sideways', startScroll <= 0, {startScroll});

  // Structure and semantics of the column.
  const column = await page.evaluate(() => {
    const host = document.getElementById('col');
    const nav = host.querySelector(':scope > nav');
    const rows = [...host.querySelectorAll('.sf-menu-item')].map((li) => {
      const row = li.querySelector(':scope > .sf-menu-element');
      const toggle = li.querySelector(':scope > .sf-menu-element[data-sf-menu-toggle], :scope > .sf-menu-element > [data-sf-menu-toggle]');
      const list = li.querySelector(':scope > ul.sf-menu');
      const link = li.querySelector(':scope > a.sf-menu-element, :scope > .sf-menu-element > a');
      return {
        id: li.dataset.sfMenuItem, level: [...row.classList].find((name) => name.startsWith('sf-menu-element--level-')),
        tag: row.localName, link: link?.getAttribute('href') ?? null, current: link?.getAttribute('aria-current') ?? null,
        toggle: toggle?.localName ?? null, expanded: toggle?.getAttribute('aria-expanded') ?? null,
        controls: toggle ? document.getElementById(toggle.getAttribute('aria-controls')) === list : null,
        disabled: toggle ? toggle.disabled : null, listShown: list ? list.getBoundingClientRect().height > 0 : null,
        open: li.classList.contains('open'), label: row.querySelector('.sf-menu-element-text')?.textContent.trim(),
        height: row.getBoundingClientRect().height,
      };
    });
    return {
      nav: nav?.localName, name: nav?.getAttribute('aria-label'), roles: host.querySelectorAll('[role="menu"], [role="menuitem"], [role="menubar"]').length,
      owned: nav?.hasAttribute('data-sf-menu-owned'), rows,
      count: host.querySelector('[data-sf-menu-item="news"] .sf-badge')?.textContent.trim(),
      countName: host.querySelector('[data-sf-menu-item="news"] > a')?.textContent.replace(/\s+/gu, ' ').trim(),
    };
  });
  evidence.column = column;
  check('column: a named nav, no application menu roles', column.nav === 'nav' && column.name === 'Разделы' && column.roles === 0 && column.owned, column);
  const byId = Object.fromEntries(column.rows.map((row) => [row.id, row]));
  check('column: levels as the class draws them', byId.about.level === 'sf-menu-element--level-1' && byId.solutions.level === 'sf-menu-element--level-2'
    && byId.framework.level === 'sf-menu-element--level-3', byId);
  check('column: a branch is a button naming its list', byId.catalog.toggle === 'button' && byId.catalog.controls === true && byId.catalog.tag === 'button', byId.catalog);
  check('column: a branch that is a page has its link and its button side by side', byId.products.tag === 'div' && byId.products.link === '/catalog/products/'
    && byId.products.toggle === 'button' && byId.products.controls === true, byId.products);
  check('column: the current page from the location', byId.solutions.current === 'page'
    && column.rows.filter((row) => row.current).length === 1, {current: column.rows.filter((row) => row.current)});
  check('column: the way to the current page is open', byId.catalog.expanded === 'true' && byId.catalog.listShown && byId.catalog.open, byId.catalog);
  check('column: a disabled branch does not open', byId.archive.disabled === true && byId.archive.expanded === 'false' && !byId.archive.listShown, byId.archive);
  check('column: the counter is the class counter, capped', column.count === '99+' && /99/u.test(column.countName || ''), {count: column.count, name: column.countName});

  // Rows are the class runtime's rows: the same heights, the same indents.
  const geometry = await page.evaluate(() => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {height: Math.round(rect.height * 100) / 100, paddingStart: style.paddingInlineStart, borderRadius: style.borderTopLeftRadius,
        color: style.color, background: style.backgroundColor};
    };
    const smart = document.getElementById('col');
    const reference = document.getElementById('class-col');
    const pick = (root, href) => root.querySelector(`a[href="${href}"]`)?.closest('.sf-menu-element');
    const pickBranch = (root, words) => [...root.querySelectorAll('.sf-menu-element')].find((row) => row.querySelector('.sf-menu-element-text')?.textContent.trim() === words);
    return {
      leaf: [box(pick(smart, '/about/')), box(pick(reference, '/about/'))],
      nested: [box(pick(smart, '/catalog/solutions/')), box(pick(reference, '/catalog/solutions/'))],
      deep: [box(pick(smart, '/catalog/products/framework/')), box(pick(reference, '/catalog/products/framework/'))],
      branch: [box(pickBranch(smart, 'Каталог')), box(pickBranch(reference, 'Каталог'))],
      linkBranch: [box(pickBranch(smart, 'Продукты')), box(pickBranch(reference, 'Продукты'))],
      gap: [getComputedStyle(smart.querySelector('ul.sf-menu')).rowGap, getComputedStyle(reference).rowGap],
      controlHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-ui-1--control-height')) || null,
    };
  });
  evidence.geometry = geometry;
  for (const key of ['leaf', 'nested', 'deep', 'branch', 'linkBranch']) {
    const [smart, reference] = geometry[key];
    check(`geometry: ${key} row drawn as the class runtime draws it`, JSON.stringify(smart) === JSON.stringify(reference), {smart, reference});
  }
  check('geometry: a row is a size 1 control', Math.abs(geometry.leaf[0].height - 40) < 0.5, {height: geometry.leaf[0].height});
  check('geometry: the class gap between rows', geometry.gap[0] === geometry.gap[1], {gap: geometry.gap});

  // A click toggles once: the class runtime binds nothing to these rows.
  await page.click('#col [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(150);
  let state = await page.evaluate(() => document.querySelector('#col [data-sf-menu-toggle="catalog"]').getAttribute('aria-expanded'));
  let sent = await events();
  check('column: a click closes the group once, one event', state === 'false' && sent.length === 1 && sent[0].type === 'sf-menu-toggle'
    && sent[0].id === 'catalog' && sent[0].open === false && sent[0].source === 'user', {state, sent});
  // Enter and Space on the branch's button.
  await page.focus('#col [data-sf-menu-toggle="catalog"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const afterEnter = await page.evaluate(() => document.querySelector('#col [data-sf-menu-toggle="catalog"]').getAttribute('aria-expanded'));
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const afterSpace = await page.evaluate(() => document.querySelector('#col [data-sf-menu-toggle="catalog"]').getAttribute('aria-expanded'));
  sent = await events();
  check('keyboard: Enter opens, Space closes a group', afterEnter === 'true' && afterSpace === 'false' && sent.length === 2, {afterEnter, afterSpace, sent});
  // Escape does not close a column's group: it is no surface.
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  state = await page.evaluate(() => document.querySelector('#col [data-sf-menu-toggle="catalog"]').getAttribute('aria-expanded'));
  check('keyboard: Escape leaves a column\'s group as it is', state === 'true', {state});
  await events();

  // Tab walks links and branch buttons in order; a disabled branch is passed over.
  await page.focus('#before');
  const order = [];
  for (let step = 0; step < 9; step += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const active = document.activeElement;
      if (!active?.closest('#col')) return `out:${active?.id || active?.localName}`;
      return `${active.localName}:${active.getAttribute('href') || active.dataset.sfMenuToggle || ''}`;
    }));
  }
  evidence.tabOrder = order;
  check('keyboard: Tab walks the links and the buttons', JSON.stringify(order) === JSON.stringify([
    'a:/about/', 'button:catalog', 'a:/catalog/solutions/', 'a:/catalog/products/', 'button:products',
    'a:/catalog/products/framework/', 'a:/catalog/products/docara/', 'a:#news', 'a:#contacts']), {order});

  // The location: history navigation moves the current page.
  await page.evaluate(() => { history.pushState({}, '', '/about/'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForTimeout(150);
  const moved = await page.evaluate(() => [...document.querySelectorAll('#col [aria-current="page"]')].map((link) => link.getAttribute('href')));
  check('current: follows history navigation', JSON.stringify(moved) === '["/about/"]', {moved});
  await page.evaluate(() => history.replaceState({}, '', '/catalog/solutions/'));

  // From the markup and from the property.
  const markup = await page.evaluate(() => {
    const host = document.getElementById('markup');
    return {
      name: host.querySelector(':scope > nav')?.getAttribute('aria-label'), navs: host.querySelectorAll('nav').length,
      rows: [...host.querySelectorAll('.sf-menu-item')].map((li) => ({id: li.dataset.sfMenuItem,
        label: li.querySelector(':scope > .sf-menu-element .sf-menu-element-text')?.textContent.trim(),
        icon: li.querySelector(':scope > .sf-menu-element .sf-menu-element-icon')?.textContent.trim() ?? null,
        current: li.querySelector(':scope > a')?.getAttribute('aria-current') ?? null,
        badge: li.querySelector('.sf-badge')?.getAttribute('data-count') ?? null})),
      open: host.querySelector('[data-sf-menu-toggle="docs"]')?.getAttribute('aria-expanded'),
    };
  });
  evidence.markup = markup;
  check('markup: the written list is the menu', markup.name === 'Из разметки' && markup.navs === 1 && markup.open === 'true'
    && JSON.stringify(markup.rows.map((row) => row.label)) === JSON.stringify(['Главная', 'Документация', 'Начало', 'API'])
    && markup.rows[0].icon === 'home' && markup.rows[2].current === 'page' && markup.rows[2].badge === '2', markup);
  await page.evaluate(() => { document.getElementById('prop').items = [{id: 'p', label: 'Из свойства', href: '#p'}]; });
  await page.waitForTimeout(150);
  const fromProperty = await page.evaluate(() => document.querySelector('#prop .sf-menu-element-text')?.textContent.trim());
  check('property: items set as a property', fromProperty === 'Из свойства', {fromProperty});

  // The presentations.
  const presentations = await page.evaluate(() => {
    const tree = document.querySelector('#tree > nav > ul');
    const compact = document.querySelector('#compact > nav > ul');
    const current = document.querySelector('#tree [aria-current="page"]');
    return {
      tree: tree.className, compact: compact.className, compactLists: compact.querySelectorAll('ul').length,
      compactToggles: compact.querySelectorAll('[data-sf-menu-toggle]').length,
      treeCurrent: current?.getAttribute('href'), treeCurrentBackground: current ? getComputedStyle(current).backgroundColor : null,
      treeOpen: [...document.querySelectorAll('#tree [aria-expanded="true"]')].map((button) => button.dataset.sfMenuToggle),
      compactWords: getComputedStyle(compact.querySelector('.sf-menu-element-text')).position,
    };
  });
  evidence.presentations = presentations;
  check('appearance: documentation tree and compact are the class modifiers', presentations.tree === 'sf-menu sf-menu--documentation-tree'
    && presentations.compact === 'sf-menu sf-menu--compact', presentations);
  check('appearance: the tree marks the current page and opens the way to it', presentations.treeCurrent === '/catalog/products/framework/'
    && presentations.treeCurrentBackground !== 'rgba(0, 0, 0, 0)' && JSON.stringify(presentations.treeOpen) === '["catalog","products"]', presentations);
  check('appearance: a compact rail opens no branch', presentations.compactLists === 0 && presentations.compactToggles === 0 && presentations.compactWords === 'absolute', presentations);

  // The row: panels below, deeper ones beside, one chain open.
  const rowState = () => page.evaluate(() => {
    const host = document.getElementById('row');
    const list = host.querySelector(':scope > nav > ul');
    const panel = (id) => {
      const li = host.querySelector(`[data-sf-menu-item="${id}"]`);
      const ul = li?.querySelector(':scope > ul');
      if (!ul) return null;
      const a = li.getBoundingClientRect();
      const b = ul.getBoundingClientRect();
      return {shown: b.height > 0, position: getComputedStyle(ul).position, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        anchorTop: a.top, anchorBottom: a.bottom, anchorLeft: a.left, anchorRight: a.right, side: ul.dataset.sfSide || null};
    };
    const tops = [...list.children].map((li) => Math.round(li.getBoundingClientRect().top));
    return {horizontal: list.classList.contains('sf-menu--horizontal'), toggle: Boolean(host.querySelector('[data-sf-menu-panel-toggle]')),
      tops, catalog: panel('catalog'), products: panel('products'), services: panel('services'),
      open: [...host.querySelectorAll('[aria-expanded="true"]')].map((button) => button.dataset.sfMenuToggle),
      mark: document.documentElement.dataset.sfPopoverOpen || null,
      focus: document.activeElement?.dataset?.sfMenuToggle || document.activeElement?.getAttribute('href') || document.activeElement?.id || null};
  });
  let row = await rowState();
  check('row: the first level in one row at 1000', row.horizontal && !row.toggle && new Set(row.tops).size === 1, row);
  await events();
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(250);
  await page.click('#row [data-sf-menu-toggle="products"]');
  await page.waitForTimeout(250);
  row = await rowState();
  evidence.rowOpen = row;
  check('row: a first-level panel opens below its item, placed by SF.Position', row.catalog.shown && row.catalog.position === 'fixed'
    && row.catalog.top >= row.catalog.anchorBottom - 1 && Math.abs(row.catalog.left - row.catalog.anchorLeft) <= 1 && row.catalog.side === 'block-end', row.catalog);
  check('row: a deeper panel opens beside its item', row.products.shown && row.products.position === 'fixed'
    && (row.products.left >= row.products.anchorRight - 1 || row.products.right <= row.products.anchorLeft + 1) && row.products.side !== null, row.products);
  check('row: an open panel holds the open-surface mark', Number(row.mark) >= 1, {mark: row.mark});
  sent = await events();
  check('row: one event per change', sent.length === 2 && sent.every((one) => one.open === true), {sent});
  // Opening a sibling at the first level closes the whole other chain.
  await page.click('#row [data-sf-menu-toggle="services"]');
  await page.waitForTimeout(250);
  row = await rowState();
  sent = await events();
  check('row: one chain open, the closed ones reported innermost first', JSON.stringify(row.open) === '["services"]'
    && JSON.stringify(sent.map((one) => `${one.id}:${one.open}`)) === '["services:true","products:false","catalog:false"]', {open: row.open, sent});

  // Escape: the innermost only, the focus back on its button.
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.click('#row [data-sf-menu-toggle="products"]');
  await page.waitForTimeout(200);
  await page.focus('#row a[href="#framework"]');
  // A drawer behind, listening in capture as sf-drawer does: it stands back
  // while the mark is up or the press was taken.
  await page.evaluate(() => {
    window.__drawerClosed = 0;
    window.__drawerSaw = [];
    window.__drawerListener = (event) => {
      if (event.key !== 'Escape') return;
      window.__drawerSaw.push({prevented: event.defaultPrevented, mark: document.documentElement.dataset.sfPopoverOpen || null});
      if (!event.defaultPrevented && !document.documentElement.dataset.sfPopoverOpen) window.__drawerClosed += 1;
    };
    document.addEventListener('keydown', window.__drawerListener, true);
  });
  await events();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  row = await rowState();
  check('Escape: the innermost panel closes, the outer stays, focus on its button', JSON.stringify(row.open) === '["catalog"]' && row.focus === 'products', row);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  row = await rowState();
  check('Escape: the next press closes the outer panel, focus on its button', row.open.length === 0 && row.focus === 'catalog' && !row.mark, row);
  sent = await events();
  check('Escape: one event per panel, source user', JSON.stringify(sent.map((one) => `${one.id}:${one.open}:${one.source}`)) === '["products:false:user","catalog:false:user"]', {sent});
  const drawerClosed = await page.evaluate(() => window.__drawerClosed);
  evidence.drawerSaw = await page.evaluate(() => window.__drawerSaw);
  check('Escape: a drawer behind stood back while the panels were open', drawerClosed === 0 && evidence.drawerSaw.length === 2 && evidence.drawerSaw.every((one) => one.mark), {drawerClosed, saw: evidence.drawerSaw});
  await page.evaluate(() => document.removeEventListener('keydown', window.__drawerListener, true));
  // Another surface opened after the menu's panel is on top: Escape is its.
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const layers = globalThis[Symbol.for('sf.openSurfaceLayers')];
    window.__surface = {isConnected: true};
    layers.push(window.__surface);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  row = await rowState();
  check('Escape: a surface opened over the menu takes the press, the panel stays', JSON.stringify(row.open) === '["catalog"]', row);
  await page.evaluate(() => {
    const layers = globalThis[Symbol.for('sf.openSurfaceLayers')];
    layers.splice(layers.indexOf(window.__surface), 1);
  });
  // A press outside closes the panels.
  await page.mouse.click(900, 880);
  await page.waitForTimeout(200);
  row = await rowState();
  check('row: a press outside closes the panels', row.open.length === 0 && !row.mark, row);
  // Focus leaving the menu closes them too.
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.focus('#row a[href="#solutions"]');
  await page.focus('#after');
  await page.waitForTimeout(200);
  row = await rowState();
  check('row: focus leaving the menu closes the panels', row.open.length === 0, row);
  await events();

  // Navigation: cancellable, and the menu closes after it.
  await page.evaluate(() => {
    document.getElementById('row').addEventListener('sf-menu-navigate', (event) => { if (event.detail.id === 'solutions') event.preventDefault(); }, {once: true});
  });
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.click('#row a[href="#solutions"]');
  await page.waitForTimeout(200);
  const prevented = await page.evaluate(() => location.hash);
  row = await rowState();
  sent = await events();
  check('navigate: prevented, the page does not go; the panel closes', prevented === '' && row.open.length === 0
    && sent.some((one) => one.type === 'sf-menu-navigate' && one.id === 'solutions' && one.href === '#solutions'), {prevented, open: row.open, sent});
  await page.click('#row a[href="#contacts"]');
  await page.waitForTimeout(200);
  const went = await page.evaluate(() => location.hash);
  sent = await events();
  check('navigate: not prevented, the page goes', went === '#contacts' && sent.length === 1 && sent[0].id === 'contacts', {went, sent});
  await page.click('#row a[href="#contacts"]', {modifiers: ['Shift']}).catch(() => {});
  await page.waitForTimeout(200);
  sent = await events();
  check('navigate: a press with a modifier is the browser\'s, no event', !sent.some((one) => one.type === 'sf-menu-navigate'), {sent});
  for (const extra of browser.contexts()[0].pages().slice(1)) await extra.close();

  // 390: the row becomes the button; nothing scrolls sideways.
  await page.setViewportSize({width: 390, height: 900});
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const host = document.getElementById('row');
    const toggle = host.querySelector('[data-sf-menu-panel-toggle]');
    const list = host.querySelector(':scope > nav > ul');
    return {scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      toggle: Boolean(toggle), expanded: toggle?.getAttribute('aria-expanded'), controls: toggle ? document.getElementById(toggle.getAttribute('aria-controls')) === list : null,
      listHidden: list.hidden, horizontal: list.classList.contains('sf-menu--horizontal'),
      height: toggle ? Math.round(toggle.getBoundingClientRect().height * 100) / 100 : null,
      words: toggle?.querySelector('.sf-menu-element-text')?.textContent.trim()};
  });
  evidence.narrow = narrow;
  check('390: the row is the menu button, nothing scrolls sideways', narrow.scroll <= 0 && narrow.toggle && narrow.expanded === 'false'
    && narrow.controls && narrow.listHidden && !narrow.horizontal && narrow.words === 'Меню' && Math.abs(narrow.height - 40) < 0.5, narrow);
  await page.click('#row [data-sf-menu-panel-toggle]');
  await page.waitForTimeout(250);
  const opened = await page.evaluate(() => {
    const host = document.getElementById('row');
    const list = host.querySelector(':scope > nav > ul');
    return {expanded: host.querySelector('[data-sf-menu-panel-toggle]').getAttribute('aria-expanded'), shown: list.getBoundingClientRect().height > 0,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      catalog: host.querySelector('[data-sf-menu-toggle="catalog"]')?.getAttribute('aria-expanded'),
      fixed: [...host.querySelectorAll('ul')].some((ul) => getComputedStyle(ul).position === 'fixed')};
  });
  sent = await events();
  check('390: the button opens the same links as a column', opened.expanded === 'true' && opened.shown && opened.scroll <= 0 && opened.catalog === 'false'
    && !opened.fixed && sent.length === 1 && sent[0].id === null && sent[0].open === true, {opened, sent});
  // A group of the column opens in place, and Escape closes the panel.
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.focus('#row a[href="#solutions"]');
  await page.waitForTimeout(100);
  const markInside = await page.evaluate(() => document.documentElement.dataset.sfPopoverOpen || null);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const closedPanel = await page.evaluate(() => ({
    expanded: document.querySelector('#row [data-sf-menu-panel-toggle]').getAttribute('aria-expanded'),
    focus: document.activeElement?.hasAttribute('data-sf-menu-panel-toggle'),
    mark: document.documentElement.dataset.sfPopoverOpen || null,
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('390: Escape closes the panel and gives the focus to the button', Number(markInside) >= 1 && closedPanel.expanded === 'false' && closedPanel.focus && !closedPanel.mark, {markInside, closedPanel});
  const columnNarrow = await page.evaluate(() => document.querySelector('#col').querySelector('nav').getBoundingClientRect().right <= document.documentElement.clientWidth);
  check('390: the column and everything else fits', columnNarrow && closedPanel.scroll <= 0, {columnNarrow, scroll: closedPanel.scroll});
  await events();

  // 1000 again: a row.
  await page.setViewportSize({width: 1000, height: 900});
  await page.waitForTimeout(400);
  row = await rowState();
  check('1000 again: a row', row.horizontal && !row.toggle && new Set(row.tops).size === 1, row);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('1000 again: nothing scrolls sideways', wide <= 0, {wide});

  // RTL: a deeper panel of a row opens toward the inline end, to the left.
  await page.evaluate(() => { document.getElementById('header').dir = 'rtl'; });
  await page.click('#row [data-sf-menu-toggle="catalog"]');
  await page.waitForTimeout(200);
  await page.click('#row [data-sf-menu-toggle="products"]');
  await page.waitForTimeout(250);
  row = await rowState();
  check('rtl: a deeper panel opens toward the inline end', row.products.shown && row.products.right <= row.products.anchorLeft + 1, row.products);
  await page.evaluate(() => document.getElementById('row').closeAll());
  await page.evaluate(() => { document.getElementById('header').dir = ''; });

  // Methods.
  await events();
  const methods = await page.evaluate(() => {
    const host = document.getElementById('col');
    // products is open from its data; catalog is open over it.
    const results = [host.close('catalog'), host.close('catalog'), host.open('products'), host.isOpen('products'), host.toggle('missing')];
    return {results, openIds: host.openIds, currentId: host.currentId};
  });
  sent = await events();
  // The actions answer outcomes (standard 1.3.8 §4.4).
  check('methods: open, close, toggle, isOpen, openIds, source method', JSON.stringify(methods.results.map((one) => (typeof one === 'boolean' ? one : one.outcome === 'applied'))) === '[true,false,false,true,false]'
    && JSON.stringify(methods.openIds) === '["products"]' && methods.currentId === 'solutions'
    && sent.every((one) => one.source === 'method') && sent.length === 1, {methods, sent});
} catch (error) {
  failures.push({name: 'probe stopped', said: error.message.split('\n')[0]});
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('MENU_SMART_OK');
