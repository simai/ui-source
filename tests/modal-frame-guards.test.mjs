import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/component/modal/js/_focus.js',import.meta.url),'utf8');
const first=await import(`data:text/javascript,${encodeURIComponent(source)}#ordinary`);
const second=await import(`data:text/javascript,${encodeURIComponent(source)}#smart`);
function setup(tags=['BUTTON','IFRAME']){
  const guards=[];
  const doc={activeElement:null,defaultView:{getComputedStyle:()=>({visibility:'visible'})},createElement(){
    const listeners={};return{isConnected:false,setAttribute(){},addEventListener(name,fn){listeners[name]=fn;},focus(){doc.activeElement=this;listeners.focus?.();},remove(){this.isConnected=false;const i=guards.indexOf(this);if(i>=0)guards.splice(i,1);}};
  }};
  globalThis.document=doc;
  const nodes=tags.map(tagName=>({tagName,tabIndex:0,matches:()=>false,closest:()=>null,getClientRects:()=>[{}],focus(){doc.activeElement=this;}}));
  const panel={ownerDocument:doc,parentNode:{},isConnected:true,querySelectorAll:()=>nodes,contains:node=>node===panel||nodes.includes(node),focus(){doc.activeElement=this;},before(node){node.isConnected=true;guards.unshift(node);},after(node){node.isConnected=true;guards.push(node);}};
  const root={inert:false,querySelector:()=>panel,getAttribute:()=>null};
  const modal={template:root};
  return{doc,guards,nodes,panel,root,modal};
}
test('Independent bundles retain one pair and remove it when no visible layer remains',()=>{
  const f=setup();first.syncModalFocusGuards(f.modal);const pair=[...f.guards];
  second.syncModalFocusGuards(f.modal);assert.deepEqual(f.guards,pair);
  second.syncModalFocusGuards(null);assert.deepEqual(f.guards,[]);assert.ok(pair.every(g=>!g.isConnected));
});
test('Guard exits use parent control or meaningful panel, never leave focus on a guard',()=>{
  const f=setup();first.syncModalFocusGuards(f.modal);
  f.guards[1].focus();assert.equal(f.doc.activeElement,f.nodes[0]);
  f.guards[0].focus();assert.equal(f.doc.activeElement,f.panel);
  f.root.inert=true;f.guards[1].focus();assert.equal(f.doc.activeElement,f.guards[1]);
});
test('Native iframe entry relays trusted Tab without preventDefault or child document access',()=>{
  const f=setup(['IFRAME']);first.syncModalFocusGuards(f.modal);
  for(const backward of [false,true]){
    let prevented=false;f.doc.activeElement=f.panel;
    second.trapModalFocus(f.panel,{shiftKey:backward,preventDefault(){prevented=true;}});
    assert.equal(prevented,false);assert.equal(f.doc.activeElement,f.guards[backward?1:0]);
  }
  // After relay, the guard handler is active again for the next native exit.
  f.guards[1].focus();assert.equal(f.doc.activeElement,f.panel);
});
test('Non-frame wrapping still focuses the control directly and prevents default',()=>{
  const f=setup(['BUTTON']);first.syncModalFocusGuards(f.modal);f.doc.activeElement=f.panel;
  let prevented=false;second.trapModalFocus(f.panel,{shiftKey:false,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(f.doc.activeElement,f.nodes[0]);
});
test('Replacing or removing the panel disposes the old pair',()=>{
  const f=setup();first.syncModalFocusGuards(f.modal);const pair=[...f.guards];
  const replacement={...f.panel};f.root.querySelector=()=>replacement;second.syncModalFocusGuards(f.modal);
  assert.equal(f.guards.length,2);assert.ok(pair.every(g=>!g.isConnected));
  f.root.querySelector=()=>null;first.syncModalFocusGuards(f.modal);assert.equal(f.guards.length,0);
});
