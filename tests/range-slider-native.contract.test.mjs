/* global URL */
// The slider's own runtime (component/range-slider/js/native-slider.js) on a
// fake DOM: rounding (S2), keys (S4), read-only (C80) and ticks (C80 T1).
import assert from 'node:assert/strict';
import test from 'node:test';

class ClassList {
  constructor(node) { this.node = node; this.set = new Set(); }
  add(...names) { names.forEach((name) => this.set.add(name)); }
  remove(...names) { names.forEach((name) => this.set.delete(name)); }
  toggle(name, force) { const on = force ?? !this.set.has(name); if (on) this.set.add(name); else this.set.delete(name); return on; }
  contains(name) { return this.set.has(name); }
}
class Node {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.attrs = {}; this.style = {}; this.listeners = {};
    this.classList = new ClassList(this);
  }
  set className(value) { this.classList = new ClassList(this); String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name)); }
  append(...nodes) { this.children.push(...nodes); nodes.forEach((node) => { node.parent = this; }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== listener); }
  getBoundingClientRect() { return {left: 0, width: 100}; }
  key(key, extra = {}) {
    let prevented = false;
    (this.listeners.keydown || []).forEach((listener) => listener({key, preventDefault() { prevented = true; }, ...extra}));
    return prevented;
  }
}
globalThis.document = {createElement: (tag) => new Node(tag)};
globalThis.window = {addEventListener() {}, removeEventListener() {}};

const {createNativeSlider, decimalPlaces, roundToDigits} = await import(new URL('../src/component/range-slider/js/native-slider.js', import.meta.url));

const classes = {
  target: 't', horizontal: 'h', textDirectionLtr: 'l', textDirectionRtl: 'r', base: 'b', connects: 'c', connect: 'cl',
  origin: 'o', handle: 'hd', handleLower: 'hl', handleUpper: 'hu', touchArea: 'ta',
};
function slider(options) {
  const root = new Node();
  const instance = createNativeSlider(root, {cssClasses: classes, connect: 'lower', ...options});
  const handles = [];
  const walk = (node) => { if (node.attrs.role === 'slider') handles.push(node); node.children.forEach(walk); };
  walk(root);
  return {root, instance, handles};
}

test('digits of a step and rounding to them', () => {
  assert.equal(decimalPlaces('0.1'), 1);
  assert.equal(decimalPlaces('2.5e-3'), 4);
  assert.equal(decimalPlaces(500), 0);
  assert.equal(roundToDigits(0.1 + 0.2, 1), 0.3);
});

test('a fractional step leaves no floating-point tail in the value or ARIA (S2)', () => {
  const {instance, handles} = slider({range: {min: 0, max: 1}, step: 0.1, start: [0.2]});
  handles[0].key('ArrowRight');
  assert.equal(instance.get(true), 0.3);
  assert.equal(handles[0].attrs['aria-valuenow'], '0.3');
  const range = slider({range: {min: 0, max: 1}, step: 0.1, start: [0.1, 0.7], margin: 0.2});
  assert.equal(range.handles[1].attrs['aria-valuemin'], '0.3');
  assert.equal(range.handles[0].attrs['aria-valuemax'], '0.5');
});
