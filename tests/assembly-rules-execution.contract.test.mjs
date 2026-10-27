// The assembly runtime (src/core/js/assembly/), standard simai.smart-component
// 1.3.8 §9 and §10: readings, conditions, the closed steps, turns and their
// writes, waiting steps and outcomes, `otherwise`, concurrency, timeout and
// retry, the cause chain, `on` lists, streams; §11.2 words a rule picks; §14
// the journal. Headless, with fake parts.
import assert from 'node:assert/strict';
import test from 'node:test';

import {journal} from '../src/core/js/assembly/index.mjs';
import {createReader} from '../src/core/js/assembly/logic.mjs';
import {createWords, say} from '../src/core/js/assembly/words.mjs';
import {deferred, mount, registerParts, tick} from './fixtures/assembly/harness.mjs';

registerParts({
  'y-button': {version: '1.0.0', settings: {label: {type: 'string'}, count: {type: 'number'}, busy: {type: 'boolean'}}, values: {}, events: {press: {carries: {}}, close: {carries: {reason: 'string'}, cancelable: true}}, actions: {}},
  'y-list': {version: '1.0.0', settings: {items: {type: 'list'}, columns: {type: 'list'}, options: {type: 'list'}, title: {type: 'string'}}, values: {}, events: {apply: {carries: {action: 'string'}}, page: {carries: {action: 'string', page: 'number'}}}, actions: {}},
  'y-source': {version: '1.0.0', settings: {query: {type: 'string'}}, values: {items: {type: 'list'}},
    events: {loaded: {carries: {total: 'number'}}, begun: {carries: {id: 'id'}}, chunk: {carries: {id: 'id'}}, completed: {carries: {id: 'id'}}},
    actions: {refresh: {}, save: {}, query: {concurrency: 'latest'}, count: {concurrency: 'drop'}}},
  'y-layer': {version: '1.0.0', layer: {}, settings: {}, values: {}, events: {}, actions: {open: {waits: true}, show: {}}},
});

test('readings and conditions: the closed lists (§9)', () => {
  const keys = {n: 2, list: [{id: 'a'}, {id: 'b'}], answer: {accepted: true}, empty: ''};
  const errors = [];
  const {read, test: holds} = createReader({key: (name) => keys[name], from: {id: 'p1', query: {search: 'x'}}, entry: {name: 'Ann'}, fail: (text) => errors.push(text)});
  assert.equal(read({from: 'query.search'}), 'x');
  assert.equal(read({key: 'answer.accepted'}), true);
  assert.equal(read({entry: 'name'}), 'Ann');
  assert.deepEqual(read({object: {id: {from: 'id'}, n: {key: 'n'}}}), {id: 'p1', n: 2});
  assert.equal(read({sum: [{key: 'n'}, {value: 3}]}), 5);
  assert.equal(read({difference: [{key: 'n'}, {value: 3}]}), -1);
  assert.equal(read({product: [{key: 'n'}, {value: 3}]}), 6);
  assert.equal(read({count: {key: 'list'}}), 2);
  assert.equal(read({choose: {left: {key: 'n'}, op: 'gt', right: {value: 1}}, then: {value: 'big'}, else: {value: 'small'}}), 'big');
  assert.notEqual(read({new: 'id'}), read({new: 'id'}), 'a fresh id each time, never a counter');
  assert.equal(read({left: {key: 'n'}, op: 'eq', right: {value: 2}}), true, 'a condition stands where a boolean is read');
  assert.equal(read({outcome: 'reason'}), undefined);
  assert.match(errors.join(), /outside otherwise/);
  for (const [condition, expected] of [
    [{left: {key: 'n'}, op: 'ne', right: {value: 2}}, false], [{left: {key: 'n'}, op: 'lt', right: {value: 3}}, true],
    [{left: {key: 'list'}, op: 'has', right: {value: {id: 'a'}}}, true], [{left: {from: 'id'}, op: 'has', right: {value: 'p'}}, true],
    [{left: {key: 'empty'}, op: 'empty'}, true], [{left: {key: 'list'}, op: 'filled'}, true], [{left: {key: 'answer.accepted'}, op: 'yes'}, true],
    [{left: {key: 'missing'}, op: 'no'}, false], [{left: {key: 'missing'}, op: 'gt', right: {value: 0}}, false],
    [{all: [{left: {key: 'n'}, op: 'gt', right: {value: 1}}, {left: {key: 'empty'}, op: 'filled'}]}, false],
    [{any: [{left: {key: 'n'}, op: 'gt', right: {value: 1}}, {left: {key: 'empty'}, op: 'filled'}]}, true],
  ]) assert.equal(holds(condition), expected, JSON.stringify(condition));
});

