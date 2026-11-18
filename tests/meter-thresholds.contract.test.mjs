import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

// The meter variant takes the HTML meter's thresholds (dispatcher decision,
// DEV held answers H4, msg-bc1702eb): low, high and optimum.
const root = resolve(import.meta.dirname, '..');
// index.js imports browser-only modules: the two functions are read from the
// source and run alone (they use nothing outside themselves).
const rendererSource = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const from = rendererSource.indexOf('function meterLimit(');
const to = rendererSource.indexOf('function meterProps(');
assert.ok(from > 0 && to > from, 'meterLimit and meterStatus stand before meterProps');
const meterStatus = new Function(`${rendererSource.slice(from, to).replace('export function', 'function')}; return meterStatus;`)();
const {PROPERTY_TYPES} = await import('../src/smart/field-renderers/registry.js');

test('H4: without low and high the meter draws no status', () => {
  assert.equal(meterStatus({variant: 'meter'}, 99), '');
  assert.equal(meterStatus({variant: 'meter', optimum: 0}, 99), '');
});

test('H4: low and high with the optimum unset: the middle is good, as <meter>', () => {
  const field = {variant: 'meter', low: 80, high: 95};
  // optimum 50 lies below low: the low region is good
  assert.equal(meterStatus(field, 40), '');
  assert.equal(meterStatus(field, 80), 'warning');
  assert.equal(meterStatus(field, 90), 'warning');
  assert.equal(meterStatus(field, 96), 'error');
});

test('H4: optimum picks the good region', () => {
  const fill = {variant: 'meter', low: 30, high: 70, optimum: 100};
  assert.equal(meterStatus(fill, 10), 'error');
  assert.equal(meterStatus(fill, 50), 'warning');
  assert.equal(meterStatus(fill, 90), '');
  const middle = {variant: 'meter', low: 30, high: 70, optimum: 50};
  assert.equal(meterStatus(middle, 10), 'warning');
  assert.equal(meterStatus(middle, 50), '');
  assert.equal(meterStatus(middle, 90), 'warning');
  // strings from a host are numbers too; high below low is clamped to low
  assert.equal(meterStatus({low: '80', high: '95'}, 99), 'error');
  assert.equal(meterStatus({low: 60, high: 20, optimum: 0}, 70), 'error');
});

test('H4: the number type declares low, high and optimum, and the meter cell passes status', () => {
  const params = JSON.stringify(PROPERTY_TYPES.number ?? PROPERTY_TYPES);
  for (const name of ['low', 'high', 'optimum']) assert.match(params, new RegExp(`"${name}"`));
  const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
  assert.match(source, /status=\$\{status \|\| nothing\}/);
});
