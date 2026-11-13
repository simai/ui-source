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
  for (const name of ['border-width', 'padding-top', 'padding-bottom', 'padding-right']) {
    assert.ok(body.includes(`--sf-menu-element--${name}: calc(var(--sf-px) * 0);`), name);
  }
});
