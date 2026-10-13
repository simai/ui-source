import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* The owner saw a language picker whose options carry flags show only the
   language name once chosen. A single choice now shows its picture in front
   of its label in the field, in the markup component and in the Smart one. */
test('dropdown field: a single choice shows its picture in front of the label', async () => {
  const js = await read('component/dropdown/js/_dropdown.js');
  assert.match(js, /const FIELD_VISUAL_SELECTOR = ":scope > \.sf-list-item-wrap :is\(\.sf-flag, \.sf-icon, \.sf-tag-color-icon, \.sf-avatar\):not\(\.sf-checkbox \*\)";/);
  assert.match(js, /function syncSelectionPresentation\(root\) \{[^}]*syncFieldVisual\(root, visible\);/);
  // a cloned flag is handed back to the flag component to load
  assert.match(js, /delete visual\.dataset\.sfFlagReady;\s*visual\.replaceChildren\(\);/);
  assert.match(js, /if \(isMultipleDropdown\(root\) \|\| selected\.length !== 1\) return;/);
  const smart = await read('smart/dropdown/js/templates/default.js');
  assert.match(smart, /\$\{renderFieldVisual\(context\)\}\s*<input/);
  assert.match(smart, /if \(context\.multiple \|\| context\.selectedOptions\?\.length !== 1\) return nothing;/);
});

test('dropdown field: the picture takes the input\'s leading step', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  assert.match(css, /\.sf-dropdown\.sf-dropdown \.sf-dropdown-field\.sf-dropdown-field:has\(> \.sf-dropdown-field-visual\) > input:not\(\[type="hidden"\]\) \{\s*--sf-dropdown-input--padding-inline-start: 0;/);
});

test('dropdown field: the picture is no taller than the field line', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  for (const [cls, vars] of [['sf-icon', ['--sf-icon--height', '--sf-icon--width']], ['sf-avatar', ['--sf-avatar--height', '--sf-avatar--width']], ['sf-tag-color-icon', ['--sf-tag-color-icon--height', '--sf-tag-color-icon--width']]]) {
    const start = css.indexOf(`.sf-dropdown .sf-dropdown-field > .${cls}.sf-dropdown-field-visual {`);
    assert.notEqual(start, -1, cls);
    const rule = css.slice(start, css.indexOf('}', start));
    for (const name of vars) assert.ok(rule.includes(`${name}: var(--sf-dropdown-tag-line--box);`), `${cls} ${name}`);
  }
});

test('dropdown field: an avatar is line-sized like every other picture, with the ordinary padding', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  assert.doesNotMatch(css, /:has\(> \.sf-avatar\.sf-dropdown-field-visual\)/, 'no compact padding for avatars');
});


test('list item: the wrap fills the option and centres its row on its own', async () => {
  const css = await read('component/dropdown/scss/_css__list-item.scss');
  const start = css.indexOf('.sf-list-item .sf-list-item-wrap {');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.match(rule, /display: flex;/);
  assert.match(rule, /flex: 1 1 auto;/);
  assert.match(rule, /align-items: center;/);
});
