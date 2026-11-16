// R242 (owner remark 2026-11-14; focus-clipping audit point 6, evidence 2026-11-14-focus-clipping in ui-control):
// the ring belongs to the part of sf-tag that takes the focus, one inner ring of 2 px, no outer ring. The label
// action and the remove button split the chip at the middle of the gap before the cross; the drawn rings are
// measured on a stand (evidence 2026-11-14-tag-ring-r242). This file holds the source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/smart/tag/js/templates/default.css', import.meta.url), 'utf8');

test('the chip draws no ring for its label action', () => {
  assert.doesNotMatch(css, /\.sf-tag--interactive:has\(> \.sf-tag-action:focus-visible\)/u);
});

test('the label action draws its own ring, inside, over the chip insets up to the split', () => {
  assert.match(css, /\.sf-tag \.sf-tag-action:focus-visible::after \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--inset\);/u);
  assert.match(css, /\.sf-tag \.sf-tag-action::after \{[^}]*inset-inline-end: calc\(-1 \* var\(--sf-tag--ring-split\)\);/u);
});

test('the remove button draws one inner ring on its part, none on the cross glyph', () => {
  assert.match(css, /> \.sf-icon-button\.sf-icon-button--close:not\(:disabled\):focus-visible \.sf-close \{\s*outline: none;/u);
  assert.match(css, /> \.sf-icon-button\.sf-icon-button--close:not\(:disabled\):focus-visible::before \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--inset\);/u);
  assert.match(css, /--sf-tag--ring-split: calc\(var\(--sf-tag--close-gap\) \/ 2 \+ var\(--sf-focus--width\) \/ 2\);/u);
});
