import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/core/js/smart-base.js',import.meta.url),'utf8');
const body=source.split('  static get observedAttributes() {')[1].split('\n  static propsToAttributes(')[0].trim().replace(/\}\s*$/,'');
const observed=new Function(body);
test('template is observed even when a component declares only field props',()=>{
  assert.ok(observed.call({propsToAttributes:()=>['value','disabled']}).includes('template'));
});
test('explicit template prop is not duplicated and host attributes remain',()=>{
  const attrs=observed.call({propsToAttributes:()=>['template','value']});
  assert.equal(attrs.filter(name=>name==='template').length,1);
  for(const name of ['value','root-class','root-style','style'])assert.ok(attrs.includes(name));
});
