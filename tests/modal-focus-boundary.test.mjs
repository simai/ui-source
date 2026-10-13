import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/component/modal/js/_focus.js',import.meta.url),'utf8');
const {getModalTabStops,trapModalFocus}=await import(`data:text/javascript,${encodeURIComponent(source)}`);
function fixture(options=[]) {
  const nodes=options.map(properties=>({tabIndex:0,visible:true,visibility:'visible',disabled:false,inert:false,...properties,
    matches(){return this.disabled;},closest(){return this.inert?{}:null;},getRootNode(){return this.tree||doc;},getClientRects(){return this.visible?[{}]:[];},focus(){doc.activeElement=this;}}));
  const doc={activeElement:null,defaultView:{getComputedStyle:node=>({visibility:node.visibility})}};
  const panel={ownerDocument:doc,querySelectorAll:()=>nodes,contains:node=>node===panel||nodes.includes(node),focus(){doc.activeElement=this;}};
  const press=(active,shiftKey=false)=>{doc.activeElement=active;let prevented=false;trapModalFocus(panel,{shiftKey,preventDefault(){prevented=true;}});return {active:doc.activeElement,prevented};};
  return {nodes,panel,doc,press};
}
test('Modal tab boundaries exclude non-tabbable, hidden, disabled and inert controls',()=>{
  const f=fixture([{}, {tabIndex:-1},{visible:false},{disabled:true},{inert:true},{visibility:'hidden'},{}]);
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[0],f.nodes[6]]);
});
test('Modal enters from the initial panel or outside and wraps both boundaries',()=>{
  const f=fixture([{},{}]),[first,last]=f.nodes;
  for(const active of [f.panel,{}]){
    assert.deepEqual(f.press(active),{active:first,prevented:true});
    assert.deepEqual(f.press(active,true),{active:last,prevented:true});
  }
  assert.deepEqual(f.press(first,true),{active:last,prevented:true});
  assert.deepEqual(f.press(last),{active:first,prevented:true});
  assert.deepEqual(f.press(first),{active:first,prevented:false});
});
test('Text-only Modal keeps Tab on its focusable panel',()=>{
  const f=fixture();
  for(const backward of [false,true])assert.deepEqual(f.press({},backward),{active:f.panel,prevented:true});
});
test('Tab boundaries reflect current visibility and explicit tab order',()=>{
  const f=fixture([{tabIndex:0},{tabIndex:2},{tabIndex:1},{tabIndex:0}]);
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[2],f.nodes[1],f.nodes[0],f.nodes[3]]);
  f.nodes[2].visible=false;
  assert.equal(f.press(f.panel).active,f.nodes[1]);
});
test('Ordinary and Smart Modal use the same boundary logic',async()=>{
  for(const path of ['../src/component/modal/js/_modal.js','../src/smart/modal/index.js']) {
    const code=await readFile(new URL(path,import.meta.url),'utf8');
    assert.match(code,/trapModalFocus\(panel, event\)/);
    assert.doesNotMatch(code,/const FOCUSABLE_SELECTOR/);
  }
});

const radio = (properties={}) => ({tagName:'INPUT',type:'radio',name:'delivery',form:null,checked:false,...properties});
test('Named radio group contributes its checked control to both Tab directions',()=>{
  const f=fixture([radio(),radio({checked:true}),radio()]);
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[1]]);
  assert.deepEqual(getModalTabStops(f.panel,true),[f.nodes[1]]);
  for(const active of [f.panel,...f.nodes])for(const backward of [false,true]){
    assert.deepEqual(f.press(active,backward),{active:f.nodes[1],prevented:true});
  }
});
test('Unselected groups use first/last eligible input according to Tab direction',()=>{
  const f=fixture([radio(),radio({checked:true,disabled:true}),radio()]);
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[0]]);
  assert.deepEqual(getModalTabStops(f.panel,true),[f.nodes[2]]);
  assert.equal(f.press(f.nodes[2]).active,f.nodes[0]);
  assert.equal(f.press(f.nodes[0],true).active,f.nodes[2]);
});
test('Radio grouping respects form owner, tree and empty names without CSS selectors',()=>{
  const form={},tree={};
  const f=fixture([radio({name:'a"[]'}),radio({name:'a"[]',checked:true}),radio({name:'a"[]',form}),radio({name:'a"[]',tree}),radio({name:''}),radio({name:''})]);
  assert.deepEqual(getModalTabStops(f.panel),f.nodes.slice(1));
});
test('Native selection changes are read live; adjacent non-radio stops remain native',()=>{
  const f=fixture([{},radio(),radio({checked:true}),{}]);
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[0],f.nodes[2],f.nodes[3]]);
  f.nodes[1].checked=true;f.nodes[2].checked=false;
  assert.deepEqual(getModalTabStops(f.panel),[f.nodes[0],f.nodes[1],f.nodes[3]]);
  assert.equal(f.press(f.nodes[1]).prevented,false);
  assert.equal(f.press(f.nodes[1],true).prevented,false);
});
