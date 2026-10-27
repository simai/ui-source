import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Dated aliases (standard simai.smart-component 1.3.8 §16.20, vocabulary
// 1.1.5 §9): core/js/aliases.js on an element without a DOM. The first group
// is stand 18's alias suite (stands/18-aliases-ci/test-alias.mjs) on the
// module the Framework ships; the rest covers attributes, properties,
// actions, values, expiry and the table's checks. The browser half, on a real
// sf-accordion and sf-menu, is tests/browser/aliases.browser.mjs.

const moduleUrl = new URL('../src/core/js/aliases.js', import.meta.url);
const {installAliases, uninstallAliases, dispatchAliased, setAliasClock, readAliasTable, aliasExpired} = await import(moduleUrl);
const {clearDeprecations, listDeprecations, noteDeprecated} = await import('../src/core/js/deprecations.js');
const vocabulary = JSON.parse(readFileSync(new URL('./fixtures/aliases-vocabulary-1.1.5.json', import.meta.url), 'utf8'));

const IN_WINDOW = Date.parse('2026-11-15T12:00:00Z');
const AFTER = Date.parse('2026-12-02T00:00:01Z');

class FakeElement extends EventTarget {
  constructor(localName = 'sf-x') {
    super();
    this.localName = localName;
    this.attrs = new Map();
    this.heard = [];
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(String(name).toLowerCase(), String(value)); this.heard.push(['set', name, String(value)]); }
  removeAttribute(name) { this.attrs.delete(name); this.heard.push(['remove', name]); }
  toggleAttribute(name, force) {
    const want = force === undefined ? !this.hasAttribute(name) : Boolean(force);
    if (want) this.setAttribute(name, ''); else this.removeAttribute(name);
    return want;
  }
}

function fresh(localName, table = vocabulary, options) {
  const element = new FakeElement(localName);
  const handle = installAliases(element, table, options);
  return {element, handle};
}

const events = () => listDeprecations().filter((note) => note.kind === 'event');
const row = (fields) => ({since: '2026-10-26', remove_after: '2026-12-01', ...fields});

function captureWarnings(run) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try { run(); } finally { console.warn = warn; }
  return warnings;
}

test.beforeEach(() => {
  clearDeprecations();
  setAliasClock(() => IN_WINDOW);
  delete globalThis.SF.aliases.strict;
});

// --- stand 18 -----------------------------------------------------------------

test('stand 18: the vocabulary table installs; split rows without an adapter are refused', () => {
  const {handle} = fresh('sf-menu');
  assert.ok(handle.installed > 40, `installed ${handle.installed}`);
  assert.ok(handle.refused.some((one) => one.from === 'sf-table-action-intent' && one.reason === 'needs-adapter'));
  assert.ok(handle.refused.some((one) => one.from === 'input' && one.reason === 'no-new-name'));
  // modal:after-hide and modal:after-show both fold into change by detail.
  assert.ok(handle.refused.some((one) => one.from === 'modal:after-hide' && one.reason === 'needs-when'));
});

test('stand 18: both names receive, the new one first, one detail object; allowed when nobody refuses', () => {
  const {element} = fresh('sf-menu');
  const seen = [];
  element.addEventListener('sf-menu:navigate', (event) => seen.push(['old', event.type, event.detail]));
  element.addEventListener('sf-menu-navigate', (event) => seen.push(['new', event.type, event.detail]));
  const detail = {href: '/a', id: 'a'};
  const allowed = dispatchAliased(element, 'sf-menu-navigate', {detail, cancelable: true});
  assert.deepEqual(seen.map(([who, type]) => `${who}:${type}`), ['new:sf-menu-navigate', 'old:sf-menu:navigate']);
  assert.ok(seen.every(([, , one]) => one === detail), 'one detail object, not a copy');
  assert.equal(allowed, true);
});

test('stand 18: preventDefault on the old name cancels the new one', () => {
  const {element} = fresh('sf-menu');
  element.addEventListener('sf-menu:navigate', (event) => event.preventDefault());
  let newEvent = null;
  element.addEventListener('sf-menu-navigate', (event) => { newEvent = event; });
  const allowed = dispatchAliased(element, 'sf-menu-navigate', {detail: {id: 'b'}, cancelable: true});
  assert.deepEqual([allowed, newEvent.defaultPrevented], [false, true]);
});

test('stand 18: preventDefault on the new name is seen by the old listener at once', () => {
  const {element} = fresh('sf-menu');
  let oldSaw = null;
  element.addEventListener('sf-menu-navigate', (event) => event.preventDefault());
  element.addEventListener('sf-menu:navigate', (event) => { oldSaw = event.defaultPrevented; });
  assert.deepEqual([dispatchAliased(element, 'sf-menu-navigate', {detail: {}, cancelable: true}), oldSaw], [false, true]);
});

