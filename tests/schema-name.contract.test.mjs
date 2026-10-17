import assert from 'node:assert/strict';
import test from 'node:test';
import {readSchema, isSchema, schemaFields, withUnversionedSchema} from '../src/core/js/schema-name.mjs';

// Both forms of a format name are read as one (names carry no version, owner
// 2026-10-11): the older `simai.<name>.v<major>` and the new `simai.<name>`
// with schema_version beside it.
test('the two forms of a format name are read as the same format', () => {
  assert.deepEqual(readSchema({schema: 'simai.composite.host-port.v1'}), {name: 'simai.composite.host-port', version: 1, form: 'versioned-name'});
  assert.deepEqual(readSchema({schema: 'simai.composite.host-port', schema_version: 1}), {name: 'simai.composite.host-port', version: 1, form: 'name'});
  assert.ok(isSchema({schema: 'simai.composition.document.v1'}, 'simai.composition.document', 1));
  assert.ok(isSchema({schema: 'simai.composition.document', schema_version: 1}, 'simai.composition.document', 1));
  assert.ok(!isSchema({schema: 'simai.composition.document', schema_version: 2}, 'simai.composition.document', 1));
  assert.equal(readSchema({}), null);
});

test('a writer gets the new form, and a document moves to it untouched otherwise', () => {
  assert.deepEqual(schemaFields('simai.framework.theme', 1), {schema: 'simai.framework.theme', schema_version: 1});
  assert.throws(() => schemaFields('simai.framework.theme.v1', 1), TypeError);
  assert.throws(() => schemaFields('simai.framework.theme', 0), TypeError);
  const moved = withUnversionedSchema({schema: 'simai.change-journal.v1', records: [1]});
  assert.deepEqual(moved, {schema: 'simai.change-journal', schema_version: 1, records: [1]});
  assert.equal(Object.keys(moved)[0], 'schema');
  const kept = {schema: 'simai.change-journal', schema_version: 1};
  assert.equal(withUnversionedSchema(kept), kept);
});
