import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Every setting is a property of the same name (§5.1). A component that writes
// its own getter for a setting shadows the accessor pair the manifest base
// defines, and the setter goes with it: on 2026-10-31 sf-badge status,
// sf-dropdown size, sf-input size, sf-textarea rows and sf-toast duration all
// dropped `element.property = value` in silence, and twenty-three components
// hold such a getter. The base now completes the author's getter with its own
// setter when the first element of the class is built; the browser probe
// tests/browser/setting-properties.browser.mjs measures the outcome, and this
// one keeps the mechanism in place.
const source = fs.readFileSync(new URL('../src/core/js/element-manifest.js', import.meta.url), 'utf8');

test('a getter of a component’s own is completed with the base’s setter', () => {
  const body = source.slice(source.indexOf('function completeOwnAccessors'));
  assert.ok(body.startsWith('function completeOwnAccessors(Class, baseProto, members)'), 'the helper takes the class, where to stop and the members');
  assert.match(body, /if \(!own \|\| !own\.get \|\| own\.set \|\| !own\.configurable\) continue;/u, 'it leaves alone what already has a setter, or cannot be redefined');
  assert.match(body, /get: own\.get,/u, 'the author’s getter stays');
  assert.match(body, /set\(value\) \{ writeAttribute\(this, member, value\); \}/u, 'the setter writes the attribute, as the generated pair does');
  assert.match(body, /if \(member\.native \|\| !member\.writable \|\| !member\.attribute\) continue;/u, 'native and read-only members are not touched');
});

test('the completion runs once per class, when its first element is built', () => {
  assert.match(source, /const completedAccessors = new WeakSet\(\);/u);
  assert.match(source, /completeOwnAccessors\(new\.target, ManifestElement\.prototype, read\.members\);/u);
  const constructor = source.slice(source.indexOf('    constructor() {'));
  assert.ok(constructor.indexOf('completeOwnAccessors') < constructor.indexOf('this.sfInternals'), 'before the element does anything of its own');
});
