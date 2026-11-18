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
import {evaluateCondition, fieldConditions, fieldEditable, conditionFields, CONDITION_OPS, CONDITION_NODES} from '../src/smart/field-renderers/conditions.js';
import {normaliseItems, searchItems, mergeItems, chosenFirst, optionLook, OPTION_LOOKS, DEFAULT_OPTION_LOOK} from '../src/smart/input-choice/js/choice-model.mjs';

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
  assert.match(index, /import \{\s*rowsWindow, ROWS_WINDOW_FROM\s*\} from "\.\.\/\.\.\/core\/js\/rows-window(?:\.js)?";/u);
  const template = read('src/smart/list/js/templates/default.js');
  assert.match(template, /data-sf-rows-spacer/u);
  assert.match(template, /aria-posinset/u);
  assert.match(template, /aria-setsize/u);
});

test('FO2-4: each entry keeps its own measured height by its id; the rest are their average', () => {
  // Rows 0..59 drawn: every tenth one a picture row of 200 px, the rest 40 px.
  const tall = (index) => index % 10 === 0;
  let tops = [];
  const drawn = () => tops.map(([top, height]) => ({getBoundingClientRect: () => ({top, bottom: top + height, height})}));
  const body = {getBoundingClientRect: () => ({top: 0}), ownerDocument: {defaultView: {innerHeight: 800}}};
  const win = rowsWindow({body: () => body, rows: drawn, clip: () => null, guess: 40, key: (index) => `r${index}`});
  win.slice(1_000);
  let top = 0;
  tops = Array.from({length: ROWS_WINDOW_INITIAL}, (_, index) => {
    const height = tall(index) ? 200 : 40;
    const box = [top, height];
    top += height;
    return box;
  });
  win.sync();
  const slice = win.slice(1_000);
  // The drawn rows' own heights: the spacer after them is the rest at the average.
  const average = top / ROWS_WINDOW_INITIAL;
  assert.ok(Math.abs(slice.after - (1_000 - ROWS_WINDOW_INITIAL) * average) < 1, `${slice.after}`);
  assert.equal(slice.before, 0);
  // Scrolled past them: the before spacer is the sum of their own heights, not count x average.
  body.getBoundingClientRect = () => ({top: -top - 400});
  win.sync();
  const moved = win.slice(1_000);
  const measured = Array.from({length: moved.first}, (_, index) => (index < ROWS_WINDOW_INITIAL ? (tall(index) ? 200 : 40) : average)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(moved.before - measured) < 1, `${moved.before} vs ${measured}`);
});

