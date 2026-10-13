import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/component/modal/js/_closing.js',import.meta.url),'utf8');
const {freezeModalContent}=await import(`data:text/javascript,${encodeURIComponent(source)}`);
function setup(){
  const element=(value=null)=>({value,hasAttribute(){return this.value!==null;},getAttribute(){return this.value;},setAttribute(k,v){this.value=v;},removeAttribute(){this.value=null;}});
  const children=[element(),element('')],state={focus:0,disconnected:false};
  const panel={children,focus(){state.focus++;},ownerDocument:{defaultView:{MutationObserver:class{constructor(fn){state.notify=fn;}observe(node,options){state.observation=options;}disconnect(){state.disconnected=true;}}}}};
  return{element,children,state,panel};
}
test('Closing freezes direct content while retaining a focusable semantic panel',()=>{
  const f=setup(),release=freezeModalContent(f.panel,true);
  assert.equal(f.state.focus,1);assert.deepEqual(f.children.map(n=>n.value),['','']);
  release();assert.deepEqual(f.children.map(n=>n.value),[null,'']);assert.equal(f.state.disconnected,true);
});
test('Background closing never steals focus; added content is frozen until release',()=>{
  const f=setup(),release=freezeModalContent(f.panel);assert.equal(f.state.focus,0);
  const added=f.element();f.children.push(added);f.state.notify();assert.equal(added.value,'');
  release();assert.equal(added.value,null);assert.deepEqual(f.state.observation,{childList:true});
});
test('Releasing does not overwrite an author-modified inert attribute and is idempotent',()=>{
  const f=setup(),release=freezeModalContent(f.panel);f.children[0].value='author';release();release();
  assert.equal(f.children[0].value,'author');assert.doesNotThrow(()=>freezeModalContent(null)());
});
test('Ordinary default title names the dialog; custom headers use existing title parameter',async()=>{
  const modal=await readFile(new URL('../src/component/modal/js/_modal.js',import.meta.url),'utf8');
  assert.match(modal,/root\.setAttribute\('aria-labelledby', title\.id\)/);
  // An untitled window takes the page language's word, not «Modal» (2026-10-13).
  assert.match(modal,/root\.setAttribute\('aria-label', params\.title \|\| untitled\(root\)\)/);
});
