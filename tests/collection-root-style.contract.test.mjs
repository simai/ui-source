import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = owner => readFile(new URL(`../src/smart/${owner}/js/templates/default.js`, import.meta.url), 'utf8');

for (const owner of ['avatars', 'list-item', 'pagination', 'tags', 'tooltip', 'tree-item', 'tabs', 'file-upload']) {
  test(`${owner} consumes root class/style in its built-in template`, async () => {
    const template = await read(owner);
    assert.match(template, /context.rootClass/);
    assert.match(template, /style=\$\{context.rootStyle \|\| nothing\}/);
  });
}

// The avatars are drawn from sf-avatar's parts: one avatar helper takes the root
// style only when it is the root (default, profile), the label group and the
// group take it on their own root, and the nested avatars are given none.
test('all Avatar variants bind style once; Label does not repeat it on its nested avatar', async () => {
  const template = await read('avatars');
  assert.equal((template.match(/style=\$\{context.rootStyle \|\| nothing\}/g) || []).length, 2);
  assert.equal((template.match(/rootStyle: context.rootStyle/g) || []).length, 2);
  assert.match(template, /style=\$\{options.rootStyle \|\| nothing\}/);
  assert.match(template, /\$\{avatar\(\{ size, imageUrl, component: context.component \}\)\}/);
  const code = template.replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(code, /sf-avatar-round|sf-avatar--image|sf-avatar-cir|sf-avatar-check|<button/);
});

test('tree disclosure and node identity use separate controls and icons', async () => {
  const template = await read('tree-item');
  assert.match(template, /class="sf-icon-button sf-tree-toggle"/);
  assert.match(template, /aria-expanded=\$\{String\(context\.open\)\}/);
  assert.match(template, /aria-label=\$\{context\.open/);
  assert.match(template, /renderIcon\(chevronIcon, 'sf-tree-chevron'\)/);
  assert.match(template, /renderIcon\(nodeIcon, 'sf-tree-node-icon'\)/);
});
