import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  clamp,
  formValue,
  formatNumber,
  inferPrecision,
  isEditableText,
  parseNumber,
  readNumber,
  roundTo,
  stepFrom,
} from '../src/smart/quantity/value.mjs';
import {FIELD_SIZES} from '../src/component/field-size.js';

// sf-quantity (owner, 2026-10-25): a number field with «−» and «+» over the class
// component quantity, for the integer fields of the property and data views.
// What a reader of the source cannot tell from one file is held here; the page
// itself is measured by tests/browser/quantity-smart.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/quantity/index.js');
const template = read('src/smart/quantity/js/templates/default.js');
const manifest = JSON.parse(read('src/smart/quantity/smart.manifest.json'));
const classSource = read('src/component/quantity/js/_quantity.js');
const sheet = read('src/component/quantity/scss/_css__quantity.scss');

test('quantity: typed text reads in the page\'s language, strictly', () => {
  const ru = {locale: 'ru', allowDecimal: true, allowNegative: true};
  assert.equal(parseNumber('2 567,5', ru), 2567.5, 'grouped, with the Russian comma');
  assert.equal(parseNumber('2.5', ru), 2.5, 'a point is a decimal mark on a Russian page too');
  assert.equal(parseNumber('1,234.5', {locale: 'en-US', allowDecimal: true}), 1234.5);
  assert.equal(parseNumber('1.234,5', {locale: 'de-DE', allowDecimal: true}), 1234.5, 'a German point groups');
  assert.equal(parseNumber('', ru), null, 'an empty box is nothing');
  for (const partial of ['-', ',', '-,']) assert.ok(Number.isNaN(parseNumber(partial, ru)), partial);
  for (const wrong of ['1,2,3', '12a', '1e3', '--1']) assert.ok(Number.isNaN(parseNumber(wrong, ru)), wrong);
  // An integer field takes no decimal mark, a field without a negative bound no minus.
  assert.ok(Number.isNaN(parseNumber('1,5', {locale: 'ru'})));
  assert.ok(Number.isNaN(parseNumber('-1', {locale: 'ru'})));
  // What can still become a number may be typed; nothing else may.
  for (const ok of ['', '-', '1,', '12 3']) assert.ok(isEditableText(ok, ru), ok);
  for (const no of ['a', '1,2,', '1-', '+1']) assert.ok(!isEditableText(no, ru), no);
  assert.ok(!isEditableText('1,', {locale: 'ru'}), 'no decimal mark in an integer field');
});

test('quantity: values are written back in the page\'s format and submitted with a point', () => {
  assert.equal(formatNumber(2567.5, {locale: 'ru', precision: 2}), '2 567,50');
  assert.equal(formatNumber(2026, {locale: 'ru', grouping: false}), '2026');
  assert.equal(formatNumber(null, {locale: 'ru'}), '');
  assert.equal(formValue(2567.5, 2), '2567.50');
  assert.equal(formValue(null, 2), '');
  assert.equal(roundTo(0.1 + 0.2, 1), 0.3);
  assert.equal(Object.is(roundTo(-0.001, 2), -0), false, 'no negative zero');
  assert.equal(inferPrecision('0.25'), 2);
  assert.equal(inferPrecision('1e-3'), 3);
  assert.equal(inferPrecision('5'), 0);
  assert.equal(readNumber(''), null);
  assert.equal(readNumber('x'), null);
  assert.equal(readNumber('-2.5'), -2.5);
});

test('quantity: a step lands inside the bounds, and an empty field starts from zero or the nearer bound', () => {
  const bounds = {step: 1, min: 0, max: 10, precision: 0};
  assert.equal(stepFrom(3, 1, bounds), 4);
  assert.equal(stepFrom(10, 1, bounds), 10, 'held at max');
  assert.equal(stepFrom(0, -1, bounds), 0, 'held at min');
  assert.equal(stepFrom(3, 10, bounds), 10, 'a page is clamped too');
  assert.equal(stepFrom(null, 1, bounds), 1);
  assert.equal(stepFrom(null, -1, bounds), 0);
  assert.equal(stepFrom(null, 1, {step: 1, min: 1, max: null}), 1, '«+» with min 1 gives 1, not 2');
  assert.equal(stepFrom(null, -1, {step: 1, min: null, max: -5}), -5);
  assert.equal(stepFrom(9.9, 1, {step: 0.1, max: 10, precision: 1}), 10);
  assert.equal(stepFrom(0.1, 2, {step: 0.1, precision: 1}), 0.3, 'no floating-point tail');
  assert.equal(clamp(5, null, null), 5);
});

