import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/smart/modal/index.js',import.meta.url),'utf8');
const method='attributeChangedCallback(name, oldValue, newValue) {'+source.split('  attributeChangedCallback(name, oldValue, newValue) {')[1].split('\n  teardownModal()')[0];
const Modal=new Function('Base',`return class extends Base {${method}}`)(class {attributeChangedCallback(){}});
test('removing open invalidates rendered state even if close sees an already-closed modal',()=>{
  const modal=new Modal(),reasons=[];modal._isMounted=true;modal.close=()=>{};
  modal.requestComponentUpdate=reason=>reasons.push(reason);
  modal.attributeChangedCallback('open','',null);
  assert.deepEqual(reasons,['open-attribute']);
});
test('internal open synchronization does not recurse into update handling',()=>{
  const modal=new Modal();modal._syncingOpenAttribute=true;
  modal.requestComponentUpdate=()=>assert.fail('internal sync');
  modal.attributeChangedCallback('open','',null);
});