test('FO2-1, FO2-4: an entry is read where it stands in the flow (place); a stuck heading does not move the range', () => {
  // A grouped list: a heading every 41 entries, 32 px; rows 40 px. The
  // heading drawn first is stuck at the top of the box (sticky-headings):
  // its box says 0 wherever the list scrolled; its place in the flow says
  // where it stands.
  const heights = (index) => (index % 41 === 0 ? 32 : 40);
  let scrolled = 0;
  let range = {first: 0, last: ROWS_WINDOW_INITIAL - 1};
  let before = 0;
  // As in a page: the drawn entries stand after the spacer before them.
  const flowTop = (index) => {
    let top = before;
    for (let at = range.first; at < index; at += 1) top += heights(at);
    return top - scrolled;
  };
  const drawn = () => Array.from({length: range.last - range.first + 1}, (_, offset) => {
    const index = range.first + offset;
    const stuck = index === range.first && index % 41 === 0;
    const top = stuck ? 0 : flowTop(index);
    return {index, getBoundingClientRect: () => ({top, bottom: top + heights(index), height: heights(index)})};
  });
  const body = {getBoundingClientRect: () => ({top: -scrolled}), ownerDocument: {defaultView: {innerHeight: 480}}};
  let moves = 0;
  const win = rowsWindow({
    body: () => body,
    rows: drawn,
    clip: () => null,
    key: (index) => `e${index}`,
    snap: (index) => index - (index % 41),
    place: (element) => flowTop(element.index),
    onMove: () => { moves += 1; },
  });
  win.slice(2_050);
  for (const at of [0, 20_000, 20_000, 20_000, 40_000, 40_000]) {
    scrolled = at;
    for (let round = 0; round < 5; round += 1) {
      if (!win.sync()) break;
      const next = win.slice(2_050);
      range = {first: next.first, last: next.last};
      before = next.before;
    }
  }
  // Settled: one more drawing at the same place moves nothing, and the
  // range holds what is in view.
  assert.equal(win.sync(), false);
  assert.ok(moves < 12, `${moves} moves`);
  const view = win.range;
  let top = 0;
  let first = 0;
  while (top + heights(first) <= 40_000) top += heights(first++);
  assert.ok(view.first <= first && view.last >= first + 10, `${JSON.stringify(view)} for ${first}`);
  assert.match(read('src/smart/list/index.js'), /place: \(element\) => \{\s*if \(!element\.classList\.contains\("sf-list__heading"\)\)/u);
});

test('FO2-1, FO2-3: a range never starts inside a group without its heading; from Infinity is off', () => {
  // Groups of 50: heading at 0, 51, 102, ...
  const head = (index) => index - (index % 51);
  const win = rowsWindow({body: () => null, rows: () => [], snap: head});
  win.slice(5_100);
  assert.equal(win.reveal(4_000), true);
  assert.equal(win.range.first, head(win.range.first));
  assert.ok(win.range.first <= 4_000 && win.range.last >= 4_000);
  win.from = Infinity;
  assert.equal(win.slice(5_100), null);
  assert.equal(win.windowed, false);
  win.from = undefined;
  assert.equal(win.from, ROWS_WINDOW_FROM);
});

test('FO2-1, FO2-3, FO2-5: sf-list windows grouped lists and has rows-window; sf-tree draws by the same helper', () => {
  const list = read('src/smart/list/index.js');
  assert.match(list, /entries\.push\(\{key: `head:\$\{group\.key\}`/u);
  assert.match(list, /getAttribute\("rows-window"\) === "off" \? Infinity : ROWS_WINDOW_FROM/u);
  assert.deepEqual(json('src/smart/list/component.json').settings['rows-window'].values, ['auto', 'off']);
  const tree = read('src/smart/tree/index.js');
  assert.match(tree, /import \{rowsWindow\} from '\.\.\/\.\.\/core\/js\/rows-window\.js';/u);
  assert.doesNotMatch(tree, /windowRange\(|watchScroll\(/u);
  assert.match(read('src/smart/tree/js/templates/default.css'), /\.sf-tree\[data-sf-rows-window\] \{\s*overflow-anchor: none;/u);
});

// ------------------------------------------------------------- FO-1 files drop

const fakeDocument = () => {
  const listeners = {};
  return {
    listeners,
    addEventListener: (type, fn) => { (listeners[type] ??= new Set()).add(fn); },
    removeEventListener: (type, fn) => { listeners[type]?.delete(fn); if (!listeners[type]?.size) delete listeners[type]; },
    fire: (type, event) => { for (const fn of [...(listeners[type] ?? [])]) fn(event); },
  };
};
const fakeElement = (doc = fakeDocument()) => {
  const listeners = {};
  const attributes = new Set();
  return {
    listeners,
    attributes,
    documentListeners: doc.listeners,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
    toggleAttribute: (name, on) => (on ? attributes.add(name) : attributes.delete(name)),
    ownerDocument: doc,
  };
};
const dragEvent = ({types = ['Files'], files = [], items = null} = {}) => {
  const event = {dataTransfer: {types, files, items: items ?? [], dropEffect: ''}, prevented: false, defaultPrevented: false};
  event.preventDefault = () => { event.prevented = true; event.defaultPrevented = true; };
  return event;
};
const settle = () => new Promise((done) => setTimeout(done, 0));

test('FO-1: a drag that carries files is taken -- copy, the over state, one onFiles per drop', async () => {
  const element = fakeElement();
  const given = [];
  const over = [];
  const drop = filesDrop(element, {onFiles: (files) => given.push(files), onOver: (one) => over.push(one)});
  element.listeners.dragenter(dragEvent());
  const held = dragEvent();
  element.listeners.dragover(held);
  assert.equal(held.prevented, true);
  assert.equal(held.dataTransfer.dropEffect, 'copy');
  assert.ok(element.attributes.has(FILES_OVER_ATTRIBUTE));
  // FO1-6: entering a child, then leaving the element for it, is not leaving.
  element.listeners.dragenter(dragEvent());
  element.listeners.dragleave(dragEvent());
  assert.equal(drop.over, true);
  const dropped = dragEvent({files: ['a.png', 'b.png']});
  element.listeners.drop(dropped);
  assert.equal(dropped.prevented, true);
  await settle();
  assert.deepEqual(given, [['a.png', 'b.png']]);
  assert.deepEqual(over, [true, false]);
  assert.equal(element.attributes.has(FILES_OVER_ATTRIBUTE), false);
  drop.stop();
  drop.stop();
  assert.deepEqual(Object.keys(element.listeners), []);
  assert.deepEqual(Object.keys(element.documentListeners), []);
});

test('FO-1: text or a row dragged across passes on; a disabled element says no and gives nothing', async () => {
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
  await settle();
  assert.deepEqual(given, []);
});

test('FO1-1: zones inside zones -- the innermost takes the drop, the outer gives nothing', async () => {
  const doc = fakeDocument();
  const outer = fakeElement(doc);
  const inner = fakeElement(doc);
  const given = [];
  filesDrop(outer, {onFiles: (files) => given.push(['outer', files])});
  filesDrop(inner, {onFiles: (files) => given.push(['inner', files])});
  // The event bubbles: the inner zone first, the outer one after it.
  const held = dragEvent();
  inner.listeners.dragover(held);
  outer.listeners.dragover(held);
  assert.ok(inner.attributes.has(FILES_OVER_ATTRIBUTE));
  assert.equal(outer.attributes.has(FILES_OVER_ATTRIBUTE), false);
  const dropped = dragEvent({files: ['a.png']});
  inner.listeners.drop(dropped);
  outer.listeners.drop(dropped);
  await settle();
  assert.deepEqual(given, [['inner', ['a.png']]]);
});

test('FO1-2: a file dropped beside every zone does not open in the tab while a zone is on the page', () => {
  const doc = fakeDocument();
  const one = filesDrop(fakeElement(doc), {});
  const two = filesDrop(fakeElement(doc), {});
  const beside = dragEvent({files: ['a.png']});
  doc.fire('dragover', beside);
  assert.equal(beside.prevented, true);
  assert.equal(beside.dataTransfer.dropEffect, 'none');
  const text = dragEvent({types: ['text/plain']});
  doc.fire('drop', text);
  assert.equal(text.prevented, false);
  one.stop();
  const still = dragEvent();
  doc.fire('drop', still);
  assert.equal(still.prevented, true);
  two.stop();
  // The last zone gone, the document is the browser's again.
  assert.deepEqual(Object.keys(doc.listeners), []);
});

test('FO1-4: the target under the pointer takes the files; null takes nothing there', async () => {
  const element = fakeElement();
  const given = [];
  const over = [];
  let under = 'folder-a';
  filesDrop(element, {target: () => under, onOver: (one, node) => over.push([one, node]), onFiles: (files, {target}) => given.push([target, files])});
  element.listeners.dragover(dragEvent());
  under = null;
  const refused = dragEvent();
  element.listeners.dragover(refused);
  assert.equal(refused.prevented, false);
  under = 'folder-b';
  element.listeners.drop(dragEvent({files: ['a.png']}));
  await settle();
  assert.deepEqual(over, [[true, 'folder-a'], [false, null]]);
  assert.deepEqual(given, [['folder-b', ['a.png']]]);
});

const folderItem = (name, children) => ({
  kind: 'file',
  getAsFile: () => null,
  webkitGetAsEntry: () => folderEntry(name, children),
});
const folderEntry = (name, children) => ({
  name,
  isDirectory: true,
  isFile: false,
  createReader: () => {
    let sent = false;
    return {readEntries: (done) => { const batch = sent ? [] : children; sent = true; done(batch); }};
  },
});
const fileEntry = (name) => ({name, isFile: true, isDirectory: false, file: (done) => done({name})});

test('FO1-5: a dropped folder gives its files (open) or is named in skipped (skip)', async () => {
  const children = [fileEntry('a.txt'), folderEntry('deep', [fileEntry('b.txt')])];
  const open = fakeElement();
  const opened = [];
  filesDrop(open, {onFiles: (files, {skipped}) => opened.push([files.map((file) => file.name).sort(), skipped])});
  open.listeners.drop(dragEvent({files: [{name: 'docs'}], items: [folderItem('docs', children)]}));
  await settle();
  await settle();
  assert.deepEqual(opened, [[['a.txt', 'b.txt'], []]]);
  const skip = fakeElement();
  const skippedGiven = [];
  filesDrop(skip, {folders: 'skip', onFiles: (files, {skipped}) => skippedGiven.push([files, skipped])});
  skip.listeners.drop(dragEvent({files: [{name: 'docs'}], items: [folderItem('docs', children)]}));
  await settle();
  assert.deepEqual(skippedGiven, [[[], ['docs']]]);
});

test('FO-1: the drag words follow C223 -- no words about dragging on a screen with no fine pointer', () => {
  assert.equal(NO_DRAG_QUERY, '(pointer: coarse) and (not (any-pointer: fine))');
  assert.equal(filesDragWords({matchMedia: (query) => ({matches: query === NO_DRAG_QUERY})}), false);
  assert.equal(filesDragWords({matchMedia: () => ({matches: false})}), true);
  assert.equal(filesDragWords({}), true);
  // The file field's sheet hides the words by the same query.
  assert.ok(read('src/component/file-upload/scss/_css__file_upload.scss').includes(`@media ${NO_DRAG_QUERY}`));
});

test('FO-1, FO1-4: five Framework places read file drops through the one core part', () => {
  for (const path of ['src/component/file-upload/js/_file_upload.js', 'src/smart/file-upload/index.js', 'src/smart/input-image/index.js', 'src/smart/tree/index.js', 'src/smart/input-rich/index.js']) {
    const source = read(path);
    assert.match(source, /import \{[^}]*filesDrop[^}]*\} from '[./]+\/core\/js\/files-drop(?:\.js)?';/u, path);
    // The tree's rows and the editor's text keep their own drop; files are not theirs.
    if (!/tree|input-rich/u.test(path)) assert.doesNotMatch(source, /addEventListener\('drop'/u, path);
  }
  assert.match(read('src/smart/tree/index.js'), /kind === 'files'\) return/u);
  assert.match(read('src/smart/input-rich/index.js'), /this\._dragFromSelf \|\| carriesFiles\(event\)/u);
  assert.doesNotMatch(read('src/smart/input-image/js/templates/default.js'), /@drop=/u);
});

// ------------------------------------------------------------- FO-3 field conditions

test('FO3-1: a hidden field is not sent; a host error for it is said in the summary by its label', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /get value\(\) \{\s*return this\.sendable\(this\._values\);/u);
  assert.match(form, /if \(field\.when && fieldConditions\(field, values\)\.visible === false\) delete out\[field\.key\];/u);
  assert.match(form, /hiddenHostErrors\(\)/u);
  // The summary counts every error it lists, the hidden field's too.
  assert.match(form, /errorsTitle: word\('errors-title', \{count: errors\.length \+ hiddenErrors\.length\}\)/u);
  assert.match(read('src/smart/form/js/templates/default.js'), /error\.href \? html`<li><a href=\$\{error\.href\}/u);
  assert.match(json('src/smart/form/component.json').events.submit.summary, /not sent, FO3-1/u);
});

test('FO3-4: a single-field edit asks the conditions -- hidden or disabled by them, it does not open', () => {
  const field = {key: 'address', when: {visible: {field: 'delivery', op: 'eq', value: 'courier'}, enabled: {field: 'locked', op: 'empty'}}};
  assert.equal(fieldEditable(field, {delivery: 'courier'}), true);
  assert.equal(fieldEditable(field, {delivery: 'pickup'}), false);
  assert.equal(fieldEditable(field, {delivery: 'courier', locked: 'yes'}), false);
  assert.equal(fieldEditable({...field, readonly: true}, {delivery: 'courier'}), false);
  assert.equal(fieldEditable({key: 'plain'}, {}), true);
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /if \(field\?\.when && options\?\.values && typeof options\.values === "object"\) \{\s*const decided = fieldConditions\(field, options\.values\);\s*if \(!decided\.visible\) return null;/u);
  assert.match(renderers, /editable: fieldEditable\}/u);
});


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

test('FO-4, FO4-2: an option carries an avatar, an icon and one colour; swatch and scheme are former names of color with their look', () => {
  const [avatar, swatch, badge, bad, both, icon] = normaliseItems([
    {value: 'ann', label: 'Анна', avatar: 'https://example.test/a.png'},
    {value: 'red', label: 'Красный', swatch: '#e53935'},
    {value: 'new', label: 'Новый', scheme: 'primary'},
    {value: 'x', swatch: 'url(javascript:alert(1))'},
    {value: 'y', color: 'teal', scheme: 'error'},
    {value: 'z', icon: 'folder'},
  ]);
  assert.deepEqual(avatar.avatar, {image: 'https://example.test/a.png', text: ''});
  assert.deepEqual([swatch.color, swatch.look], ['#e53935', 'dot']);
  assert.deepEqual([badge.color, badge.look], ['primary', 'badge']);
  assert.equal(bad.color, '');
  assert.deepEqual([both.color, both.look], ['teal', '']);
  assert.equal(icon.icon, 'folder');
  // The field's option-look wins; else the former key's look; else the default (q-fo4-colour).
  assert.deepEqual(OPTION_LOOKS, ['badge', 'dot']);
  assert.equal(optionLook(swatch, 'badge'), 'badge');
  assert.equal(optionLook(swatch, ''), 'dot');
  assert.equal(optionLook(both, ''), DEFAULT_OPTION_LOOK);
});

test('FO4-5: chosen first when the list opens; the order does not move while it is open', () => {
  const items = normaliseItems([{value: 'a'}, {value: 'b'}, {value: 'c'}, {value: 'd'}]);
  assert.deepEqual(chosenFirst(items, new Set(['c', 'a'])).map((one) => one.value), ['a', 'c', 'b', 'd']);
  assert.deepEqual(chosenFirst(items, new Set()).map((one) => one.value), ['a', 'b', 'c', 'd']);
  const element = read('src/smart/input-choice/index.js');
  assert.match(element, /this\._opened \?\?= new Set\(this\.selected\);/u);
  assert.match(element, /onDisconnected\(\) \{\s*super\.onDisconnected\?\.\(\);\s*this\._opened = null;/u);
});

test('FO4-1, FO4-3, FO4-4: visuals in both appearances and in the dropdown; the next page loads at the list\'s end', () => {
  const template = read('src/smart/input-choice/js/templates/default.js');
  assert.match(template, /renderVisual\(context, item, \{icon: false\}\)/u);
  assert.match(template, /if \(icon && item\.icon\) return html`<span class="sf-icon sf-choice-icon"/u);
  assert.match(template, /<span class="sf-choice-end" data-sf-more aria-hidden="true"><\/span>/u);
  assert.match(read('src/smart/input-choice/index.js'), /new Observer\(\(entries\) => \{/u);
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /\? \{type: 'avatar', avatarImageUrl: picture, avatarTitle: text\}\s*: option\.icon \? \{type: 'icon', icon: String\(option\.icon\)\} : \{type: 'text'\};/u);
  assert.match(renderers, /option-look=\$\{optionLookOf\(field\) \|\| nothing\}/u);
  assert.equal(json('src/smart/input-choice/component.json').settings['option-look'].values.join(), 'badge,dot');
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
  assert.match(source, /if \(!sheet\) frame\.anchor = anchor;/u);
  assert.doesNotMatch(source, /sf-table|sf-view-table/u);
  const en = json('src/smart/field-renderers/lang/en.json').runtime;
  const ru = json('src/smart/field-renderers/lang/ru.json').runtime;
  assert.equal(en.filterApply, 'Apply');
  assert.equal(en.filterReset, 'Reset');
  assert.equal(ru.filterApply, 'Применить');
  assert.equal(ru.filterReset, 'Сбросить');
});

test('FO5-1..FO5-4: «Применить (N)», a bottom sheet on a phone, on the body like the menu, the reopen guard without a timer', () => {
  const source = read('src/smart/field-renderers/filter-window.js');
  assert.match(source, /return count \? `\$\{word\('filterApply', anchor\)\} \(\$\{count\}\)` : word\('filterApply', anchor\);/u);
  assert.match(source, /frame = doc\.createElement\('sf-drawer'\);\s*frame\.setAttribute\('placement', 'bottom'\);\s*frame\.setAttribute\('heading', label\);/u);
  assert.match(source, /foot\.setAttribute\('slot', 'footer'\);/u);
  assert.match(source, /\(anchor\.closest\?\.\('dialog\[open\]'\) \|\| doc\.body\)\.append\(surface\);/u);
  assert.match(source, /followDensity\(surface, anchor\);/u);
  assert.doesNotMatch(source, /anchor\.after\(|Date\.now\(\)|< 500/u);
  assert.match(source, /doc\.addEventListener\('pointerdown', clear, true\);\s*doc\.addEventListener\('keydown', clear, true\);/u);
  // The popover's hide rule outranks a page's own display class on the content.
  assert.match(read('src/smart/popover/js/templates/default.css'), /sf-popover\[data-open='false'\] > \[slot='content'\] \{\s*display: none !important;/u);
});

test('FO-5: sf-popover opens from an anchor given as a property and places itself against it', () => {
  const popover = read('src/smart/popover/index.js');
  assert.match(popover, /get _reference\(\)/u);
  assert.match(popover, /anchorFloating\(reference/u);
  const component = json('src/smart/popover/component.json');
  const settings = component.settings ?? component.properties ?? {};
  assert.ok(settings.anchor, 'anchor setting');
});
