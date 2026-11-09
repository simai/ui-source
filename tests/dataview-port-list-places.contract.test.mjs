// simai.dataview-port 1.15.0 (owner decision C31, the list of resources): a
// column may name its place in a list row, columns[].list. The edition is a
// minor of 1.14.0 (standard simai.composite-host-port, minor-is-additive):
// every intent, field and requirement of 1.14.0 stays, and the one addition is
// optional. Until this edition sf-view carried the places in its own
// attribute, list-roles="key:role,…".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PORT = new URL('../src/core/contracts/ports/simai.dataview-port/', import.meta.url);
const edition = (version) => JSON.parse(readFileSync(new URL(`${version}/port.json`, PORT), 'utf8'));
const kitCase = (version, id) => JSON.parse(readFileSync(new URL(`${version}/kit/cases/${id}.json`, PORT), 'utf8'));
const previous = edition('1.14.0');
const current = edition('1.15.0');
const PLACES = ['status', 'title', 'supporting', 'fact', 'hidden'];
const columnSchema = (document) => document.data.columns.schema.items;

// The column schema's own rules, as a validating view applies them: required
// fields, no field the schema does not name, and every enum.
const columnProblems = (column, schema = columnSchema(current)) => {
  const problems = [];
  for (const field of schema.required) if (!(field in column)) problems.push(`${field} is required`);
  for (const [field, value] of Object.entries(column)) {
    const declared = schema.properties[field];
    if (!declared) { if (schema.additionalProperties === false) problems.push(`${field} is not a column field`); continue; }
    if (declared.enum && !declared.enum.includes(value)) problems.push(`${field}: ${JSON.stringify(value)} is not one of ${declared.enum.join(', ')}`);
  }
  return problems;
};

test('1.15.0 keeps every intent, field and requirement of 1.14.0', () => {
  assert.equal(current.version, '1.15.0');
  assert.deepEqual(current.intents, previous.intents, 'the intents are 1.14.0\'s, unchanged');
  assert.deepEqual(current.capabilities, previous.capabilities);
  assert.deepEqual(current.settings, previous.settings);
  assert.deepEqual(current.answer, previous.answer);
  for (const key of Object.keys(previous.data)) if (key !== 'columns') assert.deepEqual(current.data[key], previous.data[key], `data.${key}`);
  const [before, after] = [columnSchema(previous), columnSchema(current)];
  assert.deepEqual(after.required, before.required, 'nothing new is required of a column');
  assert.equal(after.additionalProperties, before.additionalProperties);
  for (const [field, schema] of Object.entries(before.properties)) assert.deepEqual(after.properties[field], schema, `columns[].${field}`);
  assert.deepEqual(Object.keys(after.properties).filter((field) => !(field in before.properties)), ['list']);
  for (const line of previous.compatibility.recheck) assert.ok(current.compatibility.recheck.includes(line), line);
  assert.ok(current.summary.startsWith(previous.summary), 'the summary is 1.14.0\'s, with one sentence more');
});

test('columns[].list is optional and one of status, title, supporting, fact and hidden', () => {
  const list = columnSchema(current).properties.list;
  assert.deepEqual(list.enum, PLACES);
  assert.ok(!columnSchema(current).required.includes('list'));
  assert.match(list.description, /C31/u);
  assert.match(list.description, /At most one column carries status and at most one title/u);
  assert.match(list.description, /role: title leads the row/u, 'without a list title the role: title column leads');
  assert.ok(current.compatibility.recheck.some((line) => line.startsWith('a column may name its place in a list row')));
  // A 1.14.0 column (no list) still conforms; each place conforms; any other word does not.
  assert.deepEqual(columnProblems({ key: 'name', role: 'title' }), []);
  for (const place of PLACES) assert.deepEqual(columnProblems({ key: 'k', list: place }), [], place);
  assert.equal(columnProblems({ key: 'plan', list: 'badge' }).length, 1, 'an unknown place is refused');
  assert.equal(columnProblems({ key: 'plan', list: 'Status' }).length, 1, 'places are lower case');
  assert.equal(columnProblems({ key: 'plan', list: 'fact' }, columnSchema(previous)).length, 1, '1.14.0 has no list field');
});

test('the kit is 1.14.0\'s, byte for byte, and two list-place cases', () => {
  const before = JSON.parse(readFileSync(new URL('1.14.0/kit/manifest.json', PORT), 'utf8'));
  const after = JSON.parse(readFileSync(new URL('1.15.0/kit/manifest.json', PORT), 'utf8'));
  assert.equal(after.version, '1.15.0');
  assert.deepEqual(after.cases, [...before.cases, 'columns-name-their-list-place', 'columns-list-place-is-one-of-five']);
  assert.equal(current.conformance.cases, after.cases.length);
  for (const id of before.cases) assert.equal(readFileSync(new URL(`1.15.0/kit/cases/${id}.json`, PORT), 'utf8'), readFileSync(new URL(`1.14.0/kit/cases/${id}.json`, PORT), 'utf8'), id);

  const named = kitCase('1.15.0', 'columns-name-their-list-place');
  assert.equal(named.intent, 'query.change');
  assert.deepEqual([...new Set(named.given.columns.map((column) => column.list))].sort(), [...PLACES].sort(), 'a column with each place');
  for (const column of named.given.columns) assert.deepEqual(columnProblems(column), [], column.key);
  for (const field of Object.keys(named.given.records[0])) if (!['id', 'revision', 'actions'].includes(field)) assert.ok(named.given.columns.some((column) => column.key === field), `${field} has a column`);
  assert.equal(named.given.columns.filter((column) => column.list === 'status').length, 1);
  assert.equal(named.given.columns.filter((column) => column.list === 'title').length, 1);
  assert.deepEqual(named.then.data_must_include, ['records', 'columns']);

  const refused = kitCase('1.15.0', 'columns-list-place-is-one-of-five');
  const stored = Object.entries(refused.given.stored_list_places);
  assert.ok(stored.some(([, place]) => !PLACES.includes(place)), 'the store holds a word outside the five');
  for (const [key, place] of stored) assert.equal(columnProblems({ key, list: place }).length, PLACES.includes(place) ? 0 : 1, key);
  assert.equal(refused.then.answer, 'applied');
  assert.match(refused.then.note, /does not conform to data\.columns/u);
});

// A host of a few lines that keeps list places in its store: the two cases run
// end to end, with the answer's columns checked against the schema.
test('a host that names list places answers conforming columns, and drops a word outside the five', () => {
  const host = (stored, keys) => ({
    answer: 'applied',
    data: {
      records: [],
      columns: keys.map((key) => ({ key, ...(PLACES.includes(stored[key]) ? { list: stored[key] } : {}) })),
    },
  });
  const named = kitCase('1.15.0', 'columns-name-their-list-place');
  const places = Object.fromEntries(named.given.columns.map((column) => [column.key, column.list]));
  const answered = host(places, Object.keys(places));
  assert.equal(answered.answer, named.then.answer);
  for (const field of named.then.data_must_include) assert.ok(field in answered.data, field);
  assert.deepEqual(answered.data.columns.map((column) => column.list), named.given.columns.map((column) => column.list));

  const refused = kitCase('1.15.0', 'columns-list-place-is-one-of-five');
  const own = host(refused.given.stored_list_places, Object.keys(refused.given.stored_list_places));
  for (const column of own.data.columns) assert.deepEqual(columnProblems(column), [], column.key);
  assert.deepEqual(own.data.columns, [{ key: 'name', list: 'title' }, { key: 'plan' }]);
});
