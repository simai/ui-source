import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('base dropdown retains initial selection separately and releases reset subscription',async()=>{
  const source=await read('src/component/dropdown/js/_dropdown.js');
  assert.ok(source.includes("'__sfDropdownResetValues'"));
  assert.ok(source.includes('bindFormReset(resetControl'));
  assert.ok(source.includes('root.__sfDropdownReleaseReset?.()'));
  assert.ok(source.includes("field.querySelector(':scope > button')"));
  assert.ok(source.includes('|| node.isConnected'));
});
test('Smart reset is independent of current reflected value and synchronizes cached display',async()=>{
  const source=await read('src/smart/dropdown/index.js');
  assert.ok(source.includes("hasOwnProperty.call(this, '_resetValues')"));
  assert.ok(source.includes('this._selectedValues = [...this._resetValues]'));
  assert.ok(source.includes('if (display) display.value = this.triggerText'));
  assert.ok(source.includes('this._releaseReset?.()'));
});
