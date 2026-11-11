import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  ITEM_FIELD_ALIASES,
  LEVEL_LIMIT,
  MENU_APPEARANCES,
  MENU_COLLAPSE,
  MENU_ORIENTATIONS,
  badgeCount,
  currentItemId,
  itemsFromList,
  normaliseItems,
  normalisePath,
  onItemAlias,
  openBranches,
  pathTo,
} from '../src/smart/menu/items.mjs';

// sf-menu (owner, 2026-10-25): site navigation built from data, drawn as the
// class menu (src/component/menu) so its styles apply and are not forked.
// What a reader of the source cannot tell from one file is held here; the page
// itself is measured by tests/browser/menu-smart.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/menu/index.js');
const template = read('src/smart/menu/js/templates/default.js');
const sheet = read('src/smart/menu/scss/_smart__menu.scss');
const classRuntime = read('src/component/menu/js/_menu.js');
const manifest = JSON.parse(read('src/smart/menu/smart.manifest.json'));

const TREE = [
  {id: 'about', label: 'О компании', href: '/about/'},
  {id: 'catalog', label: 'Каталог', children: [
    {id: 'solutions', label: 'Решения', href: '/catalog/solutions/'},
    {label: 'Продукты', href: '/catalog/products/', children: [{label: 'Framework', href: '/catalog/products/framework/'}]},
  ]},
  {id: 'contacts', label: 'Контакты', href: '/contacts/', current: true},
];

test('smart menu: items from an array or JSON, nested, with ids and nothing parsed as markup', () => {
  const items = normaliseItems([...TREE, {id: 'about', label: 'Повтор'}, null, 'Строка', {label: '<b>не разметка</b>', badge: 120}]);
  assert.deepEqual(items.map((item) => item.id), ['about', 'catalog', 'contacts', 'item-6', 'item-7']);
  assert.deepEqual(items[1].children.map((item) => item.id), ['solutions', 'catalog-2']);
  assert.equal(items[1].children[1].children[0].id, 'catalog-2-1');
  assert.equal(items[3].label, 'Строка');
  assert.equal(items[4].label, '<b>не разметка</b>', 'a label stays text');
  assert.equal(items[4].badge, '120');
  assert.deepEqual(normaliseItems(JSON.stringify(TREE)), normaliseItems(TREE));
  for (const empty of [null, undefined, '', '{not json', '{}', 42]) assert.deepEqual(normaliseItems(empty), [], String(empty));
  // A repeated id anywhere in the tree is left out with its children.
  assert.deepEqual(normaliseItems([{id: 'a', children: [{id: 'b'}]}, {id: 'c', children: [{id: 'b', children: [{id: 'd'}]}]}])[1].children, []);
  // Labels are bound as text: no unsafeHTML, no innerHTML anywhere.
  assert.doesNotMatch(source + template, /unsafeHTML|innerHTML/u);
  assert.equal(badgeCount('3'), '3');
  assert.equal(badgeCount('new'), null);
});

test('smart menu: the current page from current, the location, or the item flag', () => {
  const items = normaliseItems(TREE);
  assert.equal(currentItemId(items), 'contacts', 'the first item marked current');
  assert.equal(currentItemId(items, {current: 'solutions'}), 'solutions');
  assert.equal(currentItemId(items, {current: 'missing'}), 'contacts', 'an id no item has is passed over');
  const here = {pathname: '/catalog/products/framework/index.html', base: 'https://example.test/catalog/', fromLocation: true};
  assert.equal(currentItemId(items, here), 'catalog-2-1');
  assert.equal(currentItemId(items, {...here, pathname: '/catalog/solutions'}), 'solutions', 'a trailing slash does not matter');
  assert.equal(currentItemId(items, {...here, fromLocation: false}), 'contacts');
  assert.equal(currentItemId(normaliseItems([{id: 'x', href: 'https://other.test/about/'}]), {...here, pathname: '/about/'}), null,
    'a link to another site is not this page');
  assert.equal(normalisePath('/a/b/?q=1#h'), '/a/b');
  assert.equal(normalisePath('/'), '/');
  assert.deepEqual(pathTo(items, 'catalog-2-1'), ['catalog', 'catalog-2']);
  assert.equal(pathTo(items, 'missing'), null);
  // The link of the current page says so, and nothing else does.
  // (A row, a split row's link, a group-less span and -- C30 -- a region's link.)
  assert.equal((template.match(/aria-current=\$\{current \? 'page' : nothing\}/gu) || []).length, 4);
});

