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

test('NI-2: a level step is never narrower than the chevron slot', async () => {
  const tree = await read('src/component/tree/scss/_css__tree.scss');
  assert.match(tree, /--sf-tree--indent: var\(--sf-tree-indent, var\(--sf-tree-item--nested-padding-inline-start, max\(var\(--sf-space-3\), var\(--sf-icon-size-3\)\)\)\);/u);
  // Both the flat rows and a nested group step by it.
  assert.match(tree, /margin-inline-start: calc\(\(var\(--sf-tree-level, 1\) - 1\) \* var\(--sf-tree--indent\)\);/u);
  assert.match(tree, /\.sf-tree > \.sf-tree-item \.sf-tree-group \{\s*padding-inline-start: var\(--sf-tree--indent\);/u);
  assert.doesNotMatch(tree, /var\(--sf-tree-indent, var\(--sf-tree-item--nested-padding-inline-start, var\(--sf-space-3\)\)\)/u);
});

test('NI-3: the gap between a row\'s parts has one owner, the tree-item sheet', async () => {
  const [tree, item] = await Promise.all([
    read('src/component/tree/scss/_css__tree.scss'),
    read('src/component/tree-item/scss/_css__tree_item.scss'),
  ]);
  const container = tree.match(/\n  \.sf-tree \.sf-tree-item-container \{([\s\S]*?)\n  \}/u)[1];
  assert.doesNotMatch(container.replace(/\/\*[\s\S]*?\*\//gu, ''), /(^|\s)gap:/u);
  assert.doesNotMatch(tree, /--sf-tree-item--container-gap/u);
  assert.match(item, /\.sf-tree-item \.sf-tree-item-container \{\s*gap: var\(--sf-tree-item-gap, var\(--sf-tree-item-container--gap, var\(--sf-space-1\\\/3\)\)\);/u);
});

// core file-types is plain JavaScript over a JSON map; node reads the map as
// a module here the way the bundler does.
async function fileTypes() {
  const {registerHooks} = await import('node:module');
  const {readFileSync} = await import('node:fs');
  if (!globalThis.__treeC102JsonHook) {
    globalThis.__treeC102JsonHook = true;
    registerHooks({
      load(url, context, next) {
        if (url.endsWith('/file-types/file-types.json')) {
          return {format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')};`, shortCircuit: true};
        }
        return next(url, context);
      },
    });
  }
  return import('../src/core/js/file-types/index.js');
}

test('C102 1-3: one map of kinds, extensions and icons in core (module.file-types)', async () => {
  const map = await json('src/core/js/file-types/file-types.json');
  const passport = await json('src/core/passports/module.file-types.json');
  const {FILE_KINDS, fileKindOfName, fileType} = await fileTypes();
  // Twelve words.
  assert.deepEqual(FILE_KINDS, ['folder', 'file', 'page', 'document', 'image', 'code', 'data', 'table', 'archive', 'video', 'audio', 'link']);
  assert.equal(map.kinds.folder['open-icon'], 'folder_open');
  assert.equal(passport.id, 'module.file-types');
  assert.deepEqual(passport.includes, ['src/core/js/file-types/']);
  // An extension says its kind; no extension says nothing.
  assert.equal(fileKindOfName('Смета.xlsx'), 'table');
  assert.equal(fileKindOfName('simai-framework.lock.json'), 'data');
  assert.equal(fileKindOfName('Заметка'), '');
  // Who chooses: icon → kind → extension → folder / file.
  assert.deepEqual(fileType({name: 'Договор.pdf'}), {kind: 'document', icon: 'description'});
  assert.deepEqual(fileType({name: 'Заметка'}), {kind: 'file', icon: 'draft'});
  assert.deepEqual(fileType({name: 'Документы', folder: true}), {kind: 'folder', icon: 'folder'});
  assert.deepEqual(fileType({name: 'Документы', folder: true, open: true}), {kind: 'folder', icon: 'folder_open'});
  assert.deepEqual(fileType({name: 'Раздел.pdf', kind: 'page', folder: true}), {kind: 'page', icon: 'article'});
  assert.deepEqual(fileType({name: 'Отчёт.pdf', kind: 'file'}), {kind: 'document', icon: 'description'});
  assert.deepEqual(fileType({name: 'Корзина', icon: 'delete', folder: true}), {kind: 'folder', icon: 'delete'});
  assert.equal(fileType({name: 'a.png', icon: false}).icon, '');
  assert.equal(fileType({name: 'Смета.xlsx', byName: false}).icon, 'draft');
  assert.equal(fileType({name: 'x', kind: 'nonsense'}).icon, 'draft');
});

test('C102 1-2, 4: sf-tree takes the kinds, icon names and the icons / file-types settings', async () => {
  const [tree, item, source, row, itemSource, nodeData] = await Promise.all([
    json('src/smart/tree/component.json'),
    json('src/smart/tree-item/component.json'),
    read('src/smart/tree/index.js'),
    read('src/smart/tree-item/js/templates/row.js'),
    read('src/smart/tree-item/index.js'),
    read('src/smart/tree-item/js/node-data.js'),
  ]);
  const KINDS = ['folder', 'file', 'page', 'document', 'image', 'code', 'data', 'table', 'archive', 'video', 'audio', 'link'];
  assert.deepEqual(tree.settings.items.of.kind.values, KINDS);
  assert.deepEqual(item.settings.kind.values, KINDS);
  // No default kind: the place says it (no children = leaf unless folder).
  assert.equal(item.settings.kind.default, '');
  assert.match(source, /kind: fileKind\(item\.kind \|\| item\.type\),/u);
  assert.doesNotMatch(source, /=== 'file' \? 'file' : 'folder'/u);
  assert.match(source, /const isFolder = \(entry\) => isBranch\(entry\) \|\| entry\.kind === 'folder';/u);
  // icon is a name or false.
  assert.equal(item.settings.icon.type, 'string');
  assert.deepEqual(tree.settings.items.of.icon.anyOf.map((one) => one.type), ['icon', 'boolean']);
  assert.match(nodeData, /if \(value === 'false'\) return false;/u);
  // The tree's settings.
  assert.deepEqual(tree.settings.icons.values, ['all', 'branches', 'none']);
  assert.equal(tree.settings.icons.default, 'all');
  assert.deepEqual(tree.settings['file-types'].values, ['name', 'none']);
  assert.equal(tree.settings['file-types'].default, 'name');
  assert.match(source, /if \(mode === 'none'\) return '';\n\s+if \(mode === 'branches' && !\(branch \|\| entry\.kind === 'folder'\)\) return '';/u);
  assert.match(source, /byName: this\.fileTypes !== 'none',/u);
  // The row draws the icon its caller chose; the item chooses with the same map.
  assert.match(row, /const nodeIcon = row\.more \? 'more_horiz' : row\.nodeIcon;/u);
  assert.doesNotMatch(row, /isFile \? 'draft'/u);
  assert.match(itemSource, /return fileType\(\{icon: icon === false \? false : icon \|\| custom \|\| '', kind: this\.kind, name: this\.label, folder, open\}\)\.icon;/u);
  // C102 4 (toggle): chevron + icon, the chevron alone with icons none, none in a static tree.
  assert.match(row, /\$\{canToggle\s*\? html`<button type="button" tabindex="-1" class="sf-icon-button sf-tree-toggle"/u);
});

test('C102 5 (§7 item 7): static, list semantics and the .sf-tree--static class markup', async () => {
  const [tree, source, template, sheet, classTree] = await Promise.all([
    json('src/smart/tree/component.json'),
    read('src/smart/tree/index.js'),
    read('src/smart/tree/js/templates/default.js'),
    read('src/component/tree/scss/_css__tree.scss'),
    read('src/component/tree/js/_tree.js'),
  ]);
  assert.equal(tree.settings.static.type, 'boolean');
  assert.equal(tree.settings.static.default, false);
  assert.match(source, /return this\.static \? renderStaticTreeTemplate\(context\) : renderTreeTemplate\(context\);/u);
  // A nested ul/li list, not role tree; no tab stop, no chevron.
  const staticPart = template.slice(template.indexOf('function renderStaticNode'));
  assert.match(staticPart, /<ul class="sf-tree-group" role="list">/u);
  assert.match(staticPart, /'sf-tree sf-tree--static flex flex-col'/u);
  assert.doesNotMatch(staticPart, /role="tree|tabindex|sf-tree-toggle/u);
  // note, mark, more.
  assert.match(staticPart, /entry\.note \? html`<span class="sf-tree-item-note">/u);
  assert.match(staticPart, /entry\.mark \? 'sf-tree-item--mark'/u);
  assert.match(staticPart, /const icon = entry\.more \? 'more_horiz' : node\.nodeIcon;/u);
  // Text-height rows in the code face, no pointer, no hover.
  assert.match(sheet, /\.sf-tree\.sf-tree--static \.sf-tree-item > \.sf-tree-item-container \{[^}]*min-block-size: var\(--sf-text-height-1\);[^}]*cursor: auto;/u);
  assert.match(sheet, /\.sf-tree\.sf-tree--static \.sf-tree-item \.sf-tree-item-name \{[^}]*font-family: var\(--sf-code-font-family, var\(--sf-mono\)\);/u);
  assert.match(sheet, /\.sf-tree:not\(\.sf-tree--static\) \.sf-tree-item:not\(\[aria-disabled='true'\]\):hover > \.sf-tree-item-container/u);
  // The class tree leaves static markup alone.
  assert.match(classTree, /isSmartTreeRoot\(root\) \|\|\n\s+isStaticTree\(root\)/u);
  // A static tree is never windowed.
  assert.match(source, /return !this\.static && this\._rows\.length > WINDOW_FROM;/u);
});

test('C102 6: a lazy branch shows «Загрузка…», an error row with retry', async () => {
  const [tree, source, ru, en] = await Promise.all([
    json('src/smart/tree/component.json'),
    read('src/smart/tree/index.js'),
    json('src/smart/tree/lang/ru.json'),
    json('src/smart/tree/lang/en.json'),
  ]);
  assert.equal(tree.settings.items.of.error.type, 'boolean');
  assert.deepEqual(tree.events.retry.carries, {id: 'id', value: 'string'});
  assert.equal(ru.runtime.loading, 'Загрузка…');
  assert.equal(ru.runtime['load-error'], 'Не удалось загрузить');
  assert.equal(ru.runtime.retry, 'Повторить');
  assert.ok(en.runtime.loading && en.runtime['load-error'] && en.runtime.retry);
  assert.match(source, /if \(open && !entry\.childIds\.length && entry\.hasChildren\) \{\n\s+const placeholder = entry\.error && !this\._retrying\.has\(id\) \? 'error' : 'loading';/u);
  assert.match(source, /this\.sfEmit\('retry', \{id: entry\.id, value: entry\.value\}\);/u);
  assert.match(source, /createInlineSpinner\(\{className: 'sf-tree-item-spinner-ring'\}\)/u);
  assert.ok(tree.relations.some((relation) => relation.name === 'spinner' && relation.lazy === true));
});

test('C102 7 (§7 item 9): selection="check", aria-checked with mixed, cascade', async () => {
  const [tree, source, row, template] = await Promise.all([
    json('src/smart/tree/component.json'),
    read('src/smart/tree/index.js'),
    read('src/smart/tree-item/js/templates/row.js'),
    read('src/smart/tree/js/templates/default.js'),
  ]);
  assert.deepEqual(tree.settings.selection.values, ['none', 'one', 'many', 'check']);
  assert.ok(tree.relations.some((relation) => relation.name === 'checkbox'));
  // aria-checked instead of aria-selected; multiselectable.
  assert.match(row, /aria-selected=\$\{row\.selection === 'none' \|\| row\.check \? nothing : String\(Boolean\(row\.selected\)\)\}\n\s+aria-checked=\$\{checked\}/u);
  assert.match(template, /aria-multiselectable=\$\{context\.selection === 'many' \|\| context\.selection === 'check' \? 'true' : nothing\}/u);
  // The checkbox's own class markup, its mark check / remove.
  assert.match(row, /class="sf-checkbox sf-checkbox--size-1 sf-tree-check flex" aria-hidden="true"/u);
  assert.match(row, /\$\{mixed \? 'remove' : on \? 'check' : ''\}/u);
  // A branch is its children: all, none or mixed; a press cascades.
  assert.match(source, /function branchCheck\(states\) \{\n\s+if \(states\.every\(\(state\) => state === 'true'\)\) return 'true';\n\s+return states\.some\(\(state\) => state !== 'false'\) \? 'mixed' : 'false';/u);
  assert.match(source, /const mark = \(id\) => \{\n\s+states\.set\(id, on \? 'true' : 'false'\);\n\s+for \(const child of this\._entries\.get\(id\)\.childIds\) mark\(child\);/u);
});

test('C102 8 and §7 items 7-8: page tree, note, mark, more, hidden', async () => {
  const [tree, row, sheet, ru] = await Promise.all([
    json('src/smart/tree/component.json'),
    read('src/smart/tree-item/js/templates/row.js'),
    read('src/component/tree/scss/_css__tree.scss'),
    json('src/smart/tree/lang/ru.json'),
  ]);
  for (const [field, type] of [['note', 'string'], ['mark', 'boolean'], ['more', 'boolean'], ['hidden', 'boolean']]) {
    assert.equal(tree.settings.items.of[field].type, type, field);
  }
  assert.equal(ru.runtime.hidden, 'скрыта');
  assert.match(row, /row\.pageHidden && row\.hiddenWord\n\s+\? html`<span class="sf-tree-item-note sf-tree-item-hidden-word">/u);
  assert.match(sheet, /\.sf-tree \.sf-tree-item--hidden > \.sf-tree-item-container > \.sf-tree-item-name \{\s*color: var\(--sf-on-surface-variant\);/u);
  assert.match(sheet, /\.sf-tree \.sf-tree-item-note \{[^}]*color: var\(--sf-on-surface-variant\);[^}]*font-variant-numeric: tabular-nums;/u);
});

test('C102 §7 items 10-11: * and expand-all / collapse-all; reorder', async () => {
  const [tree, source, sheet] = await Promise.all([
    json('src/smart/tree/component.json'),
    read('src/smart/tree/index.js'),
    read('src/component/tree/scss/_css__tree.scss'),
  ]);
  assert.ok(tree.actions['expand-all'] && tree.actions['collapse-all']);
  assert.equal(tree.keyboard.row['*'], 'open');
  assert.equal(tree.accessibility.keys['*'].effect, 'open');
  assert.match(source, /case '\*': \{/u);
  assert.equal(tree.settings.reorder.type, 'boolean');
  assert.equal(tree.events.move.carries.parent.nullable, true);
  assert.match(source, /this\.sfEmit\('move', \{ids: \[id\], parent: place\.parent, before: place\.before, source: null\}\);/u);
  // Never into itself or anything under it.
  assert.match(source, /if \(id === dragged\.id\) return null;/u);
  for (const position of ['before', 'after']) assert.match(sheet, new RegExp(`data-sf-drop-position='${position}'\\] > \\.sf-tree-item-container::before`, 'u'));
  assert.match(source, /if \(node && \(!position \|\| position === 'inside'\)\) node\.setAttribute\('data-sf-drop-target', ''\);/u);
});

test('C102 §7 item 12: a long name stays one line with a tooltip (TR-14, still there)', async () => {
  const [sheet, source] = await Promise.all([
    read('src/smart/tree/js/templates/default.css'),
    read('src/smart/tree/index.js'),
  ]);
  assert.match(sheet, /sf-tree > \.sf-tree:not\(\.sf-tree--static\) \.sf-tree-item-name \{[^}]*text-overflow: ellipsis;/u);
  assert.match(source, /const cut = name\.scrollWidth - name\.clientWidth > 0\.5;/u);
});
