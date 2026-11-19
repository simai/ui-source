// simai.dataview-port 1.16.0 (owner decision C298, the levels of a view; VZ-1,
// the view zone; LV-12, the remembered page size): a saved view names its level
// in C298's words -- system, shared, personal -- where 1.0.0 to 1.15.0 said
// package for the system level (read as system until 2027-01-01), and a host
// that keeps the person's own view state on the server announces
// personal-preferences: page size, view zone, view opened last, sent with the
// answer to query.change and written back by preferences.save. A minor of
// 1.15.0 (standard simai.composite-host-port, minor-is-additive): every intent,
// field and requirement of 1.15.0 stays, every addition is optional.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMemoryHost, viewLevel, LEVEL_ALIAS_UNTIL } from './fixtures/dataview-memory-host.mjs';

const PORT = new URL('../src/core/contracts/ports/simai.dataview-port/', import.meta.url);
const edition = (version) => JSON.parse(readFileSync(new URL(`${version}/port.json`, PORT), 'utf8'));
const kitCase = (version, id) => JSON.parse(readFileSync(new URL(`${version}/kit/cases/${id}.json`, PORT), 'utf8'));
const previous = edition('1.15.0');
const current = edition('1.16.0');
const NEW_CASES = [
  'saved-views-name-their-level',
  'system-view-is-not-written',
  'preferences-come-with-the-first-answer',
  'preferences-save-merges-the-changed-fields',
  'preferences-save-conflict',
  'preferences-without-the-capability-stay-in-the-browser',
];

// The keywords these schemas use, applied as a validating view applies them.
const kindOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value);
const problems = (schema, data, path = '') => {
  const found = [];
  if (schema.type !== undefined && ![].concat(schema.type).some((type) => type === kindOf(data) || (type === 'number' && kindOf(data) === 'integer'))) return [`${path} must be ${[].concat(schema.type).join('|')}`];
  if (schema.enum && !schema.enum.some((one) => JSON.stringify(one) === JSON.stringify(data))) found.push(`${path}: ${JSON.stringify(data)} is not one of ${schema.enum.join(', ')}`);
  if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum) found.push(`${path} below ${schema.minimum}`);
  if (typeof data === 'number' && schema.maximum !== undefined && data > schema.maximum) found.push(`${path} above ${schema.maximum}`);
  if (typeof data === 'string' && schema.minLength !== undefined && data.length < schema.minLength) found.push(`${path} too short`);
  if (Array.isArray(data) && schema.items) data.forEach((one, index) => found.push(...problems(schema.items, one, `${path}/${index}`)));
  if (kindOf(data) === 'object') {
    if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) found.push(`${path} needs ${schema.minProperties} keys`);
    for (const name of schema.required ?? []) if (!(name in data)) found.push(`${path} must have ${name}`);
    for (const [name, value] of Object.entries(data)) {
      if (schema.properties?.[name]) found.push(...problems(schema.properties[name], value, `${path}/${name}`));
      else if (schema.additionalProperties === false) found.push(`${path}/${name} is not declared`);
    }
  }
  return found;
};
const savedViewSchema = (document) => document.data.saved_views.schema.items;

test('1.16.0 keeps every intent, capability, field and requirement of 1.15.0', () => {
  assert.equal(current.version, '1.16.0');
  for (const [name, intent] of Object.entries(previous.intents)) {
    if (name === 'query.change') continue;
    assert.deepEqual(current.intents[name], intent, `intent ${name}`);
  }
  // query.change: one optional answer field more, nothing else.
  const [before, after] = [previous.intents['query.change'], current.intents['query.change']];
  assert.deepEqual({...after, answer_data: undefined}, {...before, answer_data: undefined});
  assert.deepEqual(after.answer_data.required, before.answer_data.required);
  assert.deepEqual(Object.keys(after.answer_data.properties).filter((key) => !(key in before.answer_data.properties)), ['preferences']);
  for (const [key, schema] of Object.entries(before.answer_data.properties)) assert.deepEqual(after.answer_data.properties[key], schema, `query.change answer ${key}`);
  assert.deepEqual(Object.keys(current.intents).filter((name) => !(name in previous.intents)), ['preferences.save']);
  for (const [name, capability] of Object.entries(previous.capabilities)) assert.deepEqual(current.capabilities[name], capability, `capability ${name}`);
  assert.deepEqual(Object.keys(current.capabilities).filter((name) => !(name in previous.capabilities)), ['personal-preferences']);
  assert.deepEqual(current.settings, previous.settings, 'the column layers are unchanged');
  assert.deepEqual(current.answer, previous.answer);
  for (const key of Object.keys(previous.data)) if (key !== 'saved_views') assert.deepEqual(current.data[key], previous.data[key], `data.${key}`);
  assert.deepEqual(Object.keys(current.data).filter((key) => !(key in previous.data)), ['preferences']);
  assert.equal(current.data.preferences.required, false, 'nothing new is required of a host');
  for (const line of previous.compatibility.recheck) assert.ok(current.compatibility.recheck.includes(line), line);
  assert.ok(current.summary.startsWith(previous.summary), 'the summary is 1.15.0\'s, with sentences more');
});

