// sf-tree defects of the tree study (owner remark R186, ui-control
// control/research/2026-11-12-tree.md): TR-5 lazy branches, TR-14 long names.
// The behaviour is measured in a browser by tests/browser/tree-tr.browser.mjs
// on a build; these pin the source that makes it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('TR-5: a branch marked has-children opens before its children are loaded', async () => {
  const [tree, item, nodeData, itemIndex, itemTemplate] = await Promise.all([
    json('src/smart/tree/component.json'),
    json('src/smart/tree-item/component.json'),
    read('src/smart/tree-item/js/node-data.js'),
    read('src/smart/tree-item/index.js'),
    read('src/smart/tree-item/js/templates/default.js'),
  ]);
  const source = await read('src/smart/tree/index.js');

  // The entry field, on the tree's entries and the item's children, and the
  // item's own setting.
  assert.equal(tree.settings.items.of['has-children'], 'boolean');
  assert.equal(item.settings['items-data'].of['has-children'], 'boolean');
  assert.equal(item.settings['has-children'].type, 'boolean');
  assert.equal(item.settings['has-children'].default, false);

  // Read in either spelling; a branch is children or has-children, never a file.
  assert.match(source, /hasChildren: Boolean\(pick\(item, 'has-children', 'hasChildren'\)\)/);
  assert.match(source, /const isBranch = \(entry\) => entry\.kind !== 'file' && \(entry\.childIds\.length > 0 \|\| entry\.hasChildren\)/);
  // The row is drawn as a branch (chevron, aria-expanded), expand applies and
  // toggle is sent: the lazy recipe's cue.
  assert.match(source, /const branch = isBranch\(entry\);/);
  assert.match(source, /if \(!isBranch\(entry\)\) return \{outcome: 'refused', reason: 'leaf'\};/);
  assert.match(source, /this\.sfEmit\('toggle', \{id: entry\.id, open: Boolean\(open\), value: entry\.value\}\)/);
  // ArrowRight on an open branch with nothing loaded stays on it.
  assert.match(source, /else if \(row\.open && row\.entry\.childIds\.length\) target = index \+ 1;/);
  assert.doesNotMatch(source, /entry\.kind === 'file' \|\| !entry\.childIds\.length/);

  // Markup: <sf-tree-item has-children> inside a tree, and alone.
  assert.match(nodeData, /hasChildren: node\.hasAttribute\('has-children'\) && node\.getAttribute\('has-children'\) !== 'false'/);
  assert.match(itemIndex, /get isBranch\(\) \{\n\s+return !this\.isFile && \(this\.childItems\.length > 0 \|\| Boolean\(this\.hasChildren\)\);/);
  assert.match(itemIndex, /if \(!this\.isBranch\) return \{outcome: 'refused', reason: 'leaf'\};/);
  assert.match(itemIndex, /hasChildren: this\.isBranch,/);
  assert.match(itemTemplate, /\?has-children=\$\{Boolean\(item\.hasChildren \?\? item\['has-children'\]\)\}/);
});

test('TR-14: a long name is one line with an ellipsis, its whole name the aria-label and a Framework tooltip', async () => {
  const [sheet, row, source, tree, rule] = await Promise.all([
    read('src/smart/tree/js/templates/default.css'),
    read('src/smart/tree-item/js/templates/row.js'),
    read('src/smart/tree/index.js'),
    json('src/smart/tree/component.json'),
    read('src/smart/tree/rule.js'),
  ]);

  // One line, cut: the element's rows only (class markup has no tooltip).
  const rule14 = sheet.match(/sf-tree > \.sf-tree \.sf-tree-item-name \{([^}]*)\}/);
  assert.ok(rule14, 'the name rule of the element rows');
  for (const declaration of ['overflow: hidden', 'white-space: nowrap', 'text-overflow: ellipsis', 'overflow-wrap: normal']) {
    assert.ok(rule14[1].includes(declaration), declaration);
  }

  // A cut row: aria-label and data-tooltip on the treeitem, the tooltip
  // surface (component.tooltip class markup, hidden, no tail per C59) in it.
  assert.match(row, /aria-label=\$\{row\.tipId && row\.label \? row\.label : nothing\}/);
  assert.match(row, /data-tooltip=\$\{row\.tipId && row\.label \? row\.tipId : nothing\}/);
  assert.match(row, /class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-tree-item-tip" id=\$\{row\.tipId\} hidden/);
  assert.doesNotMatch(row.match(/function renderTip[\s\S]*?\n\}/)[0], /sf-tooltip--arrow-/);

  // Measured on the drawn name, after each drawing and when the tree's box
  // changes (a column, a late sheet); ids are path ids (§7.1.1).
  assert.match(source, /const cut = name\.scrollWidth - name\.clientWidth > 0\.5;/);
  assert.match(source, /const cut = this\.measureCut\(\);/);
  assert.match(source, /this\._resize = new ResizeObserver\(\(\) => \{\n\s+if \(this\.measureCut\(\)\) this\.requestComponentUpdate\('cut'\);/);
  assert.match(source, /tipId: this\._cut\.has\(row\.id\) \? partId\(this\._tipPath, `tip-\$\{idWord\(row\.id\)\}`\) : ''/);
  assert.match(source, /this\._tipPath = this\._cut\.size \? instancePath\(this, \{kind: 'sf-tree'\}\) : '';/);
  assert.match(source, /this\._resize\?\.disconnect\(\);/);

  // The tooltip component comes with the tree.
  assert.ok(tree.relations.some((relation) => relation.name === 'tooltip'));
  assert.match(rule, /\{ name: 'tooltip' \}/);
});

test('tree versions: sf-tree 2.2.0, sf-tree-item 1.2.0', async () => {
  const [tree, item, treeManifest, itemManifest] = await Promise.all([
    json('src/smart/tree/component.json'),
    json('src/smart/tree-item/component.json'),
    json('src/smart/tree/smart.manifest.json'),
    json('src/smart/tree-item/smart.manifest.json'),
  ]);
  assert.equal(tree.version, '2.2.0');
  assert.equal(item.version, '1.2.0');
  assert.equal(treeManifest.version, '2.2.0');
  assert.equal(itemManifest.version, '1.2.0');
});
