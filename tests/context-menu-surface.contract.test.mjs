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

test('a menu is as wide as its content from a modest floor', () => {
  assert.match(base,/min-inline-size: var\(--sf-context-menu--min-inline-size, var\(--sf-e8\)\);/);
});
