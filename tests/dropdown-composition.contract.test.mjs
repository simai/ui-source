import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('dropdown indicator synchronization is silent and uses the Checkbox owner API',async()=>{
  const source=await read('src/component/dropdown/interaction.js');
  const calls=[],checkbox={checked:false,dispatchEvent(){throw new Error('synthetic event');}};
  const runtime=vm.createContext({SF:{Checkbox:{setState(input,state){calls.push([input,state.checked]);}}}});
  vm.runInContext(source.replaceAll(/^export /gm,'').replace(/^import .*$/gm,''),runtime); // the path-id import (§7.1.1) is not used here
  runtime.syncDropdownCheckbox({querySelector:()=>checkbox},true);
  assert.equal(checkbox.checked,true);assert.deepEqual(calls,[[checkbox,true]]);
  delete runtime.SF;
  runtime.syncDropdownCheckbox({querySelector:()=>checkbox},false);
  assert.equal(checkbox.checked,false);
});
test('dropdown styling scopes disabled and hover to its own field controls',async()=>{
  const source=await read('src/component/dropdown/scss/_css__dropdown.scss');
  assert.doesNotMatch(source,/:has\(input:disabled\)/);
  assert.doesNotMatch(source,/:has\(input[^)]*hover/);
  assert.ok(source.includes(':has(> .sf-dropdown-field > :disabled)'));
});
test('checkbox synchronization does not rewrite an already correct indicator',async()=>{
  const source=await read('src/component/dropdown/interaction.js');
  const icon={textContent:''},checkbox={checked:false,indeterminate:false};let calls=0;
  const runtime=vm.createContext({SF:{Checkbox:{setState(input,state){calls++;icon.textContent=state.checked?'check':'';}}}});
  vm.runInContext(source.replaceAll(/^export /gm,'').replace(/^import .*$/gm,''),runtime); // the path-id import (§7.1.1) is not used here
  const item={querySelector:selector=>selector.includes('input')?checkbox:icon};
  runtime.syncDropdownCheckbox(item,true);runtime.syncDropdownCheckbox(item,true);
  assert.equal(calls,1);
});
test('only listbox option checkboxes become decorative indicators',async()=>{
  const css=await read('src/component/dropdown/scss/_css__custom.scss');
  const base=await read('src/component/dropdown/js/_dropdown.js');
  const interaction=await read('src/component/dropdown/interaction.js');
  assert.match(css,/\.sf-list \[role="option"\] \.sf-checkbox\s*\{\s*pointer-events: none;/);
  const selection=base.slice(base.indexOf('function syncSelected'),base.indexOf('function syncItemCheckboxInteractivity'));
  assert.doesNotMatch(selection,/dispatchEvent/);
  assert.ok(selection.includes('syncDropdownCheckbox(item, isSelected)'));
  assert.ok(interaction.includes("if(indicator.getAttribute('aria-hidden')!=='true')"));
});
