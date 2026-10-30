import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {cleanHtml} from '../src/smart/field-renderers/html.js';

// simai.property-view-port 1.17.0 (Larena, 2026-10-30): the property type
// `html`, formatted text -- an HTML string of the sf-rich-text subset, edited
// with sf-rich-text and viewed cleaned. A type, not a variant, and no new key:
// a 1.16.0 host is a 1.17.0 host that declares no html field.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.property-view-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.17.0');
const before = port('1.16.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const record = (document) => document.data.record.schema.properties;
const fieldSchemas = (document) => [
  record(document).sections.items.properties.groups.items.properties.fields.items,
  record(document).unplaced.items,
];

test('propertyType documents html in both places a field is declared', () => {
  for (const schema of fieldSchemas(now)) {
    assert.equal(schema.properties.propertyType.type, 'string');
    assert.match(schema.properties.propertyType.description,
      /Since 1\.17\.0 `html`: formatted text, an HTML string of the sf-rich-text subset; edited with sf-rich-text, viewed cleaned\./u);
  }
  assert.deepEqual(Object.keys(fieldSchemas(now)[0].properties), Object.keys(fieldSchemas(before)[0].properties));
  assert.match(now.summary, /1\.17\.0 adds the property type `html`/u);
});

test('no new intent, capability or field key', () => {
  assert.deepEqual(Object.keys(now.intents), Object.keys(before.intents));
  assert.deepEqual(Object.keys(now.capabilities), Object.keys(before.capabilities));
});

test('1.17.0 only adds: every key 1.16.0 declared is still declared the same way', () => {
  const same = (a, b, path) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      for (const key of Object.keys(a)) {
        if (['summary', 'description'].includes(key)) continue;
        assert.ok(b && key in b, `${path}.${key} is kept`);
        if (key === 'recheck' || key === 'cases') continue;
        same(a[key], b[key], `${path}.${key}`);
      }
      return;
    }
    if (path.endsWith('.version') || path.startsWith('$.conformance')) return;
    assert.deepEqual(b, a, path);
  };
  same(before, now, '$');
  assert.deepEqual(now.compatibility.recheck.slice(0, before.compatibility.recheck.length), before.compatibility.recheck);
  assert.ok(now.compatibility.recheck.length > before.compatibility.recheck.length);
  assert.ok(now.summary.startsWith(before.summary));
});

test('the kit is 1.16.0\'s cases byte for byte, and one of 1.17.0', () => {
  const old = kit('1.16.0').cases;
  const cases = kit('1.17.0').cases;
  assert.equal(kit('1.17.0').version, '1.17.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.17.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.16.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), ['an-html-field-is-saved-as-the-cleaned-string']);
  assert.equal(now.conformance.cases, cases.length);
});

test('the html case raises a declared payload and saves a string of the subset', () => {
  const fieldKeys = new Set(Object.keys(fieldSchemas(now)[0].properties));
  const one = kase('1.17.0', 'an-html-field-is-saved-as-the-cleaned-string');
  const schema = now.intents[one.when.intent].payload;
  for (const key of schema.required) assert.ok(key in one.when.payload, key);
  for (const key of Object.keys(one.when.payload)) assert.ok(key in schema.properties, key);
  assert.ok(now.intents[one.intent].answers.includes(one.then.answer));
  for (const field of one.given.fields) {
    for (const key of Object.keys(field)) assert.ok(fieldKeys.has(key), `${field.key}.${key} is declared`);
  }
  assert.equal(one.given.fields[0].propertyType, 'html');
  const saved = one.when.payload.values.body;
  assert.equal(typeof saved, 'string');
  assert.doesNotMatch(saved, /<script|\son[a-z]+=|javascript:/iu);
  // What the editor writes is already the subset: cleaning it again changes nothing.
  assert.equal(cleanHtml(saved), saved);
  assert.equal(cleanHtml(one.given.fields[0].value), one.given.fields[0].value);
});
