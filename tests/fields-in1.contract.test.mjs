import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

// Fields IN-1 (forms studies of pair 5.20261115.1622: inputs, textarea,
// quantity). Each test names the finding it holds.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const inputs = read('src/component/inputs/scss/_css__inputs.scss');
const inputsCustom = read('src/component/inputs/scss/_css__custom.scss');
const ladder = read('src/component/inputs/scss/_field-ladder.scss');
const textarea = read('src/component/textarea/scss/_css__textarea.scss');
const quantity = read('src/component/quantity/scss/_css__quantity.scss');
const quantityJs = read('src/component/quantity/js/_quantity.js');

// A selector list split at its own commas, not at those inside :is() / :has().
function selectorList(head) {
  const parts = [];
  let depth = 0, part = '';
  for (const ch of head) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(part.trim()); part = ''; } else part += ch;
  }
  parts.push(part);
  return parts.map((one) => one.replace(/^[\s\S]*\*\//u, '').trim());
}

// The declarations of the first rule whose selector list holds `selector`.
function rule(source, selector) {
  let from = 0;
  for (;;) {
    const at = source.indexOf(selector, from);
    assert.ok(at >= 0, `a rule names ${selector}`);
    const open = source.indexOf('{', at);
    const head = source.slice(Math.max(source.lastIndexOf('}', at), source.lastIndexOf('{', at), source.lastIndexOf(';', at)) + 1, open);
    if (selectorList(head).includes(selector)) {
      return source.slice(open + 1, source.indexOf('}', open));
    }
    from = at + selector.length;
  }
}

test('RG-IN-1: an icon set straight in a disabled field frame goes quiet with the text', () => {
  const body = rule(inputs, '.sf-input:has(input:disabled) > .sf-input-field > .sf-icon');
  assert.match(body, /--sf-icon--color: var\(--sf-on-surface-disabled\);/u);
});

test('RG-IN-2 / RG-TA-2: read-only drops the fill in the filled look too (C16)', () => {
  const field = rule(inputs, '.sf-input:not(.error):is(.sf-input--bordered, .sf-input--filled):has(input:read-only:not(:disabled)) .sf-input-field');
  assert.match(field, /--sf-input-field--background-color: var\(--sf-transparent\);/u);
  assert.match(field, /--sf-input-field--border-color: var\(--sf-outline-variant\);/u);
  assert.match(field, /--sf-input-field--line-color: var\(--sf-outline-variant\);/u);
  const box = rule(textarea, '.sf-textarea:not(.error):is(.sf-textarea--bordered, .sf-textarea--filled):has(textarea:read-only:not(:disabled)) textarea');
  assert.match(box, /--sf-textarea-textarea--background-color: var\(--sf-transparent\);/u);
  assert.match(box, /--sf-textarea-textarea--border-color: var\(--sf-outline-variant\);/u);
  assert.match(box, /--sf-textarea-textarea--line-color: var\(--sf-outline-variant\);/u);
});

test('RG-IN-3 / RG-QT-4: the ladder icon at 3 is the icon ladder 28 on a phone (C151), and both fields read it', () => {
  const mixin = ladder.slice(ladder.indexOf('@mixin icon($size)'));
  assert.match(mixin, /@if \$size == '3' \{\n\s+@media not all and \(min-width: 60rem\) \{\n\s+--sf-icon--font-size: var\(--sf-icon-size-4\);\n\s+--sf-icon--height: var\(--sf-icon-size-4\);\n\s+--sf-icon--width: var\(--sf-icon-size-4\);/u);
  assert.match(rule(inputsCustom, '.sf-input.sf-input--size-3 > .sf-input-field > .sf-icon'), /@include ladder\.icon\('3'\);/u);
  assert.match(quantity, /sf-icon-button--icon :is\(\.sf-icon, sf-icon:not\(:defined\)\) \{\n\s+@include ladder\.icon\(\$size\);/u);
  // The stepper keeps its height round the larger glyph.
  assert.match(quantity, /@if \$size == '3' \{\n\s+@media not all and \(min-width: 60rem\) \{\n\s+--sf-icon-button--padding-bottom: calc\(\(#\{\$stepper\} - var\(--sf-icon-size-4\)\) \/ 2\);/u);
});

test('RG-TA-1: textarea size 2 takes the shared inset ladder (C77, C141), not --sf-space-2 alone', () => {
  const body = rule(textarea, '.sf-textarea.sf-textarea--size-2');
  assert.match(body, /@include ladder\.inset\(--sf-textarea--inset, '2'\);/u);
  assert.doesNotMatch(body, /--sf-textarea--inset: var\(--sf-space-2\)/u);
});

test('RG-QT-1: steppers="none" starts the number at C77 like sf-input, at every step', () => {
  assert.match(quantity, /@each \$size in ladder\.\$sizes \{\n\s+\.sf-quantity\.sf-quantity--steppers-none\.#\{ladder\.size-class\('sf-quantity', \$size\)\} \{\n[\s\S]*?@include ladder\.inset\(--sf-quantity--inset, \$size\);/u);
  const wrap = rule(quantity, '.sf-quantity.sf-quantity--steppers-none:is(.sf-quantity--size-1\\/3, .sf-quantity--size-1\\/2, .sf-quantity--size-1, .sf-quantity--size-2, .sf-quantity--size-3) .sf-quantity-row > .sf-quantity-wrap');
  assert.match(wrap, /--sf-quantity-wrap--padding-inline-start: var\(--sf-quantity-padding-inline, calc\(var\(--sf-quantity--value-inset\) - var\(--sf-px\) - var\(--sf-space-1\\\/4\)\)\);/u);
  // The old formula (space-x plus the text step) is gone.
  assert.doesNotMatch(quantity, /steppers-none[^{]*\{[^}]*--space-x\) \+/u);
});

test('RG-QT-4: compact size 1 keeps 4 from the frame -- the stepper is the field less 2 x --sf-space-1/4', () => {
  assert.match(quantity, /\.sf-quantity\.sf-quantity--size-1 \{ --sf-quantity--number-height: calc\(var\(--sf-ui-1--control-height\) - 2 \* var\(--sf-space-1\\\/4\)\); \}/u);
  const count = rule(quantity, '.sf-quantity.sf-quantity--size-1 .sf-quantity-count');
  assert.match(count, /calc\(\(var\(--sf-quantity--number-height\) - var\(--sf-text-height-1\)\) \/ 2\)/u);
  assert.doesNotMatch(count, /--sf-ui-1\\\/2--control-height/u);
});

// A small element for the plain binder: attributes, no layout.
function setup(inputOptions = {}, hint = null) {
  class Button { disabled = false; addEventListener() {} removeEventListener() {} }
  const attrs = new Map();
  const input = {
    value: '2', defaultValue: '2', min: '1', max: '9', step: '1', type: 'text', disabled: false, readOnly: false,
    classList: {contains: () => false, toggle() {}}, dataset: {locale: 'en-US'}, ...inputOptions,
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const buttons = [new Button(), new Button()];
  const contracts = [];
  const listeners = new Map();
  const node = {dataset: {}, classList: {contains: () => false, add() {}, remove() {}, toggle() {}},
    querySelector: (selector) => (selector === '.sf-quantity-wrap input' ? input : selector === '.sf-quantity-hint-text-wrap' ? hint : null),
    querySelectorAll: () => buttons, addEventListener(type, cb) { listeners.set(type, cb); }, removeEventListener() {}, contains: () => false};
  const context = vm.createContext({
    window: {setTimeout}, document: {activeElement: null}, navigator: {language: 'en-US'}, HTMLButtonElement: Button, Event,
    syncFieldContract(...args) { contracts.push(args); }, bindFormReset() { return () => {}; },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  vm.runInContext(quantityJs.slice(quantityJs.indexOf('const QUANTITY_SELECTOR'), quantityJs.indexOf('\nclass Quantity')), context);
  return {context, node, input, attrs, contracts, listeners};
}

test('RG-QT-2: the plain number is a spin button with its limits and value (C19, as the Smart template)', () => {
  const e = setup();
  e.context.bindQuantity(e.node);
  assert.equal(e.attrs.get('role'), 'spinbutton');
  assert.equal(e.attrs.get('aria-valuemin'), '1');
  assert.equal(e.attrs.get('aria-valuemax'), '9');
  assert.equal(e.attrs.get('aria-valuenow'), '2');
  e.context.adjustValue(e.node, 1);
  assert.equal(e.attrs.get('aria-valuenow'), '3');
  // The arrow keys step it, within its limits.
  const keys = e.listeners.get('keydown');
  let prevented = 0;
  const press = (key) => keys({key, target: e.input, preventDefault() { prevented += 1; }});
  press('ArrowUp');
  assert.equal(e.attrs.get('aria-valuenow'), '4');
  press('ArrowDown'); press('ArrowDown'); press('ArrowDown'); press('ArrowDown');
  assert.equal(e.attrs.get('aria-valuenow'), '1');
  assert.equal(prevented, 5);
  press('Tab');
  assert.equal(prevented, 5);
  // No limit, no attribute; a native number input keeps its own role.
  const open = setup({min: '', max: '', type: 'number'});
  open.context.bindQuantity(open.node);
  assert.equal(open.attrs.has('role'), false);
  assert.equal(open.attrs.has('aria-valuemin'), false);
  assert.equal(open.attrs.has('aria-valuemax'), false);
  // A grouped number is read out as shown.
  const big = setup({value: '1500', max: ''});
  big.context.bindQuantity(big.node);
  assert.equal(big.attrs.get('aria-valuenow'), '1500');
  assert.equal(big.attrs.get('aria-valuetext'), '1,500');
});

test('RG-QT-3: the help line is tied by aria-describedby through the field contract (C55)', () => {
  const hint = {dataset: {}, textContent: 'From 1 to 9 guests', id: ''};
  const e = setup({}, hint);
  e.context.bindQuantity(e.node);
  const [, , options] = e.contracts[0];
  assert.equal(options.messageNode, hint);
  assert.equal(options.errorMessage, '');
  const error = setup({}, {dataset: {fieldMessage: 'error'}, textContent: ' Too many ', id: ''});
  error.context.bindQuantity(error.node);
  assert.equal(error.contracts[0][2].errorMessage, 'Too many');
});
