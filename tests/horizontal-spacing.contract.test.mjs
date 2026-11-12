import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* Horizontal spacing (owner decision C105, research
   ui-control/control/research/2026-11-12-horizontal-spacing.md): six roles on
   existing tokens, no new variable names. These tests hold the mechanism of
   each role in the sheets that draw it, and the role table in the geometry
   standard; the acceptance probe measures the result. */

test('C105 standard: the geometry standard carries the six roles and the C103 rung rule', async () => {
  const doc = await read('docs/foundation-composition-geometry.md');
  for (const [role, token] of [
    ['H1', '--sf-ui-S--text-space-x'],
    ['H2', '--sf-space-1/2'],
    ['H3', '--sf-space-1/4'],
    ['H4', 'C77'],
    ['H5', '--sf-space-1/3'],
    ['H6', '--sf-space-1'],
  ]) {
    const row = doc.split('\n').find((line) => line.startsWith(`| ${role} |`));
    assert.ok(row, `the role table has a row for ${role}`);
    assert.ok(row.includes(token), `${role} names ${token}`);
  }
  assert.match(doc, /## \d+\. One row, one rung \(C103\)/u);
  assert.match(doc, /text 1\/2 .*size="1\/2"/u);
  assert.match(doc, /never uses a layout utility/iu);
});

test('C105 H1: a control keeps the button\'s picture-to-label step', async () => {
  const sheet = await read('src/component/buttons/scss/_css__buttons.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(sheet.includes(`--sf-button-text-container--padding-inline-start: var(--sf-ui-${size}--text-space-x);`), `sf-button size ${size}`);
  }
});

test('C105 H2 (HS-1, HS-5): a list row\'s picture stands --sf-space-1/2 before its text, set by the sheet, not by a layout class', async () => {
  const template = await read('src/smart/list-item/js/templates/default.js');
  assert.doesNotMatch(template, /"gap-\d/u, 'the row template carries no gap utility');
  const sheet = await read('src/component/dropdown/scss/_css__list-item.scss');
  assert.match(sheet, /\.sf-list-item:is\(\.sf-list-item--icon, \.sf-list-item--checkbox, \.sf-list-item--avatar, \.sf-list-item--color\) \.sf-list-item-wrap \{\n {2}column-gap: var\(--sf-space-1\\\/2\);\n\}/u);
  assert.match(sheet, /\.sf-list-item:is\(\.sf-list-item--icon, \.sf-list-item--checkbox\) \.sf-list-item-wrap \.sf-list-item-container \{\n {2}--sf-list-item-container--padding-inline-start: 0;\n\}/u);
  // after the per-size rules that set the same variable at the same weight
  assert.ok(sheet.indexOf('column-gap: var(--sf-space-1\\/2);') > sheet.lastIndexOf('--sf-list-item-container--padding-inline-start: var(--sf-ui-'),
    'the H2 rule follows the per-size text inset');
  const list = await read('src/smart/list/js/templates/default.css');
  assert.match(list, /\.sf-list-item--text \.sf-list__meta \{ padding-inline-start: var\(--sf-space-1\\\/2\); \}/u, 'the least gap before a text row\'s meta is H2');
  assert.doesNotMatch(list, /--sf-list--text-step/u, 'a narrow meta stands on the title\'s first letter');
});

test('C105 H2: the dropdown options and the alert keep --sf-space-1/2', async () => {
  const custom = await read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(custom, /\.sf-dropdown \.sf-list \.sf-list-item \.sf-list-item-wrap,\n\.sf-list--menu \.sf-list-item \.sf-list-item-wrap \{\n {2}gap: var\(--sf-space-1\\\/2\);/u);
  const alert = await read('src/component/alerts/scss/_css__alerts.scss');
  assert.ok(alert.includes('gap: var(--sf-alert-gap, var(--sf-alert--gap, var(--sf-space-1\\/2)));'));
});

test('C105 H2 (HS-6, NI-9): the menu row gap is --sf-space-1/2 and is set only through the wrap\'s variable the indent reads', async () => {
  const sheet = await read('src/component/menu/scss/_css__menu_element.scss');
  assert.ok(sheet.includes('gap: var(--sf-menu-element-wrap--gap, var(--sf-space-1\\/2));'));
  assert.doesNotMatch(sheet, /--sf-menu-element-wrap--gap, var\(--sf-space-1\\\/3\)/u, 'no reader keeps the old default');
  for (const level of [1, 2, 3]) {
    assert.ok(sheet.includes(`.sf-menu-item:has(> .sf-menu-element--level-${level} .sf-menu-element-icon) {\n    --sf-menu--step-${level}: calc(var(--sf-menu-element--line-height, var(--sf-text-height-1)) + var(--sf-menu-element-wrap--gap, var(--sf-space-1\\/2)));`),
      `an icon row of level ${level} steps its children by its icon and the wrap gap`);
  }
});

test('C105 / C109 (NI-7): a menu child\'s first column stands under its parent\'s words on every level', async () => {
  const sheet = await read('src/component/menu/scss/_css__menu_element.scss');
  const start = (level) => new RegExp(`\\.sf-menu-element--level-${level} \\{\\n {4}--sf-menu-element--padding-inline-start: ([^;]+);`, 'u').exec(sheet)?.[1];
  assert.equal(start(1), 'var(--sf-menu--row-padding, var(--sf-space-1))');
  assert.equal(start(2), 'calc(var(--sf-menu--row-padding, var(--sf-space-1)) + var(--sf-menu--step-1, var(--sf-space-1)))');
  assert.equal(start(3), 'calc(var(--sf-menu--row-padding, var(--sf-space-1)) + var(--sf-menu--step-1, var(--sf-space-1)) + var(--sf-menu--step-2, var(--sf-space-1)))');
  assert.equal(start(4), 'calc(var(--sf-menu--row-padding, var(--sf-space-1)) + var(--sf-menu--step-1, var(--sf-space-1)) + var(--sf-menu--step-2, var(--sf-space-1)) + var(--sf-menu--step-3, var(--sf-space-1)))');
  for (const level of [1, 2, 3]) {
    assert.ok(sheet.includes(`.sf-menu-item:has(> .sf-menu-element--level-${level}) { --sf-menu--step-${level}: var(--sf-space-1); }`), `a words-only row of level ${level} steps by space-1 (C109 (2))`);
  }
  assert.doesNotMatch(sheet, /> \.sf-menu > \.sf-menu-item > \.sf-menu-element--level-2/u, 'the level-2-only C30 rule is gone');
});

test('C105 H2: a row without a picture among rows with one keeps the picture\'s place', async () => {
  const source = await read('src/smart/list/index.js');
  assert.match(source, /if \(this\._items\.some\(icon\) && !this\._items\.every\(icon\)\) return \{wide: false\};/u);
});

test('C105 H3: a picture inside running text stands --sf-space-1/4 from it', async () => {
  const sheet = await read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss');
  assert.ok(sheet.includes('--sf-breadcrumbs-item-container--gap: var(--sf-space-1\\/4);'));
});

test('C105 H4 (C77, HS-3, HS-4): a framed sf-list is a 4 plate and the C77 row inset; its group heading stands over the row pictures', async () => {
  const list = await read('src/smart/list/js/templates/default.css');
  assert.match(list, /--sf-list--padding-left: var\(--sf-space-1\\\/4\);/u);
  assert.match(list, /--sf-list--padding-right: var\(--sf-space-1\\\/4\);/u);
  assert.match(list, /\.sf-list__frame\.sf-list--size-1 \{ --sf-list--inset: var\(--sf-space-1\); \}/u);
  assert.match(list, /\.sf-list__frame\.sf-list--size-2 \{ --sf-list--inset: var\(--sf-space-2\); \}/u);
  assert.match(list, /\.sf-list__frame\.sf-list--size-1\\\/2 \{ --sf-list--inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\); \}/u);
  assert.match(list, /--sf-list--text-inset: calc\(var\(--sf-list--inset\) - var\(--sf-space-1\\\/4\) - var\(--sf-list--edge\)\);/u);
  // the heading's words: the plate, the frame's edge and the row's text inset = the rows' picture
  assert.match(list, /\.sf-list__group > \.sf-list__heading \{\n {4}margin-block-start: 0;\n {4}padding-inline: var\(--sf-list--text-inset\);/u);
  const menu = await read('src/component/menu/scss/_css__menu.scss');
  assert.match(menu, /--sf-menu--inset: var\(--sf-space-1\\\/4\);/u, 'the menu column has the same 4 plate');
});

test('C105 H5: tags in a field stand --sf-space-1/4 apart', async () => {
  const lookup = await read('src/smart/input-lookup/scss/_smart__lookup.scss');
  assert.ok(lookup.includes('gap: var(--sf-lookup--chip-row-gap) var(--sf-space-1\\/4);'));
});

test.todo('C105 H5: tabs abut and buttons of one group stand --sf-space-1/3 apart (tabs C99 / HS-10 and docs examples HS-13 are not on this branch)');

test('C105 H6: a table cell and a card hold their own inset', async () => {
  const frame = await read('src/utility/table-frame/default/scss/_sf_css__table_frame.scss');
  assert.ok(frame.includes('--sf-table-frame-cell-padding-inline: var(--sf-space-1);'));
  const card = await read('src/component/card/scss/_css__card.scss');
  assert.match(card, /padding-inline: var\(--sf-card-padding-inline, /u);
});

test('C105 HS-14: a picture in a table cell or a card row follows H2 through the documented pattern', async () => {
  const doc = await read('docs/foundation-composition-geometry.md');
  assert.ok(doc.includes('<span class="inline-flex items-cross-center gap-1/2">'), 'the cell and card pattern uses the H2 gap utility');
});
