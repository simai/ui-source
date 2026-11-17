// Framework orders FO-1..FO-5 of the view set study (ui-control
// control/research/2026-11-17-view-round-1/framework-orders.md): the parts
// the set's components drew for themselves, made one each in the lowest
// layer that owns them. These are the parts' rules without a browser; the
// browser probes are tests/browser/files-drop.browser.mjs,
// list-rows-window.browser.mjs, form-conditions.browser.mjs,
// input-choice-paging.browser.mjs and filter-window.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {rowsWindow, ROWS_WINDOW_FROM, ROWS_WINDOW_INITIAL} from '../src/core/js/rows-window.js';
import {filesDrop, carriesFiles, filesDragWords, FILES_OVER_ATTRIBUTE, NO_DRAG_QUERY} from '../src/core/js/files-drop.js';
import {evaluateCondition, fieldConditions, conditionFields, CONDITION_OPS, CONDITION_NODES} from '../src/smart/field-renderers/conditions.js';
import {normaliseItems, searchItems, mergeItems} from '../src/smart/input-choice/js/choice-model.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// ------------------------------------------------------------- FO-2 rows window

test('FO-2: a list shorter than the threshold draws every row; a long one a first range with spacers', () => {
  const win = rowsWindow({body: () => null, rows: () => [], guess: 40});
  assert.equal(win.slice(ROWS_WINDOW_FROM - 1), null);
  assert.equal(win.windowed, false);
  const slice = win.slice(10_000);
  assert.equal(win.windowed, true);
  assert.deepEqual({first: slice.first, last: slice.last}, {first: 0, last: ROWS_WINDOW_INITIAL - 1});
  assert.equal(slice.before, 0);
  assert.equal(slice.after, (10_000 - ROWS_WINDOW_INITIAL) * 40);
  // The spacers and the drawn rows stand for the whole list.
  assert.equal(slice.before + slice.after + (slice.last - slice.first + 1) * 40, 10_000 * 40);
});

test('FO-2: reveal puts a row reached by a key in the range; a row already in it moves nothing', () => {
  const moves = [];
  const win = rowsWindow({body: () => null, rows: () => [], onMove: (range) => moves.push(range)});
  win.slice(10_000);
  assert.equal(win.reveal(10), false);
  assert.equal(win.reveal(9_999), true);
  assert.equal(win.range.last, 9_999);
  assert.ok(win.range.first <= 9_999 - ROWS_WINDOW_INITIAL + 1);
  const slice = win.slice(10_000);
  assert.equal(slice.after, 0);
  assert.equal(slice.before, slice.first * 40);
  assert.equal(win.reveal(0), true);
  assert.equal(win.range.first, 0);
  assert.equal(moves.length, 2);
});

test('FO-2: the range stays around a revealed row until the page scrolls to it', () => {
  // The window shows rows 0..20; a key went to the last row.
  const body = {getBoundingClientRect: () => ({top: 0}), ownerDocument: {defaultView: {innerHeight: 800}}};
  const win = rowsWindow({body: () => body, rows: () => [], clip: () => null, guess: 40});
  win.slice(10_000);
  assert.equal(win.reveal(9_999), true);
  // The drawing after it measures the window still on the first rows: the range is kept.
  assert.equal(win.sync(), false);
  assert.equal(win.range.last, 9_999);
  // Once the row is in view (the focus scrolled to it), the range follows the window again.
  body.getBoundingClientRect = () => ({top: -9_990 * 40});
  win.sync();
  assert.equal(win.range.last, 9_999);
  body.getBoundingClientRect = () => ({top: -5_000 * 40});
  assert.equal(win.sync(), true);
  assert.ok(win.range.first <= 5_000 && win.range.last >= 5_020, JSON.stringify(win.range));
});

test('FO-2: sf-list draws by the core helper, between two spacers, with each row\'s place in the whole list', () => {
  const index = read('src/smart/list/index.js');
  assert.match(index, /import \{\s*rowsWindow\s*\} from "\.\.\/\.\.\/core\/js\/rows-window(?:\.js)?";/u);
  const template = read('src/smart/list/js/templates/default.js');
  assert.match(template, /data-sf-rows-spacer/u);
  assert.match(template, /aria-posinset/u);
  assert.match(template, /aria-setsize/u);
});