test('stand 18: a non-cancelable fact cannot be refused through either name', () => {
  const {element} = fresh('sf-accordion');
  element.addEventListener('sf-accordion:toggle', (event) => event.preventDefault());
  assert.equal(dispatchAliased(element, 'sf-accordion-toggle', {detail: {id: 's1', open: true}}), true);
});

test('stand 18: the journal holds one record per name, a use per dispatch that reached a listener, with its dates', () => {
  const {element} = fresh('sf-menu');
  const onOld = () => {};
  element.addEventListener('sf-menu:navigate', (event) => onOld(event.detail));
  for (const id of ['a', 'b', 'c']) dispatchAliased(element, 'sf-menu-navigate', {detail: {id}, cancelable: true});
  const notes = events().filter((note) => note.from === 'sf-menu:navigate');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].count, 3);
  const {component, tag, kind, to, since, remove_after: removeAfter} = notes[0];
  assert.deepEqual({component, tag, kind, to, since, removeAfter}, {component: 'sf-menu', tag: 'sf-menu', kind: 'event', to: 'sf-menu-navigate', since: '2026-10-26', removeAfter: '2026-12-01'});
  assert.equal(notes[0].expired, undefined);
});

test('stand 18: an old event nobody listens to is not a use', () => {
  const {element} = fresh('sf-menu');
  element.addEventListener('sf-menu-navigate', (event) => event.detail);
  dispatchAliased(element, 'sf-menu-navigate', {detail: {}, cancelable: true});
  assert.deepEqual(events(), []);
});

test('stand 18: a native close elsewhere is not noted; sf-tag-close reaches a close listener once and is noted', () => {
  const dialog = new FakeElement('dialog');
  dialog.addEventListener('close', (event) => event.target);
  dialog.dispatchEvent(new Event('close'));
  assert.equal(events().some((note) => note.from === 'close'), false);
  const {element: tag} = fresh('sf-tag');
  let old = 0;
  tag.addEventListener('close', (event) => { old += 1; return event.detail; });
  dispatchAliased(tag, 'sf-tag-close', {detail: {value: 'x'}});
  assert.equal(old, 1);
  assert.ok(events().some((note) => note.from === 'close' && note.to === 'sf-tag-close'));
});

test('stand 18 (decision): after remove_after the old name is still delivered, noted expired and warned without an opt-in', () => {
  const {element} = fresh('sf-code-input');
  setAliasClock(() => AFTER);
  let late = 0;
  let current = 0;
  element.addEventListener('sf-code-input:complete', (event) => { late += 1; return event.detail; });
  element.addEventListener('sf-code-input-complete', () => { current += 1; });
  const warnings = captureWarnings(() => {
    dispatchAliased(element, 'sf-code-input-complete', {detail: {value: '1234'}});
    dispatchAliased(element, 'sf-code-input-complete', {detail: {value: '5678'}});
  });
  assert.deepEqual([current, late], [2, 2]);
  const note = events().find((one) => one.from === 'sf-code-input:complete');
  assert.equal(note.expired, true);
  assert.equal(warnings.filter((text) => text.includes('sf-code-input:complete') && text.includes('due to leave after 2026-12-01')).length, 1, 'printed once');
});

test('stand 18: under strict mode an expired old name is not sent', () => {
  const {element} = fresh('sf-code-input');
  setAliasClock(() => AFTER);
  globalThis.SF.aliases.strict = true;
  let late = 0;
  let current = 0;
  element.addEventListener('sf-code-input:complete', () => { late += 1; });
  element.addEventListener('sf-code-input-complete', () => { current += 1; });
  dispatchAliased(element, 'sf-code-input-complete', {detail: {value: '1'}});
  assert.deepEqual([current, late], [1, 0]);
});

test('stand 18: two copies of the modules note into the one journal beside the undated notes', async () => {
  const other = await import(`${moduleUrl}?bundle=menu`);
  const otherNotes = await import(`${new URL('../src/core/js/deprecations.js', import.meta.url)}?bundle=menu`);
  noteDeprecated({component: 'sf-button', attribute: 'type', from: 'type', to: 'appearance'});
  const element = new FakeElement('sf-menu');
  other.installAliases(element, vocabulary);
  element.addEventListener('sf-menu:navigate', (event) => event.detail);
  dispatchAliased(element, 'sf-menu-navigate', {detail: {}});
  const all = otherNotes.listDeprecations();
  assert.ok(all.some((note) => note.kind === 'event' && note.from === 'sf-menu:navigate'));
  assert.ok(all.some((note) => note.kind === 'attribute' && note.from === 'type'));
  assert.equal(globalThis.SF.aliases.install, installAliases, 'the first copy keeps SF.aliases');
});

