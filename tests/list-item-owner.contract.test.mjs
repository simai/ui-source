import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('List Item keeps interaction semantics with its owning Dropdown', async () => {
  const [template, dropdownTemplate, interaction] = await Promise.all([
    read('src/smart/list-item/js/templates/default.js'),
    read('src/smart/dropdown/js/templates/default.js'),
    read('src/component/dropdown/interaction.js'),
  ]);

  assert.match(template, /const isOption = context\.option === true/);
  assert.match(template, /role=\$\{isOption \? "option" : nothing\}/);
  assert.match(template, /tabindex=\$\{isOption \? "-1" : nothing\}/);
  assert.doesNotMatch(template, /role="button"/);
  assert.match(template, /isOption \? "cursor-pointer" : ""/);
  // The option row is made in one place now: the list item's own template.
  // The dropdown drew it inline, so nothing else could have one.
  assert.match(template, /option: true/);
  assert.match(dropdownTemplate, /renderListItemOption\(/);
  assert.match(interaction, /container\.setAttribute\('role','listbox'\)/);
  assert.match(interaction, /item\.setAttribute\('role','option'\)/);
});

test('List Item decorations never create nested option controls', async () => {
  const template = await read('src/smart/list-item/js/templates/default.js');

  assert.match(template, /class="sf-icon" aria-hidden="true"/);
  assert.match(template, /class="sf-tag-color-icon \$\{context\.colorClass\}" aria-hidden="true"/);
  assert.equal((template.match(/class="sf-checkbox sf-checkbox--size-/g) || []).length, 2);
  assert.equal((template.match(/<label[\s\S]*?aria-hidden="true"/g) || []).length >= 2, true);
  assert.equal((template.match(/tabindex="-1"/g) || []).length, 2);
  assert.doesNotMatch(template, /"transition"/);
});

test('List Item source contract includes machine value and all visible labels update', async () => {
  const [source, manifest] = await Promise.all([
    read('src/smart/list-item/index.js'),
    read('src/smart/list-item/smart.manifest.json').then(JSON.parse),
  ]);

  // The value is the row's id, a setting of component.json (standard 1.3.8 §4).
  const component = JSON.parse(await read('src/smart/list-item/component.json'));
  assert.deepEqual(component.settings.value, {type: 'string', default: '', summary: component.settings.value.summary});
  assert.match(source, /elementFromManifest\(manifest/);
  assert.match(source, /\.sf-list-item-container, \.sf-avatar-label-group-title, \.sf-tag-container/);
  assert.equal(manifest.inputs.properties.value.type, 'string');
  assert.equal(manifest.item_contract.parent, 'smart.dropdown');
  assert.match(manifest.contracts.standalone.const, /Non-interactive/);
  // The role is component.json's (none); its words say where the option role lives.
  assert.equal(manifest.accessibility.role, 'none');
  assert.match(component.accessibility.$comment, /the option role belongs to sf-dropdown/);
});

test('List Item presentation uses semantic tokens and owner-scoped states', async () => {
  const style = await read('src/component/dropdown/scss/_css__list-item.scss');

  assert.match(style, /--sf-list-item--border-bottom-width: var\(--sf-px\)/);
  assert.match(style, /transition-property: background-color, border-color, box-shadow, color/);
  assert.match(style, /transition-duration: var\(--sf-duration-fast\)/);
  assert.match(style, /\.sf-list \[role="option"\]\.sf-list-item[^\n]*:hover/);
  assert.match(style, /\.sf-list \[role="option"\]\.sf-list-item[^\n]*:focus-visible/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(style, /\b\d+(?:\.\d+)?(?:px|rem)\b/);
});

test('List Item is also a general list row: supporting line, roving rows, sortable and pinned rows (simai/ui-source#18, #29)', async () => {
  const [template, source, manifest, style] = await Promise.all([
    read('src/smart/list-item/js/templates/default.js'),
    read('src/smart/list-item/index.js'),
    read('src/smart/list-item/smart.manifest.json').then(JSON.parse),
    read('src/component/dropdown/scss/_css__list-item.scss'),
  ]);

  for (const name of ['supporting', 'interactive', 'sortable-item', 'pinned']) {
    assert.ok(manifest.inputs.properties[name], `manifest declares ${name}`);
  }
  assert.ok(manifest.events['sf-list-item-activate']);
  // An option never becomes a list row: the row parts are off for isOption.
  assert.match(template, /const sortableItem = !isOption && !context\.pinned/);
  assert.match(template, /const roving = !isOption &&/);
  assert.match(template, /data-sf-sortable-item=\$\{sortableItem \|\| nothing\}/);
  // A pinned row keeps the handle slot but carries no handle.
  assert.match(template, /\?data-sf-sortable-handle=\$\{Boolean\(sortableItem\)\}/);
  // A keyboard reorder keeps the arrows; Enter stays the list's on a sortable row.
  assert.match(source, /__sfSortableSharedV1\?\.session/);
  assert.match(source, /!row\.hasAttribute\('data-sf-sortable-item'\)/);
  assert.match(style, /\.sf-list-item\[data-sf-list-roving\]:focus-visible/);
  assert.match(style, /\.sf-list-item--size-3 \{\n  --sf-list-item--padding-bottom: var\(--sf-ui-3--space-y-tightness-default\)/);
});
