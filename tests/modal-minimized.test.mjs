import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/smart/modal/index.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  syncMinimizedLayer() {'),source.indexOf('\n  toggle() {',source.indexOf('  syncMinimizedLayer() {')));
function fixture(overrides={}) {
  const calls=[],root={inert:false,setAttribute:(name,value)=>calls.push(['attribute',name,value])};
  const owner={isTopModal:()=>true,bringToFront:()=>calls.push(['raise'])};
  const sync=new Function('SfModal','removeModalLayer','addModalLayer','restoreModalLayerFocus','requestAnimationFrame',`return ({${method}}).syncMinimizedLayer;`)(owner,()=>calls.push(['remove-visible-layer']),()=>calls.push(['add-visible-layer']),(top,target)=>calls.push(['restore',top,target]),fn=>fn());
  const modal={_isMounted:true,openState:true,display:'modal',_modalState:'open',hiddenState:true,_lastActive:'opener',getModalRoot:()=>root,applyStackPosition:()=>calls.push(['position']),focusFirst:()=>calls.push(['focus']),...overrides};
  return{calls,root,run:()=>sync.call(modal)};
}
test('Minimizing releases only the visible layer and restores focus before making its root inert',()=>{
  const f=fixture();f.run();
  assert.deepEqual(f.calls,[['remove-visible-layer'],['position'],['restore',true,'opener'],['attribute','aria-hidden','true']]);
  assert.equal(f.root.inert,true);
});
test('Restoring reactivates and raises the visible layer without replacing its opener',()=>{
  const f=fixture({hiddenState:false});f.run();
  assert.deepEqual(f.calls,[['attribute','aria-hidden','false'],['add-visible-layer'],['raise'],['focus']]);
  assert.equal(f.root.inert,false);
});
test('Unmounted, closed, closing and inline changes do not acquire a modal layer',()=>{
  for(const state of [{_isMounted:false},{openState:false},{display:'inline'},{_modalState:'closed'},{_modalState:'closing'}]){
    const f=fixture(state);f.run();assert.deepEqual(f.calls,[]);
  }
});
test('Template makes minimized and closed content inert and hidden from accessibility',async()=>{
  const template=await readFile(new URL('../src/smart/modal/js/templates/default.js',import.meta.url),'utf8');
  assert.match(template,/\?inert=\$\{!context\.open \|\| context\.minimized\}/);
  assert.match(template,/aria-hidden=\$\{context\.open && !context\.minimized/);
  assert.match(source,/this\.display !== "inline" && \(this\._isHidden \|\| this\.hasAttribute\("minimized"\)\)/);
});
