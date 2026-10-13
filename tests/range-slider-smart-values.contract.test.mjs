import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../src/smart/range-slider/index.js',import.meta.url),'utf8');
test('automatic multiple-to-single transition uses the requested handle count',()=>{
  class Element{}
  const root=new Element();root.noUiSlider={};root.querySelectorAll=()=>[{},{}];
  let setterCalls=0;
  class Base {
    static define(){}
    getAttribute(name){return this.attrs[name]??null;}
    hasAttribute(name){return name in this.attrs;}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];}
  }
  const context=vm.createContext({SfBaseElement:Base,HTMLElement:Element,
    setRangeSliderValue:()=>setterCalls++,getRangeSliderValue:()=>[40,75]});
  vm.runInContext(source.slice(source.indexOf('function serializeValue'),source.indexOf("SfRangeSlider.define('sf-range-slider');"))+'\nglobalThis.Slider=SfRangeSlider;',context);
  const slider=new context.Slider();
  slider.attrs={value:'25,75',multiple:''};slider._autoMultiple=true;
  slider.getSliderRoot=()=>root;
  slider.setValue(40);
  assert.equal(slider.getAttribute('value'),'40');
  assert.equal(slider.hasAttribute('multiple'),false);
  assert.equal(setterCalls,0,'a two-handle engine must be rebuilt, not given one value');
});
