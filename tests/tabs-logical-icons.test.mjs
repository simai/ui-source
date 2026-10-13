import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/smart/tabs/index.js', import.meta.url), 'utf8');
const parse = vm.runInNewContext(source.slice(source.indexOf('function parseItems'), source.indexOf('function normalizeIndex')) + '\nparseItems;');
const getter = new Function(source.split('  get computedItems() {')[1].split('\n  get activeIndex()')[0].trim().replace(/\}\s*$/, ''));
test('compact tab data retains explicit empty canonical icons and legacy options', () => {
  const items = parse('One::icon=add,icon-left=delete,icon-start=,icon-end=close|Two::icon-right=remove');
  assert.equal(items[0].iconStart, ''); assert.equal(items[0].iconEnd, 'close');
  assert.equal(items[0].iconLeft, 'delete'); assert.equal(items[1].iconStart, null);
  const result = getter.call({dataTabs:[],items,dataPanels:[],activeIndex:0,tabCount:items.length});
  assert.equal(result[0].iconLeft, ''); assert.equal(result[0].iconRight, 'close');
  assert.equal(result[1].iconEnd, 'remove');
});
test('canonical tab object values survive serialization and recomputation', () => {
  const start = source.indexOf('  setState(nextState = {}) {') + '  setState(nextState = {}) {'.length;
  const end = source.indexOf('\n  }', start);
  const setState = new Function('nextState', 'toAttributeName', source.slice(start,end));
  const attributes = new Map();
  const input = [{label:'One',icon:'add',iconLeft:'delete',iconStart:'',iconEnd:'close'}];
  setState.call({setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name)}, {items:input}, value=>value);
  const restored = parse(attributes.get('items'));
  assert.equal(restored[0].iconStart, ''); assert.equal(restored[0].iconEnd,'close');
  const result = getter.call({dataTabs:[],items:restored,dataPanels:[],activeIndex:0,tabCount:1});
  assert.equal(result[0].iconStart,''); assert.equal(result[0].iconLeft,'');
  assert.equal(result[0].iconEnd,'close');
});
