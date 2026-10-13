import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const resetSource = await read('component/form-reset-helper.js');
const { bindFormReset } = await import(moduleUrl(resetSource));
const smartSource = (await read('smart/helpers/checkableReset.js')).replace(
  "'../../component/form-reset-helper'", JSON.stringify(moduleUrl(resetSource)),
);
const { bindCheckableReset } = await import(moduleUrl(smartSource));
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function environment() {
  const listeners = [];
  const doc = { addEventListener(type, callback, capture) {
    assert.equal(type, 'reset'); assert.equal(capture, true); listeners.push(callback);
  } };
  const form = { tagName: 'FORM', elements: [] };
  const input = { ownerDocument: doc, form, isConnected: true, checked: true };
  form.elements.push(input);
  return { doc, form, input, listeners, reset() {
    const event = { target: form, defaultPrevented: false };
    listeners.forEach((listener) => listener(event));
    return event;
  } };
}

test('reset reconciles after native state restoration without dispatching change', async () => {
  const env = environment(), values = [];
  bindFormReset(env.input, () => values.push(env.input.checked));
  env.reset();
  assert.deepEqual(values, []);
  env.input.checked = false; // Browser default action occurs after reset event.
  await settle();
  assert.deepEqual(values, [false]);
  assert.doesNotMatch(resetSource, /dispatchEvent/);
});

test('prevented reset, disposal and detached/moved controls are respected', async () => {
  const env = environment(); let calls = 0;
  const release = bindFormReset(env.input, () => calls++);
  env.reset().defaultPrevented = true;
  await settle(); assert.equal(calls, 0);
  env.reset(); env.input.isConnected = false;
  await settle(); assert.equal(calls, 0);
  env.input.isConnected = true;
  env.reset(); env.input.form = {};
  await settle(); assert.equal(calls, 0);
  env.input.form = env.form;
  release(); env.reset();
  await settle(); assert.equal(calls, 0);
});

test('one delegated listener per document, reset only touches its own form', async () => {
  const env = environment(); let first = 0, second = 0;
  const other = { ...env.input, form: { tagName: 'FORM', elements: [] } };
  other.form.elements.push(other);
  bindFormReset(env.input, () => first++);
  bindFormReset(other, () => second++);
  assert.equal(env.listeners.length, 1);
  env.reset(); await settle();
  assert.equal(first, 1); assert.equal(second, 0);
});

test('Smart reset keeps initial default across current-state rerenders', async () => {
  const env = environment(); let reflected = null;
  const component = { checked: true, getInputElement: () => env.input,
    _handleChange() { reflected = this.checked = env.input.checked; } };
  let release = bindCheckableReset(component, env.input);
  assert.equal(env.input.defaultChecked, true);
  component.checked = env.input.checked = false;
  release(); release = bindCheckableReset(component, env.input);
  assert.equal(env.input.defaultChecked, true);
  assert.equal(env.input.checked, false);
  env.reset(); env.input.checked = env.input.defaultChecked;
  await settle(); assert.equal(reflected, true);
  release(); reflected = null;
  env.reset(); await settle(); assert.equal(reflected, null);
});

test('all selection projections wire reset and separate live checked from default', async () => {
  for (const kind of ['checkbox', 'radio', 'switch', 'toggle']) {
    const base = await read(`component/${kind}/js/_${kind}.js`);
    const smart = await read(`smart/${kind}/index.js`);
    const template = await read(`smart/${kind}/js/templates/default.js`);
    assert.match(base, /bindFormReset\(input, handleChange\)/);
    assert.match(base, /ReleaseReset\?\.\(\)/);
    assert.match(smart, /bindCheckableReset\(this, input\)/);
    assert.match(smart, /_releaseReset\?\.\(\)/);
    assert.match(template, /\.checked=\$\{/);
    assert.doesNotMatch(template, /\?checked=/);
  }
});

test('radio synchronization respects native form ownership and literal names', async () => {
  const js = await read('component/radio/js/_radio.js');
  const code = js.slice(js.indexOf('function getRadioGroupRoots'), js.indexOf('function syncRadioState'));
  class Input {}
  const form = {}, otherForm = {};
  const make = (owner) => Object.assign(new Input(), {
    type: 'radio', name: 'choice["delivery"]', form: owner, closest() { return this; },
  });
  const first = make(form), sibling = make(form), other = make(otherForm);
  first.getRootNode = () => ({ querySelectorAll(selector) {
    assert.equal(selector, 'label.sf-radio-button input[type="radio"]');
    return [first, sibling, other];
  } });
  const result = vm.runInNewContext(`${code}\ngetRadioGroupRoots(first);`, {
    first, HTMLInputElement: Input, RADIO_SELECTOR: 'label.sf-radio-button',
  });
  assert.equal(result.length, 2);
  assert.equal(result[0], first);
  assert.equal(result[1], sibling);
});

test('JS constructors preserve initial checked defaults; setState only changes live state', async () => {
  for (const [kind, expected] of [['checkbox', 1], ['switch', 1], ['radio', 2], ['toggle', 3]]) {
    const js = await read(`component/${kind}/js/_${kind}.js`);
    assert.equal((js.match(/(?:this\.)?input\.defaultChecked = (?:this\.)?input\.checked;/g) || []).length, expected);
    const setter = js.slice(js.indexOf(`function set${kind[0].toUpperCase() + kind.slice(1)}State`), js.indexOf('\nclass '));
    // Toggle builders follow its setter, so inspect only the setter body prefix.
    assert.doesNotMatch(setter.split('\nfunction build')[0], /defaultChecked/);
  }
});
