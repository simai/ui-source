import assert from 'node:assert/strict';
import test from 'node:test';

import {accessibilityHolds} from '../scripts/effect-kit.mjs';

// The kit's accessibility rule reads simai.effect 1.5 interactive both ways
// (GB21, msg-cf9c957f): the host is always aria-hidden; it takes the pointer
// exactly when the manifest declares interactive: true.
const plain = {id: 'plain'};
const interactive = {id: 'reach', interactive: true};

test('a default effect: aria-hidden and out of the pointer\'s way', () => {
  assert.equal(accessibilityHolds(plain, {hidden: 'true', pointer: 'none'}), true);
  assert.equal(accessibilityHolds({...plain, interactive: false}, {hidden: 'true', pointer: 'none'}), true);
});

test('a default effect that takes the pointer fails', () => {
  assert.equal(accessibilityHolds(plain, {hidden: 'true', pointer: 'auto'}), false);
  assert.equal(accessibilityHolds({...plain, interactive: false}, {hidden: 'true', pointer: 'auto'}), false);
  assert.equal(accessibilityHolds({...plain, interactive: 'true'}, {hidden: 'true', pointer: 'auto'}), false);
});

test('an interactive effect: aria-hidden and taking the pointer', () => {
  assert.equal(accessibilityHolds(interactive, {hidden: 'true', pointer: 'auto'}), true);
});

test('an interactive effect that blocks the pointer fails', () => {
  assert.equal(accessibilityHolds(interactive, {hidden: 'true', pointer: 'none'}), false);
});

test('aria-hidden is required either way', () => {
  assert.equal(accessibilityHolds(plain, {hidden: null, pointer: 'none'}), false);
  assert.equal(accessibilityHolds(interactive, {hidden: 'false', pointer: 'auto'}), false);
  assert.equal(accessibilityHolds(interactive, {hidden: null, pointer: 'auto'}), false);
});