const counter = (extra = {}) => ({tag: 'y-counter', kind: 'assembly', events: {changed: {carries: {n: 'number'}}}, actions: {go: {}},
  keys: {n: {type: 'number', writer: 'logic', initial: 0}, list: {type: 'list', writer: 'logic', initial: []}, label: {type: 'string', writer: 'logic', initial: ''}, ...extra.keys},
  roles: {plus: {part: 'y-button', bind: {'settings.count': 'n', 'settings.label': 'label'}}, ...extra.roles},
  rules: extra.rules ?? []});

test('the steps set, add, reset, append, remove, check, emit; writes apply at the turn end (§9, §10.2)', async () => {
  const t = mount(counter({rules: [{id: 'r', on: 'plus.press', steps: [
    {add: 'n', by: {value: 2}}, {set: 'label', to: {choose: {left: {key: 'n'}, op: 'eq', right: {value: 2}}, then: {value: 'two'}, else: {value: '?'}}},
    {append: 'list', item: {object: {id: {value: 'a'}}}}, {append: 'list', item: {object: {id: {value: 'b'}}}}, {remove: 'list', id: {value: 'a'}},
    {emit: 'changed', with: {n: {key: 'n'}}},
    {check: {left: {key: 'n'}, op: 'gt', right: {value: 5}}}, {set: 'label', to: {value: 'never'}}]}]}));
  const sets = t.part('plus').sets;
  const before = sets.length;
  const turn = t.emit('plus', 'press');
  assert.equal(t.core.keys.n, 2, 'no wait: the turn committed synchronously');
  assert.equal(t.core.keys.label, 'two', 'a step reads the turn\'s pending writes');
  assert.deepEqual(t.core.keys.list, [{id: 'b'}]);
  assert.deepEqual(sets.slice(before), [['count', 2], ['label', 'two']], 'one write per key, at the end');
  await turn;
  assert.deepEqual(t.out.events.map((one) => one.detail), [{n: 2}]);
  const reset = mount(counter({rules: [{id: 'r', on: 'plus.press', steps: [{add: 'n', by: {value: 1}}, {reset: 'n'}, {append: 'list', item: {value: {name: 'no id'}}}]}]}));
  await reset.emit('plus', 'press');
  assert.equal(reset.core.keys.n, 0);
  assert.match(reset.errors().join(), /no id/);
});

test('refuse reaches a cancelable request at once; drop refuses it busy (§8, §9, §10.7)', async () => {
  const t = mount(counter({keys: {dirty: {type: 'boolean', writer: 'logic', initial: true}},
    rules: [{id: 'r-close', on: 'plus.close', if: {left: {key: 'dirty'}, op: 'yes'}, steps: [{refuse: {reason: {value: 'unsaved'}}}]}]}));
  let refused = null;
  const asked = t.emit('plus', 'close', {reason: 'escape'}, {cancel: (reason) => { refused = reason; }});
  assert.equal(refused, 'unsaved', 'synchronously, before the event returns');
  assert.deepEqual(await asked, {refused: 'unsaved'});
});

test('ask waits for the person, writes the answer; a waiting step applies the turn\'s writes first (§9, §10.2, §19.4)', async () => {
  const opened = deferred();
  let seenBusy = null;
  const t = mount(counter({keys: {busy: {type: 'boolean', writer: 'logic', initial: false}, answer: {type: 'object', writer: 'logic', initial: {}}},
    roles: {plus: {part: 'y-button', bind: {'settings.busy': 'busy'}}, confirm: {part: 'y-layer'}},
    rules: [{id: 'r', on: 'plus.press', steps: [{set: 'busy', to: {value: true}}, {ask: 'confirm.open', with: {code: {value: 'delete'}}, answer: 'answer'},
      {check: {left: {key: 'answer.accepted'}, op: 'yes'}}, {set: 'busy', to: {value: false}}]}]}),
  {behaviours: {'y-layer': {open: (args, options, fake) => { seenBusy = fake.rec; return opened.promise; }}}});
  const turn = t.emit('plus', 'press');
  assert.equal(t.core.keys.busy, true, 'busy is applied before the wait');
  assert.deepEqual(t.setsOf('plus', 'busy'), [false, true]);
  assert.ok(seenBusy);
  opened.resolve({answer: 'applied', value: {accepted: true, reason: 'confirm', value: null}});
  await turn;
  assert.deepEqual(t.core.keys.answer, {accepted: true, reason: 'confirm', value: null});
  assert.equal(t.core.keys.busy, false);
});

