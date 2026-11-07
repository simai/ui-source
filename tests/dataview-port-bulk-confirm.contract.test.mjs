// simai.dataview-port 1.14.0 (simai/ui-source#48): bulk.apply_selected may be
// confirmed as the other writes are. The edition is a minor of 1.13.0
// (standard simai.composite-host-port, minor-is-additive): every intent, field
// and requirement of 1.13.0 stays, and the one addition is optional.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PORT = new URL('../src/core/contracts/ports/simai.dataview-port/', import.meta.url);
const edition = (version) => JSON.parse(readFileSync(new URL(`${version}/port.json`, PORT), 'utf8'));
const kitCase = (version, id) => JSON.parse(readFileSync(new URL(`${version}/kit/cases/${id}.json`, PORT), 'utf8'));
const previous = edition('1.13.0');
const current = edition('1.14.0');

test('1.14.0 keeps every intent, field and requirement of 1.13.0', () => {
  assert.equal(current.version, '1.14.0');
  for (const [name, before] of Object.entries(previous.intents)) {
    const after = current.intents[name];
    assert.ok(after, `${name} is kept`);
    assert.equal(after.event, before.event, `${name}: the event`);
    assert.deepEqual(after.payload.required, before.payload.required, `${name}: nothing new is required`);
    assert.equal(after.payload.additionalProperties, before.payload.additionalProperties, `${name}: additionalProperties`);
    for (const [field, schema] of Object.entries(before.payload.properties || {})) assert.deepEqual(after.payload.properties[field], schema, `${name}.${field}`);
    assert.deepEqual(after.answers, before.answers, `${name}: the answers`);
    assert.equal(after.capability, before.capability, `${name}: the capability`);
  }
  assert.deepEqual(Object.keys(current.intents), Object.keys(previous.intents), 'no intent is added or dropped');
  for (const line of previous.compatibility.recheck) assert.ok(current.compatibility.recheck.includes(line), line);
  assert.deepEqual(current.settings, previous.settings);
  assert.deepEqual(current.data.confirm, previous.data.confirm, 'the confirmation is the one the other writes use');
});

test('bulk.apply_selected carries an optional confirm digest and answers data.confirm, as record.mutate does', () => {
  const bulk = current.intents['bulk.apply_selected'];
  const added = Object.keys(bulk.payload.properties).filter((field) => !(field in previous.intents['bulk.apply_selected'].payload.properties));
  assert.deepEqual(added, ['confirm']);
  assert.ok(!bulk.payload.required.includes('confirm'));
  const mutate = current.intents['record.mutate'];
  assert.equal(bulk.payload.properties.confirm.type, mutate.payload.properties.confirm.type, 'the digest is a string, as on record.mutate');
  assert.deepEqual(bulk.answer_data.properties.confirm, mutate.answer_data.properties.confirm);
  assert.ok(bulk.answers.includes('refused'), 'a confirmation is asked for by a refusal');
  assert.match(bulk.summary, /confirm_required/u);
  assert.ok(current.compatibility.recheck.some((line) => line.startsWith('bulk.apply_selected may be confirmed first')));
});

test('the kit is 1.13.0\'s, byte for byte, and bulk-selected-confirmed-first', () => {
  const before = JSON.parse(readFileSync(new URL('1.13.0/kit/manifest.json', PORT), 'utf8'));
  const after = JSON.parse(readFileSync(new URL('1.14.0/kit/manifest.json', PORT), 'utf8'));
  assert.deepEqual(after.cases, [...before.cases, 'bulk-selected-confirmed-first']);
  for (const id of before.cases) assert.equal(readFileSync(new URL(`1.14.0/kit/cases/${id}.json`, PORT), 'utf8'), readFileSync(new URL(`1.13.0/kit/cases/${id}.json`, PORT), 'utf8'), id);
  const added = kitCase('1.14.0', 'bulk-selected-confirmed-first');
  const bulk = current.intents['bulk.apply_selected'];
  assert.equal(added.intent, 'bulk.apply_selected');
  assert.deepEqual(added.given.confirms, ['bulk.apply_selected']);
  for (const field of bulk.payload.required) assert.ok(field in added.when.payload, `the case's payload carries ${field}`);
  for (const field of Object.keys(added.when.payload)) assert.ok(field in bulk.payload.properties, `${field} is declared`);
  assert.deepEqual([added.then.answer, added.then.data_must_include], ['refused', ['confirm']]);
});

// A host of a few lines that confirms a bulk delete: the case run end to end,
// with the digest round trip the note asks for.
test('a host that confirms a bulk delete: refused with a digest, applied with it, refused with another', () => {
  const store = new Map([[1, 'r1'], [2, 'r2']]);
  const digestOf = ({ action_id: action, record_ids: ids }) => `${action}:${[...ids].sort().join(',')}`;
  const host = (payload) => {
    const declared = current.intents['bulk.apply_selected'].payload;
    for (const field of Object.keys(payload)) if (!(field in declared.properties)) return { answer: 'refused', reason: 'invalid_payload' };
    const stale = payload.record_ids.filter((id) => store.get(id) !== payload.revisions[String(id)]);
    if (stale.length) return { answer: 'conflict', conflicts: stale.map((id) => ({ id, current_revision: store.get(id) })) };
    if (payload.action_id === 'delete' && payload.confirm !== digestOf(payload)) {
      if (payload.confirm !== undefined) return { answer: 'refused', reason: 'confirm_mismatch' };
      return { answer: 'refused', reason: 'confirm_required', data: { confirm: { summary: `Delete ${payload.record_ids.length} records`, digest: digestOf(payload) } } };
    }
    for (const id of payload.record_ids) store.delete(id);
    return { answer: 'applied' };
  };
  const { when, then } = kitCase('1.14.0', 'bulk-selected-confirmed-first');
  const asked = host(when.payload);
  assert.equal(asked.answer, then.answer);
  for (const field of then.answer_must_include) assert.ok(field in asked, field);
  for (const field of then.data_must_include) assert.ok(field in asked.data, field);
  assert.equal(asked.reason, 'confirm_required');
  assert.equal(store.size, 2, 'nothing is written before the confirmation');
  assert.equal(host({ ...when.payload, confirm: 'other' }).answer, 'refused');
  assert.equal(store.size, 2);
  assert.equal(host({ ...when.payload, confirm: asked.data.confirm.digest }).answer, 'applied');
  assert.equal(store.size, 0);
});
