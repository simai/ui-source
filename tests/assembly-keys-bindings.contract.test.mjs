// The assembly runtime (src/core/js/assembly/), standard simai.smart-component
// 1.3.8 §7: keys with one writer, derived keys, roles and bindings, `start`,
// `if` and `hidden`, a role per entry, the frame, ports and the scope. Headless:
// the bus runs with fake parts (tests/fixtures/assembly/harness.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';

import {compile} from '../src/core/js/assembly/index.mjs';
import {createReader, keysOf} from '../src/core/js/assembly/logic.mjs';
import {mount, registerParts, tick} from './fixtures/assembly/harness.mjs';

registerParts({
  'x-field': {version: '1.0.0', settings: {label: {type: 'string'}, name: {type: 'string'}, required: {type: 'boolean'}, total: {type: 'number'}, list: {type: 'list'}, flag: {type: 'boolean'}},
    values: {value: {type: 'string'}}, events: {change: {carries: 'native'}, press: {carries: {}}}, actions: {focus: {}}},
  'x-source': {version: '2.0.0', port: {id: 'simai.dataview-port'}, settings: {query: {type: 'string'}, record: {type: 'object'}},
    values: {items: {type: 'list'}, state: {type: 'state'}}, events: {loaded: {carries: {total: 'number'}}}, actions: {refresh: {}, save: {}}},
  'x-row': {version: '1.0.0', settings: {name: {type: 'string'}, phone: {type: 'string'}}, values: {}, events: {drop: {carries: {}}}, actions: {flash: {}}},
});

test('keys: one writer, typed, initial values, settings from the parent (§7.1)', () => {
  const t = mount({tag: 'x-keys', kind: 'assembly', settings: {collection: {type: 'string', default: 'a'}},
    keys: {collection: {type: 'string', writer: 'parent'}, chosen: {type: 'string', writer: 'logic', initial: ''}, list: {type: 'list', writer: 'logic', initial: []}, query: {type: 'string', writer: 'search'}},
    roles: {search: {part: 'x-field', bind: {'values.value': 'query'}}}}, {settings: {collection: 'b'}});
  assert.equal(t.core.keys.collection, 'b');
  assert.equal(t.core.keys.chosen, '');
  assert.deepEqual(t.core.keys.list, []);
  assert.equal(t.core.keys.query, null);
  t.report('search', {value: 'x'});
  assert.equal(t.core.keys.query, 'x', 'the role writes its key');
  const turn = t.core.newTurn('test', {});
  turn.writes.set('query', {value: 'y', writer: 'logic'});
  turn.writes.set('chosen', {value: 5, writer: 'logic'});
  t.core.commit(turn);
  assert.equal(t.core.keys.query, 'x', 'another writer is refused');
  assert.equal(t.core.keys.chosen, '', 'a wrong type is refused');
  assert.equal(t.errors().length, 2);
});

test('every instance has its own keys; a logic key starts from a copy of its initial value (§7.1)', () => {
  const manifest = {tag: 'x-own', kind: 'assembly', keys: {list: {type: 'list', writer: 'logic', initial: [{id: 1}]}}};
  const a = mount(manifest);
  const b = mount(manifest);
  a.core.keys.list.push({id: 2});
  assert.equal(b.core.keys.list.length, 1);
});

