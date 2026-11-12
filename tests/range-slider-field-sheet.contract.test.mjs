/* global URL */
// The field sheet of the slider (component/range-slider/scss/_css__range_slider_field.scss):
// sizes (S5), touch (S6), disabled (S7), track B (C78), bubble (C78),
// read-only R2, ticks T1 and the from/to field (C80). Values only from system tokens.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const sheet = await readFile(new URL('../src/component/range-slider/scss/_css__range_slider_field.scss', import.meta.url), 'utf8');
const rule = (selector) => {
  const at = sheet.indexOf(`\n${selector} {`);
  assert.ok(at >= 0, selector);
  return sheet.slice(at, sheet.indexOf('}', at));
};

test('no literal sizes or colours: every value is a system token', () => {
  const values = sheet.replace(/\/\/.*$/gmu, '').match(/:\s*[^;{}]+;/gu) || [];
  for (const value of values) {
    assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(|\b\d+(?:\.\d+)?(?:px|rem|em)\b/iu, value);
  }
});

test('S5: the row is the control height of the step, the handle the icon of the step', () => {
  assert.match(rule('.sf-range-slider-group--size-1\\/2,\n.sf-range-slider--size-1\\/2'), /--sf-range-slider--row: var\(--sf-ui-1\\\/2--control-height\);[\s\S]*--sf-thumb-handle--height: var\(--sf-icon-size-2\);/u);
  assert.match(rule('.sf-range-slider-group--size-1,\n.sf-range-slider--size-1'), /--sf-range-slider--row: var\(--sf-ui-1--control-height\);/u);
  assert.match(rule('.sf-range-slider-group--size-2,\n.sf-range-slider--size-2'), /--sf-range-slider--row: var\(--sf-ui-2--control-height\);[\s\S]*--sf-thumb-handle--height: var\(--sf-icon-size-4\);/u);
  assert.match(rule('.sf-range-slider'), /min-block-size: var\(--sf-range-slider--row, var\(--sf-ui-1--control-height\)\);/u);
});

test('S6: under a finger the hit area is at least the size-2 control height, the disc unchanged', () => {
  const coarse = sheet.slice(sheet.indexOf('@media (pointer: coarse)'));
  assert.match(coarse, /--sf-range-slider--hit: max\(var\(--sf-range-slider--row, var\(--sf-ui-1--control-height\)\), var\(--sf-ui-2--control-height\)\);/u);
  assert.match(coarse, /inset-block: calc\(\(var\(--sf-thumb-handle--height, var\(--sf-icon-size-3\)\) - var\(--sf-range-slider--hit\)\) \/ 2\);/u);
});

test('S7: disabled name, value and scale take the disabled content role', () => {
  assert.match(sheet, /\.sf-range-slider-group\.disabled \.sf-range-slider-name,\n\.sf-range-slider-group\.disabled \.sf-range-slider-output,\n\.sf-range-slider-group\.disabled \.sf-range-slider-scale \{\n {2}color: var\(--sf-on-surface-disabled\);/u);
  assert.match(sheet, /\.disabled\) \.sf-thumb-text \{\n {2}--sf-thumb-text--color: var\(--sf-on-surface-disabled\);/u);
});

test('C78: the value bubble shows only while its handle is dragged or keyboard-focused, without room of its own', () => {
  assert.match(rule('.sf-range-slider .sf-range-slider-labels.sf-thumb--label-tooltip'), /position: absolute;/u);
  assert.match(rule('.sf-range-slider .sf-range-slider-labels.sf-thumb--label-tooltip > .sf-tooltip'), /opacity: 0;/u);
  assert.ok(sheet.includes('.sf-range-slider:has(.sf-range-slider-handle-lower:is(.sf-range-slider-handle--dragging, :focus-visible))'));
  assert.ok(sheet.includes('.sf-range-slider-labels--merged.sf-thumb--label-tooltip > [data-handle="0"]'));
  assert.match(sheet, /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.sf-range-slider \.sf-range-slider-labels\.sf-thumb--label-tooltip > \.sf-tooltip \{\n {4}transition: none;/u);
});

test('C80 R2: read-only is the light outline at field height with a neutral handle and fill', () => {
  const frame = rule('.sf-range-slider-group.readonly .sf-range-slider');
  assert.match(frame, /border: var\(--sf-px\) solid var\(--sf-outline-variant\);/u);
  assert.match(frame, /block-size: var\(--sf-range-slider--row, var\(--sf-ui-1--control-height\)\);/u);
  // Acceptance R1: the root is a flex-1 item of the track column, so the height
  // holds only as a minimum; min-block-size 0 drew the frame 26 / 22 px.
  assert.match(frame, /\n {2}min-block-size: var\(--sf-range-slider--row, var\(--sf-ui-1--control-height\)\);/u);
  assert.match(rule('.sf-range-slider.readonly .sf-thumb-handle,\n.sf-range-slider[data-readonly="true"] .sf-thumb-handle'), /background-color: var\(--sf-on-surface-variant\);/u);
});

test('C80 T1: ticks are cut out in the colour of the place; the scale is logical', () => {
  assert.match(rule('.sf-range-slider .sf-range-slider-tick'), /background-color: var\(--sf-range-slider-tick--background-color, var\(--sf-surface-place\)\);[\s\S]*margin-inline-start:/u);
  assert.match(rule('.sf-range-slider-scale-mark--end'), /justify-content: flex-end;/u);
});

test('C80: the from/to field is a field of the step at the end of the track line', () => {
  const field = rule('.sf-range-slider-field');
  assert.match(field, /block-size: var\(--sf-range-slider--row, var\(--sf-ui-1--control-height\)\);/u);
  assert.match(field, /border: var\(--sf-px\) solid var\(--sf-outline\);/u);
  assert.match(field, /padding-inline: calc\(var\(--sf-range-slider--space-x, var\(--sf-ui-1--space-x\)\) - var\(--sf-px\)\);/u);
  assert.match(rule('.sf-range-slider-group.readonly .sf-range-slider-field'), /--sf-outline-variant/u);
});

test('C80 acceptance R2: the from/to numbers stay whole -- the box is as wide as its widest end', () => {
  const field = rule('.sf-range-slider-field');
  assert.match(field, /flex: none;/u);
  assert.doesNotMatch(field, /max-inline-size/u);
  assert.match(rule('.sf-range-slider-field-box'), /display: inline-grid;\n {2}flex: none;/u);
  assert.match(rule('.sf-range-slider-field-box > *'), /grid-area: 1 \/ 1;/u);
  assert.match(rule('.sf-range-slider-field-ruler'), /visibility: hidden;\n {2}white-space: pre;/u);
  assert.match(rule('.sf-range-slider-field-input'), /inline-size: 100%;/u);
  // The track gives way down to a finger's target, then the line wraps.
  assert.match(rule('.sf-range-slider-line'), /flex-wrap: wrap;/u);
  assert.match(rule('.sf-range-slider-track-column'), /min-inline-size: var\(--sf-ui-2--control-height\);/u);
});
