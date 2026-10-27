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

// simai/ui-source#49, #50: the layout of a Native checkbox and radio moved from
// the stylesheet into utility hints, and the constructors applied none of them,
// so the label drew inline (a 26x21 mark on a 21px row, a radio ring 2px wide
// with a 0px mark). Each constructor's private map is the stylesheet's hints,
// selector for selector, and the constructor applies every selector to the part
// it builds. Measured: tests/browser/choice-native-smart-geometry.browser.mjs.
const hintsOf=css=>Object.fromEntries([...css.matchAll(/utility-hint:([^*]*)\*\/\s*\n\s*([^{]+)\{/g)]
  .map(([,hint,selector])=>[selector.trim(),[...hint.matchAll(/\(\.[^)]+\)/g)].map(([m])=>m.slice(2,-1))]));
for (const [family,stem,scss,Class,parts] of [
  ['checkbox','checkbox','_css__checkbox.scss','Checkbox',{
    template:'.sf-checkbox', box:'.sf-checkbox .sf-checkbox-box', container:'.sf-checkbox .sf-checkbox-container',
    top:'.sf-checkbox .sf-checkbox-top', label:'.sf-checkbox .sf-checkbox-label'}],
  ['radio','radio','_css_radio.scss','Radio',{
    template:'.sf-radio-button', box:'.sf-radio-button .sf-radio-button-box', container:'.sf-radio-button .sf-radio-button-container',
    top:'.sf-radio-button .sf-radio-button-top', text:'.sf-radio-button .sf-radio-button-text'}],
]) {
  test(`${Class} constructor applies the layout its stylesheet hints`,async()=>{
    const map=JSON.parse(await read(`component/${family}/json/${stem}.utility.json`));
    const hints=hintsOf(await read(`component/${family}/scss/${scss}`));
    const fromMap=Object.fromEntries(Object.entries(map).map(([selector,values])=>[selector,ComponentObserver.prototype.extractUtilityClasses(values)]));
    assert.deepEqual(fromMap,hints,'the map is the stylesheet hints');
    for (const selector of Object.values(parts)) assert.ok(fromMap[selector]?.includes('flex'),`${selector} is a flex box`);
    const js=await read(`component/${family}/js/_${family}.js`);
    assert.match(js,new RegExp(`import \\w+ from '\\.\\./json/${stem}\\.utility\\.json'`));
    assert.match(js,new RegExp(`${Class}\\.utilityMap = \\w+;`));
    for (const [part,selector] of Object.entries(parts)) {
      assert.ok(js.includes(`this.applyLayoutUtilities(this.${part}, '${selector}');`),`${part} gets ${selector}`);
    }
    // applyLayoutUtilities reads the class's map: an instance gets the classes.
    class Probe extends ComponentObserver {}
    Probe.utilityMap=map;
    const added=[];
    // Without a constructor call: the base constructor announces itself on window.
    Object.create(Probe.prototype).applyLayoutUtilities({classList:{add:c=>added.push(c)}},parts.template);
    assert.deepEqual(added,hints[parts.template]);
  });
}