test('derived keys: computed after the writes, before the bindings; an equal value is not passed (§7.1.2)', () => {
  const t = mount({tag: 'x-derived', kind: 'assembly',
    keys: {kind: {type: 'enum', values: ['person', 'company'], writer: 'logic', initial: 'person'},
      'is-company': {type: 'boolean', writer: 'derived', from: {left: {key: 'kind'}, op: 'eq', right: {value: 'company'}}},
      subtotal: {type: 'number', writer: 'logic', initial: 100},
      total: {type: 'number', writer: 'derived', from: {sum: [{key: 'subtotal'}, {value: 300}]}},
      double: {type: 'number', writer: 'derived', from: {product: [{key: 'total'}, {value: 2}]}},
      request: {type: 'object', writer: 'derived', from: {object: {kind: {key: 'kind'}, total: {key: 'total'}}}}},
    roles: {field: {part: 'x-field', bind: {'settings.flag': 'is-company', 'settings.total': 'double'}}}});
  assert.equal(t.core.keys.total, 400);
  assert.equal(t.core.keys.double, 800);
  assert.deepEqual(t.core.keys.request, {kind: 'person', total: 400});
  assert.deepEqual(t.setsOf('field', 'flag'), [false]);
  const turn = t.core.newTurn('test', {});
  turn.writes.set('subtotal', {value: 200, writer: 'logic'});
  t.core.commit(turn);
  assert.equal(t.core.keys.double, 1000, 'a chain of derived keys follows in one commit');
  assert.deepEqual(t.setsOf('field', 'total'), [800, 1000]);
  assert.deepEqual(t.setsOf('field', 'flag'), [false], 'an equal result is not passed again');
});

test('a cycle between derived keys is reported at load (gate 4) and its keys stay unset (§7.1.2)', () => {
  const definition = compile({tag: 'x-cycle', kind: 'assembly', keys: {
    a: {type: 'number', writer: 'derived', from: {sum: [{key: 'b'}, {value: 1}]}},
    b: {type: 'number', writer: 'derived', from: {sum: [{key: 'a'}, {value: 1}]}},
    c: {type: 'number', writer: 'logic', initial: 1}}});
  assert.ok(definition.problems.some((one) => one.gate === 4 && /cycle/.test(one.text)));
  assert.deepEqual(definition.derived, []);
});

test('a derived key reads only the closed lists; keysOf finds its dependencies (§7.1.2, §9)', () => {
  assert.deepEqual([...keysOf({all: [{left: {key: 'a.b'}, op: 'filled'}, {left: {choose: {left: {key: 'c'}, op: 'yes'}, then: {key: 'd'}, else: {value: {key: 'x'}}}, op: 'eq', right: {object: {key: {key: 'e'}}}}]})].sort(), ['a', 'c', 'd', 'e']);
  const read = createReader({key: () => null, from: {}}).read;
  assert.equal(read({sum: [{value: 1}, {value: null}]}), null, 'an unset operand gives null');
});

test('bindings: a part placed gets the current values at once; constants; equal values are not passed again (§7.2)', () => {
  const t = mount({tag: 'x-bind', kind: 'assembly',
    keys: {label: {type: 'string', writer: 'logic', initial: 'Name'}, unset: {type: 'string', writer: 'logic', initial: null}},
    roles: {field: {part: 'x-field', settings: {name: 'inn', required: true}, bind: {'settings.label': 'label', 'settings.name': 'unset'}}}});
  assert.deepEqual(t.part('field').sets.slice(0, 3), [['name', 'inn'], ['required', true], ['label', 'Name']], 'constants, then keys; an unset key is not passed');
  const turn = t.core.newTurn('test', {});
  turn.writes.set('label', {value: 'Name', writer: 'logic'});
  t.core.commit(turn);
  assert.equal(t.setsOf('field', 'label').length, 1);
});

test('a binding that the part cannot satisfy rejects the part (§7.2, §4.10)', () => {
  const t = mount({tag: 'x-reject', kind: 'assembly', keys: {q: {type: 'string', writer: 'logic', initial: ''}},
    roles: {field: {part: 'x-field', bind: {'settings.nothing': 'q'}}, other: {part: 'x-field@2'}, unknown: {part: 'x-nothing'}}});
  assert.equal(t.part('field'), undefined);
  assert.equal(t.part('other'), undefined);
  const errors = t.errors().join('\n');
  assert.match(errors, /missing|has no setting "nothing"/);
  assert.match(errors, /x-field@2, the part is 1\.0\.0/);
  assert.match(errors, /x-nothing has no interface/);
});

