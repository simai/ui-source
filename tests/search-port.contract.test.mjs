import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.search-port 1.0.0: the seam of sf-search. The panel never fetches --
// it draws a field, groups of results, the blocks and the keyboard, and asks
// the host; the index, the ranking, the access and what a command does stay
// the host's. Written against the shipped simai.dataview-port 1.13.0: the same
// answer envelope, the same sequence rule, the same «a capability the host did
// not announce is never drawn as a dead control», so a host that has read one
// kit can read this one. The capability says what is possible and the panel's
// setting says what is wanted (owner, delegated envelope, 2026-10-29).
const root = resolve(import.meta.dirname, '..');
const at = join(root, 'src/core/contracts/ports/simai.search-port/1.0.0');
const port = JSON.parse(readFileSync(join(at, 'port.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(at, 'kit/manifest.json'), 'utf8'));
const kase = (id) => JSON.parse(readFileSync(join(at, `kit/cases/${id}.json`), 'utf8'));
const ANSWERS = ['applied', 'refused', 'unavailable'];
const CAPABILITIES = ['scopes', 'recent', 'popular', 'actions', 'preview', 'spelling'];
const INTENTS = ['query.change', 'result.open', 'result.preview', 'action.run', 'recent.forget', 'recent.clear'];
const SEQUENCED = ['query.change', 'result.preview'];

test('the port is a composite host port of sf-search, edition 1.0.0, with no previous major', () => {
  assert.equal(port.schema, 'simai.composite.host-port.v1');
  assert.equal(port.port, 'simai.search-port');
  assert.equal(port.version, '1.0.0');
  assert.equal(port.component, 'smart.search');
  assert.equal(port.element, 'sf-search');
  assert.equal(port.compatibility.previous_major, null);
  // Three answers, not the data view's four: nothing here carries a revision,
  // so nothing can conflict.
  assert.deepEqual(port.answer.schema.properties.answer.enum, ANSWERS);
  for (const intent of Object.values(port.intents)) assert.equal(intent.carries_revision, false);
});

test('the port is the form the published schema declares, closed where it says closed', () => {
  const schema = JSON.parse(readFileSync(join(root, 'src/core/contracts/composite-host-port.v1.schema.json'), 'utf8'));
  for (const key of schema.required) assert.ok(key in port, `port.json: ${key}`);
  assert.deepEqual(Object.keys(port).filter((key) => !(key in schema.properties)), [], 'no key the schema does not declare');
  const intentKeys = Object.keys(schema.properties.intents.additionalProperties.properties);
  for (const [name, intent] of Object.entries(port.intents)) {
    for (const key of schema.properties.intents.additionalProperties.required) assert.ok(key in intent, `${name}: ${key}`);
    assert.deepEqual(Object.keys(intent).filter((key) => !intentKeys.includes(key)), [], `${name}: declared keys only`);
  }
  const dataKeys = Object.keys(schema.properties.data.additionalProperties.properties);
  for (const [name, entry] of Object.entries(port.data)) {
    assert.deepEqual(Object.keys(entry).filter((key) => !dataKeys.includes(key)), [], `data.${name}: declared keys only`);
    assert.equal(entry.schema.additionalProperties ?? entry.schema.items?.additionalProperties ?? false, false, `data.${name}: a closed schema`);
  }
});

test('six capabilities, each naming the intents and the data behind it', () => {
  assert.deepEqual(Object.keys(port.capabilities), CAPABILITIES);
  for (const [name, capability] of Object.entries(port.capabilities)) {
    assert.ok(capability.summary.length > 20, `${name}: a summary in words`);
    for (const intent of capability.intents ?? []) assert.equal(port.intents[intent]?.capability, name, `${name} names ${intent}`);
    for (const key of capability.data ?? []) assert.ok(key in port.data, `${name}: data ${key}`);
  }
  // The two the panel reads without an intent of their own, and the four that
  // have one. preview and spelling carry no setting of sf-search: the arrangement
  // decides the pane and the correction follows the capability alone.
  assert.deepEqual(port.capabilities.scopes.intents, undefined);
  assert.deepEqual(port.capabilities.popular.intents, undefined);
  assert.deepEqual(port.capabilities.spelling.intents, undefined);
  assert.deepEqual(port.capabilities.recent.intents, ['recent.forget', 'recent.clear']);
  assert.deepEqual(port.capabilities.actions.intents, ['action.run']);
  assert.deepEqual(port.capabilities.preview.intents, ['result.preview']);
});

test('six intents on one event, each with a closed payload and answers from the three', () => {
  assert.deepEqual(Object.keys(port.intents), INTENTS);
  for (const [name, intent] of Object.entries(port.intents)) {
    // One event for the six: every intent shares one answer envelope, so one
    // event carries them all and one action answers them all (apply-answer).
    assert.equal(intent.event, 'sf-search-intent', `${name}: the element's own intent event`);
    assert.equal(intent.payload.additionalProperties, false, `${name}: a closed payload`);
    assert.ok(intent.answers.length && intent.answers.every((answer) => ANSWERS.includes(answer)), `${name}: answers`);
    assert.ok(intent.capability === null || intent.capability in port.capabilities, `${name}: capability ${intent.capability}`);
    assert.ok(intent.summary.length > 20, `${name}: a summary in words`);
    for (const key of Object.keys(intent.answer_data?.properties ?? {})) {
      assert.ok(key in port.data, `${name}: answer_data ${key} is data of the port`);
    }
  }
  // The base needs no capability: a host that announces nothing answers the
  // query and opens a result.
  assert.equal(port.intents['query.change'].capability, null);
  assert.equal(port.intents['result.open'].capability, null);
});

test('a sequenced request is answered with its sequence, and the scope is a field of the query', () => {
  for (const name of SEQUENCED) {
    assert.ok(port.intents[name].payload.required.includes('sequence'), `${name}: sequence required`);
    assert.match(port.intents[name].summary, /sequence/u, `${name}: the rule is in its words`);
  }
  for (const name of INTENTS.filter((intent) => !SEQUENCED.includes(intent))) {
    assert.ok(!(port.intents[name].payload.properties.sequence), `${name}: no sequence`);
  }
  assert.ok('scope' in port.intents['query.change'].payload.properties, 'the scope is a field of query.change');
  assert.ok(!Object.keys(port.intents).some((name) => name.startsWith('scope.')), 'and never an intent of its own');
  assert.ok(port.answer.schema.properties.sequence, 'the answer names the sequence it answers');
  assert.deepEqual(port.intents['query.change'].answer_data.required, ['results', 'echo']);
});

test('a result is a page with a url or a command with none, and the panel marks neither for the host', () => {
  const result = port.data.results.schema.items;
  assert.equal(port.data.results.required, true);
  assert.deepEqual(result.required, ['id', 'title']);
  assert.deepEqual(result.properties.kind.enum, ['page', 'action']);
  assert.deepEqual(Object.keys(result.properties), ['id', 'group', 'title', 'path', 'snippet', 'icon', 'shortcut', 'kind', 'url']);
  assert.match(result.properties.url.description, /dropped by the panel/u);
  assert.match(port.data.recent.summary, /The whole list every time/u);
});

test('the kit: twenty-six cases, every one a file, each answer one the intent may give', () => {
  assert.equal(manifest.schema, 'simai.composite.host-port.conformance.v1');
  assert.equal(manifest.port, port.port);
  assert.equal(manifest.version, port.version);
  assert.equal(manifest.transport, 'neutral');
  assert.deepEqual(manifest.answers, ANSWERS);
  assert.equal(manifest.cases.length, 26);
  assert.equal(port.conformance.cases, manifest.cases.length);
  assert.deepEqual(readdirSync(join(at, 'kit/cases')).sort(), manifest.cases.map((id) => `${id}.json`).sort());
  assert.ok(existsSync(join(at, 'kit/README.md')));
  const seen = new Set();
  for (const id of manifest.cases) {
    const document = kase(id);
    assert.equal(document.id, id);
    assert.equal(document.when.intent, document.intent, `${id}: when names the case's intent`);
    const intent = port.intents[document.intent];
    assert.ok(intent, `${id}: ${document.intent} is an intent of the port`);
    assert.ok(document.capability === intent.capability || document.capability in port.capabilities,
      `${id}: the capability is the intent's or one of the port's`);
    for (const key of intent.payload.required ?? []) assert.ok(key in document.when.payload, `${id}: payload carries ${key}`);
    for (const key of Object.keys(document.when.payload)) assert.ok(key in intent.payload.properties, `${id}: payload key ${key} is declared`);
    assert.ok(intent.answers.includes(document.then.answer), `${id}: ${document.then.answer} is an answer ${document.intent} gives`);
    assert.ok(document.summary.length > 20 && /[.]$/u.test(document.summary), `${id}: a summary in words`);
    for (const key of document.then.data_must_include ?? []) assert.ok(key in port.data, `${id}: data key ${key}`);
    for (const key of document.then.answer_must_include ?? []) assert.ok(key in port.answer.schema.properties, `${id}: answer field ${key}`);
    for (const key of Object.keys(document.then.echo_must_include ?? {})) {
      assert.ok(key in port.data.echo.schema.properties, `${id}: echo field ${key}`);
    }
    for (const capability of document.given.capabilities ?? []) assert.ok(capability in port.capabilities, `${id}: given capability ${capability}`);
    seen.add(document.then.answer);
  }
  assert.deepEqual([...seen].sort(), [...ANSWERS].sort(), 'the kit exercises every answer');
});

test('every capability is held to its presence and its absence, and the base host to neither', () => {
  const cases = manifest.cases.map((id) => kase(id));
  for (const capability of CAPABILITIES) {
    const mine = cases.filter((document) => document.capability === capability);
    assert.ok(mine.some((document) => (document.given.capabilities ?? []).includes(capability)),
      `${capability}: a case where the host announces it`);
    assert.ok(mine.some((document) => !(document.given.capabilities ?? []).includes(capability)),
      `${capability}: a case where the host does not`);
  }
  const base = kase('base-host-needs-no-capability');
  assert.equal(base.capability, null);
  assert.deepEqual(base.given.capabilities, []);
  assert.equal(base.then.answer, 'applied');
  assert.deepEqual(base.then.data_must_include, ['results', 'echo']);
  // A capability never announced answers unavailable with the one reason the
  // panel words, the data view port's own rule.
  for (const id of ['capability-absent-is-explained', 'action-run-without-the-capability-is-unavailable',
    'recent-without-the-capability-is-not-offered', 'preview-without-the-capability-is-not-offered']) {
    const document = kase(id);
    assert.equal(document.then.answer, 'unavailable', id);
    assert.deepEqual(document.then.answer_must_include, ['reason'], id);
    assert.match(document.then.note, /capability-not-provided/u, id);
  }
});

test('both sequenced intents have their stale-answer case, and a refusal its own', () => {
  for (const id of ['query-stale-sequence-dropped', 'preview-stale-sequence-dropped']) {
    const document = kase(id);
    assert.ok(Array.isArray(document.given.in_flight) && document.given.in_flight.length === 2, `${id}: two requests in flight`);
    assert.equal(document.when.payload.sequence, Math.max(...document.given.in_flight), `${id}: the newest is asked`);
    assert.ok(document.then.answer_must_include.includes('sequence'), `${id}: the answer names its sequence`);
  }
  assert.equal(kase('query-refused-is-explained').then.answer, 'refused');
  assert.equal(kase('query-unavailable-is-honest').then.answer, 'unavailable');
  assert.equal(kase('result-open-refused-keeps-the-panel-open').then.answer, 'refused');
  assert.deepEqual(kase('query-echoes-what-it-answered').then.echo_must_include, {query: 'tab', scope: 'components'});
});

test('the recheck list says what a host upgrading has to read, and names no transport', () => {
  const recheck = port.compatibility.recheck;
  assert.ok(recheck.length >= 8);
  assert.ok(recheck.some((line) => /never requests the network/u.test(line)));
  assert.ok(recheck.some((line) => /rising sequence/u.test(line)));
  assert.ok(recheck.some((line) => /does not announce is not offered/u.test(line)));
  const text = JSON.stringify(port) + JSON.stringify(manifest);
  assert.doesNotMatch(text, /https?:\/\//u, 'no address in the contract');
  assert.doesNotMatch(text, /"x-[a-z-]+"/u, 'no extension of one consumer in the port');
});
