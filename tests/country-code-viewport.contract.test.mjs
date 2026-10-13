import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source=await readFile(new URL('../src/component/country-code/js/_country_code.js',import.meta.url),'utf8');

function rows({rows=[20,35,25,40,30,20,30,20,100],open=true}={}) {
  const items=rows.map(height=>({offsetHeight:height}));
  const wrap={style:{},querySelectorAll:()=>items};
  const list={style:{}};
  const root={classList:{contains:()=>open}};
  const context=vm.createContext({getNodes:()=>({list,itemsWrap:wrap}),window:{getComputedStyle:()=>({paddingTop:'4px',paddingBottom:'6px'})}});
  vm.runInContext(source.slice(source.indexOf('function applyDropdownViewport'),source.indexOf('function bindCountryViewport')),context);
  return {total:context.applyDropdownViewport(root),wrap};
}

test('Country rows are capped at eight real rows and scroll inside the list',()=>{
  const capped=rows();
  assert.equal(capped.total,220+10);
  assert.equal(capped.wrap.style.maxHeight,'230px');
  assert.equal(capped.wrap.style.minHeight,'0');
  assert.equal(capped.wrap.style.overflowY,'auto');
  assert.equal(rows({rows:[20,20]}).total,50);
  assert.equal(rows({open:false}).total,0);
});

test('Country list uses shared positioning while open and restores author styles',()=>{
  // The list is a flex column while open so SF.Position can cap its height and
  // the rows shrink; right/bottom come from the helper, not stylesheet insets.
  assert.match(source,/import BundledPosition from '\.\.\/\.\.\/\.\.\/core\/js\/position\.js';/);
  assert.match(source,/globalThis\.SF\?\.Position \|\| BundledPosition/);
  assert.match(source,/positioning\(\)\.anchor\(root, list, \{\s*side: 'block-end', align: 'start', matchWidth: true, fitHeight: true,/);
  assert.match(source,/Object\.assign\(list\.style, \{display: 'flex', flexDirection: 'column', overflow: 'hidden'\}\)/);
  assert.match(source,/anchor\.stop\(\);/);
  assert.match(source,/list\.style\.setProperty\(name, value, priority\)/);
  assert.match(source,/if \(box\.bottom <= 0 \|\| box\.top >= window\.innerHeight\) setOpenState\(root, false\);/);
  assert.doesNotMatch(source,/insetBlockStart = up/);
});
