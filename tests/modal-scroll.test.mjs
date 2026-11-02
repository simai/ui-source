// The page lock a modal takes: since the reuse audit of 2026-11-02 it is the
// layer stack's default one (lockPageScroll in core/js/layer-stack.js), which
// every layer that locks the page takes -- a drawer, a site header and a search
// window as well. These are the modal's checks, kept against the stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/core/js/layer-stack.js', import.meta.url), 'utf8');
const { lockPageScroll } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

function setup({html=false,body=false,gap=16,padding='7px',priority='important',computed=7}={}) {
  const node=locked=>{
    const classes=new Set(locked?['overflow-hidden']:[]);
    const props=new Map([['padding-inline-end',[padding,priority]]]);
    return {clientWidth:1000,classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)},style:{
      getPropertyValue:k=>props.get(k)?.[0]??'',getPropertyPriority:k=>props.get(k)?.[1]??'',
      setProperty(k,v,p=''){props.set(k,[v,p]);},removeProperty(k){props.delete(k);}
    }};
  };
  globalThis.document={documentElement:node(html),body:node(body)};
  globalThis.window={innerWidth:1000+gap,getComputedStyle:()=>({paddingInlineEnd:String(computed)})};
  return document;
}

test('Scroll compensation adds to existing padding and preserves declaration priority',()=>{
  const d=setup(),release=lockPageScroll();
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'23px');
  assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),'important');
  assert.equal(d.body.classList.contains('overflow-hidden'),true);
  assert.equal(d.documentElement.style.getPropertyValue('overflow'),'hidden');
  release();
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'7px');
  assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),'important');
  assert.equal(d.body.classList.contains('overflow-hidden'),false);
  assert.equal(d.documentElement.style.getPropertyValue('overflow'),'');
});
test('Each pre-existing html/body lock survives independently',()=>{
  for(const html of [false,true])for(const body of [false,true]){
    const d=setup({html,body});lockPageScroll()();
    assert.equal(d.documentElement.classList.contains('overflow-hidden'),html);
    assert.equal(d.body.classList.contains('overflow-hidden'),body);
  }
});
test('An overflow the page wrote is given back, and one it writes while locked stays',()=>{
  let d=setup();d.body.style.setProperty('overflow','clip');
  const release=lockPageScroll();assert.equal(d.body.style.getPropertyValue('overflow'),'hidden');
  release();assert.equal(d.body.style.getPropertyValue('overflow'),'clip');
  d=setup();const again=lockPageScroll();d.body.style.setProperty('overflow','auto');again();
  assert.equal(d.body.style.getPropertyValue('overflow'),'auto');
});
test('Overlay scrollbars and preserveScrollGap false do not own page padding',()=>{
  for(const [gap,preserve]of [[0,true],[16,false]]){
    const d=setup({gap}),release=lockPageScroll({preserveScrollGap:preserve});
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'7px');
    d.body.style.setProperty('padding-inline-end','13px','important');release();
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'13px');
  }
});
test('Author changes to compensated padding or its priority are not overwritten',()=>{
  for(const [value,priority]of [['13px','important'],['23px','']]){
    const d=setup(),release=lockPageScroll();d.body.style.setProperty('padding-inline-end',value,priority);release();
    assert.equal(d.body.style.getPropertyValue('padding-inline-end'),value);
    assert.equal(d.body.style.getPropertyPriority('padding-inline-end'),priority);
  }
});
test('Stylesheet padding is restored by removing only the temporary declaration',()=>{
  const d=setup({padding:'',priority:'',computed:12.5}),release=lockPageScroll();
  assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'28.5px');
  release();assert.equal(d.body.style.getPropertyValue('padding-inline-end'),'');
});
test('Cleanup targets original nodes; no body leaves the page unchanged',()=>{
  const d=setup(),original=d.body,release=lockPageScroll();d.body={};release();
  assert.equal(original.style.getPropertyValue('padding-inline-end'),'7px');
  assert.equal(original.classList.contains('overflow-hidden'),false);
  document.body=null;const none=lockPageScroll();assert.equal(typeof none,'function');none();
});
