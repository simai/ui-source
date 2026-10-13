import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/smart/context-menu/index.js', import.meta.url), 'utf8');

test('context menu scopes native item semantics to the default menu template', () => {
  assert.match(source, /this\.templateName !== "default" \|\| this\.role !== "menu"/);
  assert.match(source, /content\?\.children/);
  assert.match(source, /child\.localName === "sf-button"/);
  assert.match(source, /this\.ownItemAttribute\(item, "role", "menuitem"\)/);
  assert.match(source, /typeof callback === "function"\) return super\.afterRender\(callback\)/);
});

// A host that renders the menu itself still owns dismissal: the roving
// handler moves focus and nothing else. Escape, Tab and typeahead live in the
// separate handler that acts only while the menu owns its lifecycle (opened
// through openFor), measured in tests/browser/context-menu-standard.browser.mjs.
test('context menu leaves activation and dismissal to native controls and the host', () => {
  const handler = source.slice(source.indexOf('  handleMenuKeyDown(event)'));
  for (const key of ['ArrowDown','ArrowUp','Home','End']) assert.ok(handler.includes(`case "${key}"`));
  for (const key of ['Enter',' ','Tab','Escape']) assert.ok(!handler.includes(`case "${key}"`));
  assert.match(source, /this\._itemObserver\.disconnect\(\)/);
  assert.match(source, /item\.getAttribute\(name\) !== lease\.value/);
});

test('the owned lifecycle acts only on a menu opened through openFor', () => {
  const owned = source.slice(source.indexOf('  handleOwnedKeyDown(event)'), source.indexOf('  typeahead(event)'));
  assert.match(owned, /if \(!this\._owned \|\|/);
  assert.match(owned, /event\.key === "Escape"/);
  assert.match(owned, /event\.key === "Tab"/);
  assert.ok(source.indexOf('  handleOwnedKeyDown(event)') < source.indexOf('  handleMenuKeyDown(event)'));
});
