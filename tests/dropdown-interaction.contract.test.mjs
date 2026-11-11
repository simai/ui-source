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
  // Important, so a page's unlayered :focus-visible rule cannot draw a second
  // frame on the button (tests/field-inner-focus.contract.test.mjs).
  assert.match(custom,/button\[aria-haspopup\]:focus-visible\s*\{[^}]*box-shadow: none;[^}]*outline: none !important;/);
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
test('the keyboard brings the focused option into view and keeps it there',async()=>{
  const s=await read('src/component/dropdown/interaction.js');
  // Nearest and instant: a smooth reveal is still on its way when the next key moves on.
  assert.ok(s.includes("node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})"));
  assert.ok(s.includes("['PageDown','PageUp'].includes(event.key)"));
  assert.match(s,/const typeahead = \(key,option\) =>/);
  // Space still selects unless a type-ahead prefix is being typed.
  assert.ok(s.includes("event.key!==' '||(typed&&Date.now()-typedAt<=500)"));
  // The list's own scroll does not re-fit the panel in either owner.
  const base=await read('src/component/dropdown/js/_dropdown.js'),smart=await read('src/smart/dropdown/index.js');
  assert.ok(base.includes("event?.type==='scroll'&&getList(root)?.contains(event.target)"));
  assert.ok(smart.includes("event?.type === 'scroll' && this._list?.contains(event.target)"));
  // SF.Position keeps the scroll its uncapped measurement would clamp.
  const position=await read('src/core/js/position.js');
  assert.match(position,/const scrolled = settings\.fitHeight \? scrolledWithin\(floating\) : \[\];\s*if \(settings\.fitHeight\) floating\.style\.maxHeight/);
  assert.match(position,/style\.maxHeight = `\$\{Math\.max\(0, fits \? whole : room\)\}px`;\s*restoreScroll\(scrolled\);/);
  assert.ok(position.includes("node.scrollTo({top, left, behavior: 'instant'})"));
  // After a fit the option the keyboard is on is in view again.
  const portal=await read('src/component/dropdown/portal.js');
  assert.match(portal,/state\.anchor\.update\(\)\.then\(\(\) => \{[\s\S]*?active\.scrollIntoView\(\{block: 'nearest', inline: 'nearest', behavior: 'instant'\}\)/);
  const manifest=JSON.parse(await read('src/smart/dropdown/component.json'));
  assert.equal(manifest.keyboard.host.PageDown,'step:+page');
  assert.equal(manifest.accessibility.keys.PageUp,'step:-page');
});
