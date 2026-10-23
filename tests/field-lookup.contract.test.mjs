import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// The lookup (Larena, 2026-10-23): a value chosen from a reference list the host
// keeps. It is drawn in all four modes, its value is {value, label} -- a list of
// them when multiple -- and the control writes that same shape back. A short list
// arrives inline and is chosen from in place; a long one is the host's to page
// and search, and the set never asks for a page it was given whole.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const body = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}\n', start));
};

test('lookup is registered with the keys its renderers read', () => {
  const lookup = PROPERTY_TYPES.find((entry) => entry.type === 'lookup');
  assert.ok(lookup, 'lookup is a registered type');
  assert.deepEqual(lookup.label, {ru: 'Из справочника', en: 'From a reference list'});
  assert.deepEqual(lookup.params, ['options', 'multiple', 'placeholder', 'searchPlaceholder', 'required', 'readonly']);
  // `source` is the host's to read, not a renderer's: it is not a param.
  assert.ok(!lookup.params.includes('source'));
});

test('every renderer map draws a lookup', () => {
  assert.match(source, /\n    lookup: renderEntityMultiSelectFilterControl,\n/u);
  assert.match(source, /\n    lookup: renderLookupCell,\n/u);
  assert.match(source, /\n    lookup: renderLookupEdit,\n/u);
  assert.match(source, /\n    lookup: renderLookupView,\n/u);
});

test('an inline list is chosen from in place; a paged one asks the host and is searched there', () => {
  const edit = body('renderLookupEdit');
  assert.match(edit, /const inline = Array\.isArray\(field\.options\) && field\.options\.length > 0;/u);
  assert.match(edit, /if \(!inline && \(!host\.loadFieldOptions \|\| !host\.getFieldOptionsPage\)\) return null;/u);
  assert.match(edit, /const page = inline \? null : host\.getFieldOptionsPage\(field\) \|\| null;/u);
  assert.match(edit, /@input=\$\{inline \? nothing : \(event\) => \{/u);
  assert.match(edit, /host\.loadFieldOptions\(field, \{cursor: null, search: text\}\);/u);
  // A refused list falls back to the value, read-only, as a record does.
  assert.match(edit, /if \(page\?\.status === 'unsupported'\) return null;/u);
  // What is chosen stays offered when the page does not hold it.
  assert.match(edit, /\.\.\.chosen\.filter\(\(item\) => !candidates\.some/u);
});

test('the control writes {value, label}, a list of them when multiple', () => {
  const edit = body('renderLookupEdit');
  assert.match(edit, /return found \? \{value: found\.value, label: found\.label\} : \{value: raw, label: String\(raw\)\};/u);
  assert.match(edit, /host\.setFieldValue\(field, values\.map\(resolve\)\);/u);
  assert.match(edit, /host\.setFieldValue\(field, next === null \|\| next === '' \? null : resolve\(next\)\);/u);
  assert.match(edit, /\?multiple=\$\{multiple\}/u);
  assert.match(edit, /aria-label=\$\{field\.label \|\| field\.key \|\| ''\}/u);
});

test('a lookup reads as its label and opens nothing', () => {
  const view = body('renderLookupView');
  assert.doesNotMatch(view, /sf-reference-link|href/u);
  assert.match(view, /<span class="sf-field-view">\$\{items\[0\]\.label\}<\/span>/u);
  assert.match(body('renderLookupCell'), /items\.map\(\(item\) => item\.label\)\.join\(', '\)/u);
  for (const key of ['pickFromList']) {
    assert.equal((source.match(new RegExp(`^        ${key}: '`, 'gmu')) ?? []).length, 2, `${key} in en and ru`);
  }
});