test('gate 5 at load: a rule hearing an event the part lacks, or reading a field it does not carry, rejects the part', () => {
  const t = mount({tag: 'x-gate5', kind: 'assembly', keys: {n: {type: 'number', writer: 'logic', initial: 0}},
    roles: {source: {part: 'x-source'}, field: {part: 'x-field'}},
    rules: [{id: 'r1', on: 'source.loaded', steps: [{set: 'n', to: {from: 'count'}}]}, {id: 'r2', on: 'field.missing', steps: []}]});
  assert.equal(t.part('source'), undefined);
  assert.equal(t.part('field'), undefined);
  assert.match(t.errors().join('\n'), /reads "count" from source.loaded/);
  assert.match(t.errors().join('\n'), /has no event "missing"/);
});

test('a debounced binding: the key changes at once, the part gets the value after the quiet time (§7.2)', async () => {
  const t = mount({tag: 'x-debounce', kind: 'assembly', keys: {q: {type: 'string', writer: 'search'}},
    roles: {search: {part: 'x-field', bind: {'values.value': 'q'}}, source: {part: 'x-source', bind: {'settings.query': {key: 'q', debounce: 30}}}}});
  t.report('search', {value: 'a'});
  t.report('search', {value: 'ab'});
  assert.equal(t.core.keys.q, 'ab');
  assert.deepEqual(t.setsOf('source', 'query'), []);
  await tick(50);
  assert.deepEqual(t.setsOf('source', 'query'), ['ab'], 'one value after the quiet time');
});

test('start opened: an unstarted part reads nothing and its events are not queued; it starts with the current values (§7.2.1)', () => {
  const t = mount({tag: 'x-start', kind: 'assembly', keys: {q: {type: 'string', writer: 'logic', initial: 'one'}, n: {type: 'number', writer: 'logic', initial: 0}},
    roles: {history: {part: 'x-field', start: 'opened', bind: {'settings.label': 'q'}}},
    rules: [{id: 'r', on: 'history.press', steps: [{add: 'n', by: {value: 1}}]}]});
  const part = t.part('history');
  assert.equal(part.started, false);
  assert.deepEqual(part.sets, []);
  t.emit('history', 'press');
  assert.equal(t.core.keys.n, 0, 'the event of an unstarted part is not queued');
  const turn = t.core.newTurn('test', {});
  turn.writes.set('q', {value: 'two', writer: 'logic'});
  t.core.commit(turn);
  t.core.startPart(t.core.partsOf('history')[0], 'opened');
  assert.equal(part.started, true);
  assert.deepEqual(part.sets, [['label', 'two']], 'one read, with the current value');
});

test('a started part whose container is closed again defers its reads: one read when it opens (§7.2.1)', () => {
  const t = mount({tag: 'x-defer', kind: 'assembly', keys: {q: {type: 'string', writer: 'logic', initial: 'a'}},
    roles: {section: {part: 'x-field', start: 'opened', bind: {'settings.label': 'q'}}}});
  const rec = t.core.partsOf('section')[0];
  t.core.startPart(rec, 'opened');
  t.core.setClosed(rec, true);
  for (const value of ['b', 'c', 'd']) {
    const turn = t.core.newTurn('test', {});
    turn.writes.set('q', {value, writer: 'logic'});
    t.core.commit(turn);
  }
  assert.deepEqual(t.setsOf('section', 'label'), ['a']);
  t.core.setClosed(rec, false);
  assert.deepEqual(t.setsOf('section', 'label'), ['a', 'd'], 'one read with the current value');
});