test('quantity: it is a form field like sf-input, with the inherited value', () => {
  // Built from its component.json (standard 1.3.8 §4): the settings are the
  // manifest's, `error` is a dated alias of `invalid` (§17.2).
  assert.match(source, /base: InheritedValueField\(SfBaseElement\),/u);
  assert.match(source, /class SfQuantity extends FormField\(QuantityElement\)/u);
  const declared = JSON.parse(read('src/smart/quantity/component.json'));
  for (const prop of ['label', 'hint', 'placeholder', 'required', 'disabled', 'readonly', 'invalid', 'error-message', 'min', 'max', 'step', 'precision']) {
    assert.ok(declared.settings[prop], prop);
  }
  assert.ok(JSON.parse(read('src/smart/quantity/aliases.json')).aliases.some((row) => row.from === 'error' && row.to === 'invalid'));
  assert.match(source, /inheritedValue: \{attribute: 'inherited-value', default: ''\}/u);
  assert.match(source, /ariaLabel: \{attribute: 'aria-label', default: ''\}/u);
  assert.match(source, /get size\(\) \{ return fieldSize\(this\.getAttribute\('size'\) \|\| '1', 'sf-quantity'\); \}/u);
  assert.deepEqual(manifest.inputs.properties.size.enum, [...FIELD_SIZES]);
  assert.match(source, /createFieldContract\(this, \{\n      prefix: 'sf-quantity',/u);
  // The seams the inherited-value mixin asks for.
  for (const seam of ['inheritedOwnValue()', 'inheritedDisplayValue()', 'inheritedFocusTarget()', 'clearOwnValue()']) {
    assert.ok(source.includes(`  ${seam} {`), seam);
  }
  assert.match(source, /clearOwnValue\(\) \{\n    this\.writeValue\(null, 'reset', \{change: true\}\);/u);
  assert.match(template, /renderInheritedSlot\(component, \{size: context\.size, disabled: !context\.interactive\}\)/u);
  // The form gets the number with a point from a hidden input; the box has no name.
  assert.match(template, /<input type="hidden" class="sf-quantity-value" name=\$\{context\.name\} value=\$\{context\.formValue\} \?disabled=\$\{context\.disabled\}>/u);
  const box = template.slice(template.indexOf('<input type="text"'), template.indexOf('${inheritedSlot}'));
  assert.doesNotMatch(box, /\sname=/u);
  assert.match(box, /\?required=\$\{field\.required\}/u);
});

test('quantity: the control is a WAI-ARIA spinbutton and the steppers are named buttons out of the tab order', () => {
  const box = template.slice(template.indexOf('<input type="text"'), template.indexOf('${inheritedSlot}'));
  assert.match(box, /role="spinbutton"/u);
  for (const attribute of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-invalid', 'aria-describedby', 'aria-labelledby']) {
    assert.ok(box.includes(`${attribute}=`), attribute);
  }
  assert.match(box, /inputmode=\$\{context\.precision > 0 \? 'decimal' : 'numeric'\}/u);
  const stepper = template.slice(template.indexOf('<button type="button"'), template.indexOf('</button>'));
  assert.match(stepper, /tabindex="-1"/u);
  assert.match(stepper, /aria-label=\$\{down \? context\.decrementLabel : context\.incrementLabel\}/u);
  assert.match(stepper, /aria-controls=\$\{field\.controlId\}/u);
  assert.match(stepper, /\?disabled=\$\{!context\.interactive \|\| reached\}/u);
  // The words are the class component's, in both languages, in the language
  // files (standard 1.3.8 §11); the labels default to them.
  const en = JSON.parse(read('src/smart/quantity/lang/en.json')).runtime;
  const ru = JSON.parse(read('src/smart/quantity/lang/ru.json')).runtime;
  assert.deepEqual([en.decrement, en.increment], ['Decrease value', 'Increase value']);
  assert.deepEqual([ru.decrement, ru.increment], ['Уменьшить значение', 'Увеличить значение']);
  const settings = JSON.parse(read('src/smart/quantity/component.json')).settings;
  assert.equal(settings['decrement-label']['default-from'], 'runtime.decrement');
  assert.equal(settings['increment-label']['default-from'], 'runtime.increment');
  // The APG keys.
  for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape']) {
    assert.ok(source.includes(key), key);
  }
  assert.deepEqual(manifest.accessibility.keyboard, ['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape']);
  assert.equal(manifest.accessibility.role, 'spinbutton');
  // A pointer press keeps the focus where it was; a held stepper repeats.
  assert.match(source, /onStepMouseDown\(event\) \{\n    event\.preventDefault\(\);/u);
  assert.match(source, /const REPEAT_DELAY = 400;\nconst REPEAT_INTERVAL = 60;/u);
  // The click that follows a pointer press is the same press.
  assert.match(source, /if \(event\.detail > 0\) return;/u);
});

test('quantity: input and change on the host with one detail shape; the box\'s own events stop', () => {
  assert.match(source, /this\.dispatchEvent\(new CustomEvent\(type, \{\n      bubbles: true,\n      composed: true,\n      detail: \{value: this\.value, text: this\.text, name: this\.name, source\},/u);
  assert.match(source, /onNativeInput\(event\) \{\n    event\.stopPropagation\(\);/u);
  assert.match(source, /onNativeChange\(event\) \{\n    event\.stopPropagation\(\);/u);
  // Set from code is not a change.
  const setValue = source.slice(source.indexOf('  setValue(next) {'), source.indexOf('  // ---- The form'));
  assert.ok(setValue.length > 40, 'the setter is found');
  assert.doesNotMatch(setValue, /dispatchEvent|_emit/u);
  // A hold sends input per step and one change when it ends.
  assert.match(source, /this\.stepBy\(direction, 'button', \{change: false\}\)/u);
  assert.match(source, /stopHold\(\) \{[\s\S]*?this\.commitChange\('button'\);/u);
  // The manifest says the events the source sends, change canonical, in the axes table.
  assert.deepEqual(Object.keys(manifest.events).sort(), ['change', 'input', 'sf-field:reset']);
  assert.equal(manifest.events.change.canonical, true);
  assert.deepEqual(manifest.events.change.payload, manifest.events.input.payload);
  assert.deepEqual(Object.keys(manifest.events.change.payload.properties), ['value', 'text', 'name', 'source']);
  const axes = JSON.parse(read('contracts/public-api-axes.json')).change_event.controls;
  assert.ok(axes.includes('quantity'));
});

test('quantity: it draws the class markup, and the class binder leaves it alone', () => {
  for (const part of ['sf-quantity-label', 'sf-quantity-text', 'sf-quantity-required', 'sf-quantity-wrap', 'sf-quantity-count']) {
    assert.ok(template.includes(part), part);
  }
  assert.match(template, /const STEPPER = 'sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1\/3';/u);
  assert.match(template, /`sf-quantity--size-\$\{context\.size\}`/u);
  // The layout utilities are those the class constructor applies.
  const utility = JSON.parse(read('src/component/quantity/json/quantity.utility.json'));
  const classes = (hints) => hints.map((hint) => hint.match(/\(\.([^)]+)\)/u)?.[1]).filter(Boolean).join(' ');
  assert.ok(template.includes(`root: '${classes(utility['.sf-quantity'])}'`));
  assert.ok(template.includes(`wrap: '${classes(utility['.sf-quantity .sf-quantity-wrap'])}'`));
  assert.ok(template.includes(`count: '${classes(utility['.sf-quantity .sf-quantity-count'])}'`));
  // No sheet of its own beyond the inherited value's: the class sheet draws it.
  assert.doesNotMatch(source, /import '\.\/scss/u);
  assert.match(classSource, /function isSmartOwned\(root\) \{\n  return Boolean\(root\.closest\?\.\('sf-quantity'\)\);/u);
  assert.match(classSource, /if \(!isSmartOwned\(root\)\) bindQuantity\(root\);/u);
  assert.match(classSource, /node\.matches\?\.\(QUANTITY_SELECTOR\) && !isSmartOwned\(node\)/u);
  // The help and error line the Smart field draws has its rule in the class sheet.
  assert.match(sheet, /\.sf-quantity \.sf-quantity-hint-text-wrap \{/u);
  assert.match(sheet, /\.sf-quantity\.error \.sf-quantity-hint-text-wrap \{\n  --sf-quantity-hint-text-wrap--color: var\(--sf-error\);/u);
});

test('quantity: the loader knows it and asks for what it draws with', () => {
  const rule = read('src/smart/quantity/rule.js');
  assert.match(rule, /SF\.RuleLoader\['cl-quantity'\] = \{\n  tags: \['sf-quantity'\],/u);
  assert.match(rule, /\{ name: 'quantity' \},\n    \{ name: 'icons' \},\n    \{ name: 'icon-buttons' \},/u);
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/quantity\/rule\.js';/u);
  assert.deepEqual(manifest.composition.uses, ['component.quantity', 'component.icons', 'component.icon-buttons']);
});

// The public variables (2026-10-25): nine on the class sheet, each read with the
// value it drew before as its fallback, so a page that sets none sees no change.
// The states write the internal names, so hover, error and disabled still show.
test('quantity: the public variables wrap the values the class sheet drew before', () => {
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.find((one) => one.component === 'quantity');
  assert.equal(entry.selector, '.sf-quantity');
  // Nine from 2026-10-25, and the invalid state's own (standard 1.3.8 §6).
  assert.equal(entry.variables.length, 10);
  for (const variable of entry.variables) assert.equal(variable.since, variable.state ? '2026-10-27' : '2026-10-25', variable.name);
  for (const line of [
    '--sf-quantity-wrap--background-color: var(--sf-quantity-background-color, var(--sf-surface-0));',
    '--sf-quantity-wrap--border: var(--sf-quantity-border-width, var(--sf-px)) solid;',
    '--sf-quantity-wrap--border-color: var(--sf-quantity-border-color, var(--sf-outline));',
    '--sf-quantity-wrap--border-start-start-radius: var(--sf-quantity-radius, var(--sf-radius--ui));',
    '--sf-quantity-wrap--gap: var(--sf-quantity-gap, var(--sf-space-2));',
    '--sf-quantity-input--color: var(--sf-quantity-color, var(--sf-on-surface));',
    '--sf-icon-button--border-start-start-radius: var(--sf-quantity-stepper-radius, var(--sf-radius-1\\/2));',
  ]) assert.ok(sheet.includes(line), line);
  // The field is on the size ladder: the control height of its size, the
  // block padding sf-input's field has, steppers one rung down and standing as
  // far from the side as from the top (tests/browser/quantity-smart measures it).
  for (const [size, down] of [['1', '1\\/2'], ['2', '1'], ['1\\/2', '1\\/3']]) {
    assert.ok(sheet.includes(`--sf-quantity-wrap--block-size: var(--sf-ui-${size}--control-height);`), size);
    assert.ok(sheet.includes(`--sf-quantity-wrap--padding-inline-start: var(--sf-quantity-padding-inline, calc((var(--sf-ui-${size}--control-height) - var(--sf-ui-${down}--control-height)) / 2 - var(--sf-px)));`), size);
    assert.ok(sheet.includes(`--sf-quantity-wrap--padding-top: var(--sf-quantity-padding-block, calc(var(--sf-ui-${size}--space-y-tightness-default) - var(--sf-px)));`), size);
    const steppers = sheet.slice(sheet.indexOf(`.sf-quantity.sf-quantity--size-${size} .sf-quantity-count {`)).split('}')[0];
    assert.ok(steppers.includes(`--sf-icon-button--padding-top: var(--sf-ui-${down}--space-y-tightness-default);`), size);
    const icon = sheet.slice(sheet.indexOf(`.sf-quantity.sf-quantity--size-${size} .sf-icon {`)).split('}')[0];
    assert.ok(icon.includes(`--sf-icon--height: var(--sf-text-height-${down});`), size);
  }
  assert.match(sheet, /block-size: var\(--sf-quantity-wrap--block-size\);/u);
  // The states set the internal names only.
  for (const state of ['.sf-quantity.error .sf-quantity-wrap {', '.sf-quantity:has(input:disabled) .sf-quantity-wrap {', '.sf-quantity:has(input:disabled) input {']) {
    const block = sheet.slice(sheet.indexOf(state)).split('}')[0];
    assert.doesNotMatch(block, /--sf-quantity-[a-z]+(?:-[a-z]+)*:/u, state);
  }
  const docs = read('src/smart/quantity/docs.md');
  for (const variable of entry.variables) assert.ok(docs.includes(`| \`${variable.name}\` |`), variable.name);
});
