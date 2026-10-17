import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {VALUE_TYPES, checkPortValue} from '../src/core/js/composition/routing.mjs';
import {checkFragmentDescriptor} from '../src/core/js/composition/fragments.mjs';

// simai.interface-fragment 1.0.0 (Larena handoff, owner decision 2026-10-15):
// the page-level value types, each with a schema and a check, and the
// fragment descriptor -- one vocabulary in the code, the schemas and the
// pinned copy the standard names.
const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

const PAGE_TYPES = ['record-changed.v1', 'record-removed.v1', 'collection-changed.v1', 'files-moved.v1', 'counter.v1', 'navigation.v1', 'preference-changed.v1'];

const GOOD = {
  'record-changed.v1': [{collection: 'news', id: 5, revision: 'r2'}, {collection: 'news', id: 'a-1', revision: 7, fields: ['title', 'status']}],
  'record-removed.v1': [{collection: 'news', id: 'a-1'}],
  'collection-changed.v1': [{collection: 'files', reason: 'imported'}],
  'files-moved.v1': [{ids: [1, 'b'], from: null, to: 'f-2'}],
  'counter.v1': [{key: 'notifications', value: 0}, {key: 'requests.new', value: 12}],
  'navigation.v1': [{url: '/admin/files?folder=2', region: 'content'}],
  'preference-changed.v1': [{key: 'sf-table/news'}, {key: 'sf-table/*'}],
};
const BAD = {
  'record-changed.v1': [{collection: 'news', id: 5}, {collection: 'news', id: 5, revision: 'r', values: {}}, {collection: '', id: 5, revision: 1}, {collection: 'n', id: 5, revision: 1, fields: ['a', 'a']}],
  'record-removed.v1': [{collection: 'news'}, {collection: 'news', id: null}, null],
  'collection-changed.v1': [{collection: 'news', reason: 'Created!'}, {collection: 'news'}],
  'files-moved.v1': [{ids: [], from: null, to: null}, {ids: [1, 1], from: null, to: null}, {ids: [1], from: {}, to: null}],
  'counter.v1': [{key: 'n', value: -1}, {key: 'n', value: 1.5}, {key: 'N', value: 1}],
  'navigation.v1': [{url: '//other.site/x', region: 'content'}, {url: 'https://other.site/', region: 'content'}, {url: 'javascript:alert(1)', region: 'content'}, {url: '/a', region: 'Content'}],
  'preference-changed.v1': [{key: 'a b'}, {key: ''}, {key: 'x', value: 1}],
};

test('every page value type has a summary, a schema and a check that accepts what it says and refuses the rest', () => {
  for (const type of PAGE_TYPES) {
    const entry = VALUE_TYPES[type];
    assert.ok(entry && entry.summary && entry.schema && typeof entry.check === 'function', `${type} is declared`);
    for (const value of GOOD[type]) {
      const checked = checkPortValue(type, value);
      assert.deepEqual(checked, value, `${type} keeps ${JSON.stringify(value)}`);
      assert.ok(Object.isFrozen(checked), `${type} answers a frozen copy`);
    }
    for (const value of BAD[type]) {
      assert.throws(() => checkPortValue(type, value), TypeError, `${type} refuses ${JSON.stringify(value)}`);
    }
  }
});

test('the code, the port-manifest schema, the descriptor schema and its pinned copy name one vocabulary', () => {
  const vocabulary = Object.keys(VALUE_TYPES).sort();
  const ports = json('src/core/contracts/composition-port-manifest.v1.schema.json').$defs.valueType.enum;
  const descriptor = json('src/core/contracts/interface-fragment.v1.schema.json');
  assert.deepEqual([...ports].sort(), vocabulary);
  assert.deepEqual([...descriptor.$defs.valueType.enum].sort(), vocabulary);
  // The pinned copy is the published 1.0.0 schema. The live one (1.1.0) adds
  // only the bare format name beside the older label (names carry no version,
  // 2026-10-11); without that it is the published schema.
  const published = json('contracts/standards/pinned/interface-fragment.v1.schema.json');
  const {anyOf, ...live} = descriptor;
  const {schema_version, ...properties} = live.properties;
  assert.deepEqual(anyOf, [{properties: {schema: {const: 'simai.interface-fragment.v1'}}}, {required: ['schema_version']}]);
  assert.deepEqual(schema_version, {const: 1});
  assert.deepEqual(properties.schema.enum, [published.properties.schema.const, 'simai.interface-fragment']);
  assert.deepEqual({...live, 'x-simai-version': published['x-simai-version'], properties: {...properties, schema: published.properties.schema}}, published, 'otherwise the pinned copy is the published schema');
});

const DESCRIPTOR = {
  schema: 'simai.interface-fragment.v1',
  id: 'larena.file-manager',
  element: 'sf-file-manager',
  regions: ['content'],
  port: {standard: 'simai.composite-host-port', version: '1.0.3'},
  outputs: {moved: {value: 'files-moved.v1', summary: 'Files the person moved.'}},
  inputs: {changed: {value: 'collection-changed.v1', summary: 'Read the folder again.'}},
  operation: 'files.read',
  url_state: ['folder'],
  budget: {kb: 40, first_answer_ms: 300},
};

test('a fragment descriptor that holds has no problems, and each broken part is named', () => {
  assert.deepEqual(checkFragmentDescriptor(DESCRIPTOR), []);
  const broken = (patch) => checkFragmentDescriptor({...DESCRIPTOR, ...patch});
  assert.match(broken({schema: 'x'}).join(), /schema/);
  assert.match(broken({regions: []}).join(), /regions/);
  assert.match(broken({outputs: {moved: {value: 'files.v9', summary: 'x'}}}).join(), /unknown value type/);
  assert.match(broken({inputs: {changed: {value: 'text.v1', summary: 'x', extra: 1}}}).join(), /undeclared keys/);
  assert.match(broken({url_state: ['folder', 'folder']}).join(), /url_state/);
  assert.match(broken({budget: {kb: 40}}).join(), /budget/);
  assert.match(broken({port: {standard: 'simai.composite-host-port'}}).join(), /port/);
  assert.match(checkFragmentDescriptor({...DESCRIPTOR, script: 'x'}).join(), /script: undeclared/);
});
