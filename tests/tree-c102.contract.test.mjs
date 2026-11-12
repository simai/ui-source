// sf-tree, owner decision C102 (ui-control control/docs-review/decisions.md,
// research control/research/2026-11-12-tree.md section 7) and the defects found
// with it: TR-15 (row icon colour reached a nested checkbox), NI-2 (phone level
// step under the chevron), NI-3 (row gap with two owners). The behaviour is
// measured in a browser by tests/browser/tree-c102.browser.mjs on a build;
// these pin the source that makes it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('TR-15: the row colours only its own glyphs, never what the row holds', async () => {
  const item = await read('src/component/tree-item/scss/_css__tree_item.scss');
  const override = item.match(/@layer sf\.override \{([\s\S]*?)\n\}/u)[1];
  // No rule of the row reaches every .sf-icon inside it.
  assert.doesNotMatch(item, /\.sf-tree-item \.sf-icon\s*[,{]/u);
  assert.match(override, /\.sf-tree-item-container > \.sf-tree-node-icon,\s*\.sf-tree-item-container > \.sf-tree-toggle > \.sf-tree-chevron \{\s*--sf-icon--color: var\(--sf-tree-item-icon-color, var\(--sf-tree-item-icon--color, currentColor\)\);/u);
});
