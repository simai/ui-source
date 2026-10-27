import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.chat-port 1.0.0: the seam of sf-chat-window (ui-pro), shared by an AI
// assistant's window (Mirai24) and people writing to each other (simai.chat).
// It was proven in ui-chat (0304327) and moved here with the second consumer
// (D31). The port holds the core edition only; the window's own extensions
// (x-archive-view, x-early-upload and the rest) stay the component's
// declaration and never appear here. Its words are the standard's
// (simai.smart-component 1.3.9 §4.9, vocabulary 1.1.5): four answers, a
// revision on every edit and delete, one client_key per write.
const root = resolve(import.meta.dirname, '..');
const at = join(root, 'src/core/contracts/ports/simai.chat-port/1.0.0');
const port = JSON.parse(readFileSync(join(at, 'port.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(at, 'kit/manifest.json'), 'utf8'));
const kase = (id) => JSON.parse(readFileSync(join(at, `kit/cases/${id}.json`), 'utf8'));
const ANSWERS = ['applied', 'conflict', 'refused', 'unavailable'];

test('the port is a composite host port of sf-chat-window, edition 1.0.0, with no previous major', () => {
  assert.equal(port.schema, 'simai.composite.host-port.v1');
  assert.equal(port.port, 'simai.chat-port');
  assert.equal(port.version, '1.0.0');
  assert.equal(port.component, 'smart.chat-window');
  assert.equal(port.element, 'sf-chat-window');
  assert.equal(port.compatibility.previous_major, null);
  assert.deepEqual(port.answer.schema.properties.answer.enum, ANSWERS);
});

test('sixteen intents, each with its event, its capability and answers from the four', () => {
  const intents = Object.entries(port.intents);
  assert.equal(intents.length, 16);
  const events = new Set();
  for (const [name, intent] of intents) {
    assert.match(intent.event, /^chat-port:[a-z-]+$/u, `${name}: the port's own event prefix`);
    events.add(intent.event);
    assert.ok(intent.answers.length && intent.answers.every((answer) => ANSWERS.includes(answer)), `${name}: answers`);
    assert.ok(intent.capability === null || intent.capability in port.capabilities, `${name}: capability ${intent.capability} is declared`);
    assert.equal(intent.payload.additionalProperties, false, `${name}: a closed payload`);
  }
  assert.equal(events.size, intents.length, 'one event per intent');
  for (const [name, capability] of Object.entries(port.capabilities)) {
    for (const intent of capability.intents ?? []) assert.equal(port.intents[intent]?.capability, name, `${name} names ${intent}`);
  }
});

test('every write carries a client_key; an edit or delete carries its revision and may answer conflict', () => {
  for (const name of ['message.send', 'message.retry', 'message.edit', 'message.delete']) {
    const intent = port.intents[name];
    assert.ok(intent.payload.required.includes('client_key'), `${name}: client_key`);
    assert.ok(intent.answers.includes('conflict'), `${name}: conflict`);
  }
  for (const name of ['message.edit', 'message.delete']) {
    assert.equal(port.intents[name].carries_revision, true, `${name}: carries its revision`);
    assert.ok(port.intents[name].payload.required.includes('revision'), `${name}: revision required`);
  }
  for (const [name, intent] of Object.entries(port.intents)) {
    if (!['message.edit', 'message.delete'].includes(name)) assert.equal(intent.carries_revision, false, name);
  }
  assert.equal(port.intents['file.retry'].payload.required.includes('file_key'), true, 'a failed upload is addressed by its local key');
  assert.ok(port.answer.schema.properties.current, 'a conflict carries the current message');
});

test('the window\'s extensions are not the port\'s: no x-* capability, no chat-window: event', () => {
  const text = JSON.stringify(port);
  assert.doesNotMatch(text, /"x-[a-z-]+"/u);
  assert.doesNotMatch(text, /chat-window:/u);
});

test('the kit: fourteen cases, every one a file, all four answers exercised, each answer one the intent may give', () => {
  assert.equal(manifest.schema, 'simai.composite.host-port.conformance.v1');
  assert.equal(manifest.port, port.port);
  assert.equal(manifest.version, port.version);
  assert.equal(manifest.transport, 'neutral');
  assert.deepEqual(manifest.answers, ANSWERS);
  assert.equal(manifest.cases.length, 14);
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
    assert.equal(document.capability, intent.capability, `${id}: the intent's capability`);
    for (const key of intent.payload.required ?? []) assert.ok(key in document.when.payload, `${id}: payload carries ${key}`);
    for (const key of Object.keys(document.when.payload)) assert.ok(key in intent.payload.properties, `${id}: payload key ${key} is declared`);
    assert.ok(intent.answers.includes(document.then.answer), `${id}: ${document.then.answer} is an answer ${document.intent} gives`);
    assert.ok(document.summary.length > 20 && /[.]$/u.test(document.summary), `${id}: a summary in words`);
    for (const key of document.then.data_must_include ?? []) assert.ok(key in port.data || key === 'message', `${id}: data key ${key}`);
    for (const key of document.then.answer_must_include ?? []) assert.ok(key in port.answer.schema.properties, `${id}: answer field ${key}`);
    seen.add(document.then.answer);
  }
  assert.deepEqual([...seen].sort(), ANSWERS, 'the kit exercises every answer');
});

test('the idempotency and revision cases hold the words of the vocabulary', () => {
  assert.equal(kase('send-same-key-is-one-message').then.answer, 'applied');
  assert.equal(kase('send-changed-body-same-key-conflict').then.answer, 'conflict');
  assert.match(kase('send-changed-body-same-key-conflict').then.note, /idempotency-conflict/u);
  assert.deepEqual(kase('edit-stale-revision-conflict').then.answer_must_include, ['current']);
  assert.equal(kase('retry-keeps-original-revision').when.payload.client_key, 'e7');
  assert.equal(kase('capability-absent-is-unavailable').then.answer, 'unavailable');
});
