import assert from 'node:assert/strict';
import test from 'node:test';

// A component can arrive twice — as its own file and inside a bundle that
// carries it. Registering it again is a no-op. A different component taking
// the tag, or a class that is not a Simai element, is a real conflict.

const brand = 'simai.smart-base.v1';

class Base {
  static get sfElementBrand() {
    return brand;
  }

  static isSameComponentAs(other) {
    if (other === this) return true;
    if (!other || other.sfElementBrand !== this.sfElementBrand) return false;
    const isClassName = (value) => /^[A-Z][A-Za-z0-9_]{2,}$/.test(String(value || ''));
    if (isClassName(other.name) && isClassName(this.name)) return other.name === this.name;
    return true;
  }
}

const named = (name, parent = Base) => {
  const created = class extends parent {};
  Object.defineProperty(created, 'name', { value: name });
  return created;
};

test('the same class is the same component', () => {
  const SfIcon = named('SfIcon');
  assert.equal(SfIcon.isSameComponentAs(SfIcon), true);
});

test('a second copy of one component is recognised across bundles', () => {
  const fromFile = named('SfIcon');
  const fromBundle = named('SfIcon');
  assert.notEqual(fromFile, fromBundle);
  assert.equal(fromFile.isSameComponentAs(fromBundle), true);
});

test('two different components on one tag stay a conflict', () => {
  assert.equal(named('SfIcon').isSameComponentAs(named('SfIconButton')), false);
});

test('a class that is not a Simai element stays a conflict', () => {
  class Foreign {}
  assert.equal(named('SfIcon').isSameComponentAs(Foreign), false);
  assert.equal(named('SfIcon').isSameComponentAs(null), false);
});

test('mangled names fall back to the brand', () => {
  const minified = named('e');
  const other = named('t');
  assert.equal(minified.isSameComponentAs(other), true);
});

test('the guard lives in the released base', async () => {
  const { readFile } = await import('node:fs/promises');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(root, 'src/core/js/smart-base.js'), 'utf8');
  assert.match(source, /static get sfElementBrand\(\)/);
  assert.match(source, /static isSameComponentAs\(other\)/);
  assert.match(source, /if \(!this\.isSameComponentAs\(existing\)\)/);
  assert.match(source, /"simai\.smart-base\.v1"/);
});
