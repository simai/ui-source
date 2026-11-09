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
});
