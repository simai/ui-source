import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

import {SORTABLE_INSERT_EVENT, createSortableInserter, insertionGeometry, nearestInsertion} from '../src/core/js/composition/sortable-inserter.mjs';

// The insertion point between sf-sortable rows and the searchable inserter it
// opens (simai/ui-source#21, ui-mail redesign F4). What is held here: it is
// opt-in, it reports and never creates, it is the Framework's standard menu and
// not a second popover, and the places it offers are the gaps -- before the
// first item, between every two, after the last.
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

// A list laid out by hand: items of the given boxes inside a list box.
function fakeList(boxes, {orientation = 'vertical', box = {left: 0, top: 0, width: 300, height: 200}} = {}) {
  const all = boxes.map((rect) => ({getBoundingClientRect: () => ({...rect, right: rect.left + rect.width, bottom: rect.top + rect.height})}));
  const list = {
    clientLeft: 0, clientTop: 0, clientWidth: box.width, clientHeight: box.height,
    getBoundingClientRect: () => ({...box, right: box.left + box.width, bottom: box.top + box.height}),
    getAttribute: (name) => (name === 'orientation' ? orientation : null),
  };
  return {list, all};
}

const rows = [
  {left: 0, top: 0, width: 300, height: 40},
  {left: 0, top: 48, width: 300, height: 40},
  {left: 0, top: 96, width: 300, height: 40},
];

test('the places are the gaps: before the first, between every two, after the last', () => {
  const {list, all} = fakeList(rows);
  const places = [0, 1, 2, 3].map((index) => insertionGeometry(list, all, index));
  assert.deepEqual(places.map((place) => place.axis), ['y', 'y', 'y', 'y']);
  // On the middle of a gap, not on either item's edge.
  assert.deepEqual(places.map((place) => place.at), [0, 44, 92, 136]);
  assert.deepEqual([places[1].start, places[1].end], [0, 300]);
  // An empty list has one place, in its middle.
  const empty = fakeList([]);
  assert.deepEqual(insertionGeometry(empty.list, empty.all, 0), {axis: 'y', at: 100, start: 0, end: 300});
});

test('a horizontal list puts its places across, between the items side by side', () => {
  const {list, all} = fakeList([
    {left: 0, top: 0, width: 80, height: 40},
    {left: 90, top: 0, width: 80, height: 40},
  ], {orientation: 'horizontal', box: {left: 0, top: 0, width: 300, height: 40}});
  assert.deepEqual([0, 1, 2].map((index) => insertionGeometry(list, all, index).at), [0, 85, 170]);
  assert.equal(insertionGeometry(list, all, 1).axis, 'x');
});

test('a grid puts its places on the sides of its cells, in reading order', () => {
  const {list, all} = fakeList([
    {left: 0, top: 0, width: 140, height: 40},
    {left: 160, top: 0, width: 140, height: 40},
    {left: 0, top: 48, width: 140, height: 40},
  ]);
  const between = insertionGeometry(list, all, 1);
  assert.deepEqual(between, {axis: 'x', at: 150, start: 0, end: 40});
  // The first cell of the next row: its own start side, on its own row.
  assert.deepEqual(insertionGeometry(list, all, 2), {axis: 'x', at: 0, start: 48, end: 88});
  assert.deepEqual(insertionGeometry(list, all, 3), {axis: 'x', at: 140, start: 48, end: 88});
});

test('the pointer is given the nearest place and how far it is', () => {
  const {list, all} = fakeList(rows);
  assert.equal(nearestInsertion(list, all, 150, 46).index, 1);
  assert.equal(nearestInsertion(list, all, 150, 46).distance, 2);
  assert.equal(nearestInsertion(list, all, 150, 2).index, 0);
  assert.equal(nearestInsertion(list, all, 150, 134).index, 3);
  // Off the list's width there is no place.
  assert.equal(nearestInsertion(list, all, 400, 46), null);
});

test('without inserter items the controller draws nothing and listens to nothing', () => {
  const calls = [];
  const list = new Proxy({inserterItems: [], updateInstructions: () => calls.push('updateInstructions')}, {
    get(target, key) {
      if (key in target) return target[key];
      calls.push(String(key));
      return () => {};
    },
  });
  const controller = createSortableInserter(list);
  controller.connect();
  controller.ensure();
  assert.equal(controller.active, false);
  assert.equal(controller.instructions(), '');
  assert.equal(controller.onItemKeyDown({key: '+', preventDefault() { calls.push('preventDefault'); }}, {}), false);
  controller.disconnect();
  assert.deepEqual(calls.filter((call) => call !== 'updateInstructions'), [], 'a list without an inserter is touched for nothing but its instructions');
});

