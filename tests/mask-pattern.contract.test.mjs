import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

/* The documented pattern grammar is IMask's: `0` digit, `a` letter, `*` any,
   `{...}` a fixed part that belongs to the value, `\` escape, every other
   character a fixed part. The native mask read only `0`, printed the rest, and
   re-read the digits of its own fixed parts as input: `+{7} (000) 000-00-00`
   turned 9161234567 into `+{7} (777) 777-77-79`. `mask-lazy` and
   `mask-placeholder-char` were ignored, and `"mask": "Number"` from JSON
   printed the word. */
async function load() {
  const source = await readFile(new URL('../src/core/js/mask.js', import.meta.url), 'utf8');
  const context = vm.createContext({window: {}, document: {querySelector: () => null}});
  vm.runInContext(source.replace(/^export .*$/gm, '').replace(/^getGlobalRoot\(\).*$/gm, ''), context);
  return context;
}

function field(value = '', caret = null) {
  const listeners = {};
  const element = {
    value,
    selectionStart: caret,
    ownerDocument: {activeElement: null},
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener(type) { delete listeners[type]; },
    setSelectionRange(start) { element.selectionStart = start; },
    type(text) {
      for (const character of text) {
        const at = element.selectionStart ?? element.value.length;
        element.value = element.value.slice(0, at) + character + element.value.slice(at);
        element.selectionStart = at + 1;
        listeners.input?.();
      }
    },
    blur() { listeners.blur?.(); },
  };
  element.ownerDocument.activeElement = element;
  return element;
}

const phone = '+{7} (000) 000-00-00';

test('fixed parts are printed once and never read back as input', async () => {
  const {applyPattern} = await load();
  assert.equal(applyPattern('9161234567', phone), '+7 (916) 123-45-67');
  assert.equal(applyPattern('+7 (916) 123-45-67', phone), '+7 (916) 123-45-67', 'formatting is idempotent');
  assert.equal(applyPattern('916', phone), '+7 (916');
  assert.equal(applyPattern('12032026', '00.00.0000'), '12.03.2026');
  assert.equal(applyPattern('', phone), '');
});

test('typing builds the value a character at a time, with the caret after the input', async () => {
  const {createNativeMask} = await load();
  const element = field('', 0);
  const mask = createNativeMask(element, {mask: phone});
  element.type('9161234567');
  assert.equal(element.value, '+7 (916) 123-45-67');
  assert.equal(element.selectionStart, element.value.length);
  assert.equal(mask.unmaskedValue, '79161234567', 'the {7} belongs to the unmasked value');
});

test('letters, any characters and escapes', async () => {
  const {applyPattern} = await load();
  assert.equal(applyPattern('ab12', 'aa-00'), 'ab-12');
  assert.equal(applyPattern('1a', 'aa-00'), 'a', 'a digit in a letter slot is dropped');
  assert.equal(applyPattern('x9', '*-0'), 'x-9');
  assert.equal(applyPattern('12', '\\00-0'), '01-2');
});

test('mask-lazy=false shows the whole template with the placeholder character', async () => {
  const {createNativeMask} = await load();
  const element = field('', 0);
  createNativeMask(element, {mask: phone, lazy: false, placeholderChar: '_'});
  assert.equal(element.value, '+7 (___) ___-__-__');
  element.selectionStart = 4;
  element.type('916');
  assert.equal(element.value, '+7 (916) ___-__-__');
  assert.equal(element.selectionStart, 7, 'the caret stays after the typed digits, not at the end');
});

test('raw digits written to unmaskedValue come back shaped, a {fixed} prefix included', async () => {
  const {createNativeMask} = await load();
  const element = field();
  const mask = createNativeMask(element, {mask: phone});
  mask.unmaskedValue = '79161234567';
  assert.equal(element.value, '+7 (916) 123-45-67');
});

test('Number from JSON groups thousands, keeps a typed radix and commits on blur', async () => {
  const {createNativeMask} = await load();
  const options = {mask: 'Number', thousandsSeparator: ' ', scale: 2, radix: ',', padFractionalZeros: true};
  const element = field('', 0);
  const mask = createNativeMask(element, options);
  element.type('1234567,');
  assert.equal(element.value, '1 234 567,', 'a radix on the way to a fraction stays');
  element.type('509');
  assert.equal(element.value, '1 234 567,50', 'no more fraction digits than the scale');
  assert.equal(mask.typedValue, 1234567.5);
  element.value = '12.5';
  element.blur();
  assert.equal(element.value, '12,50', 'either mark typed is the radix; padded when it is committed');
});

test('Number: no minus unless signed or a negative min, and min/max clamp on commit', async () => {
  const {createNativeMask, format} = await load();
  const element = field('', 0);
  createNativeMask(element, {mask: Number, scale: 0});
  element.type('-12');
  assert.equal(element.value, '12');
  const signed = field('', 0);
  createNativeMask(signed, {mask: Number, scale: 0, signed: true});
  signed.type('-12');
  assert.equal(signed.value, '-12');
  assert.equal(format('150', {mask: Number, scale: 0, max: 100}), '100');
  assert.equal(format(5, {mask: Number, scale: 2, padFractionalZeros: true, radix: ','}), '5,00');
});

test('a character typed past a shown template fills the first empty slot', async () => {
  const {createNativeMask} = await load();
  const element = field('', 0);
  createNativeMask(element, {mask: phone, lazy: false, placeholderChar: '_'});
  element.selectionStart = element.value.length;
  element.type('916');
  assert.equal(element.value, '+7 (916) ___-__-__');
});