test('otherwise runs on conflict, refused, unavailable and reads the outcome; cancelled runs nothing (§9, §10.3)', async () => {
  for (const answer of ['conflict', 'refused', 'unavailable', 'cancelled']) {
    const t = mount(counter({keys: {why: {type: 'string', writer: 'logic', initial: ''}}, roles: {source: {part: 'y-source'}},
      rules: [{id: 'r', on: 'outside.go', steps: [{do: 'source.save'}, {set: 'why', to: {value: 'applied'}}],
        otherwise: [{set: 'why', to: {outcome: 'answer'}}, {set: 'label', to: {outcome: 'message'}},
          {check: {left: {outcome: 'reason'}, op: 'eq', right: {value: 'stale'}}}, {add: 'n', by: {value: 1}}]}]}),
    {behaviours: {'y-source': {save: async () => ({answer, reason: 'stale', message: 'Changed by someone'})}}});
    await t.core.act('go');
    if (answer === 'cancelled') { assert.equal(t.core.keys.why, ''); continue; }
    assert.equal(t.core.keys.why, answer);
    assert.equal(t.core.keys.label, 'Changed by someone');
    assert.equal(t.core.keys.n, 1);
  }
});

test('concurrency: parallel, queue, drop, latest; latest aborts the request (§10.7)', async () => {
  const run = async (policy) => {
    const answers = [];
    const signals = [];
    const t = mount(counter({roles: {source: {part: 'y-source'}},
      rules: [{id: 'r', on: 'plus.press', concurrency: policy, steps: [{do: 'source.refresh'}, {add: 'n', by: {value: 1}}]}]}),
    {behaviours: {'y-source': {refresh: (args, options) => { const one = deferred(); answers.push(one); signals.push(options.signal); return one.promise; }}}});
    const first = t.emit('plus', 'press');
    const second = t.emit('plus', 'press');
    await tick();
    const started = answers.length;
    for (let i = 0; i < 3; i += 1) { // one answer at a time: each turn commits before the next reads
      answers[i]?.resolve({answer: 'applied'});
      await tick();
    }
    const refused = (await second).refused;
    await first;
    return {started, total: answers.length, n: t.core.keys.n, aborted: signals.map((signal) => signal.aborted), refused};
  };
  assert.deepEqual(await run('parallel'), {started: 2, total: 2, n: 2, aborted: [true, true], refused: null});
  const queued = await run('queue');
  assert.equal(queued.started, 1, 'the second waits for the first');
  assert.equal(queued.total, 2);
  assert.equal(queued.n, 2);
  const dropped = await run('drop');
  assert.deepEqual([dropped.total, dropped.n, dropped.refused], [1, 1, 'busy']);
  const latest = await run('latest');
  assert.equal(latest.started, 2);
  assert.equal(latest.n, 1, 'the replaced run answered cancelled');
  assert.equal(latest.aborted[0], true);
});

test('an action declares its own concurrency (§4.4, §10.7)', async () => {
  const pending = [];
  const t = mount(counter({keys: {why: {type: 'string', writer: 'logic', initial: ''}}, roles: {source: {part: 'y-source'}},
    rules: [{id: 'r', on: 'plus.press', steps: [{do: 'source.count'}], otherwise: [{set: 'why', to: {outcome: 'reason'}}]}]}),
  {behaviours: {'y-source': {count: () => { const one = deferred(); pending.push(one); return one.promise; }}}});
  const first = t.emit('plus', 'press');
  await t.emit('plus', 'press');
  assert.equal(t.core.keys.why, 'busy');
  pending[0].resolve({answer: 'applied'});
  await first;
  assert.equal(pending.length, 1);
});

