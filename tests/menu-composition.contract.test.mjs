import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* Measured before: a navigation menu row was 42px (38 on mobile) against a
   40px size 1 control, and a context menu's items sat 3px right of a dropdown
   list's of the same size. tests/browser/panel-composition.cli.js measures. */
test('menu composition: a menu row gives up its border', async () => {
  const css = await read('component/menu/scss/_css__menu_element.scss');
  assert.equal((css.match(/calc\(\(var\(--sf-ui-1--control-height\) - var\(--sf-text-height-1\)\) \/ 2 - var\(--sf-menu-element--border-width\)\)/g) || []).length, 2);
});

test('menu composition: a context menu publishes its axis and its items take it', async () => {
  const css = await read('component/context-menu/scss/_css__context_menu_custom.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(css.includes(`--sf-context-menu--item-inset-start-${size}: calc(var(--sf-ui-${size}--space-x) + var(--sf-px) - var(--sf-context-menu-content--padding-inline-start, 0px));`), size);
    assert.ok(css.includes(`--sf-context-menu--label-inset-${size}: calc(var(--sf-context-menu--item-inset-start-${size}) + var(--sf-ui-${size}--text-space-x));`), size);
    assert.ok(css.includes(`.sf-context-menu .sf-context-menu-content > .sf-button.sf-button--size-${size},\n.sf-context-menu .sf-context-menu-content > sf-button > .sf-button.sf-button--size-${size} {\n  --sf-button--padding-inline-start: var(--sf-context-menu--item-inset-start-${size});\n  --sf-button--padding-inline-end: var(--sf-context-menu--item-inset-end-${size});`), size);
  }
});

test('menu composition: a context menu item is a start-aligned row whatever its markup', async () => {
  const css = await read('component/context-menu/scss/_css__context_menu_custom.scss');
  assert.match(css, /\.sf-context-menu \.sf-context-menu-content > \.sf-button,\s*\.sf-context-menu \.sf-context-menu-content > sf-button > \.sf-button \{\s*display: flex;\s*align-items: center;\s*justify-content: flex-start;\s*text-align: start;/);
});
