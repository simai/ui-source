import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const focusSource=await readFile(new URL('../src/component/modal/js/_focus.js',import.meta.url),'utf8');
const layerSource=await readFile(new URL('../src/core/js/layer-stack.js',import.meta.url),'utf8');
const source=(await readFile(new URL('../src/component/modal/js/_stack.js',import.meta.url),'utf8')).replace("'./_focus'",JSON.stringify(`data:text/javascript,${encodeURIComponent(focusSource)}`))
  .replace("'../../../core/js/layer-stack'",JSON.stringify(`data:text/javascript,${encodeURIComponent(layerSource)}`));
const {captureModalFocusAncestors,restoreModalLayerFocus,addModalLayer}=await import(`data:text/javascript,${encodeURIComponent(source)}`);
function setup(){
  delete globalThis[Symbol.for('sf.layerStack')];
  const mains=[],observers=[];globalThis.document={activeElement:null,documentElement:{},querySelectorAll:()=>mains,defaultView:{getComputedStyle:n=>({visibility:n.visibility||'visible'}),MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}}};
  const node=(options={})=>({isConnected:true,ownerDocument:document,attrs:new Map(),events:new Map(),visible:true,focusable:true,...options,
    matches(selector){return selector===':disabled'?!!this.disabled:!!this.landmark;},
    closest(){for(let n=this;n;n=n.parentElement)if(n.blocked)return n;return null;},getClientRects(){return this.visible?[{}]:[];},
    hasAttribute(k){return this.attrs.has(k);},getAttribute(k){return this.attrs.get(k)??null;},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},
    addEventListener(k,fn){this.events.set(k,fn);},removeEventListener(k){this.events.delete(k);},blur(){this.events.get('blur')?.();},
    focus(){if(this.focusable||this.hasAttribute('tabindex')){document.activeElement=this;this.onFocus?.();}}
  });
  document.body=node({focusable:false});return{node,mains,observers,doc:document};
}
test('Valid opener is restored without adding attributes',()=>{
  const f=setup(),opener=f.node();restoreModalLayerFocus(true,opener);assert.equal(f.doc.activeElement,opener);assert.equal(opener.attrs.size,0);
});
test('Disabled, hidden, inert, detached and unfocusable openers fall back to remembered region',()=>{
  for(const change of [{disabled:true},{visible:false},{blocked:true},{isConnected:false},{focusable:false},{visibility:'hidden'}]){
    const f=setup(),region=f.node({landmark:true,focusable:false}),opener=f.node({parentElement:region});
    const ancestors=captureModalFocusAncestors(opener);Object.assign(opener,change);restoreModalLayerFocus(true,opener,ancestors);
    assert.equal(f.doc.activeElement,region);assert.equal(region.getAttribute('tabindex'),'-1');region.blur();assert.equal(region.getAttribute('tabindex'),null);assert.equal(f.observers[0].disconnected,true);
  }
});
test('Remaining modal owns fallback; background removal never changes focus',()=>{
  const f=setup(),panel=f.node(),opener=f.node({disabled:true}),other=f.node();f.doc.activeElement=other;
  const top={template:{contains:n=>n===opener},applyStackPosition(){},focusFirst(){panel.focus();}};
  addModalLayer(top,{lockPage(){}});restoreModalLayerFocus(false,opener);assert.equal(f.doc.activeElement,other);
  restoreModalLayerFocus(true,opener);assert.equal(f.doc.activeElement,panel);
});
test('Unavailable remembered regions fall back to main, then body',()=>{
  const f=setup(),region=f.node({blocked:true,focusable:false}),main=f.node({landmark:true,focusable:false});f.mains.push(main);
  restoreModalLayerFocus(true,null,[region]);assert.equal(f.doc.activeElement,main);main.blur();assert.equal(main.getAttribute('tabindex'),null);
  main.visible=false;restoreModalLayerFocus(true,null,[region]);assert.equal(f.doc.activeElement,f.doc.body);f.doc.body.blur();assert.equal(f.doc.body.getAttribute('tabindex'),null);
});
test('Focus-handler edits to fallback tabindex are preserved',()=>{
  const f=setup(),region=f.node({focusable:false});region.onFocus=()=>region.setAttribute('tabindex','0');
  restoreModalLayerFocus(true,null,[region]);region.blur();assert.equal(region.getAttribute('tabindex'),'0');
});
test('Removing a temporarily focused region cleans up even without a native blur event',()=>{
  const f=setup(),region=f.node({focusable:false});restoreModalLayerFocus(true,null,[region]);region.isConnected=false;f.observers[0].callback();
  assert.equal(region.getAttribute('tabindex'),null);assert.equal(f.observers[0].disconnected,true);
});
