import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

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
  assert.match(body('isStepperField'), /return templateOf\(field\) === 'stepper';/u);
  assert.match(body('renderNumberEdit'), /^function renderNumberEdit\(field, value, host\) \{\n    if \(isStepperField\(field\)\) return renderStepperEdit\(field, value, host\);\n/u);
  // The plain editor below it is one sf-input for every number (C303 (2)):
  // the digit keyboard for a whole one (decimals 0, an integer field), the
  // decimal one otherwise; an integer field still writes a number.
  const plain = body('renderNumberEdit');
  assert.match(plain, /inputmode=\$\{decimals === 0 \? 'numeric' : 'decimal'\}/u);
  assert.match(plain, /host\.setFieldValue\(field, asString \? read\.value : Number\(read\.value\)\)/u);
  assert.match(source, /\n    number: renderNumberEdit,\n/u);
  assert.doesNotMatch(source, /\n    integer: renderNumberEdit,\n/u);
});

// C303 (2): number is one type; integer is read as number with decimals 0.
test('the registry names the stepper template of the one number type, and the keys it reads', () => {
  assert.equal(PROPERTY_TYPES.find((one) => one.type === 'integer'), undefined);
  const number = PROPERTY_TYPES.find((one) => one.type === 'number');
  assert.deepEqual(number.variants.find((variant) => variant.id === 'stepper'),
    {id: 'stepper', label: {ru: 'Кнопками «−» и «+»', en: 'With steppers'}});
  assert.deepEqual(number.params, ['decimals', 'unit', 'min', 'max', 'step', 'precision', 'low', 'high', 'optimum', 'required', 'readonly']); // H4: the meter's thresholds
  assert.deepEqual(number.templates.map((one) => one.id), ['input', 'stepper', 'scale', 'meter']);
});

test('the stepper takes the field as the other controls do', () => {
  const edit = body('renderStepperEdit');
  const element = edit.slice(edit.indexOf('<sf-input-quantity'), edit.indexOf('></sf-input-quantity>'));
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
  // A number has its decimals (an integer field 0), its step's, or two.
  assert.match(edit, /const precision = decimals !== null \? String\(decimals\) : \(step \? '' : '2'\);/u);
  // The value written is the stepper's number, or null.
  // A percent's stepper writes the percent's decimal string (type templates step 5); a number's, the value as before.
  assert.match(edit, /const write = \(event\) => host\.setFieldValue\(field, written\(event\.detail\?\.value \?\? null\)\);/u);
  assert.match(edit, /if \(!percent \|\| raw === null \|\| raw === undefined \|\| raw === ''\) return raw \?\? null;/u);
  assert.equal((edit.match(/@[a-z-:]+=/gu) ?? []).join(), '@input=,@change=');
});
