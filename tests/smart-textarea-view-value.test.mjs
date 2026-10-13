import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/smart/textarea/index.js',import.meta.url),'utf8');
const body=source.split('  templateContext() {')[1].split('\n  onDisconnected(')[0].trim().replace(/\}\s*$/,'');
const context=new Function(body);
function read(controlled,field,declared='') {
  return context.call({getPropsContext:()=>({value:declared}),hasAttribute:()=>controlled,
    querySelector:()=>field,createTemplateContext:v=>v}).value;
}
test('textarea external context receives current multiline native value',()=>{
  assert.equal(read(false,{value:'First\nSecond'}),'First\nSecond');
});
test('textarea controlled value and initial render preserve declared semantics',()=>{
  assert.equal(read(true,{value:'Native'},'Declared'),'Declared');
  assert.equal(read(false,null),'');
  assert.equal(read(false,{value:''}),'');
});
