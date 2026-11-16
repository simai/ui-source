import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../src/smart/gallery/index.js', import.meta.url), 'utf8');
const method = (name, args) => new Function(args, source.split(`  ${name}(${args}) {`)[1].split('\n  }')[0]);
const resolve = method('resolveUpdateMode', 'changedAttributes = []');
const update = method('updateDom', 'changedAttributes = []');
const setCurrent = method('_setCurrent', "index, source = 'api', { emit = true } = {}");

test('Only the open and current state takes the non-rendering update path', () => {
  for (const keys of [['current'], ['open'], ['current', 'open']]) assert.equal(resolve(keys), 'dom');
  for (const keys of [[], ['heading'], ['slot-change'], ['open', 'ratio']]) assert.equal(resolve(keys), 'lit');
});

test('A current written by the page moves the gallery without an event; a write of its own is skipped', () => {
  const calls = [];
  const g = {resolveUpdateMode: resolve, getProp: () => 2, _setCurrent: (...args) => calls.push(args)};
  assert.equal(update.call(g, ['current']), true);
  assert.deepEqual(calls, [[2, 'api', {emit: false}]]);
  calls.length = 0;
  assert.equal(update.call({...g, _syncing: true}, ['current']), true);
  assert.deepEqual(calls, []);
  assert.equal(update.call(g, ['slot-change']), false);
});

test('Moving the gallery writes current once and emits change once', () => {
  const attributes = new Map(), changes = [];
  const g = {
    _current: 1, slidesTotal: 3, _viewing: false,
    get current() { return this._current; },
    _normalizeCurrent: (value) => Math.min(Math.max(Number(value), 1), 3),
    getAttribute: (key) => attributes.get(key) ?? null,
    setAttribute(key, value) { attributes.set(key, value); },
    getProp: () => 'grid',
    sfEmit: (name, detail) => changes.push({name, detail}),
  };
  assert.equal(setCurrent.call(g, 3, 'api'), 3);
  assert.equal(attributes.get('current'), '3');
  assert.deepEqual(changes, [{name: 'change', detail: {previous: 1, current: 3, total: 3, from: 'api'}}]);
  setCurrent.call(g, 3, 'api');
  assert.equal(changes.length, 1, 'no change event when nothing moved');
  setCurrent.call(g, 9, 'lightbox', {emit: false});
  assert.equal(changes.length, 1);
});