// ------------------------------------------------------------- FO-1 files drop

const fakeElement = () => {
  const listeners = {};
  const attributes = new Set();
  const documentListeners = {};
  return {
    listeners,
    attributes,
    documentListeners,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
    toggleAttribute: (name, on) => (on ? attributes.add(name) : attributes.delete(name)),
    contains: (node) => node === 'child',
    ownerDocument: {
      addEventListener: (type, fn) => { documentListeners[type] = fn; },
      removeEventListener: (type) => { delete documentListeners[type]; },
    },
  };
};
const dragEvent = ({types = ['Files'], files = [], relatedTarget = null} = {}) => {
  const event = {dataTransfer: {types, files, dropEffect: ''}, relatedTarget, prevented: false};
  event.preventDefault = () => { event.prevented = true; };
  return event;
};

test('FO-1: a drag that carries files is taken -- copy, the over state, one onFiles per drop', () => {
  const element = fakeElement();
  const given = [];
  const over = [];
  const drop = filesDrop(element, {onFiles: (files) => given.push(files), onOver: (one) => over.push(one)});
  const enter = dragEvent();
  element.listeners.dragover(enter);
  assert.equal(enter.prevented, true);
  assert.equal(enter.dataTransfer.dropEffect, 'copy');
  assert.ok(element.attributes.has(FILES_OVER_ATTRIBUTE));
  element.listeners.dragover(dragEvent());
  // Leaving for a child is not leaving.
  element.listeners.dragleave(dragEvent({relatedTarget: 'child'}));
  assert.equal(drop.over, true);
  const dropped = dragEvent({files: ['a.png', 'b.png']});
  element.listeners.drop(dropped);
  assert.equal(dropped.prevented, true);
  assert.deepEqual(given, [['a.png', 'b.png']]);
  assert.deepEqual(over, [true, false]);
  assert.equal(element.attributes.has(FILES_OVER_ATTRIBUTE), false);
  drop.stop();
  assert.deepEqual(Object.keys(element.listeners), []);
  assert.deepEqual(Object.keys(element.documentListeners), []);
});

test('FO-1: text or a row dragged across passes on; a disabled element says no and gives nothing', () => {
  const element = fakeElement();
  const given = [];
  let disabled = false;
  filesDrop(element, {onFiles: (files) => given.push(files), disabled: () => disabled});
  const text = dragEvent({types: ['text/plain']});
  element.listeners.dragover(text);
  assert.equal(text.prevented, false);
  assert.equal(carriesFiles(text), false);
  disabled = true;
  const held = dragEvent();
  element.listeners.dragover(held);
  assert.equal(held.prevented, true);
  assert.equal(held.dataTransfer.dropEffect, 'none');
  const dropped = dragEvent({files: ['a.png']});
  element.listeners.drop(dropped);
  // The browser must not open the file in place of the page.
  assert.equal(dropped.prevented, true);
  assert.deepEqual(given, []);
});

test('FO-1: the drag words follow C223 -- no words about dragging on a screen with no fine pointer', () => {
  assert.equal(NO_DRAG_QUERY, '(pointer: coarse) and (not (any-pointer: fine))');
  assert.equal(filesDragWords({matchMedia: (query) => ({matches: query === NO_DRAG_QUERY})}), false);
  assert.equal(filesDragWords({matchMedia: () => ({matches: false})}), true);
  assert.equal(filesDragWords({}), true);
  // The file field's sheet hides the words by the same query.
  assert.ok(read('src/component/file-upload/scss/_css__file_upload.scss').includes(`@media ${NO_DRAG_QUERY}`));
});

