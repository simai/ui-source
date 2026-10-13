import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Inside a tree a name takes its row's colour; the tree's rule must outweigh
// sf-tree-item's own (.sf-tree-item .sf-tree-item-name: primary), or the colour
// depends on load order and a disabled row's dimming never reaches the name.

test('the tree names its items more specifically than the item names itself', () => {
  const tree = readFileSync(new URL('../src/component/tree/scss/_css__tree.scss', import.meta.url), 'utf8');
  const item = readFileSync(new URL('../src/component/tree-item/scss/_css__tree_item.scss', import.meta.url), 'utf8');
  assert.match(item, /\.sf-tree-item \.sf-tree-item-name \{\s*color: var\(--sf-tree-item-name--color, var\(--sf-primary\)\)/u);
  assert.match(tree, /\.sf-tree \.sf-tree-item \.sf-tree-item-name,\s*\.sf-tree \.sf-tree-item-name \{[^}]*color: inherit;/u);
});
