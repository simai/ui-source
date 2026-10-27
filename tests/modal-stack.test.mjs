import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const focusSource=await readFile(new URL('../src/component/modal/js/_focus.js',import.meta.url),'utf8');
// Each bundle carries its own copy of the stack module too: the stack itself
// lives on a shared global (layer-stack.js), so the copies still see one stack.
const layerSource=await readFile(new URL('../src/core/js/layer-stack.js',import.meta.url),'utf8');
const stackSource=await readFile(new URL('../src/component/modal/js/_stack.js',import.meta.url),'utf8');
const source=suffix=>stackSource.replace("'./_focus'",JSON.stringify(`data:text/javascript,${encodeURIComponent(focusSource)}`))
  .replace("'../../../core/js/layer-stack'",JSON.stringify(`data:text/javascript,${encodeURIComponent(`${layerSource}\n// ${suffix}`)}`));
const load=suffix=>import(`data:text/javascript,${encodeURIComponent(source(suffix))}#${suffix}`);
const a=await load('ordinary'),b=await load('smart');
function setup(){
  delete globalThis[Symbol.for('sf.layerStack')];
  globalThis.document={};const calls=[];
  const owner=name=>({lockPage:()=>calls.push(`${name}:lock`),unlockPage:()=>calls.push(`${name}:unlock`)});
  const item=name=>({name,preserveScrollGap:true,applyStackPosition(i){this.index=i;},focusFirst(){calls.push(`${name}:focus`);},template:{contains:node=>node.in===name}});
  return{calls,owner,item};
}
test('Independent Modal bundles share one ordering and one scroll lock owner',()=>{
  const f=setup(),x=f.item('ordinary'),y=f.item('smart');
  a.addModalLayer(x,f.owner('ordinary'));b.addModalLayer(y,f.owner('smart'));
  assert.equal(a.getTopModalLayer(),y);assert.equal(b.getModalLayerIndex(x),0);
  assert.deepEqual([x.index,y.index],[0,1]);assert.deepEqual(f.calls,['ordinary:lock']);
  b.removeModalLayer(y);assert.equal(a.getTopModalLayer(),x);assert.deepEqual(f.calls,['ordinary:lock']);
  a.removeModalLayer(x);assert.deepEqual(f.calls,['ordinary:lock','ordinary:unlock']);
  b.removeModalLayer(x);assert.equal(f.calls.length,2);
});
test('Removing original lock owner keeps page locked until another type closes',()=>{
  const f=setup(),x=f.item('ordinary'),y=f.item('smart');
  a.addModalLayer(x,f.owner('ordinary'));b.addModalLayer(y,f.owner('smart'));
  a.removeModalLayer(x);assert.equal(y.index,0);assert.deepEqual(f.calls,['ordinary:lock']);
  b.removeModalLayer(y);assert.deepEqual(f.calls,['ordinary:lock','ordinary:unlock']);
});
test('Raise changes only global ordering and does not acquire another lock',()=>{
  const f=setup(),x=f.item('x'),y=f.item('y');
  a.addModalLayer(x,f.owner('x'));b.addModalLayer(y,f.owner('y'));a.raiseModalLayer(x);
  assert.equal(b.getTopModalLayer(),x);assert.deepEqual([x.index,y.index],[1,0]);assert.deepEqual(f.calls,['x:lock']);
});
test('Background removal cannot steal focus; top removal restores into remaining panel',()=>{
  const f=setup(),x=f.item('lower');a.addModalLayer(x,f.owner('lower'));
  const outside={isConnected:true,focus:()=>f.calls.push('outside')};
  a.restoreModalLayerFocus(false,outside);assert.deepEqual(f.calls,['lower:lock']);
  a.restoreModalLayerFocus(true,outside);assert.deepEqual(f.calls,['lower:lock','lower:focus']);
  document.defaultView={getComputedStyle:()=>({visibility:'visible'})};
  const trigger={in:'lower',isConnected:true,ownerDocument:document,matches:()=>false,closest:()=>null,getClientRects:()=>[{}],hasAttribute:()=>false,focus(){document.activeElement=this;f.calls.push('trigger');}};
  a.restoreModalLayerFocus(true,trigger);assert.equal(f.calls.at(-1),'trigger');
});
