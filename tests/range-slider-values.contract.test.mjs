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
// The page language comes from core (page-language.js); here it is English.
const runtime=vm.createContext({HTMLElement:Element,getComputedStyle:()=>({direction:'ltr'}),pageLocale:()=>'en'});
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

test('a value is written in the page language, or in data-locale',()=>{
  assert.equal(runtime.formatValue(new Element({'data-step':'0.01','data-suffix':' кг','data-locale':'ru'}),1.234),'1,23\u00a0кг');
  assert.equal(runtime.formatValue(new Element({'data-step':'1e-3','data-locale':'ru'}),0.002),'0,002');
  assert.equal(runtime.formatValue(new Element({'data-step':'0.01'}),1.234),'1.23');
});

// Acceptance R3 (S1): the decimals come from the step, and a value on its step
// is never shown rounded off it -- 2.6 with step 0.1 is «2,6», not «3».
test('step 0.1 writes 2.6 as «2,6 кг», with or without a smaller precision',()=>{
  const ru={'data-step':'0.1','data-suffix':' кг','data-locale':'ru'};
  assert.equal(runtime.formatValue(new Element(ru),2.6),'2,6\u00a0кг');
  assert.equal(runtime.formatValue(new Element(ru),2.5),'2,5\u00a0кг');
  assert.equal(runtime.formatValue(new Element({...ru,'data-precision':'1'}),2.6),'2,6\u00a0кг');
  assert.equal(runtime.formatValue(new Element({...ru,'data-precision':'0'}),2.6),'2,6\u00a0кг');
  assert.equal(runtime.formatValue(new Element({...ru,'data-precision':'2'}),2.6),'2,60\u00a0кг');
  assert.equal(runtime.formatRangeText(new Element(ru),[2.6,7.4]),'2,6 – 7,4\u00a0кг');
});

test('the Smart element writes no precision unless it is set',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../src/smart/slider-range/component.json',import.meta.url),'utf8'));
  // A number setting without a default reads as 0 (core element-manifest), and
  // data-precision="0" rounded 2.6 to «3» for step 0.1.
  assert.equal(manifest.settings.precision.default,null);
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

test('S1: thousands grouped, a unit held by a no-break space, precision before decimals',()=>{
  assert.equal(runtime.formatValue(new Element({'data-suffix':' ₽','data-locale':'ru'}),20000),'20\u00a0000\u00a0₽');
  assert.equal(runtime.formatValue(new Element({'data-prefix':'от ','data-locale':'ru'}),5000),'от\u00a05\u00a0000');
  assert.equal(runtime.formatValue(new Element({'data-grouping':'false','data-locale':'ru'}),2026),'2026');
  assert.equal(runtime.formatValue(new Element({'data-step':'0.5','data-suffix':' кг','data-locale':'ru'}),2.5),'2,5\u00a0кг');
  assert.equal(runtime.formatValue(new Element({'data-precision':'2','data-decimals':'0','data-locale':'ru'}),2.5),'2,50');
  assert.equal(runtime.formatValue(new Element({'data-decimals':'1','data-locale':'ru'}),2),'2,0');
});
