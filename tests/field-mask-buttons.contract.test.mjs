import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';
import {maskPattern, maskState} from '../src/smart/field-renderers/mask.js';

// The set's half of simai.property-view-port 1.16.0 (consumer simai.main,
// agreed contract q-b0de123841): a string with field.mask is the stock sf-input
// with its mask, its value the text as shown and an incomplete one reported to
// the host; a choice with variant buttons is a segmented sf-button-group. The
// plain string and the dropdown choice are what they were.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const body = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}\n', start));
};
const element = (text, tag) => text.slice(text.indexOf(`<${tag}`), text.indexOf(`></${tag}>`));

// The formatter the field types through, so the completeness read here is
// checked against the text sf-input actually shows.
globalThis.window ??= globalThis;
const {applyPattern} = await import('../src/core/js/mask.js');

test('a mask is a non-empty string; absent, null and "" are no mask', () => {
  assert.equal(maskPattern({mask: '+7 (000) 000-00-00'}), '+7 (000) 000-00-00');
  for (const field of [{}, {mask: null}, {mask: ''}, {mask: 7}]) assert.equal(maskPattern(field), null);
});

test('a text is empty, incomplete or complete, read as the formatter shows it', () => {
  const phone = '+7 (000) 000-00-00';
  assert.equal(maskState('', phone), 'empty');
  assert.equal(maskState('+7 (', phone), 'empty');
  assert.equal(maskState('+7 (___) ___-__-__', phone), 'empty');
  assert.equal(maskState('+7 (7', phone), 'incomplete', 'a typed 7 is a digit, not the fixed 7');
  assert.equal(maskState('+7 (912) 345-67-8', phone), 'incomplete');
  assert.equal(maskState('+7 (9__) ___-__-__', phone), 'incomplete');
  assert.equal(maskState('+7 (912) 345-67-89', phone), 'complete');
  // What the formatter makes of typed digits is what the state reads.
  assert.equal(maskState(applyPattern('9123456789', phone), phone), 'complete');
  assert.equal(maskState(applyPattern('912345', phone), phone), 'incomplete');
  assert.equal(applyPattern('9123456789', phone), '+7 (912) 345-67-89');
  // Letters, any character, an escaped slot character.
  assert.equal(maskState('AB-12', 'aa-00'), 'complete');
  assert.equal(maskState('A1-12', 'aa-00'), 'incomplete');
  assert.equal(maskState('x0y', '*\\0*'), 'complete');
  assert.equal(maskState('a.b', '*.*'), 'complete');
  assert.equal(maskState('a.', '*.*'), 'incomplete');
});

test('several masks keep their own state', () => {
  const phone = '+7 (000) 000-00-00';
  const inn = '0000000000';
  assert.equal(maskState('+7 (912) 345-67-89', phone), 'complete');
  assert.equal(maskState('77012', inn), 'incomplete');
  assert.equal(maskState('+7 (912) 345-67-89', phone), 'complete');
});

test('a masked string is the stock sf-input with its mask; phone and password keep their controls', () => {
  const edit = body('renderTextEdit');
  assert.match(edit, /const mask = maskPattern\(field\);/u);
  // phone, then password, then the mask, then the plain field as it was.
  const order = ['renderPhoneEdit', 'renderPasswordEdit', 'renderMaskedEdit', '<sf-input'].map((name) => edit.indexOf(name));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const masked = element(body('renderMaskedEdit'), 'sf-input');
  assert.match(masked, /\n\s+mask\n/u);
  assert.match(masked, /mask-pattern=\$\{mask\}/u);
  assert.match(masked, /size=\$\{EDIT_SIZE\}/u);
  assert.match(masked, /value=\$\{value \?\? ''\}/u);
  assert.match(masked, /\?required=\$\{Boolean\(field\.required\)\}/u);
  assert.match(masked, /aria-label=\$\{field\.label \|\| field\.key \|\| ''\}/u);
  assert.equal((masked.match(/@[a-z-:]+=/gu) ?? []).join(), '@input=,@change=');
});

