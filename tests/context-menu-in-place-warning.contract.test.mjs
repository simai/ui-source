import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// openFor() on a menu without `popup` (queue #304; evidence ui-control
// control/evidence/2026-11-12-menu-context-closed): such a menu is drawn in
// place, so after it closes it stays drawn where it stands -- the trap sf-editor
// fell into. The contract is unchanged; the development console says so once
// per page, naming the menu. Measured in a browser by the area-d probe.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/menu-context/index.js');
const manifest = JSON.parse(read('src/smart/menu-context/component.json'));

test('openFor() on a menu without popup warns once per page, and opens as before', () => {
  assert.match(source, /const IN_PLACE_OPEN_SAID = Symbol\.for\("sf\.menu-context\.in-place-open-said"\);/);
  assert.match(source, /function sayInPlaceOpen\(menu\) \{/);
  assert.match(source, /if \(globalThis\[IN_PLACE_OPEN_SAID\] \|\| menu\.hasAttribute\("popup"\)\) return;/);
  assert.match(source, /console\.warn\(`SIMAI Framework: \$\{name\} was opened through openFor\(\) without the popup attribute/);
  // Said where every way in passes (openFor serves toggleFor, openAt and the
  // right button), after an invalid anchor is refused.
  const openFor = source.slice(source.indexOf('async openFor(anchor'), source.indexOf('async openFor(anchor') + 400);
  assert.match(openFor, /return \{outcome: "refused", reason: "invalid"\};\n\s+sayInPlaceOpen\(this\);/);
  assert.match(manifest.settings.popup.summary, /warns once in the console/);
});
