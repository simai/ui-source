import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Plain group 3 (DEV letter msg-5a0b5ac9, study ui-control
// control/research/2026-11-14-plain-group-3.md), what C186 left: CB-3, the
// fixed space after every code block. The built sheet is measured by the
// helper's probe; this holds the source.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const highlight = code(read('src/component/highlight/scss/_default.scss'));

test('CB-3: a code block ends with the text space and sets no top on what follows', () => {
  assert.doesNotMatch(highlight, /:is\(\.sf-highlight, \.source\) \+ \*/u, 'no rule on the next sibling');
  assert.match(highlight, /:is\(\.sf-highlight, \.source\):not\(:last-child\) \{\s*margin-block-end: var\(--sf-text--space-bottom\);\s*\}/u);
  // After the code surface's margin: 0 in the file, so the block's end wins
  // at equal layer (and it is the more specific selector anyway).
  assert.ok(highlight.indexOf(':is(.sf-highlight, .source):not(:last-child)') > highlight.indexOf('.sf-code-surface {'));
});