test('a saved view\'s level is system, shared or personal; package is the dated alias of system', () => {
  const [before, after] = [savedViewSchema(previous), savedViewSchema(current)];
  assert.deepEqual(after.required, before.required, 'nothing new is required of a saved view');
  for (const [field, schema] of Object.entries(before.properties)) if (field !== 'level') assert.deepEqual(after.properties[field], schema, `saved_views[].${field}`);
  assert.deepEqual(after.properties.level.enum, ['system', 'shared', 'personal', 'package']);
  assert.match(after.properties.level.description, /C298/u);
  assert.match(after.properties.level.description, /package .* read as system until 2027-01-01/u);
  assert.equal(LEVEL_ALIAS_UNTIL, '2027-01-01');
  for (const level of ['system', 'shared', 'personal', 'package']) assert.deepEqual(problems(after, {key: 'k', label: 'K', revision: 1, level}), [], level);
  assert.deepEqual(problems(after, {key: 'k', label: 'K', revision: 1}), [], 'a view without a level still conforms');
  assert.equal(problems(after, {key: 'k', label: 'K', revision: 1, level: 'team'}).length, 1, 'team is reserved, not a level');
  assert.equal(problems(before, {key: 'k', label: 'K', revision: 1, level: 'system'}).length, 1, '1.15.0 has no system');
  // The alias reads until its date and no longer.
  assert.equal(viewLevel({level: 'package'}, '2027-01-01'), 'system');
  assert.equal(viewLevel({level: 'package'}, '2027-01-02'), null);
  assert.equal(viewLevel({level: 'shared'}), 'shared');
  assert.equal(viewLevel({}), null);
  // The journal holds the rename with the same date.
  const journal = JSON.parse(readFileSync(new URL('../contracts/changes/journal.json', import.meta.url), 'utf8'));
  const record = journal.records.find((one) => one.id === 'value-dataview-saved-view-level-package-to-system');
  assert.ok(record, 'the journal records the alias');
  assert.equal(record.remove_after, LEVEL_ALIAS_UNTIL);
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), [['package', 'system']]);
});

test('personal-preferences: a capability, the preferences layer and preferences.save', () => {
  const capability = current.capabilities['personal-preferences'];
  assert.deepEqual(capability.intents, ['preferences.save']);
  assert.deepEqual(capability.data, ['preferences']);
  assert.match(capability.summary, /signed-in person/u);
  assert.match(capability.summary, /browser/u);
  const layer = current.data.preferences.schema;
  assert.deepEqual(layer.required, ['revision']);
  assert.deepEqual(Object.keys(layer.properties), ['revision', 'page_size', 'view_zone', 'view']);
  assert.deepEqual(problems(layer, {revision: 'p1', page_size: 50, view_zone: 'open', view: 'unpaid'}), []);
  assert.deepEqual(problems(layer, {revision: 3}), [], 'every field but the revision is optional');
  assert.equal(problems(layer, {revision: 'p1', page_size: 0}).length, 1);
  assert.equal(problems(layer, {revision: 'p1', view_zone: 'half'}).length, 1);
  assert.equal(problems(layer, {revision: 'p1', person: 'u7'}).length, 1, 'the person is never in the data: the host knows who asks');
  const save = current.intents['preferences.save'];
  assert.equal(save.capability, 'personal-preferences');
  assert.equal(save.carries_revision, true);
  assert.equal(save.event, 'sf-view-preferences-change');
  assert.deepEqual(save.answers, ['applied', 'conflict', 'refused', 'unavailable']);
  assert.deepEqual(problems(save.payload, {preferences: {view_zone: 'closed'}, base_revision: 'p3'}), []);
  assert.deepEqual(problems(save.payload, {preferences: {page_size: null}, base_revision: 'p3'}), [], 'null removes a field');
  assert.equal(problems(save.payload, {preferences: {}, base_revision: 'p3'}).length, 1, 'a save names what changed');
  assert.equal(problems(save.payload, {preferences: {view_zone: 'open'}}).length, 1, 'a save carries its base revision');
  assert.ok(current.compatibility.recheck.some((line) => line.startsWith('with personal-preferences the first answer')));
});

