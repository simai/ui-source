import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// An error a host takes back leaves no trace (Larena acceptance, 2026-10-22:
// the datetime's time field said «Укажите время»; 10:30 cleared the text, but
// the red border and aria-invalid="true" stayed). The browser probe
// field-error-clear drives it; this holds the shape of the fix.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('sf-input: the host\'s invalid/error is the state, and the classes follow it both ways', () => {
  const source = read('src/smart/inputs/index.js');
  const body = source.slice(source.indexOf('afterRender() {'), source.indexOf('getInputElement() {'));
  // The binding reads the classes back to decide aria-invalid; the native
  // input's class is not drawn by the template, so it is set from the host --
  // off as well as on -- before the binding reads it.
  assert.match(body, /const invalid = this\.invalid \|\| this\.error;/u);
  assert.match(body, /this\._boundRoot\.classList\.toggle\('error', invalid\);/u);
  assert.match(body, /this\.getInputElement\(\)\?\.classList\.toggle\('error', invalid\);\s*bindInput\(this\._boundRoot\);/u);
  // The template draws aria-invalid from the same state and drops it when valid.
  const template = read('src/smart/inputs/js/templates/default.js');
  assert.ok(template.includes("aria-invalid=${field.invalid ? 'true' : nothing}"));
  assert.ok(template.includes('invalid: invalid || error,'));
});

test('sf-textarea draws the textarea\'s error class itself, so a clear reaches it', () => {
  const template = read('src/smart/textarea/js/templates/default.js');
  assert.ok(template.includes("class=${`transition${field.invalid ? ' error' : ''}`}"));
  assert.ok(template.includes("aria-invalid=${field.invalid ? 'true' : nothing}"));
});

test('sf-datepicker passes invalid and error-message to its field', () => {
  const source = read('src/smart/datepicker/index.js');
  assert.match(source, /invalid: \{type: Boolean, default: false\},/u);
  assert.match(source, /errorMessage: \{attribute: 'error-message', default: ''\},/u);
  assert.ok(source.includes('invalid: this.invalid,') && source.includes('errorMessage: this.errorMessage,'));
  const template = read('src/smart/datepicker/js/templates/default.js');
  assert.ok(template.includes('?invalid=${context.invalid}'));
  assert.ok(template.includes('error-message=${context.errorMessage || nothing}'));
  const manifest = JSON.parse(read('src/smart/datepicker/smart.manifest.json'));
  const attributes = JSON.stringify(manifest);
  assert.ok(attributes.includes('"invalid"') && attributes.includes('"error-message"'));
});

test('the field set\'s datetime editor marks the control at fault and takes the mark off', () => {
  const source = read('src/smart/field-renderers/index.js');
  const body = source.slice(source.indexOf('function renderDateTimeEdit('), source.indexOf('function renderBooleanEdit('));
  // toggleAttribute with the condition: the same line sets and clears.
  assert.match(body, /clock\?\.toggleAttribute\('invalid', timeWrong\);/u);
  assert.match(body, /picker\?\.toggleAttribute\('invalid', result\.error === 'dateMissing' \|\| result\.error === 'dateInvalid'\);/u);
  assert.match(body, /host\.setFieldError\?\.\(field, message \|\| null\);/u);
});
