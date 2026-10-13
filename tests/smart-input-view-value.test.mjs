import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/smart/inputs/index.js',import.meta.url),'utf8');
const body=source.split('  templateContext() {')[1].split('\n  onDisconnected(')[0].trim().replace(/\}\s*$/,'');
const context=new Function(body);
function exercise(controlled,value,attributeValue='',defaultValue='initial') {
  return context.call({getPropsContext:()=>({value:attributeValue,name:'title'}),hasAttribute:()=>controlled,
    value,getInputElement:()=>({value}),defaultValue,createTemplateContext:v=>v});
}
test('uncontrolled view receives current native value separately from reset default',()=>{
  const c=exercise(false,'User edit');
  assert.equal(c.value,'User edit');assert.equal(c.defaultValue,'initial');assert.equal(c.hasControlledValue,false);
});
test('controlled value remains owned by declared prop',()=>{
  assert.equal(exercise(true,'Native edit','Declared').value,'Declared');
});
test('empty native edit does not fall back to reset default',()=>{
  assert.equal(exercise(false,'').value,'');
});
test('initial uncontrolled render uses defaultValue when no native control exists',()=>{
  const c=context.call({getPropsContext:()=>({value:''}),hasAttribute:()=>false,
    getInputElement:()=>null,defaultValue:'Initial',createTemplateContext:v=>v});
  assert.equal(c.value,'Initial');
});
