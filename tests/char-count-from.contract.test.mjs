// The count of a text field with a limit shows from 80 % of the limit (owner
// decision C141 (1): «from 80 %»), not only above it: a 100-character limit
// shows the count at the 80th character (GB4 acceptance follow-up (1)).
import test from 'node:test';
import assert from 'node:assert/strict';
import {charCount, COUNT_FROM} from '../src/smart/helpers/char-count.js';

test('the count shows at exactly 80 % of the limit', () => {
  assert.equal(COUNT_FROM, 0.8);
  const at = charCount(80, 100);
  assert.equal(at.near, true);
  assert.equal(at.shown, true);
  assert.equal(at.level, 'near');
});

test('below 80 % nothing shows; past the limit it is over', () => {
  assert.equal(charCount(79, 100).shown, false);
  assert.equal(charCount(79, 100).level, '');
  assert.equal(charCount(100, 100).level, 'near');
  assert.equal(charCount(101, 100).level, 'over');
});

test('a limit whose 80 % is not whole shows from the next character', () => {
  // 80 % of 7 is 5.6: the 6th character is the first at or past it.
  assert.equal(charCount(5, 7).shown, false);
  assert.equal(charCount(6, 7).shown, true);
});

test('counter shows the count always; no limit counts nothing', () => {
  assert.equal(charCount(1, 100, {always: true}).shown, true);
  assert.equal(charCount(1, 100, {always: true}).level, '');
  assert.equal(charCount(500, 0).shown, false);
});
