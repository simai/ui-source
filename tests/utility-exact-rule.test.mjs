import assert from 'node:assert/strict';
import test from 'node:test';
import {exactClassPattern} from '../scripts/utility-exact-rule.mjs';

test('finite rules preserve variants, fractions, negative forms and literal punctuation', () => {
  const classes = ['gap-1', 'gap-1/2', 'g-1/2', 'md:-m-1', 'hover:-translate-x-1', 'project:card[wide]', 'x', 'xy'];
  const rule = new RegExp(exactClassPattern(classes));
  for (const name of classes) {
    assert.equal(rule.test(name), true, name);
    for (const bad of [`x-${name}`, `${name}-extra`, `${name}\n`, ` ${name}`, `${name} `]) {
      assert.equal(rule.test(bad), false, bad);
    }
  }
  for (const bad of ['gap-9', 'gap-', 'project:cardw', '-md:m-1', 'hover:translate-x-1', '']) {
    assert.equal(rule.test(bad), false, bad);
  }
});

test('generated rule is deterministic and supports new build-time extensions', () => {
  assert.equal(exactClassPattern(['b','a','ab']), exactClassPattern(['ab','a','b','a']));
  const before = new RegExp(exactClassPattern(['gap-1']));
  const after = new RegExp(exactClassPattern(['gap-1', 'gap-project-space']));
  assert.equal(before.test('gap-project-space'), false);
  assert.equal(after.test('gap-project-space'), true);
  assert.equal(after.test('gap-1'), true);
  for (const classes of [[], [''], ['a b'], [null]]) assert.throws(() => exactClassPattern(classes));
});
