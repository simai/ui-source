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
