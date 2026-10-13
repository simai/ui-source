import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/smart/gallery/index.js',import.meta.url),'utf8');
const method=(name)=>new Function('changedAttributes = []',source.split(`  ${name}(changedAttributes = []) {`)[1].split('\n  }')[0]);
const resolve=method('resolveUpdateMode'),update=method('updateDom');

test('Only Gallery selection/open state takes the non-rendering update path',()=>{
  for(const keys of [['current'],['open'],['current','open']])assert.equal(resolve(keys),'dom');
  for(const keys of [[],['title'],['slot-change'],['open','height']])assert.equal(resolve(keys),'lit');
});
test('Gallery updates selected slide before delegating modal state without replacing slots',()=>{
  const calls=[],g={resolveUpdateMode:resolve,openState:true,_syncingCurrent:false,getProp:()=>2,_setCurrent:(...args)=>calls.push(['current',...args]),_modal:{open:()=>calls.push(['open']),close:()=>calls.push(['close'])}};
  assert.equal(update.call(g,['current','open']),true);
  assert.deepEqual(calls,[['current',2,'api',{emit:false}],['open']]);
  calls.length=0;g.openState=false;assert.equal(update.call(g,['open']),true);assert.deepEqual(calls,[['close']]);
});
test('Gallery falls back to rendering when the modal is not yet available',()=>{
  assert.equal(update.call({resolveUpdateMode:resolve,openState:true},['open']),false);
  assert.equal(update.call({resolveUpdateMode:resolve},['slot-change']),false);
});

test('Gallery binds new Modal projection once and ignores nested render events',()=>{
  const handler=new Function('event',source.split('  _handleModalAfterRender(event) {')[1].split('\n  }')[0]);
  const slider={},calls=[],modal={getModalRoot:()=>({querySelector:()=>slider})};
  const g={_modal:modal,_lightboxSlider:{},current:2,_detachNestedListeners:()=>calls.push('detach'),_attachNestedListeners:()=>calls.push('attach'),_syncSliderSlot:(s,m)=>calls.push([s,m]),_syncSliderToIndex:(s,i)=>calls.push([s,i]),_queueNestedDefinitionSync:()=>calls.push('definitions')};
  handler.call(g,{target:{}});assert.equal(calls.length,0);
  handler.call(g,{target:modal});assert.equal(g._lightboxSlider,slider);assert.deepEqual(calls,['detach','attach',[slider,'lightbox'],[slider,1],'definitions']);
  calls.length=0;handler.call(g,{target:modal});assert.equal(calls.length,0);
});
