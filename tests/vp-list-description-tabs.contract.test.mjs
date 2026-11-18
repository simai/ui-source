import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-view-properties study (C292, 2026-11-17) Framework defects.
// VP-24: sf-list-description 1.4.0 draws a field template's value (C302 (2),
// place Показ): an item's slot, or a node given as value.
// VP-26: sf-tabs 1.4.4 folds vertical tabs by the box that holds the tabs and
// their content (C96 (5), C289 (5)), not by a tab column alone.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('VP-24: list-description 1.4.0 declares the item slot', () => {
  const component = JSON.parse(read('src/smart/list-description/component.json'));
  assert.equal(component.version, '1.4.0');
  assert.deepEqual(component.settings.items.schema.items.properties.slot, {type: 'string'});
  assert.match(component.settings.items.summary, /slot\?\}/u);
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.4.0') && line.includes('VP-24')));
});

// The pure part of index.js: from `const text` to the end of normalizeItems.
function listDescription() {
  const source = read('src/smart/list-description/index.js');
  const start = source.indexOf('export const STATUSES');
  const end = source.indexOf('const ListDescriptionElement');
  assert.ok(start > 0 && end > start);
  const body = source.slice(start, end).replace(/^export /gmu, '');
  return new Function(`${body}; return {normalizeItems, drawnValue};`)();
}

test('VP-24: a slot with content is the value; the text stays for copy; without content the text is drawn', () => {
  const {normalizeItems} = listDescription();
  const has = (names) => ({hasSlot: (name) => names.includes(name)});
  const [slotted] = normalizeItems([{label: 'Сумма', value: '418 000 ₽', slot: 'sum', copy: true, href: '/x'}], has(['sum']));
  assert.equal(slotted.slot, 'sum');
  assert.equal(slotted.drawn, true);
  assert.equal(slotted.empty, false);
  assert.equal(slotted.value, '418 000 ₽');
  assert.equal(slotted.copy, true);
  const [missing] = normalizeItems([{label: 'Сумма', value: '418 000 ₽', slot: 'sum', href: '/x'}], has([]));
  assert.equal(missing.slot, '');
  assert.equal(missing.drawn, false);
  assert.equal(missing.href, '/x');
  const [onlySlot] = normalizeItems([{label: 'Теги', slot: 'tags'}], has(['tags']));
  assert.equal(onlySlot.empty, false, 'a slot alone is a value');
  const [plain] = normalizeItems([{label: 'Адрес', value: 'demo.test'}]);
  assert.equal(plain.drawn, false);
  assert.equal(plain.value, 'demo.test');
});

test('VP-24: a node or a lit drawing given as value is drawn; other objects are not', () => {
  const {normalizeItems, drawnValue} = listDescription();
  const lit = {_$litType$: 1, strings: ['<b>', '</b>'], values: []};
  assert.equal(drawnValue(lit), lit);
  assert.equal(drawnValue({text: 'x'}), null);
  assert.equal(drawnValue(['a']), null);
  assert.equal(drawnValue('x'), null);
  const [item] = normalizeItems([{label: 'Статус', value: lit, copy: true}]);
  assert.equal(item.node, lit);
  assert.equal(item.drawn, true);
  assert.equal(item.empty, false);
  assert.equal(item.copy, false, 'a drawing without words has nothing to copy');
});

test('VP-24: the template draws the slot or the node in .sf-list-description-drawn', () => {
  const template = read('src/smart/list-description/js/templates/default.js');
  assert.ok(template.indexOf('if (item.drawn)') < template.indexOf('if (item.href)'), 'a drawn value is drawn before any link');
  assert.match(template, /if \(item\.drawn\) \{\s*return html`\$\{badge\}<span class="sf-list-description-drawn"/u);
  assert.match(template, /component\.getSlotContent\(item\.slot\)\s*: item\.node\}/u);
  assert.match(read('src/smart/list-description/scss/_smart__list-description.scss'), /\.sf-list-description-drawn \{\s*min-inline-size: 0;/u);
  assert.match(read('src/smart/list-description/index.js'), /normalizeItems\(this\.items, \{hasSlot: \(name\) => this\.hasSlotContent\?\.\(name\)\}\)/u);
});

function method(source, name) {
  const start = source.indexOf(`\n  ${name}() {`);
  assert.ok(start >= 0, `method ${name}`);
  const open = source.indexOf(') {', start) + 2;
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, at);
}

test('VP-26: a tab list alone folds by the first box around it wider than its column', () => {
  const source = read('src/smart/tabs/index.js');
  assert.equal(JSON.parse(read('src/smart/tabs/component.json')).version, '1.4.6'); // group build 13: 1.4.4 moved on by the merged branches or a GB11 merge
  const contentWidth = (box) => box.width;
  const placeBox = new Function('contentWidth', `return function () {${method(source, 'placeBox')}}`)(contentWidth);
  const box = (width, parentElement = null) => ({width, parentElement, getBoundingClientRect: () => ({width})});
  const html = box(1440);
  const body = box(1440, html);
  const card = box(1248, body); // the card full screen: the section column and the groups
  const wrapper = box(224, card); // the column's own wrapper, as wide as the column
  const tabsRoot = box(224);
  const host = (holds, parent) => ({
    ownerDocument: {documentElement: html},
    parentElement: parent,
    querySelector: () => tabsRoot,
    holdsContent: () => holds,
  });
  assert.equal(placeBox.call(host(false, wrapper)), card, 'the wrapper of the column and the content');
  assert.equal(placeBox.call(host(true, wrapper)), tabsRoot, 'panels inside: the tabs\' own block (C181 (2))');
  const lone = box(224, null);
  assert.equal(placeBox.call(host(false, box(224, lone))), tabsRoot, 'nothing wider: its own block');
  assert.match(method(source, 'placeWidth'), /const place = this\.placeBox\(\);\s*if \(place\) return contentWidth\(place\);/u);
  assert.match(method(source, 'holdsContent'), /this\.drawnPanels\(\)\.some\(panelHasContent\)/u);
  assert.match(method(source, 'watchPlace'), /this\.placeBox\(\)/u);
});
