// sf-contents 1.6.0 and sf-badge 1.5.0: owner decision C95 (2026-11-12) over
// the R181 study (ui-control control/research/2026-11-12-contents.md, prototype
// prototypes/contents-study.html), defects CT-01, CT-02, CT-06, CT-07, CT-08,
// CT-11 and CT-12. One test per point; measured on the built bytes by
// ui-control evidence 2026-11-12-contents-c95 (group build).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {currentBranch} from '../src/smart/contents/js/templates/default.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/contents/index.js');
const template = read('src/smart/contents/js/templates/default.js');
const sheet = read('src/smart/contents/scss/_smart__contents.scss');
const manifest = JSON.parse(read('src/smart/contents/component.json'));
const generated = JSON.parse(read('src/smart/contents/smart.manifest.json'));
const ru = JSON.parse(read('src/smart/contents/lang/ru.json'));
const en = JSON.parse(read('src/smart/contents/lang/en.json'));
const variables = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));
const badgeSheet = read('src/component/badges/scss/_css__badges.scss');
const badge = JSON.parse(read('src/smart/badge/component.json'));
const badgeSource = read('src/smart/badge/index.js');
const method = (name, next) => source.slice(source.indexOf(`  ${name}`), source.indexOf(`  ${next}`));

test('C95 versions: contents 1.6.x or later (1.6.1: HS-12; 1.7.x: C134), sf-badge 1.5.0 or later (1.6.0: icon-only, C134), component.badges 1.6.0 or later (1.7.x: C132; 1.8.0: icon-only, BG-9)', () => {
  assert.match(manifest.version, /^1\.([6-9]|\d{2,})\.\d+$/u);
  assert.equal(generated.version, manifest.version);
  assert.match(badge.version, /^1\.([5-9]|\d{2,})\.\d+$/u);
  assert.match(JSON.parse(read('src/component/badges/passport.json')).version, /^1\.([7-9]|\d{2,})\.\d+$/u);
});