test('FO-1: three Framework places read drops through the one core part', () => {
  for (const path of ['src/component/file-upload/js/_file_upload.js', 'src/smart/file-upload/index.js', 'src/smart/input-image/index.js']) {
    const source = read(path);
    assert.match(source, /import \{[^}]*filesDrop[^}]*\} from '[./]+\/core\/js\/files-drop(?:\.js)?';/u, path);
    assert.doesNotMatch(source, /addEventListener\('drop'/u, path);
  }
  assert.doesNotMatch(read('src/smart/input-image/js/templates/default.js'), /@drop=/u);
});

// ------------------------------------------------------------- FO-3 field conditions

test('FO-3: the grammar -- eq, ne, in, not_in, empty, not_empty, all, any, not', () => {
  assert.deepEqual([...CONDITION_OPS], ['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty']);
  assert.deepEqual([...CONDITION_NODES], ['all', 'any', 'not']);
  const values = {delivery: 'courier', tags: ['a', {value: 'b', label: 'Б'}], count: 5, note: '', none: null};
  const cases = [
    [{field: 'delivery', op: 'eq', value: 'courier'}, true],
    [{field: 'delivery', op: 'ne', value: 'courier'}, false],
    [{field: 'count', op: 'eq', value: '5'}, true],
    [{field: 'tags', op: 'eq', value: 'b'}, true],
    [{field: 'delivery', op: 'in', value: ['pickup', 'courier']}, true],
    [{field: 'delivery', op: 'not_in', value: ['pickup', 'courier']}, false],
    [{field: 'note', op: 'empty'}, true],
    [{field: 'none', op: 'empty'}, true],
    [{field: 'tags', op: 'not_empty'}, true],
    [{all: [{field: 'delivery', op: 'eq', value: 'courier'}, {field: 'note', op: 'empty'}]}, true],
    [{any: [{field: 'delivery', op: 'eq', value: 'pickup'}, {field: 'count', op: 'eq', value: 5}]}, true],
    [{not: {field: 'delivery', op: 'eq', value: 'courier'}}, false],
  ];
  for (const [condition, expected] of cases) assert.equal(evaluateCondition(condition, values), expected, JSON.stringify(condition));
  // A Map reads the same.
  assert.equal(evaluateCondition({field: 'delivery', op: 'eq', value: 'courier'}, new Map(Object.entries(values))), true);
});

test('FO-3: a condition that cannot be read leaves the field as it is declared', () => {
  for (const condition of [{field: 'a', op: 'like', value: 'x'}, {all: []}, {any: 'x'}, {field: 'a', op: 'in', value: 'x'}, null, []]) {
    assert.equal(evaluateCondition(condition, {a: 'x'}), null, JSON.stringify(condition));
  }
  const field = {key: 'address', required: true, when: {visible: {field: 'a', op: 'like'}, enabled: {all: []}}};
  assert.deepEqual(fieldConditions(field, {a: 'x'}), {visible: true, required: true, enabled: true});
});

test('FO-3: when decides shown, required and enabled from the other fields\' values on screen', () => {
  const address = {key: 'address', when: {
    visible: {field: 'delivery', op: 'eq', value: 'courier'},
    required: {field: 'delivery', op: 'eq', value: 'courier'},
    enabled: {field: 'city', op: 'not_empty'},
  }};
  assert.deepEqual(fieldConditions(address, {delivery: 'pickup'}), {visible: false, required: false, enabled: false});
  assert.deepEqual(fieldConditions(address, {delivery: 'courier', city: 'Москва'}), {visible: true, required: true, enabled: true});
  assert.deepEqual(fieldConditions({key: 'plain', required: true}, {}), {visible: true, required: true, enabled: true});
  assert.deepEqual(conditionFields(address), ['delivery', 'city']);
});

test('FO-3: sf-form reads the conditions; the grammar is documented; the page has them on SF.fieldRenderers', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /fieldConditions\(field, this\._values\)/u);
  const docs = read('src/smart/form/docs.md');
  assert.match(docs, /## Условия полей/u);
  for (const op of [...CONDITION_OPS, ...CONDITION_NODES]) assert.ok(docs.includes(`"${op}"`), op);
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /conditions: \{/u);
  assert.match(renderers, /filterWindow: \{/u);
  const api = json('src/core/contracts/public-js-api.json');
  const entry = JSON.stringify(api).includes('"filterWindow"') && JSON.stringify(api).includes('"conditions"');
  assert.ok(entry, 'public-js-api lists SF.fieldRenderers.conditions and .filterWindow');
});

