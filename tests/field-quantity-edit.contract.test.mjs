import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// An integer or a number whose variant is `stepper` is edited with sf-quantity
// (owner, 2026-10-25): «−» and «+», the arrow keys and the bounds the field
// names. Every other number keeps the plain sf-input it had. The value goes
// through setFieldValue as every control's does.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const body = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}\n', start));
};

test('only a stepper number is drawn with sf-quantity; the default number edit is unchanged', () => {
  assert.match(body('isStepperField'), /return String\(field\.variant \?\? ''\) === 'stepper';/u);
  assert.match(body('renderNumberEdit'), /^function renderNumberEdit\(field, value, host\) \{\n    if \(isStepperField\(field\)\) return renderStepperEdit\(field, value, host\);\n/u);
  // The plain editor below it is the sf-input it was.
  const plain = body('renderNumberEdit');
  assert.match(plain, /<sf-input[\s\S]*inputmode=\$\{decimal \? 'decimal' : 'numeric'\}/u);
  assert.match(plain, /host\.setFieldValue\(field, next === '' \? null : Number\(next\)\);/u);
  assert.match(source, /\n    integer: renderNumberEdit,\n    number: renderNumberEdit,\n/u);
});

test('the registry names the stepper variant for both number types, and the keys it reads', () => {
  for (const type of ['integer', 'number']) {
    const entry = PROPERTY_TYPES.find((one) => one.type === type);
    assert.deepEqual(entry.variants.find((variant) => variant.id === 'stepper'),
      {id: 'stepper', label: {ru: 'Кнопками «−» и «+»', en: 'With steppers'}}, type);
  }
  assert.deepEqual(PROPERTY_TYPES.find((one) => one.type === 'integer').params, ['unit', 'min', 'max', 'step', 'required', 'readonly']);
  assert.deepEqual(PROPERTY_TYPES.find((one) => one.type === 'number').params, ['unit', 'min', 'max', 'step', 'precision', 'required', 'readonly']);
  // The scale stays the number's first variant.
  assert.equal(PROPERTY_TYPES.find((one) => one.type === 'number').variants[0].id, 'scale');
});

test('the stepper takes the field as the other controls do', () => {
  const edit = body('renderStepperEdit');
  const element = edit.slice(edit.indexOf('<sf-quantity'), edit.indexOf('></sf-quantity>'));
  assert.match(element, /size=\$\{EDIT_SIZE\}/u);
  assert.match(element, /name=\$\{fieldName\(field\)\}/u);
  assert.match(element, /value=\$\{stepperNumber\(scalarValue\(value\)\)\}/u);
  for (const bound of ['min', 'max']) {
    assert.match(element, new RegExp(`${bound}=\\$\\{stepperNumber\\(field\\.${bound}\\) \\|\\| nothing\\}`, 'u'), bound);
  }
  // The panel prints the label: the control takes it as its name only.
  assert.match(element, /aria-label=\$\{field\.label \|\| field\.key \|\| ''\}/u);
  assert.doesNotMatch(element, /(?<!aria-)label=/u);
  assert.match(element, /\?required=\$\{Boolean\(field\.required\)\}/u);
  assert.match(element, /\?disabled=\$\{field\.readonly === true\}/u);
  // An integer has no decimals; a number has its precision, its step's, or two.
  assert.match(edit, /const precision = decimal\n\s+\? stepperNumber\(field\.precision\) \|\| \(step \? '' : '2'\)\n\s+: '0';/u);
  // The value written is the stepper's number, or null.
  assert.match(edit, /const write = \(event\) => host\.setFieldValue\(field, event\.detail\?\.value \?\? null\);/u);
  assert.equal((edit.match(/@[a-z-:]+=/gu) ?? []).join(), '@input=,@change=');
});