test('C95.1 CT-01: line="own|edge|none"; edge draws no line and keeps the mark on the edge', () => {
  assert.deepEqual(manifest.settings.line.values, ['own', 'edge', 'none']);
  assert.equal(manifest.settings.line.default, 'own');
  assert.match(template, /line !== 'own' \? `sf-contents--line-\$\{line\}` : ''/u);
  // The column: no ::after for edge and none; none hides the mark too.
  assert.match(sheet, /&\.sf-contents--line-edge \.sf-contents-list::after,\s*&\.sf-contents--line-none \.sf-contents-list::after \{\s*content: none;/u);
  assert.match(sheet, /&\.sf-contents--line-none \.sf-contents-mark \{\s*display: none;/u);
  // The mark stays on the inline-start edge (inset 0), 2 px.
  assert.match(sheet, /\.sf-contents-mark \{\s*position: absolute;\s*z-index: 1;\s*inset-block: var\(--sf-0\);\s*inset-inline-start: var\(--sf-0\);\s*display: block;\s*inline-size: var\(--sf-a2\);/u);
  // The bar: edge and none drop the element's own bottom edge.
  assert.match(sheet, /&:is\(\.sf-contents--line-edge, \.sf-contents--line-none\) \.sf-contents-list \{\s*border-block-end: none;/u);
});

test('C95.1 CT-02: --sf-contents-inset-inline is public and is the text\'s inset in the column', () => {
  assert.ok(manifest['css-variables']['--sf-contents-inset-inline']);
  assert.match(JSON.stringify(variables), /"name":"--sf-contents-inset-inline"/u);
  // Its default is the size's value inset since 1.6.1 (C77 HS-12).
  assert.match(sheet, /--sf-contents--inset: var\(--sf-contents-inset-inline, var\(--sf-contents--value-inset\)\);/u);
  assert.equal((sheet.match(/padding-inline: var\(--sf-contents--inset\) var\(--sf-space-1\\\/2\);/gu) ?? []).length, 2, 'heading and links');
});

test('C95.2 CT-06: the current text is on-surface medium; primary only on the line', () => {
  assert.match(sheet, /\.sf-contents-link\[aria-current="location"\] \{\s*color: var\(--sf-on-surface\);\s*font-weight: var\(--sf-font-weight-medium\);/u);
  assert.doesNotMatch(sheet, /\[aria-current="location"\] \{\s*color: var\(--sf-contents--current\)/u);
  assert.doesNotMatch(sheet, /background-color: var\(--sf-primary-container\)/u, 'no fill in the compact list');
  assert.ok(journal.records.some((one) => one.id === 'behaviour-contents-current-line-only'));
});

test('C95.3 CT-11: expand="all|current", the current branch only', () => {
  assert.deepEqual(manifest.settings.expand.values, ['all', 'current']);
  assert.equal(manifest.settings.expand.default, 'all');
  const sections = [
    {id: 'a', level: 2}, {id: 'a1', level: 3}, {id: 'b', level: 2}, {id: 'b1', level: 3}, {id: 'b2', level: 4}, {id: 'c', level: 2},
  ];
  assert.deepEqual([...currentBranch(sections, 'b1')], ['b', 'b1', 'b2']);
  assert.deepEqual([...currentBranch(sections, 'b')], ['b', 'b1', 'b2']);
  assert.deepEqual([...currentBranch(sections, '')], ['a', 'a1']);
  assert.deepEqual([...currentBranch(sections, 'c')], ['c']);
  assert.match(sheet, /\.sf-contents--expand-current:not\(\.sf-contents--layout-rail\):not\(\.sf-contents--layout-bar\) \.sf-contents-folded \{\s*display: none;/u);
});

test('C95.4 CT-08: a bottom sheet below md, a veil, the current link focused on open', () => {
  assert.match(sheet, /@media not all and \(min-width: 44rem\) \{[^]*?&\.sf-contents--open \.sf-contents-list \{\s*position: fixed;[^]*?inset: auto var\(--sf-0\) var\(--sf-0\);[^]*?max-inline-size: var\(--sf-h1\);/u);
  assert.match(sheet, /&\.sf-contents--open \.sf-contents-veil \{\s*position: fixed;/u);
  assert.ok(template.indexOf('sf-contents-veil') < template.indexOf('<ol class="sf-contents-list"'), 'the veil before the list');
  assert.match(source, /if \(this\.compact\) this\._focusCurrent = true;/u);
  assert.match(method('focusCurrent() {', 'closeList('), /querySelector\('\[aria-current="location"\]'\)/u);
  assert.match(sheet, /@media \(pointer: coarse\) \{[^]*?min-block-size: max\(var\(--sf-contents--control-height\), var\(--sf-d1\)\);/u);
});

test('C95.4 CT-12: the reading line on the button\'s bottom edge, no plate below', () => {
  assert.match(sheet, /padding-block: var\(--sf-space-1\\\/4\) var\(--sf-0\);\s*margin-block: calc\(var\(--sf-space-1\\\/4\) \* -1\) var\(--sf-0\);/u);
  assert.match(sheet, /\.sf-contents-progress \{\s*position: absolute;\s*inset-inline: var\(--sf-radius--ui\);\s*inset-block-end: var\(--sf-px\);/u);
});

test('C95.5: «На этой странице» by default; long names wrap, the rail chips too', () => {
  assert.equal(ru.runtime.label, 'На этой странице');
  assert.equal(en.runtime.label, 'On this page');
  assert.match(sheet, /inline-size: max-content;\s*max-inline-size: var\(--sf-f2\);/u);
  assert.doesNotMatch(sheet, /box-shadow: var\(--sf-shadow-overlay\);\s*white-space: nowrap;/u);
});

test('C95.6 CT-07: count and status on an entry, a badge on the text\'s line, the first invalid field', () => {
  assert.equal(manifest.settings.items.of.count.type, 'number');
  assert.equal(manifest.settings.items.of.status.type, 'string');
  assert.ok(manifest.relations.some((one) => one.name === 'cl-badge'));
  assert.match(template, /<sf-badge class="sf-contents-count" line="text"/u);
  assert.match(template, /aria-label=\$\{marked \? component\.markedName\(section\.text, \{count, status\}\) : nothing\}/u);
  assert.deepEqual(ru.runtime['count-error'], {one: '{n} ошибка', few: '{n} ошибки', many: '{n} ошибок', other: '{n} ошибки'});
  const jump = method('jumpTo(id, event = null) {', 'get canOpen()');
  assert.match(jump, /section\?\.status === 'error' \? this\.firstInvalid\(section\) : null/u);
  assert.match(jump, /field\.focus\(\{preventScroll: true\}\);/u);
  assert.match(source, /const INVALID = '\[invalid\]:not\(\[invalid="false"\]\), \[aria-invalid="true"\], :user-invalid';/u);
});

test('sf-badge line="text": the text\'s line high, its size, no block padding', () => {
  assert.ok(badge.settings.line.values.includes('text'));
  assert.match(badgeSource, /if \(line === 'text'\) return 'text';/u);
  const rule = badgeSheet.slice(badgeSheet.indexOf('.sf-badge.sf-badge--line-text {'));
  assert.match(rule, /--sf-badge--line-height: 1lh;/u);
  assert.match(rule, /--sf-badge--padding-block: var\(--sf-badge-padding-block, calc\(var\(--sf-px\) \* 0\)\);/u);
  assert.match(rule, /font-size: inherit;\s*vertical-align: top;/u);
  assert.match(rule, /\.sf-badge\.sf-badge--line-text \.sf-badge-text \{\s*font-size: inherit;\s*line-height: inherit;/u);
});
