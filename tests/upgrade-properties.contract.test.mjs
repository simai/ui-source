import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// A value set on an element before its class was defined reaches the setter
// once the element connects: sf-property-view bound .profiles to a lazily
// registered sf-profile-picker, and the own value hid the setter, so the
// picker drew empty (simai.main, 2026-10-28).
const {upgradeOwnProperties} = await import('../src/core/js/upgrade-properties.js');

class Base {
  set profiles(value) { this._profiles = Array.isArray(value) ? value : []; }
  get profiles() { return this._profiles; }
}
class Picker extends Base {
  get rights() { return this._rights; }
  set rights(value) { this._rights = value ?? {}; }
}

test('own values set before the upgrade reach the setters, at any depth of the chain', () => {
  const element = new Picker();
  element._profiles = [];
  Object.defineProperty(element, 'profiles', {value: [{id: 'default'}], writable: true, enumerable: true, configurable: true});
  Object.defineProperty(element, 'rights', {value: {create: {personal: true}}, writable: true, enumerable: true, configurable: true});
  element.plain = 1;
  upgradeOwnProperties(element);
  assert.equal(Object.hasOwn(element, 'profiles'), false);
  assert.equal(Object.hasOwn(element, 'rights'), false);
  assert.deepEqual(element._profiles, [{id: 'default'}]);
  assert.deepEqual(element._rights, {create: {personal: true}});
  // A field with no accessor is left as it is.
  assert.equal(element.plain, 1);
  assert.equal(element._profiles.length, 1);
  // A later assignment now goes through the setter.
  element.profiles = [{id: 'a'}, {id: 'b'}];
  assert.equal(element._profiles.length, 2);
});

test('the Smart base upgrades once, on the first connect, before it draws', () => {
  const base = readFileSync(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
  assert.match(base, /import \{ upgradeOwnProperties \} from '\.\/upgrade-properties\.js';/u);
  const connected = base.slice(base.indexOf('  connectedCallback() {'), base.indexOf('this.constructor.ensureStyleReadinessCss();'));
  assert.match(connected, /if \(!this\.__sfPropertiesUpgraded\) \{\s*this\.__sfPropertiesUpgraded = true;\s*upgradeOwnProperties\(this\);\s*\}/u);
});
