import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const source = fs.readFileSync(new URL('../src/core/js/control-spacing.js', import.meta.url), 'utf8');
const {resolveControlSpacing} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const pairs = [['compact', 'low'], ['normal', ''], ['comfortable', 'high'], ['spacious', 'highest']];
test('four canonical profiles preserve the exact legacy modifier without new geometry', () => {
  for (const [spacing, tightness] of pairs) {
    assert.deepEqual(resolveControlSpacing({spacing}), {spacing, tightness, diagnostics: []});
    assert.deepEqual(resolveControlSpacing({tightness}), {spacing, tightness, diagnostics: []});
  }
  for (const input of [{}, {tightness: ''}, {tightness: 'default'}, {spacing: null}]) {
    assert.deepEqual(resolveControlSpacing(input), {spacing: 'normal', tightness: '', diagnostics: []});
  }
});
test('canonical priority is independent of property order, including invalid and empty values', () => {
  for (const [spacing, modifier] of pairs) for (const [, tightness] of pairs) {
    const result = resolveControlSpacing({spacing, tightness});
    assert.deepEqual(result, resolveControlSpacing({tightness, spacing}));
    assert.equal(result.tightness, modifier);
    assert.equal(result.diagnostics.includes('spacing-overrides-tightness'), modifier !== tightness);
  }
  for (const spacing of ['', 'wrong', 1, false]) {
    assert.deepEqual(resolveControlSpacing({spacing, tightness: 'highest'}), {
      spacing: 'normal', tightness: '', diagnostics: ['invalid-spacing', 'spacing-overrides-tightness'],
    });
  }
});
test('normalization, update and removal do not mutate the input or retain stale state', () => {
  const input = {spacing: ' COMFORTABLE ', tightness: 'low'};
  assert.equal(resolveControlSpacing(input).tightness, 'high');
  assert.equal(input.spacing, ' COMFORTABLE ');
  delete input.spacing;
  assert.equal(resolveControlSpacing(input).tightness, 'low');
  input.tightness = 'unknown';
  assert.deepEqual(resolveControlSpacing(input), {spacing: 'normal', tightness: '', diagnostics: ['invalid-tightness']});
});
