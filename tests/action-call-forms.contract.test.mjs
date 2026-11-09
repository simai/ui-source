import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// How an action's method takes its `with` parameters (standard
// simai.smart-component §4.4: one object, and MAY positionally), on an element
// without a DOM (core/js/element-manifest.js). Action-call defects of
// 2026-11-09: a class-written method that took its fields in order read the
// object form as its first field (sf-tabs setData({data}) merged the wrapper,
// setPanels({panels}) cleared the panels, sf-menu-context openFor({anchor})
// threw, chooseTab({index}) did nothing, sf-editor-overlay
// setMessages({messages}) kept the wrapper), and the generated method's
// positional form named every parameter, given or not (sf-progress-run
// step(id, state) wrote text, started, finished and duration as undefined).

const {elementFromManifest} = await import('../src/core/js/element-manifest.js');

class FakeBase extends EventTarget {
  constructor() {
    super();
    this.localName = 'sf-thing';
    this.attrs = new Map();
    this.isConnected = false;
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  closest() { return null; }
  requestComponentUpdate() {}
  get sfScope() { return (this.scope ??= new AbortController()).signal; }
}

const manifest = {
  id: 'smart.thing',
  tag: 'sf-thing',
  version: '1.0.0',
  kind: 'leaf',
  settings: {},
  actions: {
    'set-data': {with: {data: 'object', reason: {type: 'string', optional: true}}},
    'set-messages': {with: {messages: 'object'}},
    'open-for': {with: {anchor: 'object', options: {type: 'object', optional: true}}},
    'choose-tab': {with: {index: 'number'}},
    'set-target': {with: {'insertion-target': {type: 'object', nullable: true}}},
    step: {with: {id: 'string', state: 'string', text: 'string', started: 'string', finished: 'string', duration: 'number'}},
    other: {with: {value: 'string'}},
  },
};

function make() {
  const calls = [];
  const steps = [];
  const Base = elementFromManifest(manifest, {
    base: FakeBase,
    positional: ['set-data', 'set-messages', 'open-for', 'choose-tab', 'set-target'],
    actions: {step(args) { steps.push(args); return {outcome: 'applied'}; }},
  });
  class Thing extends Base {
    setData(data = {}, reason = 'data') { calls.push(['setData', data, reason]); return {outcome: 'applied'}; }
    setMessages(messages) { calls.push(['setMessages', messages]); return this; }
    openFor(anchor, options = {}) { calls.push(['openFor', anchor, options]); return Promise.resolve({outcome: 'applied', value: true}); }
    chooseTab(index) { calls.push(['chooseTab', index]); return this; }
    setTarget(target) { calls.push(['setTarget', target]); return this; }
    other(value) { calls.push(['other', value]); return this; }
  }
  return {Thing, calls, steps};
}

test('a positional class method takes the object form of its action too (§4.4)', async () => {
  const {Thing, calls} = make();
  const element = new Thing();
  const anchor = {nodeType: 1};
  // The object form.
  element.setData({data: {tabs: [1]}, reason: 'host'});
  element.setMessages({messages: {save: 'Save'}});
  await element.openFor({anchor, options: {focus: 'none'}});
  element.chooseTab({index: 2});
  // The positional form, as before.
  element.setData({tabs: [2]}, 'items');
  element.setData({tabs: [3]});
  element.setMessages({save: 'Keep'});
  await element.openFor(anchor, {side: 'inline-end'});
  element.chooseTab(1);
  // No arguments: the method's own defaults.
  element.setData();
  element.chooseTab();
  assert.deepEqual(calls, [
    ['setData', {tabs: [1]}, 'host'],
    ['setMessages', {save: 'Save'}],
    ['openFor', anchor, {focus: 'none'}],
    ['chooseTab', 2],
    ['setData', {tabs: [2]}, 'items'],
    ['setData', {tabs: [3]}, 'data'],
    ['setMessages', {save: 'Keep'}],
    ['openFor', anchor, {side: 'inline-end'}],
    ['chooseTab', 1],
    ['setData', {}, 'data'],
    ['chooseTab', undefined],
  ]);
});

test('the object form leaves out a field not given, reads camelCase names and keeps null', () => {
  const {Thing, calls} = make();
  const element = new Thing();
  element.setData({data: {a: 1}});
  element.setData({reason: 'only'});
  element.setTarget({insertionTarget: null});
  element.setTarget({'insertion-target': {parent_id: 'p', slot: 's', index: 0}});
  // An empty object is the action's own data, not the object form.
  element.setMessages({});
  assert.deepEqual(calls, [
    ['setData', {a: 1}, 'data'],
    ['setData', {}, 'only'],
    ['setTarget', null],
    ['setTarget', {parent_id: 'p', slot: 's', index: 0}],
    ['setMessages', {}],
  ]);
});

test('the answer stays the class method\'s, and an action not named positional is left alone', async () => {
  const {Thing, calls} = make();
  const element = new Thing();
  assert.equal(element.chooseTab({index: 0}), element, 'chaining as before');
  assert.deepEqual(await element.openFor({anchor: {}}), {outcome: 'applied', value: true});
  element.other({value: 'x'});
  assert.deepEqual(calls.at(-1), ['other', {value: 'x'}], 'not named positional: the object goes through');
});

test('a subclass (a dated tag alias) is wrapped once, by the class that holds the method', () => {
  const {Thing, calls} = make();
  class Former extends Thing {}
  new Thing();
  const former = new Former();
  former.chooseTab({index: 3});
  new Former().chooseTab({index: 4});
  assert.deepEqual(calls, [['chooseTab', 3], ['chooseTab', 4]]);
  assert.equal(Object.getOwnPropertyDescriptor(Former.prototype, 'chooseTab'), undefined, 'the subclass gets no copy');
  assert.equal(Thing.prototype.chooseTab.sfObjectForm, true);
});

test('a generated action called positionally names only the parameters given', () => {
  const {Thing, steps} = make();
  const element = new Thing();
  assert.deepEqual(element.step('a', 'done'), {outcome: 'applied'});
  element.step({id: 'b', state: 'error'});
  element.step('c', undefined, 'text');
  element.step();
  assert.deepEqual(steps, [
    {id: 'a', state: 'done'},
    {id: 'b', state: 'error'},
    {id: 'c', text: 'text'},
    {},
  ]);
  for (const args of steps) {
    for (const key of Object.keys(args)) assert.notEqual(args[key], undefined, key);
  }
});

test('the elements name their positional methods (sf-tabs, sf-menu-context, sf-editor-overlay, sf-editor-inline)', () => {
  const read = (path) => readFileSync(new URL(`../src/smart/${path}`, import.meta.url), 'utf8');
  assert.match(read('tabs/index.js'), /positional: \['set-data', 'set-panels'\]/u);
  assert.match(read('menu-context/index.js'), /positional: \["open-for", "toggle-for", "choose-tab"\]/u);
  assert.match(read('editor-inline/index.js'), /positional: \['edit'\]/u);
  const overlay = read('editor-overlay/index.js');
  const declared = JSON.parse(read('editor-overlay/component.json')).actions;
  const withFields = Object.keys(declared).filter((name) => Object.keys(declared[name].with ?? {}).length);
  const listed = JSON.parse(overlay.match(/const positional = (\[[^\]]*\])/u)[1].replaceAll("'", '"'));
  assert.deepEqual(listed, withFields, 'every overlay action with parameters');
  // A positional name the element does not declare would wrap nothing.
  for (const [folder, names] of [['tabs', ['set-data', 'set-panels']], ['menu-context', ['open-for', 'toggle-for', 'choose-tab']]]) {
    const actions = JSON.parse(read(`${folder}/component.json`)).actions;
    for (const name of names) assert.ok(actions[name]?.with, `${folder} ${name}`);
  }
});
