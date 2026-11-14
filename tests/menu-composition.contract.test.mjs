import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* Measured before: a navigation menu row was 42px (38 on mobile) against a
   40px size 1 control, and a context menu's items sat 3px right of a dropdown
   list's of the same size. tests/browser/panel-composition.cli.js measures. */
test('menu composition: a menu row gives up its border', async () => {
  const css = await read('component/menu/scss/_css__menu_element.scss');
  // The block padding, top and bottom, and (C30) the split row's disclosure
  // button stretching over that same padding.
  assert.equal((css.match(/calc\(\(var\(--sf-ui-1--control-height\) - var\(--sf-text-height-1\)\) \/ 2 - var\(--sf-menu-element--border-width\)\)/g) || []).length, 4);
});

test('menu composition: a context menu publishes its axis and its items take it', async () => {
  const css = await read('component/context-menu/scss/_css__context_menu_custom.scss');
  for (const size of ['1\\/2', '1', '2']) {
    // A row's padding at every size (owner C05, R029): the item's content
    // --sf-space-1/2 inside its highlight, not on a field's axis.
    assert.ok(css.includes(`--sf-context-menu--item-inset-start-${size}: var(--sf-context-menu--row-padding);`), size);
    assert.ok(css.includes(`--sf-context-menu--label-inset-${size}: calc(var(--sf-context-menu--item-inset-start-${size}) + var(--sf-ui-${size}--text-space-x));`), size);
    assert.ok(css.includes(`.sf-context-menu .sf-context-menu-content > .sf-button.sf-button--size-${size},\n.sf-context-menu .sf-context-menu-content > sf-button > .sf-button.sf-button--size-${size} {\n  --sf-button--padding-inline-start: var(--sf-context-menu--item-inset-start-${size});\n  --sf-button--padding-inline-end: var(--sf-context-menu--item-inset-end-${size});`), size);
  }
});

