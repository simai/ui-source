// component.fab 1.2.0 (study prototypes/actions-fab-study.html, RG-FAB-1..5;
// owner decisions C211, C107, C18, C151, C116 (3), C216): the source contracts.
// The drawn inks, sizes and shadows are measured in a browser by the study's probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('src/component/fab/scss/_css_fab.scss');
const js = read('src/component/fab/js/_fab.js');
const checks = read('src/component/fab/js/_fab-checks.js');

test('RG-FAB-1: the class active draws no pressed tone on any kind (C211), and the script says so', () => {
  assert.doesNotMatch(css, /\.active\b/);
  for (const tone of ['primary-active', 'primary-container-active', 'surface-container-active', 'on-surface-active']) {
    assert.match(css, new RegExp(`:active \\{\\n  --sf-fab--background-color: var\\(--sf-${tone}\\);`), tone);
  }
  assert.match(checks, /classList\.contains\('active'\) \|\| element\.hasAttribute\('aria-pressed'\)/);
  assert.match(checks, /owner decision C211/);
});

test('RG-FAB-2: the tonal on-surface icon is --sf-on-surface-icon and no role is re-declared on the button (C107, C18)', () => {
  assert.match(css, /\.sf-fab\.sf-fab--tonal\.sf-fab--on-surface \.sf-icon \{\n  --sf-icon--color: var\(--sf-on-surface-icon\);/);
  assert.doesNotMatch(css, /^\s*--sf-on-surface[a-z-]*:/m);
});

test('RG-FAB-3: size 3 icon is 28 on a phone and the text line of size 3 from 60rem (C151)', () => {
  assert.match(css, /\.sf-fab\.sf-fab--size-3 \.sf-icon \{\n  --sf-icon--font-size: var\(--sf-c4\);/);
  assert.match(css, /@media \(min-width: 60rem\) \{\n  \.sf-fab\.sf-fab--size-3 \.sf-icon \{\n    --sf-icon--font-size: var\(--sf-text-height-3\);/);
  // The control keeps its ladder height: the larger glyph takes the two pixels from the padding.
  assert.match(css, /margin: calc\(\(var\(--sf-text-height-3\) - var\(--sf-c4\)\) \/ 2\);/);
  const ib = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
  assert.match(ib, /margin: calc\(\(var\(--sf-text-height-3\) - var\(--sf-c4\)\) \/ 2\);/);
  assert.match(ib, /\.sf-icon-button\.sf-icon-button--size-3\.sf-icon-button--icon :is\(\.sf-icon, sf-icon:not\(:defined\)\) \{\n    --sf-icon--font-size: var\(--sf-c4\);/);
});

test('RG-FAB-4: default secondary draws as default on-surface, journaled and said', () => {
  assert.match(css, /\.sf-fab\.sf-fab--default:is\(\.sf-fab--on-surface, \.sf-fab--secondary\) \{\n  --sf-fab--background-color: var\(--sf-on-surface\);/);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((row) => row.id === 'class-fab-default-secondary-c116');
  assert.equal(record?.remove_after, '2027-01-01');
  assert.match(checks, /noteDeprecated\(\{component: 'fab'/);
});

test('RG-FAB-5: the Fab helper draws arrow_upward unturned and names itself in the page language', () => {
  assert.match(js, /icon = 'arrow_upward'/);
  assert.doesNotMatch(js, /rotate-90|chevron_left'/);
  assert.match(js, /pageText\(FAB_TEXT, 'top', document\.documentElement, 'sf-fab'\)/);
  assert.equal(JSON.parse(read('src/component/fab/lang/ru.json')).runtime.top, 'Наверх');
  assert.equal(JSON.parse(read('src/component/fab/lang/en.json')).runtime.top, 'Back to top');
  assert.ok(JSON.parse(read('src/component/fab/lang/kk.json')).runtime.top);
});

test('C216: every kind carries the raised shadow', () => {
  assert.match(css, /box-shadow: var\(--sf-fab--focus-inset, 0 0 var\(--sf-transparent\)\), var\(--sf-fab--box-shadow, var\(--sf-shadow-raised\)\);/);
});
