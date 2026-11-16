import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.search-port 1.1.0 (owner decisions C162, C175, 2026-11-14): a minor
// over 1.0.0 that adds and never changes. The window draws a result's type
// mark, time and avatar, opens a command's next step in place, turns typed
// operators into tags for a host that reads them, leads a full group to the
// product's results page and keeps pages beside queries in the recent list.
const root = resolve(import.meta.dirname, '..');
const base = join(root, 'src/core/contracts/ports/simai.search-port');
const read = (edition, file) => JSON.parse(readFileSync(join(base, edition, file), 'utf8'));
const v10 = read('1.0.0', 'port.json');
const v11 = read('1.1.0', 'port.json');
const kit = read('1.1.0', 'kit/manifest.json');
const kase = (id) => read('1.1.0', `kit/cases/${id}.json`);
const component = JSON.parse(readFileSync(join(root, 'src/smart/search/component.json'), 'utf8'));

test('1.1.0 is a minor of the same port: same element, no previous major', () => {
  assert.equal(v11.port, v10.port);
  assert.equal(v11.version, '1.1.0');
  assert.equal(v11.element, 'sf-search');
  assert.equal(v11.compatibility.previous_major, null);
});

test('everything 1.0.0 declared is still there, unchanged in name', () => {
  for (const name of Object.keys(v10.capabilities)) assert.ok(name in v11.capabilities, `capability ${name}`);
  for (const name of Object.keys(v10.intents)) assert.ok(name in v11.intents, `intent ${name}`);
  for (const name of Object.keys(v10.data)) assert.ok(name in v11.data, `data ${name}`);
  const before = Object.keys(v10.data.results.schema.items.properties);
  const after = Object.keys(v11.data.results.schema.items.properties);
  assert.deepEqual(after.slice(0, before.length), before);
  // One requirement is relaxed, never tightened: recent.forget names a query
  // or (1.1.0) a page's id, so query is no longer required.
  for (const [name, intent] of Object.entries(v10.intents)) {
    if (name === 'recent.forget') continue;
    for (const key of intent.payload.required ?? []) assert.ok(v11.intents[name].payload.required.includes(key), `${name}: ${key} still required`);
  }
});

test('the additions are the ones C175 names', () => {
  assert.deepEqual(Object.keys(v11.capabilities).filter((name) => !(name in v10.capabilities)), ['operators']);
  assert.deepEqual(Object.keys(v11.data.results.schema.items.properties).filter((name) => !(name in v10.data.results.schema.items.properties)),
    ['badge', 'time', 'avatar', 'steps']);
  assert.deepEqual(Object.keys(v11.data).filter((name) => !(name in v10.data)), ['more', 'operators']);
  const query = v11.intents['query.change'].payload.properties;
  for (const key of ['step', 'operators', 'operator']) assert.ok(key in query, `query.change ${key}`);
  assert.ok('id' in v11.intents['recent.forget'].payload.properties, 'recent.forget takes a page by id');
  assert.deepEqual(v11.intents['recent.forget'].payload.required, [], 'a query or an id');
});

test('the kit grows by the six new cases and stays whole', () => {
  assert.equal(kit.version, '1.1.0');
  assert.equal(kit.cases.length, 32);
  assert.equal(v11.conformance.cases, kit.cases.length);
  assert.deepEqual(readdirSync(join(base, '1.1.0/kit/cases')).sort(), kit.cases.map((id) => `${id}.json`).sort());
  const older = read('1.0.0', 'kit/manifest.json').cases;
  for (const id of older) assert.ok(kit.cases.includes(id), `1.0.0 case ${id} kept`);
  for (const id of ['step-answers-the-commands-options', 'operators-become-tags', 'operator-value-is-suggested',
    'operators-without-the-capability-stay-words', 'scope-leads-to-the-results-page', 'recent-page-forgotten-by-id']) {
    const document = kase(id);
    assert.equal(document.id, id);
    const intent = v11.intents[document.intent];
    assert.ok(intent, `${id}: intent`);
    for (const key of Object.keys(document.when.payload)) assert.ok(key in intent.payload.properties, `${id}: ${key} declared`);
    assert.ok(intent.answers.includes(document.then.answer), `${id}: answer`);
  }
  const words = kase('operators-without-the-capability-stay-words');
  assert.ok(!(words.given.capabilities ?? []).includes('operators'), 'the absence of operators is held too');
});

test('sf-search declares 1.1.0 and still accepts 1.0.0, with the digest of the file', async () => {
  const {createHash} = await import('node:crypto');
  assert.equal(component.port.version, '1.1.0');
  assert.equal(component.port.contract, 'src/core/contracts/ports/simai.search-port/1.1.0/port.json');
  assert.deepEqual(component['x-port'].supports, ['1.0.0', '1.1.0']);
  assert.ok(component['x-port'].capabilities.includes('operators'));
  const digest = createHash('sha256').update(readFileSync(join(root, component.port.contract))).digest('hex');
  assert.equal(component['x-port'].sha256, digest);
});