test('menu composition: a context menu item is a start-aligned row whatever its markup', async () => {
  const css = await read('component/context-menu/scss/_css__context_menu_custom.scss');
  assert.match(css, /\.sf-context-menu \.sf-context-menu-content > \.sf-button,\s*\.sf-context-menu \.sf-context-menu-content > sf-button > \.sf-button \{\s*display: flex;\s*align-items: center;\s*justify-content: flex-start;\s*text-align: start;/);
});

/* R219 (C01, C18, C103, C15): measured before, the documentation sidebar's
   split chevron drew a 28 x 48 plate, the stretched box's. Under a fine
   pointer the plate is a square of the row's step, centred on the row, drawn
   by the button's ::before; the box keeps the row's height (the press
   target), and the touch rules stay the coarse pointer's. */
test('menu composition: a split row chevron draws a square plate under a fine pointer', async () => {
  const css = await read('component/menu/scss/_css__menu_element.scss');
  const fine = css.slice(css.indexOf('@media not (pointer: coarse) {'));
  assert.ok(fine.length < css.length, 'the fine-pointer block');
  assert.ok(fine.includes('--sf-menu--split-plate: var(--sf-ui-1--control-height);'));
  assert.ok(fine.includes('inline-size: var(--sf-menu--split-plate);'));
  assert.ok(fine.includes('background-color: var(--sf-transparent);'));
  const plate = fine.slice(fine.indexOf('.sf-menu-element > button.sf-icon-button::before {'));
  const body = plate.slice(0, plate.indexOf('}'));
  assert.ok(body.includes('block-size: min(100% + 2 * var(--sf-menu-element--border-width, calc(var(--sf-px) * 0)), var(--sf-menu--split-plate));'));
  assert.ok(body.includes('aspect-ratio: 1;'));
  assert.ok(body.includes('background-color: var(--sf-icon-button--background-color, var(--sf-transparent));'));
  assert.ok(body.includes('border-radius: inherit;'));
  assert.ok(body.includes('pointer-events: none;'));
  // The stretch that gives the box the row's height is not touched.
  assert.match(css, /\.sf-menu-element > button\.sf-icon-button \{\s*align-self: stretch;\s*block-size: auto;/);
  // The focus ring moves to the square in the icon button's own layer.
  assert.match(css, /@layer sf\.states \{\s*@media not \(pointer: coarse\) \{\s*\.sf-menu-element > button\.sf-icon-button:not\(:disabled\):not\(\.disabled\):focus-visible \{\s*outline: none;/);
});

test('menu composition: the documentation tree writes its zeros as lengths', async () => {
  const css = await read('component/menu/scss/_css__menu.scss');
  const tree = css.slice(css.indexOf('.sf-menu.sf-menu--documentation-tree .sf-menu-element {'));
  const body = tree.slice(0, tree.indexOf('}'));
  for (const name of ['border-width', 'padding-top', 'padding-bottom']) {
    assert.ok(body.includes(`--sf-menu-element--${name}: calc(var(--sf-px) * 0);`), name);
  }
});

/* Measured before (nav-4 06e40ed3): the documentation tree's rows were 28 in
   compact density, under the 32 step, and sf-menu's split rows in the tree
   24 (compact 20) among 40s. The tree draws the step inside the words' box:
   the wrap's block padding is the size 1 control height less the line,
   published for sf-menu's split link; the first level's inset is a length,
   which the link adds to the wrap's inline inset. */
test('menu composition: the documentation tree puts every row on the size 1 step', async () => {
  const css = await read('component/menu/scss/_css__menu.scss');
  const row = css.slice(css.indexOf('.sf-menu.sf-menu--documentation-tree .sf-menu-element {'));
  const rowBody = row.slice(0, row.indexOf('}'));
  assert.ok(rowBody.includes('--sf-menu--wrap-padding-block: calc((var(--sf-ui-1--control-height) - var(--sf-menu-element--line-height, var(--sf-text-height-1))) / 2);'));
  assert.ok(rowBody.includes('--sf-menu--wrap-padding-inline: var(--sf-space-1);'));
  const wrap = css.slice(css.indexOf('.sf-menu.sf-menu--documentation-tree .sf-menu-element-wrap {'));
  const wrapBody = wrap.slice(0, wrap.indexOf('}'));
  assert.ok(wrapBody.includes('padding-block: var(--sf-menu--wrap-padding-block);'));
  assert.ok(wrapBody.includes('padding-inline: var(--sf-menu--wrap-padding-inline);'));
  assert.doesNotMatch(wrapBody, /space-1\\\/3/u, 'no fixed space step for the height');
  assert.match(css, /\.sf-menu\.sf-menu--documentation-tree \.sf-menu-element--level-1 \{[^}]*--sf-menu-element--padding-inline-start: calc\(var\(--sf-px\) \* 0\);/u);
});

/* Measured before (nav-4 36897bb6): the tree's levels stood the words at 16,
   32, 36 (compact and phone 12, 24, 28) -- 0 / space-1 / space-2 / space-3,
   so the third level stepped 4 -- and a branch's trailing glyph sat on the
   row's end edge, 8 (compact 6) right of every split chevron's glyph (R219's
   square, glyph centred). One step per level (C30, C109 (2)): each level adds
   its parent's step, space-1 for words. The row's end padding is half of what
   the chevron's square grows past the line, so both glyphs centre on one
   square of the step at the row's end. */
test('menu composition: the documentation tree steps every level evenly and puts every chevron on one line', async () => {
  const css = await read('component/menu/scss/_css__menu.scss');
  const level = (n) => {
    const at = css.slice(css.indexOf(`.sf-menu.sf-menu--documentation-tree .sf-menu-element--level-${n} {`));
    return at.slice(0, at.indexOf('}'));
  };
  const step = (n) => `var(--sf-menu--step-${n}, var(--sf-space-1))`;
  assert.ok(level(2).includes(`--sf-menu-element--padding-inline-start: ${step(1)};`));
  assert.ok(level(3).includes(`--sf-menu-element--padding-inline-start: calc(${step(1)} + ${step(2)});`));
  assert.ok(level(4).includes(`--sf-menu-element--padding-inline-start: calc(${step(1)} + ${step(2)} + ${step(3)});`));
  for (const n of [2, 3, 4]) assert.doesNotMatch(level(n), /--sf-space-[23]/u, `level ${n}: no uneven space step`);
  const row = css.slice(css.indexOf('.sf-menu.sf-menu--documentation-tree .sf-menu-element {'));
  const rowBody = row.slice(0, row.indexOf('}'));
  assert.ok(rowBody.includes('--sf-menu-element--padding-right: calc((var(--sf-ui-1--control-height) - var(--sf-menu-element--line-height, var(--sf-text-height-1))) / 2);'));
});

/* The same across (owner decision C105 H4, the border inside the inset, as
   the fields' C77 inset; spacing audit 2026-11-13 rows M2 and C2): a bordered
   menu row, the context menu's panel and sf-settings' panel give the 1 px
   border up from their inline inset, so the first icon or letters stand 16
   from the outer edge (compact and phone 12), not 17 (13). The scrollbar's
   gap on either side of its thumb keeps the whole inset (C07, C106). */
test('menu composition: the border is inside the inline inset (C105 H4)', async () => {
  const row = await read('component/menu/scss/_css__menu_element.scss');
  assert.match(row, /padding-inline-start: calc\(var\(--sf-menu-element--padding-inline-start, var\(--sf-space-1\)\) - var\(--sf-menu-element--border-width\)\);/);
  assert.match(row, /padding-inline-end: calc\(var\(\s*--sf-menu-element--padding-right,\s*var\(--sf-menu-element--padding-inline-end, var\(--sf-space-1\)\)\s*\) - var\(--sf-menu-element--border-width\)\);/);
  const menu = await read('component/context-menu/scss/_css__context_menu.scss');
  assert.match(menu, /--sf-context-menu-content--edge-inline-start: calc\(var\(--sf-context-menu-content--padding-inline-start\) - var\(--sf-context-menu-border-width, var\(--sf-px\)\)\);/);
  assert.match(menu, /padding-inline-start: var\(--sf-context-menu-content--edge-inline-start\);/);
  assert.match(menu, /panel\.scrollbar\(var\(--sf-context-menu-content--padding-inline-end\)/);
  const settings = await read('smart/settings/scss/_smart__settings.scss');
  assert.match(settings, /--sf-settings-panel--inset-inline: calc\(var\(--sf-settings-panel--inset\) - var\(--sf-px\)\);/);
  assert.match(settings, /padding: var\(--sf-settings-panel--inset\) var\(--sf-settings-panel--inset-inline\);/);
  assert.match(settings, /panel\.scrollbar\(var\(--sf-settings-panel--inset\),/);
});
