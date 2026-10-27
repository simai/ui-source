import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('base and Smart use the same owned interaction adapter and release it',async()=>{
  const base=await read('src/component/dropdown/js/_dropdown.js'),smart=await read('src/smart/dropdown/index.js');
  for(const source of [base,smart])assert.ok(source.includes('createDropdownInteraction'));
  assert.ok(base.includes('root.__sfDropdownInteraction?.release()'));
  assert.ok(smart.includes('this._interaction?.release()'));
});
test('interaction adapter keeps search separate from listbox and releases portal listeners',async()=>{
  const s=await read('src/component/dropdown/interaction.js');
  assert.ok(s.includes("container.setAttribute('role','listbox')"));
  assert.ok(s.includes("query.setAttribute('role','searchbox')"));
  assert.ok(s.includes("item.setAttribute('role','option')"));
  assert.ok(s.includes("popup?.removeEventListener('keydown',onKeydown,true)"));
  assert.ok(s.includes('cancelAnimationFrame(frame)'));
  assert.doesNotMatch(s,/setAttribute\('role','menu/);
});
test('joined dropdown and options use keyboard-only semantic inset focus',async()=>{
  const field=await read('src/component/dropdown/scss/_css__dropdown.scss');
  const item=await read('src/component/dropdown/scss/_css__list-item.scss');
  const custom=await read('src/component/dropdown/scss/_css__custom.scss');
  assert.doesNotMatch(field,/:has\(input[^)]*:focus\)/);
  assert.doesNotMatch(item,/--sf-list-item--background-color: var\(--sf-ui-focus\)/);
  assert.ok(custom.includes(':has(> [aria-haspopup]:focus-visible)'));
  // The ring is an outline turned inwards now, not an inset shadow.
  assert.ok(custom.includes('outline-offset: calc(var(--sf-focus--width) * -1)'));
  assert.ok(custom.includes('solid Highlight'));
  assert.match(custom,/@layer sf\.states\s*\{\s*\.sf-dropdown/);
  assert.match(custom,/button\[aria-haspopup\]:focus-visible\s*\{[^}]*box-shadow: none;[^}]*outline: none;/);
});
test('Native search box keeps its own change inside, as sf-dropdown does (simai/ui-source#53)',async()=>{
  const base=await read('src/component/dropdown/js/_dropdown.js');
  const template=await read('src/smart/dropdown/js/templates/default.js');
  assert.match(template,/@change=\$\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(base,/function onSearchChange\(event\) \{\s*event\.stopPropagation\(\);\s*\}/);
  // Bound and released through the same lifecycle as the search input listener.
  assert.ok(base.includes('searchInput.addEventListener("change", onSearchChange)'));
  assert.ok(base.includes('root.__sfDropdownOnSearchChange = onSearchChange'));
  assert.match(base,/removeEventListener\(\s*"change",\s*root\.__sfDropdownOnSearchChange,?\s*\)/);
  assert.ok(base.includes('delete root.__sfDropdownOnSearchChange'));
  // Only the search box: the selection change the component dispatches still bubbles.
  assert.match(base,/new CustomEvent\("change", \{[\s\S]*?bubbles: true/);
});
