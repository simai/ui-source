// RD-1: a <label> around a form-associated Smart host (sf-radio, sf-checkbox,
// sf-switch and every host elementFromManifest makes from a manifest `form`)
// clicks the host, its labeled control, and the native control drawn inside
// stayed as it was. The host passes that press on as a native label would
// (element-manifest.js activateFromLabel): a checkbox or a radio is clicked
// once, another control takes the focus; a press on the control itself is not
// handled twice. Browser probe: ui-control control/evidence/2026-11-12-rd1-label-click/.
import assert from 'node:assert/strict';
import test from 'node:test';

// elementFromManifest makes a form control only where the browser has
// ElementInternals with setFormValue.
globalThis.ElementInternals ??= class { setFormValue() {} };
const {elementFromManifest} = await import('../src/core/js/element-manifest.js');

// A tiny tree: events go from the target up its parents, as a bubbling click.
class FakeNode {
  constructor(localName = 'span') {
    this.localName = localName;
    this.parentElement = null;
    this.children = [];
    this.listeners = new Map();
  }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } return this; }
  addEventListener(type, listener) { (this.listeners.get(type) ?? this.listeners.set(type, []).get(type)).push(listener); }
  contains(node) { for (let at = node; at; at = at.parentElement) if (at === this) return true; return false; }
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.localName === 'input' && selector.includes('input') && node.type !== 'hidden');
  }
  dispatch(type, {trusted = false} = {}) {
    const event = {
      type, target: this, defaultPrevented: false, stopped: false, isTrusted: trusted,
      stopPropagation() { this.stopped = true; },
      preventDefault() { this.defaultPrevented = true; },
    };
    for (let at = this; at && !event.stopped; at = at.parentElement) {
      for (const listener of at.listeners.get(type) ?? []) listener.call(at, event);
    }
    return event;
  }
}

class FakeInput extends FakeNode {
  constructor(type) {
    super('input');
    this.type = type;
    this.checked = false;
    this.disabled = false;
    this.focused = 0;
  }
  matches(selector) { return selector === ':disabled' ? this.disabled : false; }
  focus() { this.focused += 1; }
  click() {
    if (this.disabled) return;
    if (this.type === 'radio') this.checked = true;
    else if (this.type === 'checkbox') this.checked = !this.checked;
    this.dispatch('click');
    if (this.type === 'radio' || this.type === 'checkbox') this.dispatch('change');
  }
}

class FakeBase extends FakeNode {
  static get props() { return {}; }
  constructor() {
    super('sf-fake');
    this.attrs = new Map();
  }
  attachInternals() { return new globalThis.ElementInternals(); }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  closest() { return null; }
  requestComponentUpdate() {}
  connectedCallback() {}
}

const formManifest = (tag) => ({
  id: `smart.${tag}`, tag, version: '1.0.0', kind: 'leaf',
  settings: {checked: {type: 'boolean', default: false}, name: {type: 'string', default: ''}, disabled: {type: 'boolean', default: false}},
  form: {value: 'checked', name: 'name', default: 'checked', disabled: 'disabled'},
});

// <label> <host> <label class="inner"> <input> </label> </host> text </label>
function scene(type, {Host} = {}) {
  const Base = Host ?? class extends elementFromManifest(formManifest(`sf-${type}`), {base: FakeBase}) {
    getInputElement() { return this.querySelectorAll('input')[0] ?? null; }
  };
  const host = new Base();
  const input = new FakeInput(type);
  const inner = new FakeNode('label').append(input);
  host.append(inner);
  const label = new FakeNode('label').append(host);
  const counts = {change: 0, hostClicksAbove: 0, clicksAbove: 0};
  label.addEventListener('change', () => { counts.change += 1; });
  label.addEventListener('click', (event) => {
    counts.clicksAbove += 1;
    if (event.target === host) counts.hostClicksAbove += 1;
  });
  return {host, input, label, counts};
}

for (const type of ['checkbox', 'radio']) {
  test(`a label's activation of the host chooses its ${type} once (RD-1)`, () => {
    const {host, input, counts} = scene(type);
    assert.equal(host.constructor.formAssociated, true);
    // The platform clicks the labeled control: the host itself.
    host.dispatch('click');
    assert.equal(input.checked, true);
    assert.equal(counts.change, 1);
    // Ancestors hear one click, the control's, not the host's as well.
    assert.equal(counts.hostClicksAbove, 0);
    assert.equal(counts.clicksAbove, 1);
  });

  test(`a press on the ${type} itself is not passed on again (RD-1)`, () => {
    const {input, counts} = scene(type);
    input.click();
    assert.equal(input.checked, true);
    assert.equal(counts.change, 1);
    assert.equal(counts.clicksAbove, 1);
  });
}

test('a second activation of a checkbox host unchecks it: one toggle per press', () => {
  const {host, input, counts} = scene('checkbox');
  host.dispatch('click');
  host.dispatch('click');
  assert.equal(input.checked, false);
  assert.equal(counts.change, 2);
});

test('an ancestor that passes the host press on itself (the sf-menu-context row workaround) does not double it', () => {
  const {host, input, label, counts} = scene('checkbox');
  label.addEventListener('click', (event) => {
    if (event.target === host) input.click();
  });
  host.dispatch('click');
  assert.equal(input.checked, true);
  assert.equal(counts.change, 1);
});

test('a disabled control is not activated, and the host click goes on', () => {
  const {host, input, counts} = scene('checkbox');
  input.disabled = true;
  host.dispatch('click');
  assert.equal(input.checked, false);
  assert.equal(counts.change, 0);
  assert.equal(counts.hostClicksAbove, 1);
});

test('a refused click (defaultPrevented) is not passed on', () => {
  const {host, input} = scene('checkbox');
  host.listeners.get('click').unshift((event) => event.preventDefault());
  host.dispatch('click');
  assert.equal(input.checked, false);
});

test('a person\'s press focuses the control as a label does; a script\'s host.click() does not move the focus', () => {
  const {host, input} = scene('checkbox');
  host.dispatch('click');
  assert.equal(input.focused, 0);
  host.dispatch('click', {trusted: true});
  assert.equal(input.focused, 1);
  assert.equal(input.checked, false);
});

test('a field that is not checkable takes the focus, and its host click is not stopped', () => {
  const {host, input, counts} = scene('text');
  host.dispatch('click', {trusted: true});
  assert.equal(input.focused, 1);
  assert.equal(input.checked, false);
  assert.equal(counts.hostClicksAbove, 1);
});

test('without getInputElement the first native control of the host is the one', () => {
  const Host = elementFromManifest(formManifest('sf-plain'), {base: FakeBase});
  const {host, input} = scene('checkbox', {Host});
  host.dispatch('click');
  assert.equal(input.checked, true);
});

test('sfLabelControl returning null leaves the activation alone', () => {
  const Host = class extends elementFromManifest(formManifest('sf-opt-out'), {base: FakeBase}) {
    sfLabelControl() { return null; }
  };
  const {host, input, counts} = scene('checkbox', {Host});
  host.dispatch('click');
  assert.equal(input.checked, false);
  assert.equal(counts.hostClicksAbove, 1);
});

test('a host without a form declaration does not listen', () => {
  const manifest = {...formManifest('sf-no-form')};
  delete manifest.form;
  const Host = class extends elementFromManifest(manifest, {base: FakeBase}) {
    getInputElement() { return this.querySelectorAll('input')[0] ?? null; }
  };
  const {host, input} = scene('checkbox', {Host});
  assert.equal(host.constructor.formAssociated, false);
  host.dispatch('click');
  assert.equal(input.checked, false);
});
