import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// An element from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §4.1, §4.4, §7.7, §8, §11, §11.1): core/js/element-manifest.js on
// an element without a DOM. The browser half runs on the built switch
// (tests/browser/switch-manifest.browser.mjs).

const {elementFromManifest, readManifest, propsFromManifest, eventName, toOutcome} = await import('../src/core/js/element-manifest.js');
const {pageWord, language} = await import('../src/core/js/page-language.js');
const {clearDeprecations, listDeprecations} = await import('../src/core/js/deprecations.js');
const {setAliasClock} = await import('../src/core/js/aliases.js');

class FakeBase extends EventTarget {
  static get props() { return {base: {default: ''}}; }
  constructor() {
    super();
    this.localName = 'sf-thing';
    this.attrs = new Map();
    this.isConnected = false;
    this.updates = [];
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  closest() { return null; }
  requestComponentUpdate(reason) { this.updates.push(reason); }
  connectedCallback() { this.isConnected = true; }
  get sfScope() { return (this.scope ??= new AbortController()).signal; }
}

const manifest = {
  id: 'smart.thing',
  tag: 'sf-thing',
  version: '1.0.0',
  kind: 'leaf',
  settings: {
    size: {type: 'enum', values: ['1', '2'], default: '1'},
    label: {type: 'string', default: ''},
    count: {type: 'number', default: 3},
    disabled: {type: 'boolean', default: false},
    rows: {type: 'list', default: []},
    'close-label': {type: 'string', 'default-from': 'runtime.close'},
    title: {type: 'string'},
  },
  values: {
    checked: {type: 'boolean', default: false, optional: true},
    'effective-checked': {type: 'boolean'},
  },
  events: {
    change: {carries: 'native'},
    open: {carries: {id: 'id'}},
    close: {cancelable: true},
  },
  actions: {
    open: {with: {id: 'id'}},
    close: {emits: 'close'},
    load: {},
    nothing: {},
  },
  form: {value: 'checked', name: 'name', submits: 'label', disabled: 'disabled'},
  'host-states': {'data-inherited': 'boolean'},
};
const lang = {
  en: {title: 'Thing', runtime: {close: 'Close', rows: {one: '{n} row', other: '{n} rows'}, only: 'only English'}},
  ru: {title: 'Штука', runtime: {close: 'Закрыть', rows: {one: '{n} строка', few: '{n} строки', many: '{n} строк', other: '{n} строки'}, native: 'родное'}},
};

function make(options = {}) {
  const Thing = elementFromManifest(manifest, {base: FakeBase, lang, ...options});
  return {Thing, element: new Thing()};
}

test('the DOM name of an event follows its verb (§8)', () => {
  assert.equal(eventName(manifest, 'change'), 'change');
  // change and input keep the browser's names when they carry a detail too.
  const detailed = {tag: 'sf-thing', events: {change: {carries: {value: 'string'}}, input: {carries: {value: 'string'}}}};
  assert.equal(eventName(detailed, 'change'), 'change');
  assert.equal(eventName(detailed, 'input'), 'input');
  // A component that is no value control keeps <tag>-change (sf-tabs, sf-steps, sf-pagination).
  const own = {tag: 'sf-thing', events: {change: {'x-native': false, carries: {current: 'number'}}}};
  assert.equal(eventName(own, 'change'), 'sf-thing-change');
  assert.equal(eventName(manifest, 'open'), 'sf-thing-open');
  assert.equal(eventName(manifest, 'close'), 'sf-thing-close');
});

test('reserved and prototype names are refused or left to the browser (§3.1)', () => {
  const read = readManifest({tag: 'sf-x', settings: {scope: {}, _x: {}, sfFoo: {}, ok: {}}});
  assert.deepEqual(read.refused.map((one) => one.name), ['scope', '_x', 'sfFoo']);
  assert.deepEqual(read.members.map((one) => one.name), ['ok']);
});

test('settings become typed props for the base, values with a default are writable', () => {
  const props = propsFromManifest(manifest);
  assert.deepEqual(Object.keys(props), ['size', 'label', 'count', 'disabled', 'rows', 'closeLabel', 'title', 'checked']);
  assert.equal(props.disabled.type, Boolean);
  assert.equal(props.count.type, Number);
  assert.equal(props.rows.attribute, false);
  assert.deepEqual(props.size.values, ['1', '2']);
  assert.ok(!('effectiveChecked' in props), 'a shown value is read, not set');
  const {Thing} = make();
  assert.ok('base' in Thing.props, 'the base props are kept');
});

test('attributes and properties: typed reads, writes through the attribute', () => {
  const {element} = make();
  assert.equal(element.size, '1');
  element.setAttribute('size', '7');
  assert.equal(element.size, '1', 'an enum outside its values reads its default');
  element.size = '2';
  assert.equal(element.getAttribute('size'), '2');
  assert.equal(element.count, 3);
  element.setAttribute('count', '12');
  assert.equal(element.count, 12);
  assert.equal(element.disabled, false);
  element.disabled = true;
  assert.equal(element.getAttribute('disabled'), '');
  element.disabled = false;
  assert.equal(element.hasAttribute('disabled'), false);
  // An optional boolean keeps «off» as a value of its own.
  element.checked = false;
  assert.equal(element.getAttribute('checked'), 'false');
  assert.equal(element.checked, false);
  element.checked = true;
  assert.equal(element.checked, true);
  element.checked = null;
  assert.equal(element.hasAttribute('checked'), false);
  // A list lives in a property only.
  element.rows = [1, 2];
  assert.deepEqual(element.rows, [1, 2]);
  assert.equal(element.hasAttribute('rows'), false);
  assert.deepEqual(element.updates.at(-1), 'rows');
  // The read-only value answers its default until the component says more.
  assert.equal(element.effectiveChecked, false);
});

test('a setting defaults to its runtime word, an attribute wins (§11 default-from)', () => {
  const {element} = make();
  assert.equal(element.closeLabel, 'Close');
  element.setAttribute('close-label', 'Done');
  assert.equal(element.closeLabel, 'Done');
});

test('actions take one object or positional arguments and answer an outcome (§4.4)', async () => {
  const calls = [];
  const {element} = make({actions: {
    open(params, {signal}) { calls.push(params); assert.ok(signal); return undefined; },
    close() { return 'busy'; },
    load(params, {signal}) { return new Promise((resolve) => signal.addEventListener('abort', () => resolve('applied'))); },
  }});
  assert.deepEqual(element.open({id: 7}), {outcome: 'applied'});
  assert.deepEqual(element.open(8), {outcome: 'applied'});
  assert.deepEqual(calls, [{id: 7}, {id: 8}]);
  const heard = [];
  element.addEventListener('sf-thing-close', (event) => heard.push(event.cancelable));
  assert.deepEqual(element.close(), {outcome: 'refused', reason: 'busy'});
  assert.deepEqual(heard, [true], 'emits sends its event once, cancelable');
  element.addEventListener('sf-thing-close', (event) => event.preventDefault());
  assert.deepEqual(element.close(), {outcome: 'refused', reason: 'prevented'});
  const waiting = element.load();
  element.scope.abort();
  assert.deepEqual(await waiting, {outcome: 'cancelled'}, 'a removed instance cancels what waits');
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(element.nothing(), {outcome: 'refused', reason: 'not-implemented'});
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(toOutcome(false), {outcome: 'refused', reason: 'refused'});
  assert.deepEqual(toOutcome({outcome: 'conflict', revision: 2}), {outcome: 'conflict', revision: 2});
});

test('events are sent by verb under their DOM name, through the dated aliases', () => {
  clearDeprecations();
  setAliasClock(() => Date.parse('2026-11-01T00:00:00Z'));
  const {element} = make();
  const heard = [];
  element.addEventListener('sf-thing-open', (event) => heard.push(['new', event.detail.id]));
  assert.equal(element.sfEmit('open', {id: 3}), true);
  assert.deepEqual(heard, [['new', 3]]);
  assert.equal(listDeprecations().length, 0);
});

test('host states are the declared ones only (§5.3)', () => {
  const {element} = make();
  element.sfHostState('data-inherited', true);
  assert.equal(element.getAttribute('data-inherited'), 'true');
  element.sfHostState('data-inherited', false);
  assert.equal(element.hasAttribute('data-inherited'), false);
  const warn = console.warn;
  const said = [];
  console.warn = (text) => said.push(text);
  try {
    element.sfHostState('data-other', true);
  } finally {
    console.warn = warn;
  }
  assert.equal(element.hasAttribute('data-other'), false);
  assert.match(said[0], /not declared/);
});

test('base values: started on connect, shown follows hidden containers (§4.1)', () => {
  const {element} = make();
  assert.equal(element.started, false);
  element.connectedCallback();
  assert.equal(element.started, true);
  assert.equal(element.getAttribute('data-sf-started'), '');
});

test('the form value: the submitted setting while the value holds, nothing while disabled (§17.1)', () => {
  const {element} = make();
  element.label = 'yes';
  assert.equal(element.sfFormValue(), null);
  element.checked = true;
  assert.equal(element.sfFormValue(), 'yes');
  element.disabled = true;
  assert.equal(element.sfFormValue(), null);
});

test('aliases.json becomes static aliases', () => {
  const table = {component: 'sf-thing', aliases: [{from: 'thing:open', to: 'sf-thing-open', kind: 'event', since: '2026-10-27', remove_after: '2026-12-01'}]};
  const {Thing} = make({aliases: table});
  assert.equal(Thing.aliases, table);
});

test('words: the element language, English, the source language, the key; plural forms (§11.1)', () => {
  const {element} = make({source: 'ru'});
  const lang = (code) => { element.closest = () => ({getAttribute: () => code}); };
  lang('ru');
  assert.equal(element.sfWord('close'), 'Закрыть');
  assert.equal(element.sfWord('rows', {count: 1}), '1 строка');
  assert.equal(element.sfWord('rows', {count: 3}), '3 строки');
  assert.equal(element.sfWord('rows', {count: 5}), '5 строк');
  assert.equal(element.sfWord('only'), 'only English', 'a word missing in Russian falls back to English');
  lang('en');
  assert.equal(element.sfWord('rows', {count: 1}), '1 row');
  assert.equal(element.sfWord('rows', {count: 1500}), '1,500 rows', '{n} in the language format');
  const said = [];
  const warn = console.warn;
  console.warn = (text) => said.push(text);
  try {
    assert.equal(element.sfWord('native'), 'родное', 'then the source language');
    assert.equal(element.sfWord('missing'), 'missing', 'then the key');
    element.sfWord('missing');
  } finally {
    console.warn = warn;
  }
  assert.equal(said.length, 2, 'each warns once');
  // A word registered by a product wins over the shipped one.
  language.register('sf-thing', 'en', {close: 'Dismiss'});
  try {
    assert.equal(element.sfWord('close'), 'Dismiss');
  } finally {
    language.forget();
  }
  assert.equal(pageWord(null, 'x', null), 'x');
});

test('the Smart base gives every instance a scope that ends on removal (§7.7)', () => {
  const base = readFileSync(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
  assert.match(base, /get sfScope\(\) \{\s*if \(!this\.__sfScope\) this\.__sfScope = new AbortController\(\);/);
  assert.match(base, /disconnectedCallback\(\) \{\s*this\._isMounted = false;\s*this\.sfCloseScope\?\.\(\);/);
  assert.match(base, /if \(!this\.isConnected\) this\.__sfScope\?\.abort\(\);/);
  // ... and hands the shim the element's detail adapters for split rows (§16.20).
  assert.match(base, /installAliases\(this, this\.constructor\.aliases, \{tag: this\.localName, signal: this\.sfScope, adapters: this\.sfAliasAdapters\?\.\(\) \?\? \{\}\}\)/);
});
