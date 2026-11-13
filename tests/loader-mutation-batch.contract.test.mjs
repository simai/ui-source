// C54 D4 (2026-11-12, ui-control evidence 2026-11-12-tabs-d3-d4): on a page
// that draws hundreds of components in one task (the 470-row sf-tabs page) the
// Loader's MutationObserver is handed hundreds of thousands of records at
// once. Spread into push() as arguments they ran past the call stack
// (RangeError: Maximum call stack size exceeded, once a load) and that whole
// batch of changes was lost. The records are kept one at a time.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');

test('the Loader keeps a batch of mutation records of any size', () => {
  assert.doesNotMatch(source, /push\(\.\.\.relevantChanges\)/u);
  assert.match(source, /const keep = \(into\) => \{ for \(const change of relevantChanges\) into\.push\(change\); \};/u);
  assert.match(source, /keep\(mutationBuffer\);/u);
  assert.match(source, /keep\(_this\.observeElements\);/u);
});

test('a batch the size of the 470-row page is kept whole by the loop and not by a spread', () => {
  const batch = Array.from({length: 600000}, (_, at) => at);
  assert.throws(() => [].push(...batch), RangeError);
  const into = [];
  for (const change of batch) into.push(change);
  assert.equal(into.length, batch.length);
});