test('timeout answers unavailable, reason timeout, and aborts; retry repeats a read, a write only with its client-key (§10.7)', async () => {
  let signal = null;
  const slow = mount(counter({keys: {why: {type: 'string', writer: 'logic', initial: ''}}, roles: {source: {part: 'y-source'}},
    rules: [{id: 'r', on: 'outside.go', timeout: 20, steps: [{do: 'source.refresh'}], otherwise: [{set: 'why', to: {outcome: 'reason'}}]}]}),
  {behaviours: {'y-source': {refresh: (args, options) => { signal = options.signal; return new Promise(() => {}); }}}});
  await slow.core.act('go');
  assert.equal(slow.core.keys.why, 'timeout');
  assert.equal(signal.aborted, true);

  const tries = {refresh: 0, save: 0};
  const flaky = (verb) => () => { tries[verb] += 1; return tries[verb] < 3 ? {answer: 'unavailable'} : {answer: 'applied'}; };
  const t = mount(counter({roles: {source: {part: 'y-source'}}, rules: [
    {id: 'r-read', on: 'plus.press', retry: {times: 2, delay: 1}, steps: [{do: 'source.refresh'}, {add: 'n', by: {value: 1}}]},
    {id: 'r-write', on: 'outside.go', retry: {times: 2, delay: 1}, steps: [{do: 'source.save', with: {'client-key': {from: 'key'}}}, {add: 'n', by: {value: 10}}]}]}),
  {behaviours: {'y-source': {refresh: flaky('refresh'), save: flaky('save')}}});
  await t.emit('plus', 'press');
  assert.equal(tries.refresh, 3);
  assert.equal(t.core.keys.n, 1);
  await t.core.act('go', {});
  assert.equal(tries.save, 1, 'a write without its client-key is not repeated');
  tries.save = 0;
  await t.core.act('go', {key: 'k1'});
  assert.equal(tries.save, 3);
  assert.equal(t.core.keys.n, 11);
});

test('loops: a rule does not run twice for one cause; an answer carries the chain of the turn that asked (§10.5, §10.6)', async () => {
  const t = mount(counter({roles: {source: {part: 'y-source'}}, rules: [
    {id: 'r-bump', on: 'data.n', steps: [{add: 'n', by: {value: 1}}]},
    {id: 'r-go', on: 'outside.go', steps: [{do: 'source.refresh'}]},
    {id: 'r-loaded', on: 'source.loaded', steps: [{do: 'source.refresh'}]}]}),
  {behaviours: {'y-source': {refresh: async (args, options, fake) => { await tick(); fake.context.emit('loaded', {total: 1}); return {answer: 'applied'}; }}}});
  await t.emit('plus', 'press');
  const bump = t.core.newTurn('test', {});
  bump.writes.set('n', {value: 1, writer: 'logic'});
  await t.core.endTurn(bump);
  await tick(5);
  assert.equal(t.core.keys.n, 2, 'r-bump ran once, then its own write was cut');
  await t.core.act('go');
  await tick(20);
  assert.equal(t.part('source').calls.length, 2, 'r-go → refresh → loaded → r-loaded → refresh → loaded: r-loaded is cut');
  assert.ok(t.errors().filter((text) => /already ran for this cause/.test(text)).length >= 2);
});

test('the chain is cut at depth 32, an error naming the instance (§10.5)', async () => {
  const t = mount(counter({rules: [{id: 'r', on: 'plus.press', steps: [{add: 'n', by: {value: 1}}]}]}));
  await t.emit('plus', 'press', {}, {chain: Array.from({length: 31}, (_, i) => `x:${i}`)});
  assert.equal(t.core.keys.n, 1, 'depth 32 is the limit');
  await t.emit('plus', 'press', {}, {chain: Array.from({length: 32}, (_, i) => `x:${i}`)});
  assert.equal(t.core.keys.n, 1);
  assert.match(t.errors().join(), new RegExp(`cut at depth 32 in ${t.id}`));
});

test('each emit across a frame adds one link to the chain (§10.5)', async () => {
  const inner = {tag: 'y-inner', kind: 'assembly', events: {pressed: {carries: {}}}, keys: {}, roles: {plus: {part: 'y-button'}},
    rules: [{id: 'r-up', on: 'plus.press', steps: [{emit: 'pressed', with: {}}]}]};
  const t = mount({tag: 'y-outer', kind: 'assembly', events: {pressed: {carries: {}}}, keys: {}, roles: {inner: {part: 'y-inner'}},
    rules: [{id: 'r-up', on: 'inner.pressed', steps: [{emit: 'pressed', with: {}}]}]}, {children: [inner]});
  await t.emit('inner/plus', 'press');
  await tick();
  assert.deepEqual(t.out.events.at(-1).chain, [`${t.id}/inner:r-up`, `${t.id}:r-up`]);
});

test('on a list of triggers: the rule runs once per event (§9); data.<key> carries value and previous', async () => {
  const t = mount(counter({keys: {last: {type: 'string', writer: 'logic', initial: ''}, was: {type: 'number', writer: 'logic', initial: -1}},
    roles: {list: {part: 'y-list'}},
    rules: [{id: 'r', on: ['list.apply', 'list.page'], steps: [{set: 'last', to: {from: 'action'}}, {add: 'n', by: {value: 1}}]},
      {id: 'r-data', on: 'data.n', steps: [{set: 'was', to: {from: 'previous'}}]}]}));
  await t.emit('list', 'apply', {action: 'publish'});
  await t.emit('list', 'page', {action: 'next', page: 2});
  assert.equal(t.core.keys.last, 'next');
  assert.equal(t.core.keys.n, 2);
  assert.equal(t.core.keys.was, 1);
});