test('the kit is 1.15.0\'s, byte for byte, and six cases more', () => {
  const before = JSON.parse(readFileSync(new URL('1.15.0/kit/manifest.json', PORT), 'utf8'));
  const after = JSON.parse(readFileSync(new URL('1.16.0/kit/manifest.json', PORT), 'utf8'));
  assert.equal(after.version, '1.16.0');
  assert.deepEqual(after.cases, [...before.cases, ...NEW_CASES]);
  assert.equal(current.conformance.cases, after.cases.length);
  for (const id of before.cases) assert.equal(readFileSync(new URL(`1.16.0/kit/cases/${id}.json`, PORT), 'utf8'), readFileSync(new URL(`1.15.0/kit/cases/${id}.json`, PORT), 'utf8'), id);
  const levels = kitCase('1.16.0', 'saved-views-name-their-level');
  for (const view of levels.given.saved_views) assert.deepEqual(problems(savedViewSchema(current), view), [], view.key);
  assert.deepEqual([...new Set(levels.given.saved_views.map((view) => view.level ?? null))], ['system', 'shared', 'personal', 'package', null]);
  for (const id of NEW_CASES) {
    const one = kitCase('1.16.0', id);
    assert.equal(one.id, id);
    assert.ok(current.intents[one.when.intent], `${id}: ${one.when.intent} is an intent`);
    assert.deepEqual(problems(current.intents[one.when.intent].payload, one.when.payload), [], `${id}: the payload conforms`);
    if (one.given.preferences) assert.deepEqual(problems(current.data.preferences.schema, one.given.preferences), [], `${id}: the layer conforms`);
  }
});

// The six cases end to end against the in-memory reference host.
test('the reference host passes the six new cases', () => {
  for (const id of NEW_CASES) {
    const one = kitCase('1.16.0', id);
    const capabilities = one.given.capabilities ?? ['saved-views', 'shared-saved-views', 'personal-preferences'];
    const host = createMemoryHost({
      person: 'u7',
      people: one.given.preferences ? {u7: one.given.preferences} : {},
      saved_views: one.given.saved_views ?? [],
      records: one.given.records ?? [],
      capabilities,
    });
    const answer = host.raise(one.when.intent, one.when.payload);
    assert.equal(answer.answer, one.then.answer, `${id}: ${JSON.stringify(answer)}`);
    for (const field of one.then.answer_must_include ?? []) assert.ok(field in answer, `${id}: ${field}`);
    for (const field of one.then.data_must_include ?? []) assert.ok(field in (answer.data ?? {}), `${id}: data.${field}`);
    if (answer.data?.preferences) assert.deepEqual(problems(current.data.preferences.schema, answer.data.preferences), [], `${id}: the answered layer conforms`);
  }
  // The merge keeps what a save does not name, and null removes a field.
  const host = createMemoryHost({person: 'u7', people: {u7: {revision: 'p3', page_size: 50, view_zone: 'open'}}});
  const first = host.raise('query.change', {sequence: 1, query: {per_page: 50}});
  assert.equal(first.data.preferences.revision, 'p3');
  assert.equal('preferences' in host.raise('query.change', {sequence: 2, query: {}}).data, false, 'the first answer carries the layer');
  const closed = host.raise('preferences.save', {preferences: {view_zone: 'closed'}, base_revision: 'p3'});
  assert.deepEqual({...closed.data.preferences, revision: undefined}, {page_size: 50, view_zone: 'closed', revision: undefined});
  const reset = host.raise('preferences.save', {preferences: {page_size: null}, base_revision: closed.data.preferences.revision});
  assert.equal('page_size' in reset.data.preferences, false);
  // A system view is never written; the change goes to a new personal view.
  const views = createMemoryHost({saved_views: [{key: 'all', label: 'All', revision: 'v1', level: 'system'}]});
  assert.equal(views.raise('view.save', {key: 'all', revision: 'v1'}).answer, 'refused');
  const own = views.raise('view.save', {key: 'all-mine', label: 'All, mine'});
  assert.equal(own.answer, 'applied');
  assert.equal(own.data.saved_views.find((view) => view.key === 'all-mine').level, 'personal');
  assert.equal(views.raise('view.save_shared', {key: 'team', label: 'Team', target: 'shared'}).data.saved_views.find((view) => view.key === 'team').level, 'shared');
});

test('a guest is offered no personal-preferences: the state stays in the browser', () => {
  const guest = createMemoryHost({person: null, people: {u7: {revision: 'p1', page_size: 50}}});
  assert.equal(guest.capabilities.includes('personal-preferences'), false);
  assert.equal('preferences' in guest.raise('query.change', {sequence: 1, query: {}}).data, false);
  const asked = guest.raise('preferences.save', {preferences: {page_size: 20}, base_revision: 'p1'});
  assert.deepEqual(asked, {answer: 'unavailable', reason: 'capability-not-provided'});
  // Two people, two layers: one person's save never reaches another's.
  const people = {u7: {revision: 'a1', page_size: 50}, u8: {revision: 'b1', page_size: 10}};
  const seven = createMemoryHost({person: 'u7', people});
  seven.raise('preferences.save', {preferences: {page_size: 100}, base_revision: 'a1'});
  assert.equal(createMemoryHost({person: 'u8', people}).raise('query.change', {sequence: 1, query: {}}).data.preferences.page_size, 10);
});
