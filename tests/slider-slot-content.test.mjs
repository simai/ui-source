import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/component/slider/js/_slide-content.js',import.meta.url),'utf8');
const {normalizeSlideContent}=await import(`data:text/javascript,${encodeURIComponent(source)}`);
const gallery=await readFile(new URL('../src/smart/gallery/index.js',import.meta.url),'utf8');
class FakeNode {
  static ELEMENT_NODE=1; static TEXT_NODE=3; static COMMENT_NODE=8; static DOCUMENT_FRAGMENT_NODE=11;
  constructor(type,text=''){this.nodeType=type;this.textContent=text;}
}
test('Slide normalization removes formatting but preserves meaningful authored nodes and order',()=>{
  const old=globalThis.Node;globalThis.Node=FakeNode;
  try {
    const card=new FakeNode(1),text=new FakeNode(3,'  meaningful text  '),emptyElement=new FakeNode(1),fragment=new FakeNode(11);
    const result=normalizeSlideContent([new FakeNode(3,'\n  \t'),card,new FakeNode(8,'author note'),text,emptyElement,fragment]);
    assert.deepEqual(result,[card,text,emptyElement,fragment]);assert.equal(text.textContent,'  meaningful text  ');
    assert.deepEqual(normalizeSlideContent(card),[card]);
  }finally{if(old===undefined)delete globalThis.Node;else globalThis.Node=old;}
});
test('Slide normalization retains legacy non-Node template values; consumers own empty/Node guards',()=>{
  const old=globalThis.Node;globalThis.Node=FakeNode;
  try{const template={strings:['card']};assert.deepEqual(normalizeSlideContent([template,'text',0]),[template,'text',0]);}
  finally{if(old===undefined)delete globalThis.Node;else globalThis.Node=old;}
});
test('Gallery projections clone slot content and retain framework runtime metadata',()=>{
  assert.match(gallery,/const content = slide\.cloneNode\(true\);\s*this\.copyRuntimeData\(slide, content\);\s*wrapper\.append\(content\)/);
  assert.doesNotMatch(gallery,/wrapper\.append\(slide\)/);
});
