import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// Field ladder icons (C151 (1)) and the range slider field's focus (C153 (4)),
// follow-ups of fix/fields-in1 and fix/range-slider-rs1. A phone's size 3
// field icon is the icon ladder's 28 (--sf-icon-size-4), one step below the
// desktop 36, in every field of the ladder, written once in the ladder.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const ladder = read('src/component/inputs/scss/_field-ladder.scss');
const inputs = read('src/component/inputs/scss/_css__inputs.scss');
const lookup = read('src/smart/input-lookup/scss/_smart__lookup.scss');
const color = read('src/smart/input-color/js/templates/default.css');
const smartInput = read('src/smart/input/js/templates/default.css');
const slider = read('src/component/range-slider/scss/_css__range_slider_field.scss');

test('the ladder writes the icon of a step to any property a field names', () => {
  assert.match(ladder, /@mixin icon-size\(\$properties, \$size\)/u);
  assert.match(ladder, /@mixin icon\(\$size\) \{\s*@include icon-size\(\(--sf-icon--font-size, --sf-icon--height, --sf-icon--width\), \$size\);/u);
  assert.match(ladder, /@media not all and \(min-width: 60rem\) \{\s*@each \$property in \$properties \{\s*#\{\$property\}: var\(--sf-icon-size-4\);/u);
});

test('sf-input (and sf-input-date through it): the field action glyph of 3 is the ladder icon', () => {
  assert.match(inputs, /\.sf-input\.sf-input--size-3 \{\s*@include ladder\.icon-size\(--sf-field-action--glyph, '3'\);/u);
  assert.doesNotMatch(inputs, /\.sf-input\.sf-input--size-3 \{\s*--sf-field-action--glyph: var\(--sf-text-height-3\);/u);
});

test('sf-input-lookup: its icons and its action glyph at the outer steps read the ladder icon', () => {
  assert.match(lookup, /@include ladder\.icon-size\(\(--sf-field-action--glyph, --sf-lookup--icon-size\), \$size\);/u);
  assert.match(lookup, /--sf-icon--font-size: var\(--sf-lookup--icon-size, var\(--sf-lookup--line-height\)\);/u);
  // The larger icon stands out of the text line evenly: the frame keeps its height (52 on a phone at 3).
  assert.match(lookup, /sf-icon\.sf-lookup-value-picture > \.sf-icon \{\s*margin-block: calc\(\(var\(--sf-lookup--line-height\) - var\(--sf-lookup--icon-size, var\(--sf-lookup--line-height\)\)\) \/ 2\);/u);
});

test('sf-input-color: swatch, chevron and reset take 28 at 3 on a phone, one size', () => {
  assert.match(color, /@media not all and \(min-width: 60rem\) \{\s*\.sf-color-field--size-3,\s*\.sf-color--theme\.sf-color--size-3 \{\s*--sf-color--icon-size: var\(--sf-icon-size-4\);/u);
  assert.match(color, /--sf-field-action--glyph: var\(--sf-color--icon-size, var\(--sf-color--text-height\)\);/u);
  assert.match(color, /\.sf-color-chip \{[^}]*inline-size: var\(--sf-color--icon-size, /u);
  assert.match(color, /\.sf-color-chevron \{\s*--sf-icon--font-size: var\(--sf-color--icon-size, /u);
});

test('Smart sf-input (and sf-input-date in it): no own size 3 icon rule over the class layer', () => {
  // The template sheet drew the size 3 icon at the text line (24 on a phone)
  // with more weight than the class layer's field-ladder.icon rule.
  assert.doesNotMatch(smartInput, /\.sf-input\.sf-input--size-3 > \.sf-input-field > \.sf-input-(hint|left) > sf-icon > \.sf-icon/u);
  assert.ok(read('src/component/inputs/scss/_css__custom.scss').includes('.sf-input.sf-input--size-3 > .sf-input-field > .sf-input-hint > sf-icon > .sf-icon,'), 'the class rule reaches the Smart hint icon in its host');
  assert.match(read('src/component/inputs/scss/_css__custom.scss'), /\.sf-input\.sf-input--size-3 > \.sf-input-field > \.sf-input-left \.sf-icon[^{]*\{\s*@include ladder\.icon\('3'\);/u);
});

test('range slider from/to field: hover in the text ink, focus 2 px inside for mouse and keys (C153 (4))', () => {
  assert.match(slider, /\.sf-range-slider-group:not\(\.disabled\):not\(\.readonly\) \.sf-range-slider-field:hover \{\s*border-color: var\(--sf-on-surface\);/u);
  assert.match(slider, /\.sf-range-slider-group:not\(\.disabled\) \.sf-range-slider-field:has\(\.sf-range-slider-field-input:focus\) \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--inset\);/u);
  assert.match(slider, /\.sf-range-slider-group--field:not\(\.disabled\) \.sf-range-slider-field-box:has\(\.sf-range-slider-field-input:focus\) \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--inset\);/u);
  assert.doesNotMatch(slider, /outline-offset: var\(--sf-focus--offset\)/u);
  assert.doesNotMatch(slider, /border-color: var\(--sf-primary-hover\)/u);
});
