import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('range slider decoration does not add another interactive owner',async()=>{
  const source=await readFile(new URL('../src/component/range-slider/js/_range_slider.js',import.meta.url),'utf8');
  class Element {
    constructor(){this.attrs={};this.classList={add(){},remove(){},toggle(){}};}
    setAttribute(key,value){this.attrs[key]=value;}
    append(node){this.child=node;}
  }
  const area=new Element();area.querySelector=()=>null;
  const handle=new Element();handle.querySelector=()=>area;
  const context=vm.createContext({HTMLElement:Element,getHandleLabelMode:()=> 'none',
    getHandleLabelPosition:()=> 'top',getHandles:()=>[handle],
    isDisabledRoot:()=>false,createVisualNode:()=>new Element()});
  vm.runInContext(source.slice(source.indexOf('function decorateHandles('),source.indexOf('function updateHandleLabels(')),context);
  context.decorateHandles({});
  assert.ok(area.child);
  assert.equal(area.attrs.tabindex,undefined);
  assert.equal(area.attrs.role,undefined);
});

test('range slider uses actual handle keyboard focus and system high contrast',async()=>{
  const styles=await readFile(new URL('../src/component/range-slider/scss/_css__thumbs.scss',import.meta.url),'utf8');
  assert.doesNotMatch(styles,/:focus(?![\w-])/);
  assert.match(styles,/\.sf-range-slider-handle:focus-visible \.sf-thumb-handle\s*\{/);
  // The handle stands free on the track, so the ring sits outside its edge.
  assert.match(styles,/outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.match(styles,/@media \(forced-colors: active\)/);
  assert.match(styles,/outline: var\(--sf-focus-outline-width\) solid Highlight/);
});
