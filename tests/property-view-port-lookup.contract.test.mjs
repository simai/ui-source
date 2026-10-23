import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.property-view-port 1.14.0 (Larena, 2026-10-23): a lookup field, its
// candidates by source and limit, a save confirmed with a digest, and fields
// with conditions. Every addition is optional, so a 1.13.0 host is a 1.14.0
// host that sends none of them; and the answers stay the four the composite
// host port standard names -- a confirmation is a refusal with a reason, as in
// the data view port, not a fifth answer.
const root = resolve(import.meta.dirname, '..');
const port = (version) => JSON.parse(readFileSync(join(root,
  `src/core/contracts/ports/simai.property-view-port/${version}/port.json`), 'utf8'));
const now = port('1.14.0');
const before = port('1.13.0');
const fieldsOf = (document) => document.data.record.schema.properties.sections.items.properties.groups.items.properties.fields.items;

test('a field may name its source and carry its conditions, in both lists that hold fields', () => {
  for (const items of [fieldsOf(now), now.data.record.schema.properties.unplaced.items]) {
    assert.deepEqual(items.properties.source.type, ['string', 'null']);
    const when = items.properties.when;
    assert.equal(when.additionalProperties, false);
    assert.deepEqual(Object.keys(when.properties), ['visible', 'required', 'enabled']);
    for (const condition of Object.values(when.properties)) {
      const shapes = condition.oneOf.map((shape) => shape.required);
      assert.deepEqual(shapes, [['field', 'op'], ['all'], ['any'], ['not']]);
      assert.deepEqual(condition.oneOf[0].properties.op.enum, ['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty']);
    }
    assert.deepEqual(items.required, ['key', 'propertyType']);
  }
});

test('field.options carries the source and a limit, and requires neither', () => {
  const payload = now.intents['field.options'].payload;
  assert.deepEqual(payload.required, before.intents['field.options'].payload.required);
  assert.deepEqual(payload.properties.source.type, ['string', 'null']);
  assert.deepEqual(payload.properties.limit, {...payload.properties.limit, type: 'integer', minimum: 1});
});

test('a save may be confirmed with a digest, in the data view port\'s shape', () => {
  assert.deepEqual(now.data.confirm.schema.required, ['summary', 'digest']);
  for (const name of ['group.save', 'record.save']) {
    const intent = now.intents[name];
    assert.deepEqual(intent.payload.required, before.intents[name].payload.required, `${name}: nothing newly required`);
    assert.equal(intent.payload.properties.confirm.type, 'string');
    assert.ok(intent.answer_data.properties.confirm);
    assert.deepEqual(intent.answers, ['applied', 'conflict', 'refused', 'unavailable']);
  }
  assert.deepEqual(now.answer.schema.properties.answer.enum, ['applied', 'conflict', 'refused', 'unavailable']);
  assert.match(now.answer.schema.properties.reason.description, /confirm_required/u);
  const dataview = JSON.parse(readFileSync(join(root, 'src/core/contracts/ports/simai.dataview-port/1.12.0/port.json'), 'utf8'));
  assert.deepEqual(Object.keys(now.data.confirm.schema.properties), Object.keys(dataview.data.confirm.schema.properties));
});

test('1.14.0 only adds: every key 1.13.0 declared is still declared the same way', () => {
  const same = (a, b, path) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      for (const key of Object.keys(a)) {
        // Prose grows; shapes do not change.
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
});
