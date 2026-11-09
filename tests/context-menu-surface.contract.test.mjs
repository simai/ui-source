import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const base=readFileSync(new URL('../src/component/context-menu/scss/_css__context_menu.scss',import.meta.url),'utf8');
const custom=readFileSync(new URL('../src/component/context-menu/scss/_css__context_menu_custom.scss',import.meta.url),'utf8');

test('Context Menu uses the semantic surface radius and draws no tail', () => {
  assert.equal((base.match(/var\(--sf-radius--surface\)/g)||[]).length,5);
  // No tail (owner, 2026-10-12): legacy markup that writes one is hidden, and
  // the tail variables stay at zero for hosts that add them into placement.
  assert.match(base,/\.sf-context-menu \.sf-context-menu-tooltip \{\s*display: none;/);
  assert.match(custom,/--sf-context-menu-tail-size: 0px;/);
  assert.match(custom,/--sf-context-menu-tail-corner-offset: 0px;/);
  assert.doesNotMatch(custom,/sf-context-menu--position-[a-z-]+ \.sf-context-menu-tooltip/);
});

test('Context Menu content owns bounded scrolling',()=>{
  assert.match(custom,/\.sf-context-menu > \.relative \{/);
  assert.match(custom,/--sf-context-menu-available-block-size, none/);
  assert.match(base,/\.sf-context-menu \.sf-context-menu-content \{[\s\S]*overflow: auto/);
  assert.match(base,/\.sf-context-menu \.sf-context-menu-content \{[\s\S]*scroll-behavior: auto/);
});

test('Context Menu keeps its surface distinguishable in forced colors',()=>{
  assert.match(base,/@media \(forced-colors: active\)/);
  assert.match(base,/\.sf-context-menu \.sf-context-menu-content \{\s*border: var\(--sf-px\) solid CanvasText/);
});

test('a menu is as wide as its content between the menu\'s popup widths (C32)', () => {
  assert.match(base,/min-inline-size: var\(--sf-context-menu--min-inline-size, var\(--sf-popup-menu-min-width\)\);/);
  assert.match(base,/max-inline-size: min\(var\(--sf-context-menu--max-inline-size, var\(--sf-popup-menu-max-width\)\), /);
});

// Owner decision C32: the kinds a popup takes by what it holds, from core's
// --sf-popup-*-width steps, a panel with tabs on the panel's step.
test('the popup kinds read core\'s popup widths (C32)', () => {
  assert.match(base,/\[data-sf-width="list"\] \{\s*min-inline-size: min\(var\(--sf-context-menu-trigger-inline-size, var\(--sf-popup-menu-min-width\)\)/);
  assert.match(base,/max\(var\(--sf-context-menu-trigger-inline-size, var\(--sf-a0\)\), var\(--sf-popup-list-max-width\)\)/);
  assert.match(base,/\[data-sf-width="panel"\] \{\s*inline-size: max\(var\(--sf-context-menu-trigger-inline-size, var\(--sf-a0\)\), var\(--sf-popup-panel-width\)\);/);
  assert.match(base,/inline-size: var\(--sf-popup-form-width\);/);
  assert.match(base,/\[data-sf-width="form-wide"\] \{\s*inline-size: var\(--sf-popup-form-wide-width\);/);
  assert.match(base,/--sf-context-menu-panel--inline-size: max\(var\(--sf-context-menu-trigger-inline-size, var\(--sf-a0\)\), var\(--sf-popup-panel-width\)\);/);
  assert.match(base,/\.sf-context-menu\[data-sf-sheet\] \{[^}]*--sf-context-menu--box-shadow: var\(--sf-shadow-modal\);/);
  assert.match(base,/\.sf-context-menu\[data-sf-sheet\]::backdrop \{\s*background-color: var\(--sf-scrim-color\);/);
  // The sheet keeps clear of a phone's home indicator (DEV acceptance, 2026-11-09).
  assert.match(base,/\[data-sf-sheet\] \.sf-context-menu-content\[data-sf-width\] \{[^}]*padding-bottom: calc\(var\(--sf-context-menu-content--padding-bottom\) \+ env\(safe-area-inset-bottom, var\(--sf-a0\)\)\);/);
});

// The form's sheet is a phone's (below md); a form takes the focus at its
// first control, and an in-place list is as wide as its options and hangs
// from the field's end near the screen's end (DEV acceptance, 2026-11-09).
test('the C32 acceptance fixes are in the sources', () => {
  const menu=readFileSync(new URL('../src/smart/menu-context/index.js',import.meta.url),'utf8');
  const list=readFileSync(new URL('../src/component/dropdown/scss/_css__custom.scss',import.meta.url),'utf8');
  const portal=readFileSync(new URL('../src/component/dropdown/portal.js',import.meta.url),'utf8');
  assert.match(menu,/getPropertyValue\("--sf-breakpoint-md"\)/);
  assert.match(menu,/else this\.tabbables\(\)\[/);
  assert.match(menu,/window\.addEventListener\("resize", owned\.onResize\)/);
  assert.match(menu,/window\.removeEventListener\("resize", owned\.onResize\)/);
  assert.match(list,/\.sf-list:not\(\[data-sf-portal\], \.sf-list--free-width\) \{[^}]*inline-size: max-content;/);
  assert.match(list,/\.sf-list\[data-sf-align="end"\]:not\(\[data-sf-portal\], \.sf-list--free-width\) \{\s*inset-inline-start: auto;\s*inset-inline-end: 0;/);
  assert.match(portal,/export function alignDropdownInPlace\(list\)/);
});
