import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {fieldSize} from '../src/component/field-size.js';

const base=await readFile(new URL('../src/component/dropdown/js/_dropdown.js',import.meta.url),'utf8');
const smart=await readFile(new URL('../src/smart/dropdown/index.js',import.meta.url),'utf8');
const baseRuntime=vm.createContext({});
vm.runInContext(base.slice(base.indexOf('const DROPDOWN_SELECTOR'),base.indexOf('if (!document.__sfDropdownDocumentClickBound)')),baseRuntime);
test('dropdown keeps human label separate from machine value, including empty value',()=>{
  const item={dataset:{value:'kazan'},querySelector:s=>s==='.sf-list-item-container'?{textContent:'Казань'}:null};
  assert.equal(baseRuntime.getItemLabel(item),'Казань');
  assert.equal(baseRuntime.getItemValue(item),'kazan');
  item.dataset.value='';assert.equal(baseRuntime.getItemValue(item),'');
  delete item.dataset.value;assert.equal(baseRuntime.getItemValue(item),'Казань');
});

test('base outside-close delegates Smart state without touching rendered nodes',()=>{
  let closed=0;
  const host={__sfSmartElement:true,closeDropdown(){closed++;}};
  const root={closest:()=>host,querySelector(){throw new Error('Smart DOM belongs to its renderer');}};
  baseRuntime.closeDropdown(root);
  assert.equal(closed,1);
});

function fixture(){
  class Element {
    constructor(){this.attrs=new Map();this.events=[];}
    static define(){}
    getAttribute(n){return this.attrs.get(n)??null;}
    hasAttribute(n){return this.attrs.has(n);}
    setAttribute(n,v){const old=this.getAttribute(n);this.attrs.set(n,String(v));this.attributeChangedCallback(n,old,String(v));}
    removeAttribute(n){const old=this.getAttribute(n);this.attrs.delete(n);if(old!==null)this.attributeChangedCallback(n,old,null);}
    attributeChangedCallback(){}
    getBooleanAttr(n,f=false){return this.hasAttribute(n)?this.getAttribute(n)!=='false':f;}
    getEnumAttr(n,values,f){return values.includes(this.getAttribute(n))?this.getAttribute(n):f;}
    // The stub stands in for the real base, which resolves a prop from its
    // canonical attribute or from a legacy name the prop answers to.
    getProp(key){
      const config=this.constructor.props?.[key]??{};
      const names=[key.replace(/[A-Z]/g,l=>`-${l.toLowerCase()}`),...(config.aliases??[])];
      const name=names.find(candidate=>this.hasAttribute(candidate));
      const raw=name?this.getAttribute(name):undefined;
      if(raw===undefined||raw===null)return config.default;
      return Array.isArray(config.values)?(config.values.includes(raw)?raw:config.default):raw;
    }
    setAttributeValue(n,v){this.setAttribute(n,v);}
    requestComponentUpdate(){}
    dispatchEvent(e){this.events.push(e);}
    // The manifest's event sender (core element-manifest.js): the verb's DOM name.
    sfEmit(verb,detail){this.events.push({type:verb,detail});return true;}
    sfWord(key){return key;}
  }
  const runtime=vm.createContext({fieldSize,SfBaseElement:Element,DropdownElement:Element,
    // The inherited-value mixin is out of these tests' scope: it adds a state,
    // not a selection rule (simai/ui-source#28 has its own contract).
    InheritedValueField:(Base)=>Base,HTMLElement:Element,toBoolean:v=>v===''||v==='true',CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}});
  vm.runInContext(smart.slice(smart.indexOf('function normalizeSize')),runtime);
  const e=vm.runInContext('new SfDropdown()',runtime);
  e._options=[{value:'kazan',text:'Казань'},{value:'moscow',text:'Москва'}];
  return e;
}
test('Smart explicit empty value and removed value clear prior selection',()=>{
  const e=fixture();e._selectedValues=['kazan'];e.setAttribute('value','');
  assert.equal(e.hiddenValue,'');
  e.setAttribute('value','moscow');e.removeAttribute('value');
  assert.equal(e.hiddenValue,'');
});
test('Smart public value exposes initial selected options before attribute reflection',()=>{
  // value is the selected value itself, a string, as the manifest declares;
  // it used to be every template setting in one object (documentation trial).
  const e=fixture();e._selectedValues=['kazan'];
  assert.equal(e.value,e.hiddenValue);
  assert.equal(e.value,'kazan');
});
test('Smart disabling closes the popup and rejects user selection/removal',()=>{
  const e=fixture();e.setAttribute('value','kazan');e._open=true;
  e.setAttribute('disabled','');
  assert.equal(e._open,false);
  e.selectValue('moscow');e.removeSelectedValue('kazan');
  assert.equal(e.hiddenValue,'kazan');assert.equal(e.events.length,0);
});
test('filter result count is not an author request to disable a base dropdown',()=>{
  const body=base.slice(base.indexOf('function syncDisabledState'),base.indexOf('function dispatchDropdownChange'));
  assert.doesNotMatch(body,/AutoDisabled|getAvailableItems\(root\)\.length/);
  assert.doesNotMatch(body,/root\.classList\.toggle\("disabled"/);
});

test('Smart multiple labels follow the existing payload order without changing it',()=>{
  const e=fixture();e.setAttribute('multiple','');e.setAttribute('value','moscow,kazan');
  assert.equal(e.hiddenValue,'moscow,kazan');
  assert.equal(e.triggerText,'Москва, Казань');
  assert.deepEqual(Array.from(e.selectedOptions,o=>o.value),['moscow','kazan']);
  e.selectValue('moscow');assert.equal(e.triggerText,'Казань');
});

test('Smart avatar selection uses the label that is actually rendered',()=>{
  const e=fixture();e._options[0]={type:'avatar',value:'kazan',text:'Казань',avatarTitle:'Отдел — Казань'};
  e.setAttribute('value','kazan');assert.equal(e.triggerText,'Отдел — Казань');
  e.dispatchDropdownChange(e.selectedOptions[0]);assert.equal(e.events[0].detail.label,'Отдел — Казань');
});

test('base selection has one presentation path for initial state, updates and reset',()=>{
  assert.ok(base.includes('function syncSelectionPresentation(root)'));
  assert.equal((base.match(/syncSelectionPresentation\(root\);/g)||[]).length,5);
  assert.doesNotMatch(base,/else if \(!isTextItem\)/);
});

test('Smart accepts its projected option but rejects an unrelated outside item',()=>{
  const e=fixture(),item={dataset:{value:'moscow'},classList:{contains:()=>false}};
  e.contains=()=>false;e._list={contains:node=>node===item};
  e.handleOptionClick({target:{closest:()=>item},preventDefault(){}});
  assert.equal(e.hiddenValue,'moscow');
  e.handleOptionClick({target:{closest:()=>({dataset:{value:'kazan'},classList:item.classList})},preventDefault(){}});
  assert.equal(e.hiddenValue,'moscow');
});
