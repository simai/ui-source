import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/core/js/smart-base.js',import.meta.url),'utf8');
const body=source.split('async performComponentUpdate(changedAttributes = []) {')[1].split('\n  async renderComponent(')[0];
const run=new Function('return async function(changedAttributes=[]) {'+body.trim().replace(/\}\s*$/,'')+'}')();
async function exercise(template,module,domResult=true){
  const calls=[];
  const component={componentTemplateName:template,_externalTemplateModule:module,
    hasBuiltInTemplate:name=>name==='default',
    resolveUpdateMode:()=>{calls.push('resolve');return 'dom';},
    updateDom:()=>{calls.push('dom');return domResult;},
    renderComponent:async()=>calls.push('render'),afterUpdate:()=>{},
    emitComponentEvent:()=>{},createPropChangeDetail:()=>({})};
  await run.call(component,['text']);return calls;
}
test('external views never receive built-in DOM patches',async()=>{
  assert.deepEqual(await exercise('project',{}),['render']);
  assert.deepEqual(await exercise('project',null),['render']);
});
test('built-in fast path remains, including full render fallback',async()=>{
  assert.deepEqual(await exercise('default',null),['resolve','dom']);
  assert.deepEqual(await exercise('default',null,false),['resolve','dom','render']);
});
test('returning from an external view performs a full render',async()=>{
  assert.deepEqual(await exercise('default',{}),['render']);
});
const release=new Function(source.split('  _releaseExternalTemplate() {')[1].split('\n  runExternalHook(')[0].trim().replace(/\}\s*$/,''));
test('template release is idempotent even when destroy re-enters',()=>{
  const module={},calls=[];
  const component={_externalTemplateModule:module,
    runExternalHook:(name,detail,owner)=>{calls.push({name,owner});release.call(component);}};
  release.call(component);release.call(component);
  assert.deepEqual(calls,[{name:'destroy',owner:module}]);
  assert.equal(component._externalTemplateModule,null);
});
const disconnect=new Function(source.split('  disconnectedCallback() {')[1].split('\n  toBoolean(')[0].trim().replace(/\}\s*$/,''));
test('base cleanup survives a throwing component disconnect override',()=>{
  let released=0;
  const component={_isMounted:true,onDisconnected(){throw new Error('component failure');},
    _releaseExternalTemplate(){released++;},emitComponentEvent(){}};
  assert.throws(()=>disconnect.call(component),/component failure/);
  assert.equal(released,1);assert.equal(component._isMounted,false);
});
