import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pagination 1.7.3 (progress-5 follow-up, SP-07): the wait beside the range
// is the spinner alone. Its words are counting-label, kept as the spinner's
// name and not drawn (sf-spinner label-hidden), as sf-input-lookup's wait.
// Before, the spinner drew its own «Загрузка…» under it and the aria-label
// sat on the display: contents host.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const markup = read('src/smart/pagination/js/templates/default.js');
const lookup = read('src/smart/input-lookup/js/templates/default.js');

test('pagination: the counting wait names the spinner by counting-label and hides the words', () => {
  const spinners = markup.match(/<sf-spinner[^>]*>/gu) ?? [];
  assert.equal(spinners.length, 1);
  assert.match(spinners[0], /label=\$\{context\.countingLabel\}/u);
  assert.match(spinners[0], /\blabel-hidden\b/u);
  assert.doesNotMatch(spinners[0], /aria-label=/u);
});

test('lookup: its wait spinner already hides its words (the line says the wait)', () => {
  const spinners = lookup.match(/<sf-spinner[^>]*>/gu) ?? [];
  assert.ok(spinners.length >= 1);
  for (const one of spinners) assert.match(one, /\blabel-hidden\b/u);
});