// ------------------------------------------------------------- FO-4 option visuals and pages

test('FO-4: an option carries an avatar, a swatch and a scheme; a swatch that is not a colour is dropped', () => {
  const [avatar, swatch, badge, bad] = normaliseItems([
    {value: 'ann', label: 'Анна', avatar: 'https://example.test/a.png'},
    {value: 'red', label: 'Красный', swatch: '#e53935'},
    {value: 'new', label: 'Новый', scheme: 'primary'},
    {value: 'x', swatch: 'url(javascript:alert(1))'},
  ]);
  assert.deepEqual(avatar.avatar, {image: 'https://example.test/a.png', text: ''});
  assert.equal(swatch.swatch, '#e53935');
  assert.equal(badge.scheme, 'primary');
  assert.equal(bad.swatch, '');
});

test('FO-4: search folds case and accents; pages merge after the options in hand, one value one option', () => {
  const items = normaliseItems([{value: 'a', label: 'Ёлка'}, {value: 'b', label: 'Café', caption: 'Кофе'}, {value: 'c', label: 'Дом'}]);
  assert.deepEqual(searchItems(items, 'cafe').map((one) => one.value), ['b']);
  assert.deepEqual(searchItems(items, 'КОФ').map((one) => one.value), ['b']);
  assert.deepEqual(searchItems(items, '').map((one) => one.value), ['a', 'b', 'c']);
  const merged = mergeItems(normaliseItems([{value: 'b', label: 'Chosen'}]), normaliseItems([{value: 'a'}, {value: 'b', label: 'Paged'}]));
  assert.deepEqual(merged.map((one) => [one.value, one.label]), [['b', 'Chosen'], ['a', 'a']]);
});

test('FO-4: the filter renderer draws sf-input-choice with the host\'s provider where the host draws no options itself', () => {
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /<sf-input-choice[^>]*appearance="list"/u);
  assert.match(renderers, /getFilterOptionsProvider/u);
  assert.match(renderers, /typeof host\.renderFilterOption !== 'function'|typeof host\?\.renderFilterOption !== 'function'/u);
  const component = json('src/smart/input-choice/component.json');
  const settings = component.settings ?? component.properties ?? {};
  assert.ok(settings.searchable, 'searchable');
  assert.ok(settings.provider, 'provider');
});

// ------------------------------------------------------------- FO-5 filter window

test('FO-5: the filter window -- a dialog popover from any anchor, «Применить» before «Сбросить» (C157 (3))', () => {
  const source = read('src/smart/field-renderers/filter-window.js');
  assert.match(source, /setAttribute\('surface-role', 'dialog'\)/u);
  const apply = source.indexOf("data-action=\"apply\"");
  const reset = source.indexOf("data-action=\"reset\"");
  assert.ok(apply > 0 && reset > apply, 'apply first');
  assert.match(source, /popover\.anchor = anchor/u);
  assert.doesNotMatch(source, /sf-table|sf-view-table/u);
  const en = json('src/smart/field-renderers/lang/en.json').runtime;
  const ru = json('src/smart/field-renderers/lang/ru.json').runtime;
  assert.equal(en.filterApply, 'Apply');
  assert.equal(en.filterReset, 'Reset');
  assert.equal(ru.filterApply, 'Применить');
  assert.equal(ru.filterReset, 'Сбросить');
});

test('FO-5: sf-popover opens from an anchor given as a property and places itself against it', () => {
  const popover = read('src/smart/popover/index.js');
  assert.match(popover, /get _reference\(\)/u);
  assert.match(popover, /anchorFloating\(reference/u);
  const component = json('src/smart/popover/component.json');
  const settings = component.settings ?? component.properties ?? {};
  assert.ok(settings.anchor, 'anchor setting');
});