// --- today's components: the old name sent by the component ---------------------

test('a component that still sends the old name has the new one sent first, and its own event shares the cancel', () => {
  const {element} = fresh('sf-menu');
  const order = [];
  element.addEventListener('sf-menu-navigate', (event) => { order.push('new'); event.preventDefault(); });
  element.addEventListener('sf-menu:navigate', (event) => { order.push(`old:${event.defaultPrevented}`); });
  const own = new CustomEvent('sf-menu:navigate', {bubbles: true, composed: true, cancelable: true, detail: {id: 'a'}});
  const allowed = element.dispatchEvent(own);
  assert.deepEqual(order, ['new', 'old:true']);
  assert.equal(allowed, false);
  assert.equal(own.defaultPrevented, true, 'the component reads its own event');
});

test('an old name with several new names, or with a larger new detail, is not promoted', () => {
  const {element} = fresh('sf-table');
  const seen = [];
  element.addEventListener('sf-table-save', () => seen.push('new'));
  element.addEventListener('sf-table-cell-set', () => seen.push('old'));
  element.dispatchEvent(new CustomEvent('sf-table-cell-set', {detail: {id: 1}}));
  assert.deepEqual(seen, ['old']);
  dispatchAliased(element, 'sf-table-save', {detail: {id: 1, values: {}, revision: 2}});
  assert.deepEqual(seen, ['old', 'new', 'old'], 'detail-adds: the new, larger detail reaches the old name');
});

test('when picks the old name of a folded event; a split row takes an adapter', () => {
  const table = [
    row({kind: 'event', from: 'modal:after-hide', to: 'change', mode: 'detail-adds', when: {minimized: true}}),
    row({kind: 'event', from: 'modal:after-show', to: 'change', mode: 'detail-adds', when: {minimized: false}}),
    row({kind: 'event', from: 'sf-table-action-intent', to: 'sf-table-apply', mode: 'split'}),
  ];
  const element = new FakeElement('sf-modal');
  const handle = installAliases(element, table, {adapters: {'sf-table-action-intent': (detail) => (detail.action ? {action_id: detail.action} : undefined)}});
  assert.equal(handle.installed, 3);
  const seen = [];
  for (const name of ['modal:after-hide', 'modal:after-show', 'sf-table-action-intent']) element.addEventListener(name, (event) => seen.push([name, event.detail]));
  dispatchAliased(element, 'change', {detail: {minimized: true}});
  dispatchAliased(element, 'sf-table-apply', {detail: {action: 'archive'}});
  dispatchAliased(element, 'sf-table-apply', {detail: {}});
  assert.deepEqual(seen, [['modal:after-hide', {minimized: true}], ['sf-table-action-intent', {action_id: 'archive'}]]);
});

// --- settings, attributes, properties --------------------------------------------

test('an old attribute writes the new one; the new one updates the old one the page still has; no loops', () => {
  const element = new FakeElement('sf-modal');
  element.backdropBlur = '';
  installAliases(element, [row({kind: 'setting', from: 'blur', to: 'backdrop-blur'})]);
  element.setAttribute('blur', '8');
  assert.equal(element.getAttribute('backdrop-blur'), '8');
  element.setAttribute('backdrop-blur', '4');
  assert.equal(element.getAttribute('blur'), '4', 'kept in step while the page has it');
  element.setAttribute('backdrop-blur', '4');
  assert.equal(element.heard.filter(([op, name]) => op === 'set' && name === 'blur').length, 2, 'an equal value is not written again');
  element.removeAttribute('blur');
  assert.equal(element.hasAttribute('backdrop-blur'), false);
  element.setAttribute('backdrop-blur', '2');
  assert.equal(element.hasAttribute('blur'), false, 'a page that never wrote the old name does not get it');
  element.toggleAttribute('blur', true);
  assert.equal(element.getAttribute('backdrop-blur'), '');
  const note = listDeprecations().find((one) => one.from === 'blur');
  assert.deepEqual([note.kind, note.attribute, note.to, note.remove_after], ['setting', 'blur', 'backdrop-blur', '2026-12-01']);
  assert.equal(note.count, 3, 'set, remove, toggle');
});

