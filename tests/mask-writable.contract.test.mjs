import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

/* Every value a consumer is expected to write has to be writable. The country
   code field writes the raw digits of a value the page arrived with; while
   unmaskedValue had a getter and no setter, that assignment threw under strict
   mode, the warning was swallowed by the catch, and everything after it in the
   same try -- the re-format and the required-state sync -- never ran. */
async function nativeMask() {
  const source = await readFile(new URL('../src/core/js/mask.js', import.meta.url), 'utf8');
  const context = vm.createContext({window: {}, document: {querySelector: () => null}});
  vm.runInContext(source.replace(/^export .*$/gm, '').replace(/^getGlobalRoot\(\).*$/gm, ''), context);
  return context.createNativeMask;
}

function field(value = '') {
  return {value, addEventListener() {}, removeEventListener() {}};
}

test('mask: the values a consumer writes all have setters', async () => {
  const create = await nativeMask();
  const instance = create(field(), {mask: '+0 000 000-00-00'});
  for (const name of ['value', 'unmaskedValue', 'typedValue']) {
    const descriptor = Object.getOwnPropertyDescriptor(instance, name);
    assert.ok(descriptor, `${name} is missing`);
    assert.equal(typeof descriptor.set, 'function', `${name} has no setter`);
  }
});

test('mask: raw digits written through the mask come back shaped', async () => {
  const create = await nativeMask();
  const element = field();
  const instance = create(element, {mask: '+0 000 000-00-00'});
  instance.unmaskedValue = '79031234567';
  assert.equal(element.value, '+7 903 123-45-67');
  assert.equal(instance.unmaskedValue, '79031234567');
});

test('country code: the guard asks whether a property can be written, not whether it exists', async () => {
  const source = await readFile(new URL('../src/component/country-code/js/_country_code.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('/* Whether a property can be assigned'), source.indexOf('async function applyMaskForRoot')), context);
  const {writable} = context;
  assert.equal(writable({get only() { return 1; }}, 'only'), false, 'getter alone is not writable');
  assert.equal(writable({get both() { return 1; }, set both(v) {}}, 'both'), true);
  assert.equal(writable(Object.create({get inherited() { return 1; }, set inherited(v) {}}), 'inherited'), true,
    'an implementation may carry the accessor on its prototype');
  assert.equal(writable({plain: 1}, 'plain'), true);
  assert.equal(writable({}, 'absent'), false);
});
