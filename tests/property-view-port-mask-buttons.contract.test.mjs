import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.property-view-port 1.16.0 (consumer simai.main, agreed contract
// q-b0de123841): a string typed through a mask and a choice drawn as buttons.
// `mask` is the Framework grammar sf-input reads as mask-pattern; the value
// travels as it is shown, fixed parts included, and an incomplete one is never
// sent. `nullable: false` makes a cleared masked field send "" instead of null.
// `size` sizes a choice's buttons on the ladder. Every addition is optional, so
// a 1.15.0 host is a 1.16.0 host that sends none of them.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.property-view-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.16.0');
const before = port('1.15.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const record = (document) => document.data.record.schema.properties;
// Both places a field is declared: in a group, and among the unplaced.
const fieldSchemas = (document) => [
  record(document).sections.items.properties.groups.items.properties.fields.items,
  record(document).unplaced.items,
];

test('a field declares mask, nullable and size, each optional', () => {
  for (const schema of fieldSchemas(now)) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.mask.type, ['string', 'null']);
    assert.match(schema.properties.mask.description, /`0` a digit, `a` a letter, `\*` any character, `\\` escapes/u);
    assert.match(schema.properties.mask.description, /fixed parts included/u);
    assert.equal(schema.properties.nullable.type, 'boolean');
    assert.deepEqual(schema.properties.size.enum, ['1/2', '1', '2']);
    for (const key of ['mask', 'nullable', 'size']) assert.ok(!schema.required.includes(key), `${key} is optional`);
    assert.match(schema.properties.variant.description, /`buttons`/u);
    // The variant stays an open string: a variant the set does not know draws the default.
    assert.deepEqual(schema.properties.variant.type, ['string', 'null']);
  }
  assert.deepEqual(Object.keys(fieldSchemas(now)[0].properties), Object.keys(fieldSchemas(now)[1].properties));
});

test('no new intent: a masked value and a chosen button go through group.save and record.save', () => {
  assert.deepEqual(Object.keys(now.intents), Object.keys(before.intents));
  assert.deepEqual(Object.keys(now.capabilities), Object.keys(before.capabilities));
});

test('1.16.0 only adds: every key 1.15.0 declared is still declared the same way', () => {
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

test('the kit is 1.15.0\'s cases byte for byte, and five of 1.16.0', () => {
  const old = kit('1.15.0').cases;
  const cases = kit('1.16.0').cases;
  assert.equal(kit('1.16.0').version, '1.16.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.16.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.15.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), [
    'a-masked-field-arrives-with-its-mask',
    'a-masked-value-is-saved-as-shown',
    'an-incomplete-masked-value-is-never-sent',
    'a-cleared-masked-field-sends-null-or-empty',
    'a-choice-as-buttons-saves-the-option-value',
  ]);
  assert.equal(now.conformance.cases, cases.length);
});

test('every new case raises a payload its intent declares, and its fields carry only declared keys', () => {
  const declared = (intent, payload, where) => {
    const schema = now.intents[intent].payload;
    for (const key of schema.required) assert.ok(key in payload, `${where}: ${intent} carries ${key}`);
    for (const key of Object.keys(payload)) assert.ok(key in schema.properties, `${where}: ${intent} declares ${key}`);
  };
  const fieldKeys = new Set(Object.keys(fieldSchemas(now)[0].properties));
  for (const id of kit('1.16.0').cases.slice(kit('1.15.0').cases.length)) {
    const one = kase('1.16.0', id);
    assert.equal(one.id, id);
    declared(one.when.intent, one.when.payload, id);
    assert.ok(now.intents[one.intent].answers.includes(one.then.answer), `${id}: ${one.then.answer}`);
    for (const field of one.given.fields ?? []) {
      for (const key of Object.keys(field)) assert.ok(fieldKeys.has(key), `${id}: ${field.key}.${key} is declared`);
      if ('size' in field) assert.ok(fieldSchemas(now)[0].properties.size.enum.includes(field.size), `${id}: size`);
    }
  }
});

test('a masked value in a case is the text as shown, and a cleared one is null or ""', () => {
  assert.equal(kase('1.16.0', 'a-masked-value-is-saved-as-shown').when.payload.values.phone, '+7 (912) 345-67-89');
  const cleared = kase('1.16.0', 'a-cleared-masked-field-sends-null-or-empty');
  assert.equal(cleared.given.fields.find((field) => field.key === 'inn').nullable, false);
  assert.deepEqual(cleared.when.payload.values, {phone: null, inn: ''});
  const buttons = kase('1.16.0', 'a-choice-as-buttons-saves-the-option-value');
  // The option's own value, in its own type.
  assert.deepEqual(buttons.when.payload.values, {kind: null, tier: 2});
});
