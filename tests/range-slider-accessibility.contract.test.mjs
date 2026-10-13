/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../src/component/range-slider/js/_range_slider.js',import.meta.url),'utf8');
test('bulk initialization does not pass the callback index as an ARIA owner',()=>{
  assert.doesNotMatch(source,/\.forEach\(bindRangeSlider\)/);
  assert.match(source,/accessibilityOwner instanceof HTMLElement \? accessibilityOwner : root/);
});
function fixture(){
  class Element {
    constructor(attrs={}){
      this.attrs=attrs;this.dataset={};
      this.classList={contains:name=>String(this.attrs.class||'').split(/\s+/).includes(name)};
    }
    getAttribute(name){return this.attrs[name]??null;}
    hasAttribute(name){return name in this.attrs;}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];}
    querySelectorAll(){return this.handles||[];}
  }
  const observers=[];
  class Observer {
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(owner){this.owner=owner;}
    disconnect(){this.disconnected=true;}
  }
  const newRuntime=()=>{
    const runtime=vm.createContext({HTMLElement:Element,MutationObserver:Observer});
    vm.runInContext(source.slice(source.indexOf('const '),source.indexOf("if (typeof window !== 'undefined')")),runtime);
    return runtime;
  };
  const runtime=newRuntime();
  const root=new Element();root.handles=[new Element(),new Element()];
  return {runtime,newRuntime,root,Element,observers};
}

test('range accessibility follows standard names but preserves author overrides',()=>{
  const {runtime,root,observers}=fixture();
  root.attrs={'aria-labelledby':'price-title','aria-describedby':'price-hint'};
  runtime.bindSliderAccessibility(root);
  assert.equal(root.handles[0].attrs['aria-labelledby'],'price-title');
  assert.equal(root.handles[1].attrs['aria-describedby'],'price-hint');
  root.handles[1].attrs['aria-labelledby']='upper-title';
  delete root.attrs['aria-labelledby'];root.attrs['aria-label']='Цена';
  observers.at(-1).callback();
  assert.equal(root.handles[0].attrs['aria-label'],'Цена');
  assert.equal(root.handles[0].attrs['aria-labelledby'],undefined);
  assert.equal(root.handles[1].attrs['aria-labelledby'],'upper-title');
  assert.equal(root.handles[1].attrs['aria-label'],undefined);
});

test('a separately bundled Smart runtime can release an existing base binding',()=>{
  const {runtime,newRuntime,root,observers}=fixture();
  root.attrs={'aria-label':'Volume'};
  runtime.bindSliderAccessibility(root);
  root.noUiSlider={destroy(){}};
  newRuntime().unbindRangeSlider(root);
  assert.equal(observers[0].disconnected,true);
});

test('range accessibility can use the Smart owner and releases observers',()=>{
  const {runtime,root,Element,observers}=fixture();
  runtime.bindSliderAccessibility(root);
  assert.deepEqual(root.handles[0].attrs,{});
  const owner=new Element({'aria-label':'Яркость'});
  runtime.bindSliderAccessibility(root,owner);
  assert.equal(observers[0].disconnected,true);
  assert.equal(root.handles[0].attrs['aria-label'],'Яркость');
  delete owner.attrs['aria-label'];observers.at(-1).callback();
  assert.equal(root.handles[0].attrs['aria-label'],undefined);
  root.noUiSlider={destroy(){}};
  runtime.unbindRangeSlider(root);
  assert.equal(observers.at(-1).disconnected,true);
});

test('two handles receive distinct concise boundary names and follow updates',()=>{
  const {runtime,root,Element,observers}=fixture();
  root.attrs={
    'data-lower-label':'Минимальная цена',
    'data-upper-label':'Максимальная цена',
    'aria-describedby':'price-hint',
  };
  runtime.bindSliderAccessibility(root);
  assert.equal(root.handles[0].attrs['aria-label'],'Минимальная цена');
  assert.equal(root.handles[1].attrs['aria-label'],'Максимальная цена');
  assert.equal(root.handles[1].attrs['aria-describedby'],'price-hint');
  root.attrs['data-upper-label']='Верхняя граница цены';
  observers.at(-1).callback();
  assert.equal(root.handles[1].attrs['aria-label'],'Верхняя граница цены');

  const owner=new Element({
    'aria-label':'Цена',
    'lower-label':'От',
    'upper-label':'До',
  });
  runtime.bindSliderAccessibility(root,owner);
  delete root.attrs['data-lower-label'];
  delete root.attrs['data-upper-label'];
  observers.at(-1).callback();
  assert.equal(root.handles[0].attrs['aria-label'],'От');
  assert.equal(root.handles[1].attrs['aria-label'],'До');
});

test('disabled range exposes its state to assistive technology',()=>{
  const {runtime,root,observers}=fixture();
  root.attrs.disabled='';
  runtime.bindSliderAccessibility(root);
  assert.equal(root.handles[0].attrs['aria-disabled'],'true');
  assert.equal(root.handles[1].attrs['aria-disabled'],'true');
  delete root.attrs.disabled;
  observers.at(-1).callback();
  assert.equal(root.handles[0].attrs['aria-disabled'],undefined);
  assert.equal(root.handles[1].attrs['aria-disabled'],undefined);
});
