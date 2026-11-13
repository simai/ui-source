// sf-list-timeline's collapse rule (C40 round 2, DEV D1; acceptance note 4, 2026-11-11):
// runs of one actor and one kind fold their rest into «Ещё N»; events without an actor and
// steps never make a run; a rest of one is drawn; the fold is a native button that reveals in
// place and gives the focus to the first revealed event.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {foldRuns} from '../src/smart/list-timeline/js/fold-runs.mjs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const ev = (id, actor = 'Анна', kind = 'edit', extra = {}) => ({id, kind, actor: actor ? {name: actor} : null, ...extra});
const run = (prefix, n, actor = 'Анна', kind = 'edit', extra = {}) => Array.from({length: n}, (_, i) => ev(`${prefix}${i + 1}`, actor, kind, extra));
// What the list draws: event ids, and FOLD(n:first) for a folded rest.
const drawn = (entries) => entries.map((entry) => (entry.fold ? `FOLD(${entry.fold.items.length}:${entry.fold.key})` : entry.item.id));

test('events without an actor never fold, whatever their number', () => {
  assert.deepEqual(drawn(foldRuns(run('a', 7, null))), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
  assert.deepEqual(drawn(foldRuns(run('a', 12, null), {collapse: 2})).length, 12);
});

test('steps never fold, with or without an actor', () => {
  assert.deepEqual(drawn(foldRuns(run('s', 7, 'Анна', 'edit', {state: 'done'}))), ['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
  assert.deepEqual(drawn(foldRuns(run('s', 7, null, 'edit', {state: 'upcoming'}))).length, 7);
});

test('a run of one actor keeps its first collapse events and folds the rest', () => {
  assert.deepEqual(drawn(foldRuns(run('e', 7))), ['e1', 'e2', 'e3', 'e4', 'e5', 'FOLD(2:e6)']);
  assert.deepEqual(drawn(foldRuns(run('t', 12))), ['t1', 't2', 't3', 't4', 't5', 'FOLD(7:t6)']);
  assert.deepEqual(drawn(foldRuns(run('w', 5), {collapse: 2})), ['w1', 'w2', 'FOLD(3:w3)']);
});

test('a single leftover event is drawn, not folded', () => {
  assert.deepEqual(drawn(foldRuns(run('e', 6))), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
  assert.deepEqual(drawn(foldRuns(run('w', 3), {collapse: 2})), ['w1', 'w2', 'w3']);
});

test('a list is never folded whole: actorless events around a run stand alone', () => {
  const items = [...run('x', 3, null), ...run('m', 7, 'Анна'), ...run('y', 2, null)];
  assert.deepEqual(drawn(foldRuns(items)), ['x1', 'x2', 'x3', 'm1', 'm2', 'm3', 'm4', 'm5', 'FOLD(2:m6)', 'y1', 'y2']);
  for (const n of [1, 6, 7, 30]) {
    for (const items2 of [run('a', n), run('a', n, null), run('a', n, 'Анна', 'edit', {state: 'done'})]) {
      assert.ok(drawn(foldRuns(items2))[0] !== undefined && !drawn(foldRuns(items2))[0].startsWith('FOLD'), `n=${n}`);
    }
  }
});

test('a run is one actor and one kind; another kind starts a new run', () => {
  const items = [...run('e', 4, 'Анна', 'edit'), ...run('c', 4, 'Анна', 'comment')];
  assert.deepEqual(drawn(foldRuns(items)).length, 8);
  const two = [...run('a', 4, 'Анна'), ...run('b', 4, 'Борис')];
  assert.deepEqual(drawn(foldRuns(two)).length, 8);
});

test('collapse 0 folds nothing; an opened run stays open', () => {
  assert.deepEqual(drawn(foldRuns(run('e', 8), {collapse: 0})).length, 8);
  assert.deepEqual(drawn(foldRuns(run('e', 7), {opened: new Set(['e6'])})), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']);
});

test('the fold is a native button (Enter and Space press it) that reveals in place and focuses the first revealed event', () => {
  const template = read('src/smart/list-timeline/js/templates/default.js');
  const source = read('src/smart/list-timeline/index.js');
  // A <button type="button">: the platform presses it on Enter and on Space; no key handler of its own.
  assert.match(template, /<button type="button" class="sf-list-timeline-run" aria-expanded="false" @click=\$\{\(\) => context\.component\.expand\(entry\)\}>/u);
  assert.doesNotMatch(template, /@keydown/u);
  // The press opens the run (component state, the list re-renders from items) and says which run.
  assert.match(source, /this\._opened\.add\(fold\.key\);\n\s+this\._focusRun = fold\.key;/u);
  assert.match(source, /this\.sfEmit\('expand', \{run: fold\.key, ids: fold\.items\.map\(\(item\) => item\.id\), count: fold\.items\.length\}\);/u);
  // After the render the first revealed event (the fold's key) takes the focus, made focusable by tabindex -1.
  assert.match(source, /find\(\(li\) => li\.dataset\.id === key\);\n\s+if \(first\) \{\n\s+first\.setAttribute\('tabindex', '-1'\);\n\s+first\.focus\(/u);
  assert.match(source, /import \{foldRuns\} from '\.\/js\/fold-runs\.mjs';/u);
});
