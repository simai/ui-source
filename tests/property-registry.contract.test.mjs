import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// The registry of universal properties is the renderer set's own list: every
// type a renderer map names is registered, and every registered type has a
// view and an edit template (owner, 2026-10-15).
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const mapKeys = (name) => {
  const body = source.slice(source.indexOf(`${name} = {`), source.indexOf('};', source.indexOf(`${name} = {`)));
  return [...body.matchAll(/^\s+'?([a-z-]+)'?:/gmu)].map(([, key]) => key);
};

test('every type a renderer map names is registered', () => {
  const registered = new Set(PROPERTY_TYPES.map((entry) => entry.type));
  const named = new Set(['VIEW_RENDERERS', 'EDIT_RENDERERS', 'CELL_RENDERERS'].flatMap(mapKeys));
  assert.deepEqual([...named].filter((type) => !registered.has(type)), []);
});

test('every registered type is shown and edited, and names its label in both languages', () => {
  const view = new Set(mapKeys('VIEW_RENDERERS'));
  const edit = new Set(mapKeys('EDIT_RENDERERS'));
  for (const entry of PROPERTY_TYPES) {
    assert.ok(view.has(entry.type), `${entry.type} has a view`);
    assert.ok(edit.has(entry.type), `${entry.type} has an edit`);
    assert.ok(entry.label.ru && entry.label.en, `${entry.type} is named`);
    for (const variant of entry.variants) assert.ok(variant.id && variant.label.ru, `${entry.type}:${variant.id}`);
  }
});

test('the set publishes the registry with each type\'s modes', () => {
  assert.match(source, /registry: PROPERTY_TYPES\.map\(\(entry\) => \(\{\.\.\.entry, modes: propertyModes\(entry\.type\)\}\)\)/u);
});

// A password is a string the set never shows (owner, 2026-10-19). The registry
// names it write-only; its renderers never bind the value into markup, and the
// control writes only what a person types.
test('string:password is registered, write-only, in both languages', () => {
  const string = PROPERTY_TYPES.find((entry) => entry.type === 'string');
  const password = string.variants.find((variant) => variant.id === 'password');
  assert.deepEqual(password, {id: 'password', label: {ru: 'Пароль', en: 'Password'}, writeOnly: true});
  assert.deepEqual(string.params, ['placeholder', 'required', 'readonly']);
});

test('the password renderers never put the value into markup and write only typed text', () => {
  const body = (name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    return source.slice(start, source.indexOf('\n}\n', start));
  };
  const edit = body('renderPasswordEdit');
  assert.match(edit, /input-type="password"/u);
  assert.match(edit, /autocomplete="new-password"/u);
  assert.match(edit, /spellcheck="false"/u);
  assert.match(edit, /aria-pressed="false"/u);
  assert.match(edit, /aria-label=\$\{setText\(host, 'showPassword'\)\}/u);
  // No value binding of any kind, and no data-* carrying anything.
  assert.doesNotMatch(edit, /[\s.]value=|data-|console\./u);
  // The only write is the typed text, and erasing withdraws it.
  assert.equal(edit.match(/setFieldValue/gu).length, 1);
  assert.match(edit, /host\.setFieldValue\(field, typed === '' \? undefined : typed\)/u);
  for (const name of ['renderStringView', 'renderStringCell', 'passwordState']) {
    assert.doesNotMatch(body(name), /formatFieldValue|scalarValue|viewText\(|console\./u, name);
  }
  assert.match(body('renderTextEdit'), /if \(isPasswordField\(field\)\) return renderPasswordEdit/u);
  assert.match(source, /const VIEW_RENDERERS = \{\n    string: renderStringView,/u);
  assert.match(source, /string: renderStringCell,/u);
  for (const key of ['passwordSet', 'passwordUnset', 'passwordKeep', 'showPassword']) {
    assert.equal((source.match(new RegExp(`^        ${key}: '`, 'gmu')) ?? []).length, 2, `${key} in en and ru`);
  }
});
