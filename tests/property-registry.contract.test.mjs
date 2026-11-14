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
  return [...body.matchAll(/^\s+'?([a-z.-]+)'?:/gmu)].map(([, key]) => key);
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
    // A type a component set draws (property-view port 1.18.0) is shown and
    // edited by that set; the Framework does not half-draw it.
    if (entry.set) {
      assert.ok(!view.has(entry.type) && !edit.has(entry.type), `${entry.type} is the ${entry.set} set's to show and edit`);
      assert.ok(entry.label.ru && entry.label.en, `${entry.type} is named`);
      continue;
    }
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
  // mask and nullable since property-view port 1.16.0 (a masked string).
  assert.deepEqual(string.params, ['placeholder', 'mask', 'nullable', 'required', 'readonly']);
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
  // One eye: sf-input's own (C123 (4)); the set draws no second button beside
  // the field (text inputs study, TI-7).
  assert.doesNotMatch(edit, /sf-button-icon|visibility|showPassword/u);
  assert.doesNotMatch(source, /function togglePasswordShown\(/u);
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
  for (const key of ['passwordSet', 'passwordUnset', 'passwordKeep']) {
    assert.equal((source.match(new RegExp(`^        ${key}: '`, 'gmu')) ?? []).length, 2, `${key} in en and ru`);
  }
});

// The types the View set draws (simai.property-view-port 1.18.0): registered
// with the set that shows and edits them, their cells and filters the
// Framework's, and every key they read declared by the port.
test('money, percent, items, compound and ru.requisites are the view set\'s, with the port\'s keys', () => {
  const port = JSON.parse(readFileSync(join(root, 'src/core/contracts/ports/simai.property-view-port/1.18.0/port.json'), 'utf8'));
  const declared = new Set(Object.keys(port.data.record.schema.properties.sections.items.properties.groups.items.properties.fields.items.properties));
  const cell = new Set(mapKeys('CELL_RENDERERS'));
  const filter = new Set(mapKeys('FILTER_RENDERERS'));
  const drawn = PROPERTY_TYPES.filter((entry) => entry.set);
  assert.deepEqual(drawn.map((entry) => entry.type), ['money', 'percent', 'items', 'compound', 'ru.requisites']);
  for (const entry of drawn) {
    assert.equal(entry.set, 'view', entry.type);
    for (const param of entry.params) assert.ok(declared.has(param), `${entry.type}.${param} is declared by the port`);
  }
  for (const type of ['money', 'percent', 'items']) {
    assert.ok(cell.has(type), `${type} has a cell`);
    assert.ok(filter.has(type), `${type} has a filter`);
  }
});
