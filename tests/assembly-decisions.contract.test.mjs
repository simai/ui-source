// The assembly runtime (src/core/js/assembly/): the dispatcher's decisions on
// the runtime's open points (2026-10-27), with SF.Assembly made public.
// Headless, with fake parts; the DOM half (native change and input reach the
// page) is in tests/browser/assembly-runtime.browser.mjs.
/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';

import {adaptElement, compile} from '../src/core/js/assembly/index.mjs';
import {deferred, mount, registerParts, tick} from './fixtures/assembly/harness.mjs';

registerParts({
  'd-button': {version: '1.0.0', settings: {}, values: {}, events: {press: {carries: {}}}, actions: {}},
  'd-row': {version: '1.0.0', settings: {name: {type: 'string'}}, values: {}, events: {drop: {carries: {}}}, actions: {flash: {}}},
  'd-source': {version: '1.0.0', settings: {}, values: {}, events: {}, actions: {save: {}, refresh: {}}},
  'd-field': {version: '1.0.0', settings: {}, values: {value: {type: 'string'}}, events: {}, actions: {}},
  'd-field-default': {version: '1.0.0', settings: {}, values: {value: {type: 'string', default: ''}}, events: {}, actions: {}},
});

test('a: do on a role per entry from a rule that did not hear that role\'s event is an error in the journal', async () => {
  const t = mount({tag: 'd-each', kind: 'assembly',
    keys: {rows: {type: 'list', writer: 'logic', initial: [{id: 'a', name: 'Ann'}]}, done: {type: 'boolean', writer: 'logic', initial: false}},
    roles: {row: {part: 'd-row', each: 'rows', bind: {'settings.name': 'entry.name'}}, go: {part: 'd-button'}},
    rules: [{id: 'r', on: 'go.press', steps: [{do: 'row.flash'}, {set: 'done', to: {value: true}}]}]});
  await t.emit('go', 'press');
  assert.match(t.errors().join('\n'), /role per entry; only an event of one of its parts says which entry/);
  assert.equal(t.part('row[a]').calls.length, 0);
  assert.equal(t.core.keys.done, false, 'the rule stops');
});

test('b: undoable is postponed and said at load; the key works without it', () => {
  const definition = compile({tag: 'd-undo', kind: 'assembly', keys: {text: {type: 'string', writer: 'logic', initial: '', undoable: true}}, roles: {}, rules: []});
  assert.deepEqual(definition.problems, []);
  assert.match(definition.notes.map((note) => note.text).join(), /key "text" is undoable: undo is postponed/);
});

test('d: add under parallel turns applies against the value at apply time; no increment is lost', async () => {
  const answers = [];
  const t = mount({tag: 'd-add', kind: 'assembly', keys: {n: {type: 'number', writer: 'logic', initial: 0}},
    roles: {go: {part: 'd-button'}, source: {part: 'd-source'}},
    rules: [{id: 'r', on: 'go.press', concurrency: 'parallel', steps: [{do: 'source.refresh'}, {add: 'n', by: {value: 1}}, {add: 'n', by: {value: 2}}]}]},
  {behaviours: {'d-source': {refresh: () => { const one = deferred(); answers.push(one); return one.promise; }}}});
  const first = t.emit('go', 'press');
  const second = t.emit('go', 'press');
  await tick();
  assert.equal(answers.length, 2, 'both runs wait at once');
  for (const one of answers) one.resolve({answer: 'applied'}); // both answer before either turn commits
  await Promise.all([first, second]);
  assert.equal(t.core.keys.n, 6, 'two runs of +1 +2 each');
  const within = mount({tag: 'd-add2', kind: 'assembly', keys: {n: {type: 'number', writer: 'logic', initial: 5}}, roles: {go: {part: 'd-button'}},
    rules: [{id: 'r', on: 'go.press', steps: [{set: 'n', to: {value: 10}}, {add: 'n', by: {value: 1}}]}]});
  await within.emit('go', 'press');
  assert.equal(within.core.keys.n, 11, 'an add after a set in the same turn adds to that value');
});

