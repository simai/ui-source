import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-menu-context 1.27.0 (queue db8793a2): `for` reaches areas in a shadow
// root -- a view's own table. Measured in a browser by
// tests/browser/context-menu-shadow-areas.browser.mjs; these keep the shape of
// the source and the manifest it rests on.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/menu-context/index.js');
const manifest = JSON.parse(read('src/smart/menu-context/component.json'));
const passport = JSON.parse(read('src/smart/menu-context/smart.manifest.json'));
const docs = read('src/smart/menu-context/docs/docs.md');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test('for takes the areas themselves as the property, ids in the attribute', () => {
  assert.equal(manifest.version, '1.27.2'); // fix/rtl-direction-icons: one RTL turn (the minor above stays 1.27.0)
  assert.equal(manifest.settings.for.type, 'string');
  assert.match(manifest.settings.for['x-note'], /the property also takes a list of the areas, elements or ids/);
  assert.match(manifest.settings.for.summary, /menu\.for = \[table, \.\.\.\]/);
  assert.deepEqual(manifest['x-registry'].inputs.for.type, ['string', 'array']);
  assert.deepEqual(passport.inputs.properties.for.type, ['string', 'array']);
  assert.equal(passport.version, '1.27.2'); // fix/rtl-direction-icons
  assert.ok(manifest['x-decisions'].some((note) => note.startsWith('version 1.27.0 (2026-11-17, queue db8793a2')));
  assert.match(source, /  get for\(\) \{\n\s*return Array\.isArray\(this\._forList\) \? this\._forList\.slice\(\) : \(this\.getAttribute\("for"\) \?\? ""\);/);
  assert.match(source, /  set for\(value\) \{\n\s*if \(Array\.isArray\(value\)\) \{\n\s*this\._forList = value\.slice\(\);/);
  // Set before the element was defined, the list is taken over.
  assert.match(source, /hasOwnProperty\.call\(this, "for"\)/);
  assert.match(docs, /menu\.for = \[table\]/);
});

test('an id is found in the menu\'s root, the anchor\'s root, then the document', () => {
  const areas = slice('  areas() {', '  // The object a node');
  assert.match(areas, /\[this\.getRootNode\?\.\(\), this\._owned\?\.anchor\?\.getRootNode\?\.\(\), document\]/);
  assert.match(areas, /root\.getElementById\(one\)/);
  assert.ok(!areas.includes('document.getElementById'), 'ids are not read from the document alone');
});

test('the events are read at the node they came from, once, on the document', () => {
  assert.match(source, /const node = event\.composedPath\?\.\(\)\[0\] \?\? event\.target;/);
  const handler = slice('  handleAreaEvent(event) {', '  surface() {');
  assert.ok(!handler.includes('event.target'), 'the handler never reads the retargeted event.target');
  assert.match(handler, /const node = origin\(event\);/);
  assert.match(handler, /const from = inTreeOf\(node, found\.area\);/);
  // One listener per event type, on the document: no second one on a root.
  assert.match(source, /for \(const type of AREA_EVENTS\) document\.addEventListener\(type, this\._onAreaEvent, type === "click"\);/);
  assert.equal((source.match(/addEventListener\(type, this\._onAreaEvent/g) ?? []).length, 1);
  // An area of the document reads the node event.target always named: the
  // walk stops at the area's own root.
  assert.match(source, /while \(at && at\.getRootNode\(\) !== root\) at = hostOf\(at\);/);
});

test('light DOM stays as it was: Shift, links, focus back, openFor and toggleFor', () => {
  assert.match(source, /if \(event\.shiftKey && event\.type === "contextmenu" && event\.button === 2\) return true;/);
  assert.match(source, /const BROWSER_KEEPS = 'a\[href\], input, select, textarea/);
  assert.match(source, /const back = forObject && !\(somewhere && found\.target\.contains\(active\)\);/);
  // The deep focus is taken only when the document's focus is outside the
  // object and the deep one is inside it -- a shadow root's case alone.
  assert.match(source, /const active = found && deep !== shallow && !found\.target\.contains\(shallow\) && holds\(found\.target, deep\) \? deep : shallow;/);
  assert.match(source, /: this\.targetOf\(anchor\);/);
});