test('streams: begun, chunks, exactly one end (§10.8)', async () => {
  const t = mount(counter({roles: {source: {part: 'y-source'}}}));
  t.emit('source', 'begun', {id: 's1'});
  t.emit('source', 'chunk', {id: 's1'});
  t.emit('source', 'completed', {id: 's1'});
  assert.deepEqual(t.errors(), []);
  t.emit('source', 'chunk', {id: 's1'});
  t.emit('source', 'chunk', {id: 's2'});
  assert.equal(t.errors().length, 2);
});

test('words a rule picks: a code and a number; plural forms, {n} in the page\'s format, fallbacks (§11.2, §11.1)', () => {
  const words = createWords({ru: {roles: {confirm: {words: {delete: {one: 'Удалить {n} запись?', few: 'Удалить {n} записи?', many: 'Удалить {n} записей?', other: 'Удалить {n} записи?'}}}}},
    en: {roles: {confirm: {words: {delete: {one: 'Delete {n} record?', other: 'Delete {n} records?'}, only: 'English'}}}}}, 'ru');
  assert.equal(words.text('ru', 'roles.confirm.words.delete', 1), 'Удалить 1 запись?');
  assert.equal(words.text('ru-RU', 'roles.confirm.words.delete', 3), 'Удалить 3 записи?');
  assert.equal(words.text('ru', 'roles.confirm.words.delete', 11), 'Удалить 11 записей?');
  assert.equal(words.text('ru', 'roles.confirm.words.delete', 1000), 'Удалить 1 000 записей?');
  assert.equal(words.text('en', 'roles.confirm.words.delete', 2), 'Delete 2 records?');
  assert.equal(words.text('ru', 'roles.confirm.words.only'), 'English', 'a missing word falls back to English');
  assert.equal(words.text('de', 'roles.confirm.words.missing'), null);
  assert.equal(say({zero: 'Нет записей', other: '{n}'}, 0, 'ru'), 'Нет записей');
});

test('a role\'s words: constant word settings and the words of a constant list from the language file (§7.2, §11.3)', () => {
  const t = mount({tag: 'y-words', kind: 'assembly', keys: {},
    roles: {table: {part: 'y-list', settings: {columns: [{key: 'title'}, {key: 'amount'}], options: [{value: 'open'}, {value: 'won', label: 'given'}]}}},
  }, {locale: 'ru', lang: {ru: {roles: {table: {settings: {title: 'Сделки'}, columns: {title: 'Сделка', amount: 'Сумма'}, items: {open: 'Открытые', won: 'Выигранные'}}}}}});
  assert.deepEqual(t.lastSet('table', 'columns'), [{key: 'title', label: 'Сделка'}, {key: 'amount', label: 'Сумма'}]);
  assert.deepEqual(t.lastSet('table', 'options'), [{value: 'open', label: 'Открытые'}, {value: 'won', label: 'given'}]);
  assert.equal(t.lastSet('table', 'title'), 'Сделки');
  const rec = t.core.partsOf('table')[0];
  assert.equal(rec.context.word('columns.title'), 'Сделка');
  assert.equal(rec.context.word('words.none'), null);
});

test('the journal: development mode only; turns, rules, commits with the keys; exports as JSON (§14)', async () => {
  const quiet = mount(counter({rules: [{id: 'r', on: 'plus.press', steps: [{add: 'n', by: {value: 1}}]}]}));
  journal.force(false);
  journal.clear();
  await quiet.emit('plus', 'press');
  assert.equal(journal.entries(quiet.id).length, 0, 'nothing in production');
  journal.force(true);
  await quiet.emit('plus', 'press');
  const kinds = journal.entries(quiet.id).map((entry) => entry.kind);
  for (const kind of ['turn', 'rule', 'stepped', 'commit']) assert.ok(kinds.includes(kind), kind);
  const commit = journal.entries(quiet.id).find((entry) => entry.kind === 'commit');
  assert.deepEqual(journal.keysAt(quiet.id, commit.seq).n, 2, 'the time machine');
  assert.ok(Array.isArray(JSON.parse(journal.export(quiet.id))));
  assert.equal(quiet.core.keyMap().n.writer, 'logic');
});