test('smart menu: a column opens the way to the current page; a row opens only when asked', () => {
  const items = normaliseItems([...TREE, {id: 'help', label: 'Помощь', open: true, children: [{id: 'faq', label: 'Вопросы'}]}]);
  assert.deepEqual([...openBranches(items, new Map(), 'catalog-2-1', true)], ['catalog', 'catalog-2', 'help']);
  assert.deepEqual([...openBranches(items, new Map([['catalog', false]]), 'catalog-2-1', true)], ['catalog-2', 'help']);
  assert.deepEqual([...openBranches(items, new Map(), 'catalog-2-1', false)], []);
  assert.deepEqual([...openBranches(items, new Map([['catalog', true]]), null, false)], ['catalog']);
  // A row's open panels are one chain: opening a branch closes every panel
  // not above it.
  assert.match(source, /if \(this\.flyouts\) \{\n      const above = new Set\(pathTo\(this\.treeItems, item\.id\) \|\| \[\]\);\n      for \(const other of before\) if \(!above\.has\(other\)\) after\.delete\(other\);/u);
});

test('smart menu: a list written in the markup is read as items', () => {
  // A small stand-in for the DOM: elements with children, childNodes and
  // attributes, and text nodes.
  const textNode = (value) => ({nodeType: 3, textContent: value});
  const el = (localName, attrs = {}, kids = []) => {
    const node = {
      nodeType: 1, localName, childNodes: kids,
      get children() { return kids.filter((kid) => kid.nodeType === 1); },
      get textContent() { return kids.map((kid) => kid.textContent).join(''); },
      getAttribute: (name) => (name in attrs ? attrs[name] : null),
      hasAttribute: (name) => name in attrs,
      querySelector: () => null,
      classList: {contains: (name) => String(attrs.class || '').split(/\s+/u).includes(name)},
    };
    return node;
  };
  const list = el('ul', {}, [
    el('li', {'data-icon': 'info'}, [el('a', {href: '/about/', 'aria-current': 'page'}, [el('i', {class: 'sf-icon'}, [textNode('info')]), textNode(' О компании ')])]),
    el('li', {'data-id': 'catalog', 'data-open': ''}, [textNode('Каталог '), el('ul', {}, [
      el('li', {'data-badge': '3'}, [el('a', {href: '/catalog/'}, [textNode('Все')])]),
      el('li', {'data-disabled': ''}, [el('a', {}, [textNode('Архив')])]),
    ])]),
  ]);
  const items = normaliseItems(itemsFromList(list));
  assert.deepEqual(items.map(({id, label, href, icon, current, open}) => ({id, label, href, icon, current, open})), [
    {id: 'item-1', label: 'О компании', href: '/about/', icon: 'info', current: true, open: false},
    {id: 'catalog', label: 'Каталог', href: '', icon: '', current: false, open: true},
  ]);
  assert.deepEqual(items[1].children.map(({label, badge, disabled}) => ({label, badge, disabled})), [
    {label: 'Все', badge: '3', disabled: false},
    {label: 'Архив', badge: '', disabled: true},
  ]);
  // Read once, before the first render clears the light DOM, and taken out.
  assert.match(source, /captureSlotTemplates\(\) \{\n    const first = !this\._slotTemplatesCaptured;\n    super\.captureSlotTemplates\(\);\n    if \(!first\) return;/u);
});

test('smart menu: the class markup, the class runtime kept off it', () => {
  // The class menu's own classes and structure, so its sheet draws it.
  for (const part of ['sf-menu-item', 'sf-menu-element', 'sf-menu-element-wrap', 'sf-menu-element-text', 'sf-menu-element-icon',
    'sf-menu-element--has-submenu', 'sf-menu-item--has-submenu', 'sf-menu--horizontal', 'sf-icon-button']) {
    assert.ok(template.includes(part), part);
  }
  assert.match(template, /const levelClass = \(level\) => `sf-menu-element--level-\$\{Math\.min\(Math\.max\(level, 1\), LEVEL_LIMIT\)\}`;/u);
  assert.equal(LEVEL_LIMIT, 4);
  // The glyphs the class runtime writes.
  // A row's deeper branch opens to the side and points there (C30).
  assert.match(template, /if \(context\.flyouts && level === 1\) return open \? 'keyboard_arrow_up' : 'keyboard_arrow_down';\n  if \(context\.flyouts\) return 'chevron_right';\n  return open \? 'keyboard_arrow_down' : 'chevron_right';/u);
  // A branch is a native button with aria-expanded and aria-controls; no
  // application menu roles.
  assert.match(template, /aria-expanded=\$\{open \? 'true' : 'false'\} aria-controls=\$\{own\(submenuId\)\}/u);
  assert.doesNotMatch(template + source, /role="?menu|menuitem/u);
  // The markup is the element's: the class runtime leaves what is marked.
  assert.match(template, /data-sf-menu-owned>/u);
  assert.match(classRuntime, /const OWNED_SELECTOR = '\[data-sf-menu-owned\]';/u);
  assert.match(classRuntime, /function initMenuItem\(root\) \{\n  if \(!root \|\| isOwned\(root\)\) return;/u);
  assert.match(classRuntime, /if \(isOwned\(target\)\) return;/u);
  assert.match(classRuntime, /if \(!\(target instanceof Element\) \|\| isOwned\(target\)\) return;/u);
  assert.match(classRuntime, /if \(!isOwned\(root\) && !root\.contains\(target\)\) setMenuItemOpen\(root, false\);/u);
  // The own sheet draws nothing the class draws: no row geometry, no colours
  // but the shared focus ring. The one rule past that is the host's place on
  // the page (sticky, sf-menu 1.3.0); the groups are the class sheet's
  // (component.menu 1.2.0, _css__menu_group.scss). The search head (C30
  // amended, R071 a) is the element's own part, which the class has not:
  // its rules select only the head, the field and the empty text.
  const [ownParts, sticky] = sheet.split('// sticky (sf-menu 1.3.0)');
  const [beforeSearch, searchPart] = ownParts.split('  // search (C30 amended, R071 a; C06)');
  const [searchRules, afterSearch] = searchPart.split('  @media (forced-colors: active)');
  const parts = beforeSearch + afterSearch;
  assert.doesNotMatch(parts, /padding|block-size|height|background|border-color|font-size/u);
  for (const selector of searchRules.match(/^  [.a-z][^{\n]*\{/gmu)) {
    assert.match(selector, /sf-smart-menu-search|sf-smart-menu--search/u, selector);
  }
  assert.match(sticky, /sf-menu\[sticky\]:not\(\[sticky='false'\]\) \{\n    position: sticky;/u);
  assert.doesNotMatch(sticky, /padding|background|border-color|font-size/u);
  for (const part of ['sf-menu-item--group', 'sf-menu-group-heading', 'sf-menu-group-label', 'sf-menu-element-status']) {
    assert.ok(template.includes(part), part);
  }
});

test('smart menu: a row\'s panels are placed by SF.Position and Escape closes the innermost only', () => {
  assert.match(source, /const positioning = \(\) => globalThis\.SF\?\.Position \|\| BundledPosition;/u);
  // C30: the first level the gap under the header's edge (R060), a side
  // panel beside the panel it is in, on the chain's side (no zig-zag), a
  // region under the header, as wide.
  assert.match(source, /anchor = positioning\(\)\.anchor\(row, submenu, \{side: 'block-end', align: 'start', offset: 'calc\(var\(--sf-site-header--edge, calc\(var\(--sf-px\) \* 0\)\) \+ var\(--sf-space-1\\\\\/4\)\)', fitHeight: true,\n\s*onPosition: \(\) => this\.syncScroll\(submenu, true\)\}\);/u);
  assert.match(source, /side, align: 'start', fitHeight: true,\n\s*offset: Math\.max\(outer\.right - box\.right, box\.left - outer\.left\) \+ gap,/u);
  assert.match(source, /if \(inherited === 'inline-start' \|\| inherited === 'inline-end'\) \{\n\s*side = inherited;/u);
  assert.match(source, /anchor = positioning\(\)\.anchor\(header, submenu, \{side: 'block-end', align: 'start', offset: 0, matchWidth: true, fitHeight: true, onPosition: \(\) => this\.syncScroll\(submenu, true\)\}\);/u);
  // The shared open-surface protocol: the mark is held while a panel is open
  // and Escape is taken only as the innermost layer.
  assert.match(source, /import \{holdOpenSurfaceMark, isTopOpenSurface\} from '\.\.\/\.\.\/core\/js\/open-surface-mark';/u);
  assert.match(source, /if \(event\.key !== 'Escape' \|\| event\.defaultPrevented \|\| !isTopOpenSurface\(this\)\) return;/u);
  // An outside press reaches it through the layer stack's one listener.
  assert.match(source, /holdOpenSurfaceMark\(this, hold, \{onOutsidePress: this\.onOutsidePress\}\);/u);
  assert.match(source, /onDisconnected\(\) \{[\s\S]*?this\.holdSurface\(false\);/u);
});

test('smart menu: navigate is cancellable and modified presses stay the browser\'s', () => {
  // sf-menu-navigate (vocabulary §5 navigate); sf-menu:navigate is its dated
  // alias with one shared cancel (aliases.json).
  assert.match(source, /const allowed = this\.sfEmit\('navigate', \{id: item\.id, href: item\.href, item\}\);/u);
  assert.match(source, /if \(!allowed\) event\.preventDefault\(\);/u);
  assert.match(source, /event\.button > 0 \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/u);
  assert.match(source, /this\.sfEmit\('toggle', \{id: one\.id, open: after\.has\(one\.id\), source, item: one\}\);/u);
});

test('smart menu: the manifest is the element', () => {
  assert.equal(manifest.custom_element, 'sf-menu');
  assert.deepEqual(manifest.inputs.properties.orientation.enum, [...MENU_ORIENTATIONS]);
  assert.deepEqual(manifest.inputs.properties.appearance.enum, [...MENU_APPEARANCES]);
  assert.deepEqual(manifest.inputs.properties.collapse.enum, [...MENU_COLLAPSE]);
  const props = source.slice(source.indexOf('static get props()'), source.indexOf('constructor()'));
  for (const name of Object.keys(manifest.inputs.properties)) {
    // root-class and root-style are the base's (§4.1), aria-label the host's:
    // not the element's props.
    if (['root-class', 'root-style', 'aria-label'].includes(name)) continue;
    const key = name.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    assert.ok(props.includes(`${key === 'template' ? 'templateName' : key}:`), name);
  }
  for (const method of Object.keys(manifest.methods)) assert.match(source, new RegExp(`\\n  ${method}\\((id)?\\) \\{`, 'u'), method);
  // The events are component.json's verbs, sent through sfEmit (standard 1.3.8
  // §8); the old colon names are aliases.json's.
  const sent = new Set([...source.matchAll(/this\.sfEmit\('([^']+)'/gu)].map((match) => match[1]));
  assert.deepEqual(Object.keys(JSON.parse(read('src/smart/menu/component.json')).events).sort(), [...sent].sort());
  assert.doesNotMatch(source, /new CustomEvent\(/u);
  assert.deepEqual(Object.keys(manifest.item_contract.properties), ['id', 'label', 'href', 'icon', 'badge', 'count', 'status', 'current', 'disabled', 'open', 'children', 'region', 'target', 'external', 'group', 'collapsible', 'items']);
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage/u);
  // The Pro admin menu is another component: nothing of it is used here.
  assert.doesNotMatch(source + template, /admin-menu|sf-admin/u);
});

// A field the element reads from an item is public, so the manifest declares
// it (C30 amended): every field normaliseItem reads, and every field of the
// items setting's port, is in item_contract. key, text and title are the
// first release's spellings of id and label, read but not offered, recorded
// in the change journal until 2027-01-01 (DEV answer d).
test('smart menu: item_contract declares every item field the renderer reads', () => {
  const items = read('src/smart/menu/items.mjs');
  const body = items.slice(items.indexOf('export function normaliseItem('), items.indexOf('export function normaliseItems('));
  assert.ok(body.length > 200, 'normaliseItem is found');
  assert.deepEqual(ITEM_FIELD_ALIASES, {key: 'id', text: 'label', title: 'label'});
  const tolerated = new Set(Object.keys(ITEM_FIELD_ALIASES));
  for (const name of tolerated) assert.ok(!(name in manifest.item_contract.properties), `${name} stays undeclared`);
  const readFields = new Set([...body.matchAll(/\bitem\.([a-z][a-zA-Z]*)/gu)].map((match) => match[1]).filter((name) => !tolerated.has(name)));
  const declared = new Set(Object.keys(manifest.item_contract.properties));
  assert.deepEqual([...readFields].filter((name) => !declared.has(name)), [], 'every field normaliseItem reads is declared');
  const port = Object.keys(JSON.parse(read('src/smart/menu/component.json')).settings.items.of);
  assert.deepEqual(port.filter((name) => !declared.has(name)), [], 'every field of the port is declared');
  assert.equal(manifest.item_contract.additionalProperties, false);
  // A group item and a linked item both validate against the contract.
  for (const item of [{group: true, label: 'Магазин', collapsible: true, items: [{label: 'Оплата'}]}, {label: 'Docs', href: 'https://example.com', target: '_blank', external: true, count: 3, status: 'warning'}]) {
    assert.deepEqual(Object.keys(item).filter((name) => !declared.has(name)), []);
  }
});

test('smart menu: the item field aliases are recorded, dated and noted when used', () => {
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'sf-menu-item-field-aliases');
  assert.ok(record, 'the journal records the aliases');
  assert.equal(record.stage, 'compat');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), Object.entries(ITEM_FIELD_ALIASES));
  assert.match(source, /onItemAlias\(\(from, to\) => noteDeprecated\(\{component: 'sf-menu', kind: 'property', attribute: 'items', from, to, remove_after: '2027-01-01'\}\)\);/u);
  const noted = [];
  onItemAlias((from, to) => noted.push(`${from}>${to}`));
  try {
    const [first, second, third] = normaliseItems([{key: 'a', text: 'A'}, {id: 'b', title: 'B'}, {id: 'c', label: 'C', text: 'ignored'}]);
    assert.deepEqual([first.id, first.label, second.label, third.label], ['a', 'A', 'B', 'C']);
    assert.deepEqual(noted, ['key>id', 'text>label', 'title>label']);
  } finally {
    onItemAlias(null);
  }
});

test('smart menu: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/menu/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-menu'\] = \{\n  tags: \['sf-menu'\],/u);
  assert.match(rule, /\{ name: 'menu' \},\n    \{ name: 'icons' \},\n    \{ name: 'icon-buttons' \},\n    \{ name: 'badges' \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/menu\/rule\.js';/u);
  // The class dot draws an item's status (sf-menu 1.3.0).
  assert.match(rule, /\{ name: 'badges' \},\n(?: {4}\/\/.*\n)* {4}\{ name: 'dot' \},/u);
  assert.deepEqual(manifest.composition.uses, ['component.badges', 'component.dot', 'component.icon-buttons', 'component.icons', 'component.menu', 'smart.input']);
});

// The public variables (2026-10-25): nine, read by the class sheet sf-menu
// draws with, each with the value it drew before as its fallback.
test('smart menu: the class menu\'s public variables wrap the values it drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'menu');
  assert.equal(entry.selector, '.sf-menu');
  // Ten with the sticky offset sf-menu's own sheet reads (1.3.0).
  assert.equal(entry.variables.length, 10);
  const classSheet = ['_css__menu.scss', '_css__menu_element.scss'].map((name) => read(`src/component/menu/scss/${name}`)).join('\n');
  assert.ok(sheet.includes('inset-block-start: var(--sf-menu-sticky-top, var(--sf-0));'));
  for (const line of [
    'background-color: var(--sf-menu--background-color, var(--sf-menu-background-color, transparent));',
    'gap: var(--sf-menu--gap, var(--sf-menu-gap, var(--sf-space-1\\/3)));',
    '--sf-menu-element--background-color: var(--sf-menu-item-background-color, var(--sf-transparent));',
    '--sf-menu-element--border-color: var(--sf-menu-item-border-color, var(--sf-surface-container));',
    '--sf-menu-element--color: var(--sf-menu-item-color, var(--sf-on-surface));',
    '--sf-menu-element--radius: var(--sf-menu-item-radius, var(--sf-radius--ui));',
    'var(--sf-menu-horizontal-submenu--background-color, var(--sf-menu-submenu-background-color, var(--sf-surface-popup)))',
    'var(--sf-menu-horizontal-submenu--border-color, var(--sf-menu-submenu-border-color, var(--sf-outline-variant)))',
    'var(--sf-menu-horizontal-submenu--radius, var(--sf-menu-submenu-radius, var(--sf-radius--ui)))',
  ]) assert.ok(classSheet.includes(line), line);
  // Hover and an open branch write their own.
  for (const state of [':hover {', ".sf-menu-element[aria-expanded='true'] {"]) {
    assert.doesNotMatch(classSheet.slice(classSheet.indexOf(state)).split('}')[0], /--sf-menu-[a-z]+-[a-z]+(?:-[a-z]+)*[,)]/u, state);
  }
  const docs = read('src/smart/menu/docs.md');
  for (const variable of entry.variables) assert.ok(docs.includes(`| \`${variable.name}\` |`), variable.name);
});

// Header navigation (owner decision by recommendation, 2026-11-01): the look
// of a site header's sections as Docara draws them, so a header needs no
// classes of its own over the menu. tests/browser/menu-navigation.browser.mjs
// measures it on the built bytes.
test('smart menu: appearance navigation is a row or a column of frameless rows', () => {
  assert.deepEqual([...MENU_APPEARANCES], ['default', 'documentation-tree', 'compact', 'navigation']);
  assert.match(read('src/smart/menu/items.mjs'), /export const ROW_APPEARANCES = Object\.freeze\(\['default', 'navigation'\]\);/u);
  assert.match(source, /return this\.orientation === 'horizontal' && ROW_APPEARANCES\.includes\(this\.appearance\);/u);
  // Escape closes a navigation row's panel as it does a default row's.
  const component = JSON.parse(read('src/smart/menu/component.json'));
  assert.deepEqual(component.accessibility.keys.Escape.when, [
    {orientation: 'horizontal', appearance: 'default'},
    {orientation: 'horizontal', appearance: 'navigation'},
    {collapse: 'always'},
    {collapse: 'narrow'},
  ]);
  const sheet = read('src/component/menu/scss/_css__menu.scss');
  const block = sheet.slice(sheet.indexOf('.sf-menu.sf-menu--navigation {'), sheet.indexOf('/* Documentation navigation'));
  const rule = (selector) => {
    const at = block.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    return block.slice(at, block.indexOf('}', at));
  };
  const enabled = ".sf-menu.sf-menu--navigation .sf-menu-element:not(:disabled):not(.disabled):not([aria-disabled='true'])";
  // No frame, no fill at rest; the row keeps the class row's height, padding,
  // type and radius (nothing of them is written here).
  const rest = block.slice(block.indexOf('.sf-menu.sf-menu--navigation .sf-menu-element {'));
  assert.match(rest.slice(0, rest.indexOf('}')), /--sf-menu-element--border-width: calc\(var\(--sf-px\) \* 0\);[\s\S]*--sf-menu-element--background-color: var\(--sf-menu-item-background-color, var\(--sf-transparent\)\);/u);
  // (A pseudo-element's own box -- the row section's line, C30 -- is not the
  // row; the column's geometry -- its inset, its rows' padding, its group
  // headings, C30 amended R083, R070 -- is the column's, below.)
  const columnAt = block.indexOf('/* A column (C30 amended 2026-11-09, R083');
  const columnEnd = block.indexOf('/* A row: an open branch');
  const column = block.slice(columnAt, columnEnd);
  const rows = (block.slice(0, columnAt) + block.slice(columnEnd)).replace(/[^{}]*::(?:before|after)[^{]*\{[^}]*\}/gu, '');
  assert.doesNotMatch(rows, /^\s*(?:padding[a-z-]*|font-[a-z]+|line-height|block-size|height|--sf-menu-element--(?:radius|padding[a-z-]*|font-[a-z]+)):/mu);
  // R083 (C05): the plates space-1/4 in from the column's edge, the words
  // space-1/2 in from the plate; C07: the scrollbar's gap given back.
  assert.match(column, /--sf-menu--row-padding: var\(--sf-space-1\\\/2\);/u);
  assert.match(column, /--sf-menu--inset: var\(--sf-space-1\\\/4\);[\s\S]*padding-inline: var\(--sf-menu--inset\);/u);
  assert.match(column, /\.sf-menu--scrollbar \{\n  padding-inline-end: max\(calc\(var\(--sf-px\) \* 0\), calc\(var\(--sf-menu--inset\) - var\(--sf-scroll-thumb-inset, var\(--sf-a4\)\)\)\);/u);
  // R070: a column's group headings are a row.
  assert.match(column, /\.sf-menu-group-heading \{\n  min-block-size: var\(--sf-ui-1--control-height\);\n  padding-inline: var\(--sf-menu--row-padding\);/u);
  // (The current page's medium label is the current-plate mixin's, above the block.)
  // The states are the alpha scale's role tokens: state 4 and 12; an open
  // branch is not filled (C23) -- never a number of its own.
  assert.match(rule(`${enabled}:hover`), /var\(--sf-surface-state-hover\)/u);
  assert.match(rule(`${enabled}:active`), /var\(--sf-surface-state-active\)/u);
  assert.doesNotMatch(block, /:is\(\.open, \[aria-expanded='true'\]\)/u);
  // A column's open branch is not filled; a row's open branch -- first level
  // and panel row -- has the neutral select plate (C30, R060), and only there.
  assert.equal((block.match(/--sf-surface-state-select/gu) || []).length, 1);
  assert.match(rule(".sf-menu.sf-menu--navigation.sf-menu--horizontal .sf-menu-element.open:not(:disabled):not(.disabled):not([aria-disabled='true'])"), /--sf-menu-element--background-color: var\(--sf-surface-state-select\);/u);
  // The current page (C23, owner 2026-11-09): the primary plate of the fill
  // family (primary-container-active, 20 light / 32 dark), its ink and a
  // medium label, written once in the current-plate mixin; the path's line,
  // never a bar (C30 amended: R065, R072, R084; DEV answer b).
  const current = `${enabled}:is([aria-current='page'], [aria-current='true'], :has(> [aria-current='page'], > [aria-current='true']))`;
  assert.match(rule(current), /@include current-plate;/u);
  const plate = sheet.slice(sheet.indexOf('@mixin current-plate {'), sheet.indexOf('}', sheet.indexOf('@mixin current-plate {')));
  assert.match(plate, /--sf-menu-element--background-color: var\(--sf-primary-container-active\);/u);
  assert.match(plate, /--sf-menu-element--color: var\(--sf-on-primary-container\);/u);
  assert.match(plate, /--sf-menu-element--font-weight: var\(--sf-font-weight-medium\);/u);
  assert.doesNotMatch(plate, /::before|--sf-primary\)/u);
  // The 3px bar (C23) is retired everywhere, the rail included (DEV answer b).
  assert.doesNotMatch(sheet, /holds-current-bar|var\(--sf-a3\)/u);
  // The path mark (C30 amended, R065 a, R072 e, R084): a column has the
  // medium label; a bordered column and a row's panels the line on their
  // border as well; the › is never primary.
  assert.doesNotMatch(block, /@include holds-current-bar;/u);
  assert.match(block, /\.sf-menu\.sf-menu--navigation:not\(\.sf-menu--horizontal\) \{\n  @include path-weight\(\$path-closed\);/u);
  assert.match(rule('.sf-menu.sf-menu--navigation.sf-menu--bordered:not(.sf-menu--horizontal):not(.sf-menu-item > .sf-menu)'), /@include path-line\(\$path-closed\);/u);
  assert.match(rule('.sf-menu.sf-menu--navigation.sf-menu--horizontal .sf-menu'), /@include path-weight\(\$path-any\);\n  @include path-line\(\$path-any\);/u);
  assert.match(rule('.sf-menu.sf-menu--navigation.sf-menu--horizontal:not(.sf-menu--indicator-fill)'), /@include row-current-line;/u);
  assert.match(rule('.sf-menu.sf-menu--navigation.sf-menu--horizontal.sf-menu--indicator-fill'), /@include row-current-fill;/u);
  const path = sheet.slice(sheet.indexOf('@mixin path-weight('), sheet.indexOf('/* The first-level item of a header row'));
  assert.match(path, /--sf-menu-element--font-weight: var\(--sf-font-weight-medium\);/u);
  assert.doesNotMatch(path, /--sf-icon--color/u);
  assert.match(path, /inset-inline-start: calc\(\(var\(--sf-menu--inset, calc\(var\(--sf-px\) \* 0\)\) \+ var\(--sf-menu--line-border\)\) \* -1\);[\s\S]*inline-size: var\(--sf-a2\);[\s\S]*background-color: var\(--sf-primary\);/u);
  assert.match(path, /&\.sf-menu--scroll \{\n    --sf-menu--line-border: calc\(var\(--sf-px\) \* 0\);/u);
  const line = sheet.slice(sheet.indexOf('@mixin row-current-line {'), sheet.indexOf('@mixin row-current-fill {'));
  assert.match(line, /inset-block-end: calc\(-1 \* var\(--sf-site-header--edge, calc\(var\(--sf-px\) \* 0\)\)\);[\s\S]*block-size: var\(--sf-a2\);[\s\S]*background-color: var\(--sf-primary\);/u);
  // The compact rail: the plate on the current row, the path's line on the
  // rail's start edge at the row whose section holds it (no border, no inset).
  const compact = read('src/component/menu/scss/_css__menu_compact.scss');
  assert.match(compact, /@include menu\.current-plate;[\s\S]*--sf-menu--inset: calc\(var\(--sf-px\) \* 0\);\n    --sf-menu--border-width: calc\(var\(--sf-px\) \* 0\);\n    @include menu\.path-line\('\.sf-menu-element\.sf-menu-element--holds-current:not\(\[aria-current\]\)'\);/u);
  assert.doesNotMatch(compact, /holds-current-bar/u);
  assert.match(read('src/smart/menu/js/templates/default.js'), /holds \? 'sf-menu-element--holds-current' : ''/u);
  assert.doesNotMatch(block, /rgba?\(|#[0-9a-f]{3,8}\b|--sf-[a-z0-9-]+--alfa-/iu);
  // The current page's plate comes after the pointer's states at the same
  // weight, so hover and press never lighten it.
  assert.ok(block.indexOf(`${current} {`) > block.indexOf(`${enabled}:active {`));
  assert.match(block, /@media \(forced-colors: active\)[\s\S]*--sf-menu-element--border-width: var\(--sf-px\);/u);
  // The row's gap stays the public variable's.
  assert.match(rule('.sf-menu.sf-menu--navigation'), /--sf-menu--gap: var\(--sf-menu-gap, var\(--sf-space-1\\\/4\)\);/u);
  for (const docs of ['src/smart/menu/docs.md', 'src/component/menu/docs/docs.md']) assert.match(read(docs), /navigation/u, docs);
});

// sf-site-header navigation-align (owner decision by recommendation,
// 2026-11-01): the nav at the centre of the bar, a sheet rule so the first
// paint is centred; tests/browser/menu-navigation.browser.mjs measures it.
test('site header: navigation-align centres the nav without measuring', () => {
  const component = JSON.parse(read('src/smart/header-site/component.json'));
  const setting = component.settings['navigation-align'];
  assert.deepEqual(setting.values, ['start', 'center']);
  assert.equal(setting.default, 'start');
  assert.match(read('src/smart/header-site/index.js'), /navigationAlign: this\.navigationAlign,/u);
  assert.match(read('src/smart/header-site/js/templates/default.js'), /navigationAlign === 'center' \? 'sf-site-header--navigation-center' : ''/u);
  const headerSheet = read('src/smart/header-site/scss/_smart__site_header.scss');
  assert.match(headerSheet, /\.sf-site-header--navigation-center \.sf-site-header-row:where\(:not\(:has\(\.sf-site-header-actions\)\)\) \{\n  display: grid;\n  grid-template-columns: minmax\(max-content, 1fr\) minmax\(0, max-content\) minmax\(max-content, 1fr\);/u);
  // Collapsed, the bar is a row again whatever the setting says.
  const collapsed = headerSheet.slice(headerSheet.indexOf('@mixin collapsed {'));
  assert.match(collapsed, /^@mixin collapsed \{\n[^\n]*\n  \.sf-site-header-row \{\n    display: flex;\n  \}/u);
  assert.ok(headerSheet.indexOf('@mixin collapsed {') > headerSheet.indexOf('.sf-site-header--navigation-center'));
  assert.match(read('src/smart/header-site/docs.md'), /navigation-align="center"/u);
});
