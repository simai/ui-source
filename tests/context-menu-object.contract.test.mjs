import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The menu of an object (owner decision C164, 2026-11-14). The behaviour is
// measured in a browser by tests/browser/context-menu-object.browser.mjs; these
// keep the shape of the source and the manifest it rests on.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/menu-context/index.js');
const template = read('src/smart/menu-context/js/templates/default.js');
const manifest = JSON.parse(read('src/smart/menu-context/component.json'));
const sheet = read('src/component/context-menu/scss/_css__context_menu.scss');
const sizes = read('src/component/context-menu/scss/_css__context_menu_custom.scss');

test('C164 (1): one setting binds the right button, the menu key and a long press', () => {
  assert.equal(manifest.settings.for.type, 'string');
  assert.match(manifest.settings.for.summary, /right button, the menu key \(Shift\+F10\) and a long press/);
  assert.ok(manifest.actions['open-at'], 'openAt(x, y) is an action of the manifest');
  for (const type of ['contextmenu', 'keydown', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click']) {
    assert.ok(source.includes(`"${type}"`), `${type} is heard for the areas`);
  }
  assert.match(source, /event\.key !== "ContextMenu" && !\(event\.shiftKey && event\.key === "F10"\)/);
  assert.match(source, /const LONG_PRESS_MS = 500;/);
  assert.match(source, /const LONG_PRESS_SLOP = 10;/);
  // The corner exactly at the pointer (CM-5) and the focus back to the object (CM-2).
  assert.match(source, /offset: "0px"/);
  assert.match(source, /const forObject = anchor === this\._point && Boolean\(found\);/);
  assert.match(source, /const back = forObject && !\(somewhere && found\.target\.contains\(active\)\);/);
  assert.match(source, /lent: back \? !found\.target\.matches\(FOCUSABLE\)/);
  // The browser keeps its menu on links, fields, selected text and with Shift.
  assert.match(source, /const BROWSER_KEEPS = 'a\[href\], input, select, textarea/);
});

test('C164 (2): the open request names the object, one list for every way in', () => {
  assert.deepEqual(Object.keys(manifest.events.open.carries), ['target', 'targets']);
  assert.match(source, /this\.sfEmit\("open", \{target: found\?\.target \?\? null, targets: selection\?\.targets \?\? \[\]\}, \{cancelable: true\}\)/);
  // openFor() at a row's «⋯» finds the same object as the right button.
  assert.match(source, /: this\.targetOf\(anchor\);/);
});

test('C164 (3): a selected row acts on every selected row; another is selected alone first', () => {
  const selection = source.slice(source.indexOf('  selectionOf({area, target})'), source.indexOf('  get targets()'));
  assert.match(selection, /rows\.filter\(selected\)/);
  assert.match(selection, /select: rows\.filter\(\(row\) => row !== target && selected\(row\)\)/);
  assert.match(source, /found\.target\.setAttribute\("aria-selected", "true"\)/);
  assert.equal(JSON.parse(read('src/smart/menu-context/lang/ru.json')).runtime.selected, 'Выбрано {count}');
  assert.equal(JSON.parse(read('src/smart/menu-context/lang/en.json')).runtime.selected, '{count} selected');
  assert.match(template, /sf-context-menu-heading--selection/);
});

test('C164 (4): a disabled row is dimmed, focusable and never chosen', () => {
  assert.match(template, /aria-disabled=\$\{dimmed \? "true" : nothing\}/);
  const at = template.indexOf('aria-disabled=${dimmed');
  const row = template.slice(template.lastIndexOf('<button', at), template.indexOf('>${body}</button>', at));
  assert.ok(!row.includes('?disabled'), 'an action row is never disabled');
  assert.match(source, /item\.matches\("\.sf-context-menu-item--disabled"\) \|\| !item\.closest\('\[aria-disabled="true"\]'\)/);
  assert.match(source, /if \(row\.getAttribute\("aria-disabled"\) === "true"\) \{\n\s*event\.preventDefault\(\);\n\s*return;/);
  assert.match(sheet, /\.sf-context-menu-item:is\(:disabled, \.sf-context-menu-item--disabled\) \{\n\s*color: var\(--sf-on-surface-disabled\);/);
});

test('C164 (5): a destructive row is drawn last, after a line', () => {
  assert.match(template, /function actionOrder\(shown\)/);
  assert.match(template, /return rest\.length \? \[\.\.\.rest, \[\{type: "separator"\}, -1\], \.\.\.danger\] : danger;/);
  assert.match(template, /let shown = actionOrder\(/);
});

test('C164 (6): the menu of an object is the one sheet on a phone, at size 1', () => {
  // Group build 7: C176's drilling popup is the same sheet (fix/settings-menu-c176).
  assert.match(source, /const sheets = FORM_KINDS\.has\(kind\) \|\| Boolean\(found\) \|\| \(this\.drill && !parentMenu\);/);
  assert.match(sizes, /\.sf-context-menu\[data-sf-sheet\] \.sf-context-menu-content:not\(\[data-sf-width\]\) \{/);
  assert.match(sheet, /\.sf-context-menu\[data-sf-sheet\] \.sf-context-menu-content > \.sf-context-menu-heading:first-child/);
  // The grab bar's row stands right on the content.
  assert.match(sheet, /@include sheet\.sheet-surface;\n\s*display: flex;\n\s*flex-direction: column;\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*gap: 0;/);
});