test('e: do on a part that has not started starts it first, then asks it', async () => {
  const t = mount({tag: 'd-start', kind: 'assembly', actions: {save: {}},
    roles: {source: {part: 'd-source', start: 'opened'}}, rules: [{id: 'r', on: 'outside.save', steps: [{do: 'source.save'}]}]},
  {behaviours: {'d-source': {save: (args, options, fake) => (fake.started ? {answer: 'applied'} : {answer: 'refused', reason: 'not-started'})}}});
  assert.equal(t.part('source').started, false);
  const answer = await t.core.act('save');
  assert.equal(t.part('source').started, true);
  assert.equal(t.part('source').calls.length, 1);
  assert.deepEqual(answer, {answer: 'applied'});
});

test('f: a part\'s first value with no declared default reaches its key as null, not ""; no change goes out', async () => {
  const manifest = (part) => ({tag: `d-first-${part}`, kind: 'assembly', values: {value: {type: 'string', value: 'q'}},
    keys: {q: {type: 'string', writer: 'search'}}, roles: {search: {part, bind: {'values.value': 'q'}}}, rules: []});
  const t = mount(manifest('d-field'));
  t.part('search').context.report({value: ''}, {origin: 'start'});
  assert.equal(t.core.keys.q, null);
  assert.ok(t.out.values.every((one) => one.origin === 'start'), 'the first value is not a person\'s change');
  t.part('search').context.report({value: ''});
  assert.equal(t.core.keys.q, '', 'a person\'s empty value later is ""');
  const withDefault = mount(manifest('d-field-default'));
  withDefault.part('search').context.report({value: ''}, {origin: 'start'});
  assert.equal(withDefault.core.keys.q, '', 'a declared default "" stays ""');
});

test('g: an outside action whose rule ended without applied answers that rule\'s outcome', async () => {
  for (const [answer, otherwise] of [['refused', false], ['conflict', true], ['unavailable', false]]) {
    const t = mount({tag: `d-out-${answer}`, kind: 'assembly', actions: {save: {}}, keys: {why: {type: 'string', writer: 'logic', initial: ''}},
      roles: {source: {part: 'd-source'}},
      rules: [{id: 'r', on: 'outside.save', steps: [{do: 'source.save'}], ...(otherwise ? {otherwise: [{set: 'why', to: {outcome: 'reason'}}]} : {})}]},
    {behaviours: {'d-source': {save: async () => ({answer, reason: 'stale', message: 'Changed by someone'})}}});
    assert.deepEqual(await t.core.act('save'), {answer, reason: 'stale', message: 'Changed by someone'});
    if (otherwise) assert.equal(t.core.keys.why, 'stale', 'otherwise still runs');
  }
  const ok = mount({tag: 'd-out-ok', kind: 'assembly', actions: {save: {}}, roles: {source: {part: 'd-source'}},
    rules: [{id: 'r', on: 'outside.save', steps: [{do: 'source.save'}]}]}, {behaviours: {'d-source': {save: {answer: 'applied'}}}});
  assert.deepEqual(await ok.core.act('save'), {answer: 'applied'});
});

test('h: a word by code wins over the host\'s message; the message is said only when the code has no word', () => {
  const said = [];
  const element = {localName: 'd-notice', addEventListener() {}, show(args) { said.push(args.text); return {answer: 'applied'}; }};
  const words = {'words.stale': 'Запись изменил другой человек'};
  const link = adaptElement(element, {settings: {}, values: {}, events: {}, actions: {show: {}}},
    {signal: new AbortController().signal, report() {}, emit() {}, word: (path) => words[path] ?? null});
  link.act('show', {code: 'stale', text: 'Changed by someone (409)'});
  link.act('show', {code: 'unknown-code', text: 'Changed by someone (409)'});
  link.act('show', {code: 'stale'});
  assert.deepEqual(said, ['Запись изменил другой человек', 'Changed by someone (409)', 'Запись изменил другой человек']);
});