test('if: the part is out, its rules do not run, its instance is kept; hidden keeps it (§7.2.2)', () => {
  const shown = [];
  const t = mount({tag: 'x-if', kind: 'assembly', keys: {company: {type: 'boolean', writer: 'logic', initial: false}, n: {type: 'number', writer: 'logic', initial: 0}, note: {type: 'boolean', writer: 'logic', initial: false}},
    roles: {inn: {part: 'x-field', if: 'company'}, memo: {part: 'x-field', hidden: '!note'}},
    rules: [{id: 'r', on: 'inn.press', steps: [{add: 'n', by: {value: 1}}]}]},
  {view: {show: (role, present, hidden) => shown.push([role, present, hidden])}});
  assert.deepEqual(shown, [['inn', false, false], ['memo', true, true]]);
  t.emit('inn', 'press');
  assert.equal(t.core.keys.n, 0);
  const part = t.part('inn');
  const turn = t.core.newTurn('test', {});
  turn.writes.set('company', {value: true, writer: 'logic'});
  turn.writes.set('note', {value: true, writer: 'logic'});
  t.core.commit(turn);
  assert.deepEqual(shown.slice(2), [['inn', true, false], ['memo', true, false]]);
  assert.equal(t.part('inn'), part, 'the same instance returns');
  t.emit('inn', 'press');
  assert.equal(t.core.keys.n, 1);
});

test('a role per entry: one part per entry, kept by id, removed with its scope; entry readings (§7.2.3)', async () => {
  const t = mount({tag: 'x-each', kind: 'assembly', keys: {contacts: {type: 'list', writer: 'logic', initial: [{id: 'a', name: 'Ann'}, {id: 'b', name: 'Bob'}]}, last: {type: 'string', writer: 'logic', initial: ''}},
    roles: {row: {part: 'x-row', each: 'contacts', bind: {'settings.name': 'entry.name'}}},
    rules: [{id: 'r', on: 'row.drop', steps: [{set: 'last', to: {entry: 'name'}}, {remove: 'contacts', id: {entry: 'id'}}, {do: 'row.flash'}]}]});
  const first = t.part('row[a]');
  assert.deepEqual(first.sets, [['name', 'Ann']]);
  const turn = t.core.newTurn('test', {});
  turn.writes.set('contacts', {value: [{id: 'b', name: 'Bob'}, {id: 'a', name: 'Anna'}, {id: 'c', name: 'Cy'}], writer: 'logic'});
  t.core.commit(turn);
  assert.equal(t.part('row[a]'), first, 'an entry that stays keeps its part');
  assert.deepEqual(first.sets, [['name', 'Ann'], ['name', 'Anna']]);
  await t.emit('row[b]', 'drop');
  assert.equal(t.core.keys.last, 'Bob');
  assert.deepEqual(t.core.keys.contacts.map((one) => one.id), ['a', 'c']);
  assert.equal(t.part('row[b]').disposed, true);
  assert.equal(t.part('row[b]').context.signal.aborted, true, 'its scope ends');
  assert.equal(t.part('row[b]').calls.length, 1, 'do on a role per entry asks the entry that sent the event');
});

test('the frame: settings in as outside.<setting>, values out, events only by emit, unhandled actions reported (§7.4)', async () => {
  const t = mount({tag: 'x-frame', kind: 'assembly', settings: {collection: {type: 'string'}}, values: {selected: {type: 'string', value: 'selected'}},
    events: {open: {carries: {id: 'string'}}}, actions: {refresh: {}, other: {}},
    keys: {collection: {type: 'string', writer: 'parent'}, selected: {type: 'string', writer: 'logic', initial: ''}, seen: {type: 'list', writer: 'logic', initial: []}},
    roles: {field: {part: 'x-field'}},
    rules: [{id: 'r-coll', on: 'outside.collection', steps: [{append: 'seen', item: {object: {id: {from: 'value'}, was: {from: 'previous'}}}}]},
      {id: 'r-press', on: 'field.press', steps: [{set: 'selected', to: {value: 'p1'}}, {emit: 'open', with: {id: {key: 'selected'}}}]},
      {id: 'r-refresh', on: 'outside.refresh', steps: [{do: 'field.focus'}]}]}, {settings: {collection: 'a'}});
  await t.core.setSetting('collection', 'b');
  assert.deepEqual(t.core.keys.seen, [{id: 'b', was: 'a'}]);
  await t.emit('field', 'press');
  assert.deepEqual(t.out.values.at(-1), {values: {selected: 'p1'}, origin: null});
  assert.deepEqual(t.out.events.map((one) => [one.verb, one.detail]), [['open', {id: 'p1'}]], 'the part\'s press did not cross; emit did');
  assert.deepEqual(await t.core.act('refresh'), {answer: 'applied'});
  assert.deepEqual(await t.core.act('other'), {answer: 'refused', reason: 'unhandled'});
  assert.match(t.errors().join('\n'), /handled by no rule/);
});

