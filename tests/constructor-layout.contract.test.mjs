import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(`../src/${path}`,import.meta.url),'utf8');
const observer=await read('core/js/ComponentObserver.js');
const {ComponentObserver}=await import(`data:text/javascript;base64,${Buffer.from(observer).toString('base64')}`);
test('utility extraction excludes CSS function arguments and keeps explicit class annotations',()=>{
  assert.deepEqual(ComponentObserver.prototype.extractUtilityClasses([
    'gap/var(--sf-space-1\\/4)', 'width/calc(var(--sf-a1) * 2)',
    'display/flex (.flex)', 'layout (.flex .flex-col)', 'responsive (.md:grid-col-2)',
  ]),['flex','flex-col','md:grid-col-2']);
});
test('field constructors use real selectors and do not stretch labels or shrink surfaces',async()=>{
  for(const [family,file,root,label,field] of [
    ['inputs','input','.sf-input','.sf-input .sf-input-label','.sf-input .sf-input-field'],
    ['textarea','textarea','.sf-textarea','.sf-textarea .sf-textarea-label','.sf-textarea textarea'],
    ['quantity','quantity','.sf-quantity','.sf-quantity .sf-quantity-label','.sf-quantity .sf-quantity-wrap'],
    ['country-code','country-code','.sf-country-code','.sf-country-code .sf-country-code-label','.sf-country-code .sf-country-code-field'],
  ]) {
    const map=JSON.parse(await read(`component/${family}/json/${file}.utility.json`));
    assert.ok(map[label],label);
    assert.ok(!map[root].some(value=>value.includes('.items-start')),root);
    assert.ok(!map[label].some(value=>value.includes('.flex-1')),label);
    assert.ok(!map[field].some(value=>value.includes('.flex-1')),field);
  }
  const input=await read('component/inputs/js/_inputs.js');
  assert.match(input,/applyLayoutUtilities\(labelWrap, '\.sf-input \.sf-input-label'\)/);
  assert.match(input,/applyLayoutUtilities\(input, '\.sf-input \.sf-input-field input'\)/);
});

test('native field min-content size cannot force the surrounding grid wider at text zoom',async()=>{
  for(const [family,stem,selector] of [['inputs','inputs','input'],['textarea','textarea','textarea'],['quantity','quantity','quantity']]) {
    const css=await read(`component/${family}/scss/_css__${stem}.scss`);
    assert.match(css,new RegExp(`\\.sf-${selector} \\{\\s*min-inline-size: 0;`));
    assert.match(css,selector==='textarea'?/\.sf-textarea textarea \{[^}]*\bmin-inline-size: 0;/:new RegExp(`\\.sf-${selector} \\.sf-${selector}-${selector==='input'?'field':'wrap'} input \\{[^}]*\\bmin-inline-size: 0;`));
  }
});
