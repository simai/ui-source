import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ordinary Tree implements a roving composite keyboard model', async () => {
  const source = await read('src/component/tree/js/_tree.js');

  for (const key of [
    'ArrowDown',
    'ArrowUp',
    'ArrowRight',
    'ArrowLeft',
    'Home',
    'End',
    'Enter',
  ]) {
    assert.match(source, new RegExp(`case '${key}'`));
  }

  assert.match(source, /candidate\.tabIndex = candidate === next \? 0 : -1/);
  assert.match(source, /data-selection/);
  assert.match(source, /sf-tree:selection-change/);
  assert.match(source, /isSmartTreeRoot\(root\)/);
});

test('ordinary Tree exposes nested groups and token-owned interaction paint', async () => {
  const [source, styles] = await Promise.all([
    read('src/component/tree/js/_tree.js'),
    read('src/component/tree/scss/_css__tree.scss'),
  ]);

  assert.match(source, /group\?\.setAttribute\('role', 'group'\)/);
  assert.match(styles, /\.sf-tree-group/);
  assert.match(styles, /:focus-visible > \.sf-tree-item-container/);
  assert.match(styles, /var\(--sf-radius--ui\)/);
  assert.match(styles, /var\(--sf-surface-container-hover\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}|rgba?\(/i);
});

test('Smart Tree mirrors navigation, selection and ARIA ownership', async () => {
  const [tree, item, template, row] = await Promise.all([
    read('src/smart/tree/index.js'),
    read('src/smart/tree-item/index.js'),
    read('src/smart/tree-item/js/templates/default.js'),
    read('src/smart/tree-item/js/templates/row.js'),
  ]);

  // The entries are drawn flat, keyed by id (standard 1.3.8 §18.4): a level
  // is aria-level, the roving tab stop is the tree's.
  assert.match(tree, /getVisibleItems\(\)/);
  assert.match(tree, /moveTypeahead\(index, key\)/);
  assert.match(tree, /this\.sfEmit\('select'/);
  assert.match(item, /'focus-item'\(\)/);
  assert.match(item, /activate\(\)/);
  assert.match(row, /role="treeitem"/);
  assert.match(row, /tabindex=\$\{row\.tabStop \? '0' : '-1'\}/);
  assert.match(row, /aria-level=/);
  assert.match(template, /class="sf-tree-group flex flex-col" role="group"/);
  assert.match(row, /aria-selected=/);
  assert.match(row, /aria-current=/);
});

test('Smart Tree separates disclosure and node identity icons', async () => {
  const template = await read(
    'src/smart/tree-item/js/templates/row.js',
  );

  assert.match(template, /sf-tree-toggle/);
  assert.match(template, /renderIcon\(chevronIcon, 'sf-tree-chevron'\)/);
  assert.match(template, /renderIcon\(nodeIcon, 'sf-tree-node-icon'\)/);
  assert.match(template, /sf-tree-toggle-spacer/);
});
