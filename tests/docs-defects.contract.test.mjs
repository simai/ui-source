import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Three defects the docs repin found in the pair (DEV letter msg-fc6473fa,
// ui-control control/evidence/2026-11-18-docs-defects). The browser probe
// tests/browser/public-variable-defaults.browser.mjs holds every default to
// the built page; these hold the source.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
const defaultOf = (component, name) => contract.components.find((entry) => entry.component === component)
  .variables.find((variable) => variable.name === name).default;

test('DF-1: the progress fills default to primary and the spinner to the quiet ink, as drawn (C131 (1), C130 (6))', () => {
  assert.equal(defaultOf('progress-bar', '--sf-progress-bar-fill-color'), 'var(--sf-primary)');
  assert.equal(defaultOf('progress-scale', '--sf-progress-scale-fill-color'), 'var(--sf-primary)');
  assert.equal(defaultOf('progress-ring', '--sf-progress-ring-fill-color'), 'var(--sf-primary)');
  assert.equal(defaultOf('spinner', '--sf-spinner-color'), 'var(--sf-on-surface-variant)');
  assert.match(read('src/component/progress-bar/scss/_css__progressbar.scss'), /var\(--sf-progress-bar-fill-color, var\(--sf-primary\)\)/u);
  assert.match(read('src/component/spinner/scss/_css__spinner.scss'), /var\(--sf-spinner-color, var\(--sf-loader--color, var\(--sf-on-surface-variant\)\)\)/u);
});

test('DF-1: a default is a CSS value, never words', () => {
  for (const entry of contract.components) {
    for (const variable of entry.variables) {
      assert.doesNotMatch(variable.default, /\((?:body|the|not) |[А-Яа-яЁё]/u, `${entry.component} ${variable.name}`);
    }
  }
});

test('DF-2: sf-quantity--pointer-focus changes no look and is a dated alias (C153 (4))', () => {
  const css = read('src/component/quantity/scss/_css__quantity.scss').replace(/\/\*[\s\S]*?\*\//gu, '');
  assert.doesNotMatch(css, /pointer-focus/u, 'no rule reads the class');
  assert.match(read('src/component/quantity/js/_quantity.js'), /classList\.add\('sf-quantity--pointer-focus'\)/u);
  const record = JSON.parse(read('contracts/changes/journal.json')).records.find(({id}) => id === 'class-quantity-pointer-focus-c153');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items, [{component: 'sf-quantity', from: 'sf-quantity--pointer-focus', to: null}]);
});

test('DF-3: the class field binds a div root whose label text is a label of its own', () => {
  const javascript = read('src/component/inputs/js/_inputs.js');
  assert.match(javascript, /const INPUT_SELECTOR = '\.sf-input:is\(label, div\)';/u);
  assert.match(javascript, /this\.template = document\.createElement\('div'\);/u);
  assert.match(javascript, /const labelText = document\.createElement\('label'\);/u);
  const shared = read('src/component/field-contract.js');
  assert.match(shared, /labelNode\?\.tagName === 'LABEL' && !labelNode\.hasAttribute\('for'\)/u);
  assert.match(shared, /getElementById\?\.\(id\)/u, 'the label id is checked for a clash');
});
