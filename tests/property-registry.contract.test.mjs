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