test('the drag module is unchanged: the sortable bundle defines the element extended', async () => {
  const [core, inserter, entry, overlay] = await Promise.all([
    read('src/core/js/composition/sortable.mjs'),
    read('src/core/js/composition/sortable-inserter.mjs'),
    read('src/smart/sortable/index.js'),
    read('src/core/js/composition/overlay.mjs'),
  ]);
  // sortable.mjs is carried by the composition overlay too; nothing of the
  // inserter is in it.
  assert.doesNotMatch(core, /inserter/i);
  assert.match(inserter, /export function withSortableInserter\(Base\) \{\s*return class SfSortable extends Base \{/);
  assert.match(inserter, /return \[\.\.\.\(super\.observedAttributes \?\? \[\]\), 'inserter-items'\];/);
  assert.match(inserter, /get inserterItems\(\) \{/);
  assert.match(inserter, /set inserterItems\(value\) \{/);
  // The row's "+" is asked first, outside a drag, and everything else is the drag's.
  assert.match(inserter, /onKeyDown\(event\) \{[\s\S]{0,300}this\.inserterController\?\.onItemKeyDown\(event, item\)\) return;\s*super\.onKeyDown\(event\);/);
  // A host redraw puts the point back with the live region.
  assert.match(inserter, /ensureAccessibilityNodes\(\) \{\s*super\.ensureAccessibilityNodes\(\);[\s\S]{0,120}this\.inserterController\?\.ensure\(\);/);
  // Instructions are written only when they change: the list observes itself.
  assert.match(inserter, /if \(next !== current\) this\.instructions\.textContent = next;/);
  assert.match(entry, /defineSortable\(inserterRegistry\(\), \{base: manifestHost\(manifest, /);
  assert.match(entry, /SORTABLE_INSERT_EVENT, SORTABLE_INTENT_EVENT/);
  assert.doesNotMatch(overlay, /sortable-inserter/);
});

test('a choice is reported, cancelable, and never creates the item', async () => {
  const source = await read('src/core/js/composition/sortable-inserter.mjs');
  assert.equal(SORTABLE_INSERT_EVENT, 'sf-sortable-insert');
  assert.match(source, /list\.dispatchEvent\(new globalThis\.CustomEvent\(SORTABLE_INSERT_EVENT, \{\s*bubbles: true, composed: true, cancelable: true,\s*detail: Object\.freeze\(\{ index, item: entry\.id, to:/);
  // A refusal keeps the inserter open.
  assert.match(source, /if \(!accepted\) return;/);
  // Nothing in it makes an item: no item attribute is ever written.
  assert.doesNotMatch(source, /setAttribute\(['"]data-sf-sortable-item/);
  assert.doesNotMatch(source, /dataset\.sfSortableItem\s*=/);
});

test('the inserter is the standard menu, and Escape is its layer alone', async () => {
  const [source, menu] = await Promise.all([
    read('src/core/js/composition/sortable-inserter.mjs'),
    read('src/smart/context-menu/index.js'),
  ]);
  assert.match(source, /createElement\('sf-context-menu'\)/);
  assert.match(source, /ensurePlugin\?\.\('cl-context-menu'\)/);
  assert.match(source, /surface\.search = \{ placeholder: text\('search'\), empty: text\('empty'\) \};/);
  assert.match(source, /surface\.openFor\(button,/);
  // No Escape of its own on the document: the menu owns it and holds the
  // open-surface mark, so a drawer or modal around the list stands back.
  assert.doesNotMatch(source, /addEventListener\('keydown'[^)]*true\)/);
  assert.doesNotMatch(source, /key === ['"]Escape['"]/);
  assert.match(menu, /holdOpenSurfaceMark\(this, true\);/);
  // The point is a native button of the smallest rung, a tab stop after the items.
  assert.match(source, /sf-icon-button--size-1\/3/);
  assert.match(source, /control\.compareDocumentPosition\(last\) & globalThis\.Node\.DOCUMENT_POSITION_FOLLOWING/);
});

test('the rule, the manifest and both documents name the inserter', async () => {
  const [rule, manifestText, smartDocs, developerDocs, styles] = await Promise.all([
    read('src/smart/sortable/rule.js'),
    read('src/smart/sortable/smart.manifest.json'),
    read('src/smart/sortable/docs.md'),
    read('docs/developer/composition-sortable.md'),
    read('src/smart/sortable/scss/_smart__sortable.scss'),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.match(rule, /\{ name: 'icon-buttons', lazy: true \},\n    \{ name: 'icons', lazy: true \},\n    \{ name: 'cl-context-menu', lazy: true \},/);
  assert.deepEqual(manifest.composition.uses, ['component.icon-buttons', 'component.icons', 'smart.context-menu']);
  assert.equal(manifest.inputs.properties['inserter-items'].default, '');
  assert.deepEqual(manifest.events['sf-sortable-insert'].payload.required, ['index', 'item', 'to']);
  assert.ok(manifest.accessibility.keyboard.includes('+'));
  assert.ok(manifest.provenance.source_artifacts.some(({path}) => path === 'src/core/js/composition/sortable-inserter.mjs'));
  assert.match(smartDocs, /## Точка вставки и вставщик/);
  assert.match(developerDocs, /## Insertion point and inserter/);
  for (const document_ of [smartDocs, developerDocs]) assert.match(document_, /sf-sortable-insert/);
  // Gone while something is dragged; a utility on the list still wins over
  // its position.
  assert.match(styles, /html\[data-sf-sortable-active\] \.sf-sortable-insert \{\s*display: none;/);
  assert.match(styles, /@layer sf\.base \{[\s\S]*sf-sortable\[data-sf-sortable-inserter\] \{\s*position: relative;/);
});
