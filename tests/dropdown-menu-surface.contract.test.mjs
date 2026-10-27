import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

/* The dropdown popup is a menu surface and reads like the context menu: no
   divider between options, rounded inset highlight, lift instead of border.
   The same surface is available to any list that asks for it by name, because
   a list of options anchored to some other control is the same thing -- and a
   list that does not ask keeps its row look. */
const css = await readFile(new URL('../src/component/dropdown/scss/_css__list.scss', import.meta.url), 'utf8');
const block = css.slice(css.indexOf('.sf-dropdown .sf-list,'));

test('dropdown popup: lifted like the context menu, not bordered', () => {
  assert.match(block, /--sf-list--border-width: 0;/);
  // The open list's public variable over the elevation (standard 1.3.8 §6).
  assert.match(block, /--sf-list--background-color: var\(--sf-dropdown-list-background-color, var\(--sf-elevation-2--surface\)\);/);
  assert.match(block, /--sf-list--box-shadow: var\(--sf-elevation-2--shadow\);/);
});

test('dropdown options: no dividers, control corner, a flex row the check mark fits in', () => {
  const options = block.slice(block.indexOf('.sf-dropdown .sf-list .sf-list-item,'));
  assert.match(options, /--sf-list-item--border-bottom-width: 0;/);
  assert.match(options, /border-radius: var\(--sf-radius--ui\);/);
  assert.match(options, /display: flex;/);
});

test('the menu surface reaches a dropdown and a list that asks for it, and nothing else', () => {
  // Comments first: a sentence that happens to end in a comma is not a selector,
  // and reading one as a selector failed this on the prose rather than the CSS.
  const selectors = block.replace(/\/\*[\s\S]*?\*\//gu, '');
  for (const rule of selectors.matchAll(/^\s*([^@{}\n][^{}\n]*)[,{]\s*$/gm)) {
    const selector = rule[1].trim();
    if (selector.startsWith('.sf-dropdown') || selector.startsWith('.sf-list--menu')) continue;
    if (selector.startsWith('.sf-list-heading')) continue;
    // A list laid out as a grid, and the surface that holds one. Both are asked
    // for by name, the way the menu look is, so neither reaches a list that did
    // not ask.
    if (selector.startsWith('.sf-list-container--grid')) continue;
    if (selector.startsWith('.sf-list:has(.sf-list-container--grid)')) continue;
    // A list that hangs from a trigger of the consumer's own, rather than from
    // a field, and so takes a width of its own. Asked for by name like the
    // rest.
    if (selector.startsWith('.sf-list--free-width')) continue;
    // The wrapper that scrolls a grid, capped so a grid is read at a glance
    // rather than running the height of the screen.
    if (selector.startsWith('.sf-list-container-wrap:has(.sf-list-container--grid)')) continue;
    assert.fail(`unscoped selector: ${selector}`);
  }
});

/* A heading is not an option: a pointer passes through it and a reader is told
   it carries no choice. Written as a row, it would be counted and stepped onto
   by every keyboard that walks a listbox. */
test('a list heading is told it is not a choice', () => {
  assert.match(css, /\.sf-list-heading \{/);
  assert.match(css, /position: sticky;/);
});
