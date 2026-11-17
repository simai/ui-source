import assert from 'node:assert/strict';
import test from 'node:test';

import {TOP_FIELDS, TOP_FIELD_ALIASES, topField, topFieldProblems} from '../scripts/generate-component-files.mjs';

// Standard simai.smart-component 1.3.17 §4 (dispatcher 2026-11-17, order of the
// SIMAI View round): history and framework_first join the closed list of
// component.json's top-level fields. A set that wrote them as x-history and
// x-framework-first while the list had no word for them is read the same until
// 2027-01-01; both spellings in one file are refused.

const BEFORE = '2026-11-17';
const AFTER = '2027-01-01';

const history = [
  {version: '1.21.0', kind: 'minor', recorded_on: '2026-11-17', consumer: 'A host may now set the head colour through a variable.', evidence: 'https://github.com/simai/ui-view/commit/da5de52ef022bfcd6da197ee6963675ded22ef08'},
  {version: '1.20.1', kind: 'patch', recorded_on: '2026-11-16', consumer: 'Nothing to change for a host.', evidence: 'https://github.com/simai/ui-view/commit/fa0ee5e8a1ee42a718079a2430cc9b36df8b93c6'},
];
const framework = {$comment: 'Copies kept knowingly, part id to the Framework order.', waits: {'T-21': 'FO-4', 'T-33': 'FO-2'}};
const base = {id: 'view-table', tag: 'sf-view-table', version: '1.21.0', kind: 'smart', family: 'view'};

const standardForm = {...base, history, framework_first: framework};
const aliasForm = {...base, 'x-history': history, 'x-framework-first': framework};

test('history and framework_first stand in the closed list, after version', () => {
  const at = TOP_FIELDS.indexOf('version');
  assert.deepEqual(TOP_FIELDS.slice(at, at + 3), ['version', 'history', 'framework_first']);
  assert.equal(new Set(TOP_FIELDS).size, TOP_FIELDS.length);
  assert.deepEqual(Object.fromEntries(Object.entries(TOP_FIELD_ALIASES).map(([alias, {field, remove_after: until}]) => [alias, [field, until]])),
    {'x-history': ['history', '2027-01-01'], 'x-framework-first': ['framework_first', '2027-01-01']});
});

test('the standard spelling holds, on any day', () => {
  assert.deepEqual(topFieldProblems(standardForm, {today: BEFORE}), []);
  assert.deepEqual(topFieldProblems(standardForm, {today: AFTER}), []);
});

test('the x- spelling holds until 2027-01-01 and is read as the standard field', () => {
  assert.deepEqual(topFieldProblems(aliasForm, {today: BEFORE}), []);
  assert.deepEqual(topFieldProblems(aliasForm, {today: '2026-12-31'}), []);
  assert.deepEqual(topField(aliasForm, 'history'), history);
  assert.deepEqual(topField(aliasForm, 'framework_first'), framework);
  assert.deepEqual(topField(standardForm, 'history'), history);
  assert.deepEqual(topFieldProblems(aliasForm, {today: AFTER}), [
    'component.json: x-history ended 2027-01-01; write history',
    'component.json: x-framework-first ended 2027-01-01; write framework_first',
  ]);
});

test('both spellings in one file are refused', () => {
  assert.deepEqual(topFieldProblems({...standardForm, 'x-history': history}, {today: BEFORE}),
    ['component.json: x-history and history both written; keep history']);
});

test('an unknown top-level field is still refused, a tool\'s x- field still kept', () => {
  assert.deepEqual(topFieldProblems({...base, journal: history, 'x-summary': 'kept'}, {today: BEFORE}),
    ['component.json: unknown top-level field journal (gate 1, §4)']);
});

test('history is the journal: newest first, at the component version, each entry with its kind, day and evidence', () => {
  const problems = (value, component = base) => topFieldProblems({...component, history: value}, {today: BEFORE});
  assert.deepEqual(problems([]), ['component.json.history: a non-empty list, newest first']);
  assert.deepEqual(problems([...history].reverse()), ["component.json.history[0].version: the newest entry is the component's version 1.21.0, not 1.20.1"]);
  assert.deepEqual(problems([{...history[0], kind: 'fix'}, history[1]]), ['component.json.history[0].kind: one of added, patch, minor, major']);
  assert.deepEqual(problems([{...history[0], consumer: 'ok'}, history[1]]), ['component.json.history[0].consumer: a minor version says what a host does (more than 10 characters)']);
  assert.deepEqual(problems([{...history[0], evidence: 'da5de52'}, history[1]]), ['component.json.history[0].evidence: an https link']);
  assert.deepEqual(problems([{...history[0], recorded_on: '17.11.2026'}, history[1]]), ['component.json.history[0].recorded_on: YYYY-MM-DD']);
  assert.deepEqual(problems([{...history[0], note: 'x'}, history[1]]), ['component.json.history[0]: unknown field note']);
  assert.deepEqual(problems([history[0], {...history[1], version: '1.21.0'}]), ['component.json.history: a version is listed once']);
  const patch = {version: '1.21.0', kind: 'patch', recorded_on: '2026-11-17', evidence: 'https://example.test/e'};
  assert.deepEqual(problems([patch]), [], 'a patch needs no consumer note');
});

test('framework_first names, per part, the Framework order it waits for', () => {
  const problems = (value) => topFieldProblems({...base, framework_first: value}, {today: BEFORE});
  assert.deepEqual(problems({waits: {}}), []);
  assert.deepEqual(problems([]), ['component.json.framework_first: an object {waits}']);
  assert.deepEqual(problems({}), ['component.json.framework_first.waits: an object, part id to the Framework order it waits for']);
  assert.deepEqual(problems({waits: {'T-21': 'FO-4'}, order: 'x'}), ['component.json.framework_first: unknown field order']);
  assert.deepEqual(problems({waits: {'T-21': 'order 4'}}), ['component.json.framework_first.waits.T-21: a Framework order FO-<n>, not "order 4"']);
  assert.deepEqual(topFieldProblems({...base, 'x-framework-first': {waits: {'T-21': 'FO'}}}, {today: BEFORE}),
    ['component.json.framework_first.waits.T-21: a Framework order FO-<n>, not "FO"'], 'the x- spelling is held to the same shape');
});
