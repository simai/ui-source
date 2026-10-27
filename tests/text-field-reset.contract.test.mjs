import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

/* global URL, console */

const read = file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');

for (const [family, name, selector, nativeTag] of [
  ['inputs', 'Input', 'INPUT', 'input'], ['textarea', 'Textarea', 'TEXTAREA', 'textarea'],
]) {
  test(`${name} resets mask from native default and disposes reset subscription`, async () => {
    const source = await read(`component/${family}/js/_${family}.js`);
    let callback, releaseCount = 0, destroyCount = 0;
    const native = {value: '34', dataset: {}, required: false, classList: {contains: () => false},
      addEventListener() {}, removeEventListener() {}};
    const root = {dataset: {}, classList: {add() {}, remove() {}, contains: () => false},
      querySelector: query => query === nativeTag || query === '.sf-input-field input, input' ? native : null};
    const code = source.slice(source.indexOf(`const ${selector}_SELECTOR`), source.indexOf(`function initExisting${name === 'Input' ? 'Inputs' : 'Textareas'}`));
    const context = vm.createContext({
      window: {SF: {Mask: {destroy() { destroyCount++; }}}}, console,
      syncFieldContract() {}, retireFieldSizeClass() {}, bindFormReset(input, handler) {
        assert.equal(input, native); callback = handler; return () => releaseCount++;
      },
    });
    vm.runInContext(`${code}\nglobalThis.api = {bind${name}, unbind${name}}`, context);
    context.api[`bind${name}`](root);
    assert.equal(typeof callback, 'function');
    const mask = {value: '34'};
    root[`__sf${name}Mask`] = mask;
    native.value = '12'; callback();
    assert.equal(mask.value, '12');
    native.value = ''; callback();
    assert.equal(mask.value, '');
    context.api[`unbind${name}`](root);
    assert.equal(releaseCount, 1); assert.equal(destroyCount, 1);
    assert.equal(root[`__sf${name}ReleaseReset`], undefined);
    assert.match(source, new RegExp(`${nativeTag}\\.defaultValue = String\\(value \\?\\? ''\\)`));
  });
}

test('Smart Input keeps explicit empty default separate from its live value', async () => {
  const source = await read('smart/input/index.js');
  const getter = source.slice(source.indexOf('  get defaultValue()'), source.indexOf('  set defaultValue('));
  const context = vm.createContext({});
  vm.runInContext(`globalThis.Subject = class {${getter}}`, context);
  const subject = new context.Subject();
  const attrs = new Map([['value', 'current'], ['default-value', '']]);
  subject.getAttribute = key => attrs.get(key) ?? null;
  assert.equal(subject.defaultValue, '');
  attrs.set('default-value', 'reset'); assert.equal(subject.defaultValue, 'reset');
  attrs.delete('default-value'); assert.equal(subject.defaultValue, 'current');
  attrs.delete('value'); assert.equal(subject.defaultValue, '');
  const template = await read('smart/input/js/templates/default.js');
  assert.match(template, /\.value=\$\{value\}\s+\.defaultValue=\$\{defaultValue\}/);
});

test('Smart Textarea reads live text while its template records reset default', async () => {
  const source = await read('smart/textarea/index.js');
  const getter = source.slice(source.indexOf('  get value()'), source.indexOf('  set value('));
  const context = vm.createContext({});
  vm.runInContext(`globalThis.Subject = class {${getter}}`, context);
  const subject = new context.Subject();
  const native = {value: 'edited'};
  subject.querySelector = () => native;
  subject.getAttribute = () => 'initial';
  assert.equal(subject.value, 'edited');
  native.value = ''; assert.equal(subject.value, '');
  subject.querySelector = () => null; assert.equal(subject.value, 'initial');
  const template = await read('smart/textarea/js/templates/default.js');
  assert.match(template, /\.value=\$\{value\}\s+\.defaultValue=\$\{value\}/);
});

test('Smart text setters synchronize native/masked values immediately without synthetic input', async () => {
  for (const [family, nextGetter, maskKey] of [
    ['input', 'defaultValue', '__sfInputMask'], ['textarea', 'name', '__sfTextareaMask'],
  ]) {
    const source = await read(`smart/${family}/index.js`);
    const setter = source.slice(source.indexOf('  set value('), source.indexOf(`  get ${nextGetter}()`));
    const context = vm.createContext({});
    vm.runInContext(`globalThis.Subject = class {${setter}}`, context);
    const subject = new context.Subject();
    const native = {value: 'before'};
    const attrs = new Map();
    const root = {querySelector: () => native};
    subject.querySelector = () => root;
    subject.getInputElement = () => native;
    subject.setAttribute = (key, value) => attrs.set(key, value);
    subject.removeAttribute = key => attrs.delete(key);
    subject.value = 'after'; assert.equal(native.value, 'after');
    assert.equal(attrs.get('value'), 'after');
    subject.value = null; assert.equal(native.value, ''); assert.equal(attrs.has('value'), false);
    const mask = {get value() { return native.value; }, set value(value) { native.value = value; }};
    root[maskKey] = mask;
    subject.value = '12'; assert.equal(mask.value, '12'); assert.equal(native.value, '12');
    subject.value = undefined; assert.equal(mask.value, '');
    assert.doesNotMatch(setter, /dispatchEvent/);
  }
});