test('the markup at install: an old attribute fills the new one, and a new one the page also wrote wins', () => {
  const one = new FakeElement('sf-x');
  one.attrs.set('prefix', '₽');
  installAliases(one, [row({kind: 'attribute', from: 'prefix', to: 'prefix-text'})]);
  assert.equal(one.getAttribute('prefix-text'), '₽');
  const two = new FakeElement('sf-x');
  two.attrs.set('prefix', 'old');
  two.attrs.set('prefix-text', 'new');
  installAliases(two, [row({kind: 'attribute', from: 'prefix', to: 'prefix-text'})]);
  assert.equal(two.getAttribute('prefix-text'), 'new');
  assert.equal(listDeprecations().find((note) => note.from === 'prefix').count, 2);
});

test('a setting\'s old property reads and writes the new one; a value set before install moves over', () => {
  const element = new FakeElement('sf-x');
  element.spellCheck = false;
  element.prefix = 'early';
  element.prefixText = '';
  installAliases(element, [
    row({kind: 'setting', from: 'prefix', to: 'prefix-text'}),
    row({kind: 'setting', from: 'heading-old', to: 'heading'}),
  ]);
  assert.equal(element.prefixText, 'early');
  element.prefix = '$';
  assert.equal(element.prefixText, '$');
  element.prefixText = '€';
  assert.equal(element.prefix, '€', 'both ways, one value, no copy to loop on');
  assert.equal(Object.keys(element).includes('prefix'), false, 'not enumerable');
});

test('a property the new name does not have yet, or that the browser\'s element owns, is refused; the attribute still maps', () => {
  const element = new FakeElement('sf-x');
  const handle = installAliases(element, [
    row({kind: 'setting', from: 'heading-old', to: 'heading'}),
    row({kind: 'setting', from: 'dispatch-event', to: 'dispatch-it'}),
  ]);
  assert.deepEqual(handle.refused.map((one) => [one.from, one.reason]), [['heading-old', 'no-new-property'], ['dispatch-event', 'native-member']]);
  element.setAttribute('heading-old', 'A');
  assert.equal(element.getAttribute('heading'), 'A');
});

test('an old value of a setting is written with the new one', () => {
  const element = new FakeElement('sf-button');
  element.attrs.set('appearance', 'outline');
  installAliases(element, [row({kind: 'value', setting: 'appearance', from: 'outline', to: 'outlined'})]);
  assert.equal(element.getAttribute('appearance'), 'outlined');
  element.setAttribute('appearance', 'outline');
  assert.equal(element.getAttribute('appearance'), 'outlined');
  const note = listDeprecations().find((one) => one.kind === 'value');
  assert.deepEqual([note.attribute, note.from, note.to, note.count], ['appearance', 'outline', 'outlined', 2]);
});

// --- actions -----------------------------------------------------------------------

test('an old action calls the new one with its arguments and answers its result', () => {
  const element = new FakeElement('sf-x');
  element.rerender = function rerender(reason) { return `rerendered:${reason}:${this === element}`; };
  const handle = installAliases(element, [
    row({kind: 'action', from: 'refresh', to: 'rerender'}),
    row({kind: 'action', from: 'detachOld', to: 'detach'}),
    row({kind: 'action', from: 'addEventListener', to: 'listen'}),
  ]);
  assert.equal(element.refresh('data'), 'rerendered:data:true');
  assert.deepEqual(handle.refused.map((one) => [one.from, one.reason]), [['detachOld', 'no-new-action'], ['addEventListener', 'native-member']]);
  assert.equal(listDeprecations().find((one) => one.kind === 'action').to, 'rerender');
});

test('expired members keep working, noted expired; under strict mode they are gone', () => {
  const element = new FakeElement('sf-x');
  element.rerender = () => 'ok';
  element.heading = '';
  installAliases(element, [
    row({kind: 'action', from: 'refresh', to: 'rerender'}),
    row({kind: 'setting', from: 'title-old', to: 'heading'}),
  ]);
  setAliasClock(() => AFTER);
  captureWarnings(() => {
    assert.equal(element.refresh(), 'ok');
    element.titleOld = 'A';
    assert.equal(element.heading, 'A');
  });
  assert.ok(listDeprecations().every((note) => note.expired === true));
  globalThis.SF.aliases.strict = true;
  assert.throws(() => element.refresh(), /refresh\(\) was removed after 2026-12-01; call rerender\(\)/u);
  element.titleOld = 'B';
  assert.equal(element.heading, 'A');
  assert.equal(element.titleOld, undefined);
  element.setAttribute('title-old', 'C');
  assert.equal(element.getAttribute('heading'), null, 'the old attribute is inert');
});