test('a masked value is written as shown, a cleared one as null or "", an incomplete one is reported', () => {
  const masked = body('renderMaskedEdit');
  assert.match(masked, /const cleared = field\.nullable === false \? '' : null;/u);
  assert.match(masked, /host\.setFieldValue\(field, state === 'empty' \? cleared : text\);/u);
  assert.match(masked, /host\.setFieldError\?\.\(field, null\);/u);
  // Incomplete: told to a host that hears errors, withdrawn from one that does not.
  assert.match(masked, /host\.setFieldError\(field, message\);\n\s+host\.setFieldValue\(field, text\);/u);
  assert.match(masked, /\} else \{\n\s+host\.setFieldValue\(field, undefined\);/u);
  // The control's own mark and stock message, once the person leaves it.
  assert.match(masked, /if \(left && input\) \{\n\s+input\.setAttribute\('error-message', message\);\n\s+input\.toggleAttribute\('invalid', true\);/u);
  assert.match(masked, /const message = setText\(host, 'maskIncomplete'\);/u);
  assert.equal((source.match(/^        maskIncomplete: '/gmu) ?? []).length, 2, 'en and ru');
  assert.match(source, /maskIncomplete: 'Complete the field',/u);
  assert.match(source, /maskIncomplete: 'Заполните поле полностью',/u);
});

test('the plain string edit is unchanged', () => {
  const edit = body('renderTextEdit');
  const plain = edit.slice(edit.indexOf('<sf-input'));
  assert.doesNotMatch(plain, /mask/u);
  assert.match(plain, /@input=\$\{\(event\) => host\.setFieldValue\(field, event\.target\?\.value \?\? ''\)\}/u);
});

test('a choice as buttons is one segmented sf-button-group; the dropdown is unchanged', () => {
  assert.match(body('renderChoiceEdit'), /^function renderChoiceEdit\(field, value, host\) \{\n    if \(isChoiceButtons\(field\)\) return renderChoiceButtons\(field, value, host\);\n/u);
  assert.match(body('renderChoiceEdit'), /<sf-dropdown[\s\S]*mode="select"/u);
  const buttons = body('renderChoiceButtons');
  const group = element(buttons, 'sf-button-group');
  assert.match(group, /appearance="segmented"/u);
  assert.match(group, /size=\$\{size\}/u);
  assert.match(group, /root-class=\$\{locked \? 'flex-wrap pointer-event-none' : 'flex-wrap'\}/u);
  assert.match(group, /\?disabled=\$\{disabled\}/u);
  assert.match(buttons, /const size = CHOICE_BUTTON_SIZES\.has\(asked\) \? asked : EDIT_SIZE;/u);
  assert.match(source, /const CHOICE_BUTTON_SIZES = new Set\(\['1\/2', '1', '2'\]\);/u);
  // Clearing: only a field that is not required, by pressing the chosen button again.
  assert.match(buttons, /const clearable = field\.required !== true && !locked && !disabled;/u);
  assert.match(buttons, /group\.clear\?\.\(\);/u);
  // The option's own value, or null.
  assert.match(group, /host\.setFieldValue\(field, next === '' \? null : optionValue\(next\)\);/u);
});

test('a read-only choice as buttons stays a control; every other read-only field is still shown', () => {
  const edit = body('renderEditField');
  assert.match(source, /const keepsControlWhenLocked = \(asked, field\) => asked === 'choice' && isChoiceButtons\(field\);/u);
  assert.match(edit, /if \(\(field\.readonly === true \|\| disabled\) && VIEW_RENDERERS\[asked\] && !keepsControlWhenLocked\(asked, field\)\) \{\n\s+return renderViewField\(field, value, host, options\);/u);
});

test('the registry names the buttons variant of choice and the keys the two read', () => {
  const string = PROPERTY_TYPES.find((entry) => entry.type === 'string');
  assert.deepEqual(string.params, ['placeholder', 'mask', 'nullable', 'required', 'readonly']);
  const choice = PROPERTY_TYPES.find((entry) => entry.type === 'choice');
  assert.deepEqual(choice.variants, [{id: 'buttons', label: {ru: 'Кнопками', en: 'As buttons'}}]);
  assert.deepEqual(choice.params, ['options', 'badgeAppearance', 'size', 'required', 'readonly']);
});
