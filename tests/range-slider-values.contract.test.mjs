/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../src/component/range-slider/js/_range_slider.js',import.meta.url),'utf8');
class Element {
  constructor(attrs={}){this.attrs=attrs;}
  getAttribute(key){return this.attrs[key]??null;}
  hasAttribute(key){return key in this.attrs;}
}
const runtime=vm.createContext({HTMLElement:Element,getComputedStyle:()=>({direction:'ltr'})});
vm.runInContext(source.slice(source.indexOf('const '),source.indexOf("if (typeof window !== 'undefined')")),runtime);

test('range values preserve scientific step precision',()=>{
  for(const [step,decimals] of [['1e-3',3],['2.5e-3',4],['0.00100',3],['1e2',0],['2.5e1',0]]) {
    const root=new Element({'data-step':step});
    assert.equal(runtime.getValueDecimals(root),decimals,step);
  }
  const root=new Element({'data-step':'1e-3'});
  assert.equal(runtime.getNumericValues([0.002])[0],0.002);
  assert.equal(runtime.formatValue(root,0.002),'0.002');
});

test('display precision does not change values emitted by the engine',()=>{
  assert.deepEqual(Array.from(runtime.getNumericValues([1.25,8.75])),[1.25,8.75]);
  assert.equal(runtime.formatValue(new Element({'data-decimals':'1'}),1.25),'1.3');
});

test('range decimals stay inside JavaScript formatting bounds',()=>{
  for(const value of ['101','1e4','-2']) {
    const root=new Element({'data-decimals':value});
    assert.doesNotThrow(()=>runtime.formatValue(root,0.25));
    assert.ok(runtime.getValueDecimals(root)>=0&&runtime.getValueDecimals(root)<=100);
  }
});

test('range setter passes both comma-separated values to the existing engine',()=>{
  const root=new Element({'data-multiple':'true'});
  let passed;
  root.noUiSlider={set:value=>{passed=value;}};
  assert.equal(runtime.setRangeSliderValue(root,'30,70'),true);
  assert.deepEqual(Array.from(passed),['30','70']);
  runtime.setRangeSliderValue(root,[40,60]);
  assert.deepEqual(Array.from(passed),[40,60]);
  delete root.attrs['data-multiple'];
  runtime.setRangeSliderValue(root,[50,90]);
  assert.equal(passed,50);
});

test('range options normalize malformed public values without invalid geometry',()=>{
  const reversed=new Element({
    'data-min':'10','data-max':'0','data-start':'20,-5',
    'data-multiple':'true','data-margin':'500','data-connect':'false',
    'data-step':'-1',
  });
  const options=runtime.createSliderOptions(reversed);
  assert.deepEqual({...options.range},{min:0,max:10});
  assert.deepEqual(Array.from(options.start),[0,10]);
  assert.equal(options.connect,false);
  assert.equal(options.step,undefined);
  assert.equal(options.margin,10);

  const collapsed=new Element({
    'data-min':'5','data-max':'5','data-connect':'unknown',
  });
  const fallback=runtime.createSliderOptions(collapsed);
  assert.deepEqual({...fallback.range},{min:0,max:100});
  assert.deepEqual(Array.from(fallback.start),[0]);
  assert.equal(fallback.connect,'lower');
});
