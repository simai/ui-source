import assert from 'node:assert/strict';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {checkStrongPlaceInk, findingsIn} from '../scripts/check-strong-place-ink.mjs';

// C208 (dispatcher decision msg-bc1702eb, 2026-11-18): words on a strong
// coloured place without its on-class read the page's ink on the colour,
// about 3:1 -- a defect. The check requires the on-class beside the place.
const root = resolve(import.meta.dirname, '..');

test('the Framework\'s own markup writes the on-class beside every strong place', () => {
  assert.deepEqual(checkStrongPlaceInk(['src', 'docs'].map((path) => join(root, path)), {root}), []);
});

test('a strong place with words and no on-class is a finding; with it, or decorative, it is not', () => {
  assert.equal(findingsIn('<div class="bg-primary p-2">Текст</div>').length, 1);
  assert.deepEqual(findingsIn('<div class="radius-surface bg-error">x</div>')[0].need, ['color-on-error']);
  assert.equal(findingsIn('<div class="bg-primary color-on-primary">Текст</div>').length, 0);
  assert.equal(findingsIn('<span aria-hidden="true" class="sf-tag-color-icon bg-success"></span>').length, 0);
  assert.equal(findingsIn('<div class="bg-primary-container">Текст</div>').length, 0, 'a container is not a strong place');
  assert.equal(findingsIn('<sf-list-item color-class="bg-success"></sf-list-item>').length, 0, 'a setting is not a class list');
  assert.equal(findingsIn('html`<div class=\\"bg-warning\\">x</div>`').length, 1, 'a class in a string');
});