test('connect-port reaches parts that declare the port, at any depth, parts placed later too; a part without it answers unavailable (§4.9)', async () => {
  const child = {tag: 'x-child', kind: 'assembly', actions: {go: {}}, keys: {items: {type: 'list', writer: 'logic', initial: []}},
    roles: {source: {part: 'x-source'}, rows: {part: 'x-source', each: 'items'}},
    rules: [{id: 'r-go', on: 'outside.go', steps: [{append: 'items', item: {object: {id: {new: 'id'}}}}]}]};
  const t = mount({tag: 'x-top', kind: 'assembly', actions: {load: {}}, keys: {state: {type: 'string', writer: 'logic', initial: ''}},
    roles: {inner: {part: 'x-child'}, own: {part: 'x-source'}},
    rules: [{id: 'r-load', on: 'outside.load', steps: [{do: 'own.refresh'}], otherwise: [{set: 'state', to: {outcome: 'reason'}}]}]}, {children: [child]});
  await t.core.act('load');
  assert.equal(t.core.keys.state, 'port-not-connected');
  const port = {id: 'simai.dataview-port'};
  t.core.connectPort(port);
  assert.deepEqual(t.part('own').ports, [port]);
  assert.deepEqual(t.part('inner/source').ports, [port], 'a part one level down');
  await t.core.partsOf('inner')[0].child.act('go');
  const added = [...t.parts.keys()].find((path) => path.includes('inner/rows['));
  assert.deepEqual(t.parts.get(added).ports, [port], 'a part placed later');
  assert.equal(t.core.connectPort({}).answer, 'refused');
});

test('the scope: removing the instance cancels its waits and timers (§7.7)', async () => {
  let resolve;
  const t = mount({tag: 'x-scope', kind: 'assembly', actions: {save: {}}, keys: {done: {type: 'boolean', writer: 'logic', initial: false}, q: {type: 'string', writer: 'search'}},
    roles: {source: {part: 'x-source', bind: {'settings.query': {key: 'q', debounce: 1000}}}, search: {part: 'x-field', bind: {'values.value': 'q'}}},
    rules: [{id: 'r', on: 'outside.save', steps: [{do: 'source.save'}, {set: 'done', to: {value: true}}], otherwise: [{set: 'done', to: {value: true}}]}]},
  {behaviours: {'x-source': {save: () => new Promise((done) => { resolve = done; })}}});
  t.core.connectPort({id: 'simai.dataview-port'});
  const asked = t.core.act('save');
  t.report('search', {value: 'x'});
  await tick();
  t.core.dispose();
  const answer = await asked;
  assert.equal(t.core.keys.done, false, 'cancelled: no otherwise');
  assert.equal(answer.answer, 'applied');
  assert.equal(t.part('source').calls[0].options.signal.aborted, true, 'the request is aborted');
  assert.equal(t.part('source').disposed, true);
  resolve({answer: 'applied'});
});

test('form.aggregates: valid and value over the present parts (§17.4)', () => {
  const t = mount({tag: 'x-form', kind: 'assembly', form: {aggregates: true}, keys: {company: {type: 'boolean', writer: 'logic', initial: false}},
    roles: {name: {part: 'x-field'}, inn: {part: 'x-field', if: 'company'}}});
  t.part('name').values.value = 'Ann';
  t.part('inn').valid = false;
  t.report('name', {value: 'Ann'});
  assert.deepEqual(t.core.keys.value, {name: 'Ann'});
  assert.equal(t.core.keys.valid, true, 'a part out under if does not block');
});
