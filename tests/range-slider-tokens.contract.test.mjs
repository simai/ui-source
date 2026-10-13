/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=name=>readFile(new URL(`../src/component/range-slider/scss/${name}`,import.meta.url),'utf8');
test('thumb geometry inherits host tokens and shares the semantic control fallback',async()=>{
  const visual=await read('_css__thumbs.scss'),layout=await read('_css__range_slider_custom.scss');
  for(const dimension of ['height','width']){
    assert.doesNotMatch(visual,new RegExp(`--sf-thumb-handle--${dimension}:`));
    const declaration=`${dimension}: var(--sf-thumb-handle--${dimension}, var(--sf-ui-1\\/3--control-height));`;
    assert.ok(visual.includes(declaration));
    assert.ok(layout.includes(declaration));
  }
  assert.doesNotMatch(layout,/var\(--sf-text-size/);
});
test('rail defaults do not shadow inherited configuration',async()=>{
  const style=await read('_css__range_slider.scss');
  assert.doesNotMatch(style,/^\s*--sf-range-slider-/m);
  assert.ok(style.includes('var(--sf-range-slider-progress-line--height, var(--sf-range-slider-track--height, var(--sf-a4)))'));
  assert.ok(style.includes('var(--sf-radius--ui)'));
});
test('disabled ancestors exclude hover and use disabled roles',async()=>{
  const style=await read('_css__thumbs.scss');
  for(const selector of style.split('{').slice(0,-1).filter(s=>s.includes(':hover'))){
    assert.ok(selector.includes(':not([disabled] *):not(.disabled *)'));
  }
  assert.ok(style.includes('background-color: var(--sf-disable)'));
  assert.ok(style.includes('background-color: var(--sf-on-disable)'));
});

test('Smart range consumes the shared root-style contract on render and DOM updates',async()=>{
  const template=await readFile(new URL('../src/smart/range-slider/js/templates/default.js',import.meta.url),'utf8');
  const source=await readFile(new URL('../src/smart/range-slider/index.js',import.meta.url),'utf8');
  assert.ok(template.includes('style=${valueOrNothing(context.rootStyle)}'));
  assert.ok(source.includes("changedAttributes.includes('style') || changedAttributes.includes('root-style')"));
  assert.ok(source.includes('const style = this.getRootStyle();'));
});

test('thumb motion is bounded to paint and geometry properties',async()=>{
  const visual=await read('_css__thumbs.scss');
  const layout=await read('_css__range_slider_custom.scss');
  assert.doesNotMatch(`${visual}\n${layout}`,/transition-property:\s*all/);
  assert.ok(visual.includes('transition-property: background-color, box-shadow'));
  assert.ok(visual.includes('transition-property: background-color, height, width'));
  assert.ok(visual.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(visual.includes('transition-duration: 0s'));
});
