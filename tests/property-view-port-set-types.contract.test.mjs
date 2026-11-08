import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {formatMoney, formatPercent, readDecimal} from '../src/smart/field-renderers/decimal.js';

// simai.property-view-port 1.18.0: the settings of the property types the View
// set draws itself (sf-view-properties 1.11.0; Larena property types standard,
// notes of 2026-11-03) -- currency, columns, minRows, maxRows, parts -- and the
// bounds, step and digits a number reads (min, max, step, precision), read by
// the renderers since the stepper (1.14.0) and declared by no port until now.
// Every key is optional: a 1.17.0 host is a 1.18.0 host that sends none.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.property-view-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.18.0');
const before = port('1.17.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const record = (document) => document.data.record.schema.properties;
const fieldSchemas = (document) => [
  record(document).sections.items.properties.groups.items.properties.fields.items,
  record(document).unplaced.items,
];
const ADDED = ['min', 'max', 'step', 'precision', 'currency', 'columns', 'minRows', 'maxRows', 'parts'];

test('1.18.0 declares the nine keys in both places a field is declared, none of them required', () => {
  for (const schema of fieldSchemas(now)) {
    assert.equal(schema.additionalProperties, false);
    const keys = Object.keys(schema.properties);
    assert.deepEqual(keys.slice(-ADDED.length), ADDED);
    assert.deepEqual(keys.slice(0, -ADDED.length), Object.keys(fieldSchemas(before)[0].properties));
    for (const key of ADDED) assert.ok(!schema.required.includes(key), `${key} is optional`);
    assert.match(schema.properties.propertyType.description, /Since 1\.18\.0, drawn by a component set/u);
    for (const type of ['money', 'percent', 'items', 'compound', 'ru.requisites']) {
      assert.ok(schema.properties.propertyType.description.includes(`\`${type}\``), type);
    }
  }
  assert.deepEqual(fieldSchemas(now)[0].properties, fieldSchemas(now)[1].properties);
});

test('a column and a part have the shape the set reads', () => {
  const field = fieldSchemas(now)[0].properties;
  const column = field.columns.items;
  assert.equal(column.additionalProperties, false);
  assert.deepEqual(column.required, ['key']);
  for (const key of ['key', 'label', 'propertyType', 'type', 'settings', 'required', 'readonly', 'currency', 'scale', 'compute', 'total']) {
    assert.ok(key in column.properties, key);
  }
  assert.deepEqual(column.properties.compute.properties.op.enum, ['multiply']);
  assert.deepEqual(field.parts.items.oneOf[0].enum, ['inn', 'kpp', 'ogrn', 'bik', 'account', 'corr_account']);
  assert.equal(field.currency.pattern, '^[A-Z]{3}$');
});

test('no new intent or capability; every 1.17.0 key is declared the same way', () => {
  assert.deepEqual(Object.keys(now.intents), Object.keys(before.intents));
  assert.deepEqual(Object.keys(now.capabilities), Object.keys(before.capabilities));
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
  assert.match(now.summary, / 1\.18\.0 declares the settings of the property types a component set draws itself/u);
});

test('the kit is 1.17.0\'s cases byte for byte, and two of 1.18.0', () => {
  const old = kit('1.17.0').cases;
  const cases = kit('1.18.0').cases;
  assert.equal(kit('1.18.0').version, '1.18.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.18.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.17.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), ['money-and-percent-are-saved-as-decimal-strings', 'an-items-field-is-saved-as-rows']);
  assert.equal(now.conformance.cases, cases.length);
});

// Every number in the new cases is a decimal string, never a float, and what a
// field sends is declared by the port.
const decimalsOf = (value, out = []) => {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((one) => decimalsOf(one, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((one) => decimalsOf(one, out));
  return out;
};
test('the new cases raise declared payloads with decimal strings', () => {
  const fieldKeys = new Set(Object.keys(fieldSchemas(now)[0].properties));
  for (const id of ['money-and-percent-are-saved-as-decimal-strings', 'an-items-field-is-saved-as-rows']) {
    const one = kase('1.18.0', id);
    const schema = now.intents[one.when.intent].payload;
    for (const key of schema.required) assert.ok(key in one.when.payload, `${id}: ${key}`);
    for (const key of Object.keys(one.when.payload)) assert.ok(key in schema.properties, `${id}: ${key}`);
    assert.ok(now.intents[one.intent].answers.includes(one.then.answer));
    for (const field of one.given.fields) {
      for (const key of Object.keys(field)) assert.ok(fieldKeys.has(key), `${id}: ${field.key}.${key} is declared`);
    }
    assert.deepEqual(decimalsOf(one.when.payload.values), [], `${id}: no JSON number in the values`);
  }
  const money = kase('1.18.0', 'money-and-percent-are-saved-as-decimal-strings').when.payload.values;
  assert.equal(readDecimal(money.price.amount).value, '2499.99');
  assert.equal(formatMoney(money.price, {}, 'en'), '$2,499.99');
  assert.equal(formatPercent(money.discount, 'en'), '12.5%');
  const items = kase('1.18.0', 'an-items-field-is-saved-as-rows');
  const field = items.given.fields[0];
  assert.ok(items.when.payload.values.items.length >= field.minRows && items.when.payload.values.items.length <= field.maxRows);
});

test('readDecimal: a comma or a point, spaces between groups, never a float', () => {
  assert.deepEqual(readDecimal('1 234,50'), {ok: true, value: '1234.50'});
  assert.deepEqual(readDecimal('-0,0'), {ok: true, value: '0.0'});
  assert.deepEqual(readDecimal('007'), {ok: true, value: '7'});
  assert.deepEqual(readDecimal(''), {ok: true, value: null});
  assert.deepEqual(readDecimal(12), {ok: true, value: '12'});
  assert.deepEqual(readDecimal(0.1), {ok: false});
  assert.deepEqual(readDecimal('1e3'), {ok: false});
  assert.deepEqual(readDecimal('abc'), {ok: false});
  assert.equal(formatMoney({amount: '99999999999999999.99', currency: 'USD'}, {}, 'en'), '$99,999,999,999,999,999.99');
  assert.equal(formatMoney('1200', {currency: 'JPY'}, 'en'), '¥1,200');
  assert.equal(formatMoney({amount: 'x', currency: 'RUB'}, {}, 'en'), '');
});
