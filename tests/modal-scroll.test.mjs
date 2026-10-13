import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/component/modal/js/_scroll.js', import.meta.url), 'utf8');
const { lockModalScroll, unlockModalScroll } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

function setup({html=false,body=false,gap=16,padding='7px',priority='important',computed=7}={}) {
  const node=locked=>{
    const classes=new Set(locked?['overflow-hidden']:[]);
    let value=padding,importance=priority;
    return {clientWidth:1000,classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)},style:{
      getPropertyValue:()=>value,getPropertyPriority:()=>importance,
      setProperty(k,v,p=''){value=v;importance=p;},removeProperty(){value='';importance='';}
    }};
  };
  globalThis.document={documentElement:node(html),body:node(body)};
  globalThis.window={innerWidth:1000+gap,getComputedStyle:()=>({paddingInlineEnd:String(computed)})};
  return document;
}

test('Scroll compensation adds to existing padding and preserves declaration priority',()=>{
  const d=setup(),saved=lockModalScroll();
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'23px');
  assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),'important');
  unlockModalScroll(saved);
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'7px');
  assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),'important');
  assert.equal(d.body.classList.contains('overflow-hidden'),false);
});
test('Each pre-existing html/body lock survives independently',()=>{
  for(const html of [false,true])for(const body of [false,true]){
    const d=setup({html,body});unlockModalScroll(lockModalScroll());
    assert.equal(d.documentElement.classList.contains('overflow-hidden'),html);
    assert.equal(d.body.classList.contains('overflow-hidden'),body);
  }
});
test('Overlay scrollbars and preserveScrollGap false do not own page padding',()=>{
  for(const [gap,preserve]of [[0,true],[16,false]]){
    const d=setup({gap}),saved=lockModalScroll(preserve);
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'7px');
    d.body.style.setProperty('padding-inline-end','13px','important');unlockModalScroll(saved);
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'13px');
  }
});
test('Author changes to compensated padding or its priority are not overwritten',()=>{
  for(const [value,priority]of [['13px','important'],['23px','']]){
    const d=setup(),saved=lockModalScroll();d.body.style.setProperty('padding-inline-end',value,priority);unlockModalScroll(saved);
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),value);
    assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),priority);
  }
});
test('Stylesheet padding is restored by removing only the temporary declaration',()=>{
  const d=setup({padding:'',priority:'',computed:12.5}),saved=lockModalScroll();
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'28.5px');
  unlockModalScroll(saved);assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'');
});
test('Cleanup targets original nodes; an absent lease leaves the page unchanged',()=>{
  const d=setup(),original=d.body,saved=lockModalScroll();d.body={};unlockModalScroll(saved);
  assert.equal(original.style.getPropertyValue('padding-inline-end'),'7px');
  const next=setup({body:true});unlockModalScroll(null);assert.equal(next.body.classList.contains('overflow-hidden'),true);
  document.body=null;assert.equal(lockModalScroll(),null);
});