// --- lifecycle ------------------------------------------------------------------

test('uninstall and an aborted signal take every wrapper and accessor away', () => {
  const element = new FakeElement('sf-menu');
  element.rerender = () => 'ok';
  const controller = new AbortController();
  installAliases(element, [...vocabulary.aliases, row({kind: 'action', from: 'refresh', to: 'rerender'}), row({kind: 'attribute', from: 'a-old', to: 'a-new'})], {signal: controller.signal});
  assert.ok(Object.hasOwn(element, 'dispatchEvent'));
  controller.abort();
  for (const name of ['dispatchEvent', 'setAttribute', 'removeAttribute', 'toggleAttribute', 'refresh']) assert.equal(Object.hasOwn(element, name), false, name);
  let old = 0;
  element.addEventListener('sf-menu:navigate', () => { old += 1; });
  dispatchAliased(element, 'sf-menu-navigate', {detail: {}});
  assert.equal(old, 0);
  assert.equal(uninstallAliases(element), false);
  const second = installAliases(new FakeElement('sf-x'), vocabulary, {signal: AbortSignal.abort()});
  assert.equal(second.installed, 0);
});

test('installing again replaces the table instead of wrapping twice', () => {
  const element = new FakeElement('sf-menu');
  installAliases(element, vocabulary);
  installAliases(element, vocabulary);
  let old = 0;
  element.addEventListener('sf-menu:navigate', () => { old += 1; });
  dispatchAliased(element, 'sf-menu-navigate', {detail: {}});
  assert.equal(old, 1);
});

// --- the table ------------------------------------------------------------------------

test('the table: every row is checked and refused with a reason, never thrown', () => {
  const {rows, refused, tag} = readAliasTable({tag: 'sf-x', aliases: [
    row({kind: 'event', from: 'a:b', to: 'sf-x-b'}),
    row({kind: 'wire', from: 'a', to: 'b'}),
    row({kind: 'event', from: 'c', to: null}),
    row({kind: 'event', from: 'd', to: 'd'}),
    row({kind: 'event', from: 'e', to: 'f', since: '2026-02-30'}),
    row({kind: 'event', from: 'e', to: 'f', remove_after: '2026-10-01'}),
    row({kind: 'event', from: 'e', to: 'f', mode: 'rename'}),
    row({kind: 'setting', from: 'a', to: 'b', mode: 'split'}),
    row({kind: 'setting', from: 'Bad', to: 'b'}),
    row({kind: 'value', from: 'x', to: 'y'}),
    row({kind: 'attribute', from: 'p', to: 'q', setting: 'z'}),
    row({kind: 'action', from: 'go-on', to: 'run'}),
    row({kind: 'event', from: 'a:b', to: 'sf-x-b'}),
    row({kind: 'attribute', from: 'm', to: 'n'}),
    row({kind: 'setting', from: 'm', to: 'o'}),
    row({kind: 'event', from: 'g', to: 'h', when: {open: [1]}}),
    'row',
  ]});
  assert.equal(tag, 'sf-x');
  assert.deepEqual(rows.map((one) => one.from), ['a:b', 'm']);
  assert.equal(rows[0].tag, 'sf-x');
  assert.equal(rows[0].mode, 'same-detail');
  assert.ok(Object.isFrozen(rows[0]));
  assert.deepEqual(refused.map((one) => one.reason), [
    'unknown-kind', 'no-new-name', 'same-name', 'bad-since', 'remove-after-before-since', 'unknown-mode',
    'mode-on-non-event', 'bad-attribute-name', 'value-needs-setting', 'setting-on-non-value', 'bad-member-name',
    'duplicate', 'conflict', 'bad-when', 'not-an-object',
  ]);
  assert.deepEqual(readAliasTable(null).refused.map((one) => one.reason), ['not-a-table']);
});

test('remove_after is the last promised day, whole, in UTC', () => {
  const one = row({kind: 'event', from: 'a', to: 'b'});
  assert.equal(aliasExpired(one, Date.parse('2026-12-01T23:59:59.999Z')), false);
  assert.equal(aliasExpired(one, Date.parse('2026-12-02T00:00:00Z')), true);
  assert.equal(globalThis.SF.aliases.expired(one, Date.parse('2026-12-02T00:00:00Z')), true);
});

test('an undated note keeps the record shape it always had', () => {
  noteDeprecated({component: 'sf-button', attribute: 'type', from: 'type', to: 'appearance'});
  assert.deepEqual(listDeprecations(), [{component: 'sf-button', kind: 'attribute', attribute: 'type', from: 'type', to: 'appearance', count: 1}]);
});
