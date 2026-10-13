import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* A list row's divider is inside its control height: the bottom padding gives
   the border back. Measured before: a standalone row stood 33/41/49 at sizes
   1/2, 1, 2 against a 32/40/48 control. tests/browser/list-row-composition
   .cli.js measures it; this holds the arithmetic for the node gate. */
test('list row composition: the bottom padding gives the divider back', async () => {
  const sheet = await read('src/component/dropdown/scss/_css__list-item.scss');
  assert.match(sheet, /@property --sf-list-item--border-bottom-width \{\n {2}syntax: "<length>";\n {2}inherits: true;\n {2}initial-value: 0;\n\}/);
  assert.match(sheet, /padding-bottom: calc\(var\(--sf-list-item--padding-bottom\) - var\(--sf-list-item--border-bottom-width\)\);/);
  assert.match(sheet, /border-bottom-width: var\(--sf-list-item--border-bottom-width\);/);
  const doc = await read('docs/foundation-composition-geometry.md');
  assert.ok(doc.includes('tests/browser/list-row-composition.cli.js'));
});
