import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  LEVEL_LIMIT,
  MENU_APPEARANCES,
  MENU_COLLAPSE,
  MENU_ORIENTATIONS,
  badgeCount,
  currentItemId,
  itemsFromList,
  normaliseItems,
  normalisePath,
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
  assert.equal((template.match(/aria-current=\$\{current \? 'page' : nothing\}/gu) || []).length, 3);
});

test('smart menu: a column opens the way to the current page; a row opens only when asked', () => {
  const items = normaliseItems([...TREE, {id: 'help', label: 'Помощь', open: true, children: [{id: 'faq', label: 'Вопросы'}]}]);
  assert.deepEqual([...openBranches(items, new Map(), 'catalog-2-1', true)], ['catalog', 'catalog-2', 'help']);
  assert.deepEqual([...openBranches(items, new Map([['catalog', false]]), 'catalog-2-1', true)], ['catalog-2', 'help']);
  assert.deepEqual([...openBranches(items, new Map(), 'catalog-2-1', false)], []);
  assert.deepEqual([...openBranches(items, new Map([['catalog', true]]), null, false)], ['catalog']);
  // A row's open panels are one chain: opening a branch closes every panel
  // not above it.
  assert.match(source, /if \(this\.flyouts\) \{\n      const above = new Set\(pathTo\(this\.menuItems, item\.id\) \|\| \[\]\);\n      for \(const other of before\) if \(!above\.has\(other\)\) after\.delete\(other\);/u);
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
  assert.match(template, /if \(context\.flyouts && level === 1\) return open \? 'keyboard_arrow_up' : 'keyboard_arrow_down';\n  return open \? 'keyboard_arrow_down' : 'chevron_right';/u);
  // A branch is a native button with aria-expanded and aria-controls; no
  // application menu roles.
  assert.match(template, /aria-expanded=\$\{open \? 'true' : 'false'\} aria-controls=\$\{submenuId\}/u);
  assert.doesNotMatch(template + source, /role="?menu|menuitem/u);
  // The markup is the element's: the class runtime leaves what is marked.
  assert.match(template, /data-sf-menu-owned>/u);
  assert.match(classRuntime, /const OWNED_SELECTOR = '\[data-sf-menu-owned\]';/u);
  assert.match(classRuntime, /function initMenuItem\(root\) \{\n  if \(!root \|\| isOwned\(root\)\) return;/u);
  assert.match(classRuntime, /if \(isOwned\(target\)\) return;/u);
  assert.match(classRuntime, /if \(!\(target instanceof Element\) \|\| isOwned\(target\)\) return;/u);
  assert.match(classRuntime, /if \(!isOwned\(root\) && !root\.contains\(target\)\) setMenuItemOpen\(root, false\);/u);
  // The own sheet draws nothing the class draws: no row geometry, no colours
  // but the shared focus ring.
  assert.doesNotMatch(sheet, /padding|block-size|height|background|border-color|font-size/u);
});

test('smart menu: a row\'s panels are placed by SF.Position and Escape closes the innermost only', () => {
  assert.match(source, /const positioning = \(\) => globalThis\.SF\?\.Position \|\| BundledPosition;/u);
  assert.match(source, /side: row\.dataset\.sfMenuLevel === '1' \? 'block-end' : 'inline-end', align: 'start', offset: 0, fitHeight: true,/u);
  // The shared open-surface protocol: the mark is held while a panel is open
  // and Escape is taken only as the innermost layer.
  assert.match(source, /import \{holdOpenSurfaceMark, isTopOpenSurface\} from '\.\.\/\.\.\/core\/js\/open-surface-mark';/u);
  assert.match(source, /if \(event\.key !== 'Escape' \|\| event\.defaultPrevented \|\| !isTopOpenSurface\(this\)\) return;/u);
  assert.match(source, /holdOpenSurfaceMark\(this, hold\);/u);
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
  assert.deepEqual(Object.keys(manifest.item_contract.properties), ['id', 'label', 'href', 'icon', 'badge', 'current', 'disabled', 'open', 'children']);
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage/u);
  // The Pro admin menu is another component: nothing of it is used here.
  assert.doesNotMatch(source + template, /admin-menu|sf-admin/u);
});

test('smart menu: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/menu/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-menu'\] = \{\n  tags: \['sf-menu'\],/u);
  assert.match(rule, /\{ name: 'menu' \},\n    \{ name: 'icons' \},\n    \{ name: 'icon-buttons' \},\n    \{ name: 'badges' \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/menu\/rule\.js';/u);
  assert.deepEqual(manifest.composition.uses, ['component.badges', 'component.icon-buttons', 'component.icons', 'component.menu']);
});

// The public variables (2026-10-25): nine, read by the class sheet sf-menu
// draws with, each with the value it drew before as its fallback.
test('smart menu: the class menu\'s public variables wrap the values it drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'menu');
  assert.equal(entry.selector, '.sf-menu');
  assert.equal(entry.variables.length, 9);
  const classSheet = ['_css__menu.scss', '_css__menu_element.scss'].map((name) => read(`src/component/menu/scss/${name}`)).join('\n');
  for (const line of [
    'background-color: var(--sf-menu--background-color, var(--sf-menu-background-color, transparent));',
    'gap: var(--sf-menu--gap, var(--sf-menu-gap, var(--sf-space-1\\/3)));',
    '--sf-menu-element--background-color: var(--sf-menu-item-background-color, var(--sf-transparent));',
    '--sf-menu-element--border-color: var(--sf-menu-item-border-color, var(--sf-surface-container));',
    '--sf-menu-element--color: var(--sf-menu-item-color, var(--sf-on-surface));',
    '--sf-menu-element--radius: var(--sf-menu-item-radius, var(--sf-radius--ui));',
    'var(--sf-menu-horizontal-submenu--background-color, var(--sf-menu-submenu-background-color, var(--sf-elevation-2--surface)))',
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
