import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {MENU_APPEARANCES} from '../src/smart/menu/items.mjs';

// Owner decision C134 (ui-control control/docs-review/decisions.md; study
// control/research/2026-11-13-navigation-density.md D5, Q1): the word compact
// means density only (data-sf-density). Three settings that used it for
// something else are renamed, the old names kept as dated aliases until
// 2027-01-01 and noted in SF.deprecations:
//
//   sf-language compact (boolean)   -> labels="code"
//   sf-menu appearance="compact"    -> appearance="rail"   (class sf-menu--rail)
//   sf-contents layout="compact"    -> layout="sheet"      (class sf-contents--layout-sheet)
//
// sf-segmented spacing="compact" is not renamed: its words are sf-button's
// spacing words, and the whole attribute is already deprecated in favour of
// height until the same date (journal attribute-segmented-spacing-to-height).
// The rendering is probed on built bytes (probe.json checks p4-compact-alias,
// p-rail-alias, p4-sheet-alias); this file holds what the source promises.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const journal = json('contracts/changes/journal.json').records;
const record = (id) => journal.find((entry) => entry.id === id);

test('C134 sf-language: labels name|code replaces the boolean compact, read in code and noted with its dates', () => {
  const manifest = json('src/smart/language/component.json');
  assert.equal(manifest.version, '1.3.0');
  assert.ok(!('compact' in manifest.settings), 'compact leaves the settings');
  assert.deepEqual(manifest.settings.labels.values, ['name', 'code']);
  assert.equal(manifest.settings.labels.default, 'name');
  const source = read('src/smart/language/index.js');
  assert.match(source, /const COMPACT_ALIAS = \{component: 'sf-language', tag: 'sf-language', kind: 'attribute', from: 'compact', to: 'labels="code"', since: '2026-11-13', remove_after: '2027-01-01'\};/u);
  assert.match(source, /if \(own === null && this\.hasAttribute\('compact'\)\) \{/u, 'labels written beside compact wins');
  assert.match(source, /codes: this\.labelsShown === 'code',/u);
  const template = read('src/smart/language/js/templates/default.js');
  assert.match(template, /label: context\.codes \? language\.short : language\.label,/u);
  const entry = record('attribute-language-compact-to-labels-code');
  assert.equal(entry.remove_after, '2027-01-01');
  assert.deepEqual(entry.items, [{component: 'sf-language', from: 'compact', to: 'labels="code"'}]);
});

test('C134 sf-menu: appearance rail, compact a dated value alias; the rail writes both classes and the class sheet draws either', () => {
  const manifest = json('src/smart/menu/component.json');
  // 1.7.1: C134; 1.8.0: the counter's and the text badge's looks (C140).
  assert.match(manifest.version, /^1\.(7\.[1-9]\d*|([8-9]|\d{2,})\.\d+)$/u);
  assert.deepEqual(manifest.settings.appearance.values, ['default', 'documentation-tree', 'rail', 'navigation']);
  assert.deepEqual([...MENU_APPEARANCES], manifest.settings.appearance.values);
  const row = json('src/smart/menu/aliases.json').aliases.find((alias) => alias.kind === 'value' && alias.from === 'compact');
  assert.deepEqual({to: row.to, setting: row.setting, since: row.since, remove_after: row.remove_after}, {to: 'rail', setting: 'appearance', since: '2026-11-13', remove_after: '2027-01-01'});
  const source = read('src/smart/menu/index.js');
  assert.doesNotMatch(source, /appearance === 'compact'/u, 'the element reads the new value only (the shim rewrites the old one)');
  const template = read('src/smart/menu/js/templates/default.js');
  assert.match(template, /context\.appearance === 'rail' \? 'sf-menu--compact' : '',/u);
  const sheet = read('src/component/menu/scss/_css__menu_compact.scss');
  assert.doesNotMatch(sheet, /\.sf-menu\.sf-menu--compact/u);
  assert.equal(sheet.match(/\.sf-menu:is\(\.sf-menu--rail, \.sf-menu--compact\)/gu).length, 12);
  assert.match(read('src/component/menu/scss/_css__menu_element.scss'), /:where\(\.sf-menu:not\(\.sf-menu--rail, \.sf-menu--compact\)\)/u);
  assert.equal(json('src/component/menu/passport.json').version, '1.8.1');
  assert.equal(record('value-menu-appearance-compact-to-rail').rewrite, 'rename-value');
  assert.deepEqual(record('class-menu-compact-to-rail').items, [{component: 'sf-menu', from: 'sf-menu--compact', to: 'sf-menu--rail'}]);
});

test('C134 sf-contents: layout sheet, compact a dated value alias; the sheet writes both classes and the sheet rule draws either', () => {
  const manifest = json('src/smart/contents/component.json');
  // 1.7.0: C134; 1.7.1: the status mark writes icon-only and is tonal (C134, C140).
  assert.match(manifest.version, /^1\.(7\.\d+|([8-9]|\d{2,})\.\d+)$/u);
  assert.deepEqual(manifest.settings.layout.values, ['auto', 'column', 'sheet', 'rail', 'bar']);
  const row = json('src/smart/contents/aliases.json').aliases.find((alias) => alias.kind === 'value' && alias.from === 'compact');
  assert.deepEqual({to: row.to, setting: row.setting, since: row.since, remove_after: row.remove_after}, {to: 'sheet', setting: 'layout', since: '2026-11-13', remove_after: '2027-01-01'});
  const source = read('src/smart/contents/index.js');
  assert.match(source, /import aliases from '\.\/aliases\.json';/u);
  assert.match(source, /source: 'ru',\n {2}aliases,\n/u, 'the element installs its aliases');
  assert.match(source, /if \(this\.layout === 'sheet'\) return true;/u);
  const template = read('src/smart/contents/js/templates/default.js');
  assert.match(template, /layout === 'sheet' \? 'sf-contents--layout-compact' : '',/u);
  const sheet = read('src/smart/contents/scss/_smart__contents.scss');
  assert.match(sheet, /\n:is\(\.sf-contents--layout-sheet, \.sf-contents--layout-compact\) \{\n {2}@include sheet;\n\}/u, 'one class of specificity, as the former rule');
  assert.doesNotMatch(sheet, /@include compact;/u);
  assert.equal(record('value-contents-layout-compact-to-sheet').items[0].to, 'sheet');
});

test('C134 sf-segmented: spacing keeps the button\'s words; the attribute itself is already dated', () => {
  const segmented = json('src/smart/segmented/component.json').settings.spacing;
  const button = json('src/smart/button/component.json').settings.spacing;
  assert.deepEqual(segmented.values, button.values);
  const entry = record('attribute-segmented-spacing-to-height');
  assert.equal(entry.remove_after, '2027-01-01');
});
