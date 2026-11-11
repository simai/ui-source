// sf-list-timeline 1.1 collapse rules (owner decision C40; DEV acceptance
// round 2, D1): which events fold behind «Ещё N».
//   - a run is consecutive events of one actor and one kind;
//   - events without an actor (a system log) and steps make no run;
//   - a run longer than collapse keeps its first collapse events and folds the
//     rest; a rest of one event is drawn;
//   - collapse 0 folds nothing; an opened run (its first folded id) is drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {foldRuns} from '../src/smart/list-timeline/js/runs.mjs';

const ev = (id, {actor, kind = 'event', state} = {}) => ({id, kind, state, actor: actor ? {name: actor} : null});
const many = (prefix, n, options) => Array.from({length: n}, (_, i) => ev(`${prefix}${i + 1}`, options));
// The drawing as a string: ids of events, «+N» for a fold.
const draw = (entries) => entries.map((one) => (one.fold ? `+${one.fold.items.length}` : one.item.id)).join(' ');

test('events without an actor never fold, however many', () => {
  assert.equal(draw(foldRuns(many('s', 7))), 's1 s2 s3 s4 s5 s6 s7');
});

test('a run of one actor keeps its first collapse events and folds the rest', () => {
  const entries = foldRuns(many('e', 7, {actor: 'A'}));
  assert.equal(draw(entries), 'e1 e2 e3 e4 e5 +2');
  assert.equal(entries[5].fold.key, 'e6');
  assert.deepEqual(entries[5].fold.items.map((one) => one.id), ['e6', 'e7']);
  assert.equal(draw(foldRuns(many('t', 12, {actor: 'A'}))), 't1 t2 t3 t4 t5 +7');
});

test('a rest of one event is drawn, not folded', () => {
  assert.equal(draw(foldRuns(many('e', 6, {actor: 'A'}))), 'e1 e2 e3 e4 e5 e6');
  assert.equal(draw(foldRuns(many('e', 5, {actor: 'A'}))), 'e1 e2 e3 e4 e5');
});

test('steps never fold, with or without an actor', () => {
  assert.equal(draw(foldRuns(many('p', 7, {actor: 'A', state: 'done'}))), 'p1 p2 p3 p4 p5 p6 p7');
  assert.equal(draw(foldRuns(many('q', 7, {state: 'upcoming'}))), 'q1 q2 q3 q4 q5 q6 q7');
});

test('another actor or another kind ends a run', () => {
  const mixed = [...many('x', 3), ...many('m', 7, {actor: 'A'}), ...many('y', 2)];
  assert.equal(draw(foldRuns(mixed)), 'x1 x2 x3 m1 m2 m3 m4 m5 +2 y1 y2');
  const kinds = [...many('c', 4, {actor: 'A'}), ...many('k', 4, {actor: 'A', kind: 'comment'})];
  assert.equal(draw(foldRuns(kinds)), 'c1 c2 c3 c4 k1 k2 k3 k4');
  const people = [...many('a', 4, {actor: 'A'}), ...many('b', 4, {actor: 'B'})];
  assert.equal(draw(foldRuns(people)), 'a1 a2 a3 a4 b1 b2 b3 b4');
});

test('collapse sets the visible count; 0 folds nothing', () => {
  assert.equal(draw(foldRuns(many('w', 5, {actor: 'A'}), {collapse: 2})), 'w1 w2 +3');
  assert.equal(draw(foldRuns(many('z', 8, {actor: 'A'}), {collapse: 0})), 'z1 z2 z3 z4 z5 z6 z7 z8');
});

test('an opened run is drawn whole', () => {
  const items = many('e', 7, {actor: 'A'});
  assert.equal(draw(foldRuns(items, {opened: new Set(['e6'])})), 'e1 e2 e3 e4 e5 e6 e7');
});
