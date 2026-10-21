import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// A host applies a sortable intent by redrawing its own list. What the
// component must survive, from the first editor built on it (consumer case
// ui-mail.sortable-editor-recipe, 2026-10-21).
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('the live region and the instructions survive a host redraw of the list', async () => {
  const source = await read('src/core/js/composition/sortable.mjs');

  assert.match(source, /ensureAccessibilityNodes\(\) \{/);
  // Announcing puts them back first, because the host's redraw happens
  // between the intent and the announcement of the drop.
  assert.match(source, /announce\(text\) \{\s*this\.ensureAccessibilityNodes\(\);/);
  // And the observer that already watches childList puts them back after any
  // other redraw.
  assert.match(source, /new globalThis\.MutationObserver\(\(\) => \{ this\.ensureAccessibilityNodes\(\);/);
  // The instructions keep their id: items point at it with aria-describedby.
  assert.doesNotMatch(source, /ensureAccessibilityNodes[\s\S]{0,400}instructions\.id =/);
});

test('a keyboard drop gets its focus back, and only when the host lost it', async () => {
  const source = await read('src/core/js/composition/sortable.mjs');

  assert.match(source, /function restoreFocusAfterDrop\(ended\) \{/);
  assert.match(source, /if \(reason === 'dropped' && ended\.input === 'keyboard'\) restoreFocusAfterDrop\(ended\);/);
  // Nothing is taken from a host that restored focus itself.
  assert.match(source, /if \(active && active !== document_\.body && document_\.contains\(active\)\) return;/);
  // Two frames: the host has applied the intent by then.
  assert.match(source, /requestAnimationFrame\(\(\) => globalThis\.requestAnimationFrame\(place\)\)/);
  // The item is found by its own id, in the list it landed in.
  assert.match(source, /\[data-sf-sortable-item="\$\{globalThis\.CSS\?\.escape/);
});

test('both sortable documents carry the editor recipe', async () => {
  const [developer, smart] = await Promise.all([
    read('docs/developer/composition-sortable.md'),
    read('src/smart/sortable/docs.md'),
  ]);

  for (const document_ of [developer, smart]) {
    assert.match(document_, /data-sf-sortable-item/);
    assert.match(document_, /replaceChildren/);
  }
  assert.match(developer, /## Applying an intent in an editor/);
  assert.match(smart, /## Применение намерения в редакторе/);
});
