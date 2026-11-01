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
  // Disabled, the handle is a solid disc of the disabled content role over the
  // surface, without a centre.
  assert.ok(style.includes('background: linear-gradient(var(--sf-on-disable), var(--sf-on-disable))'));
  assert.match(style,/:is\(\[disabled\], \.disabled\) \.sf-thumb-inner \{\s*background-color: transparent;/);
});

test('the handle is solid by default and the hollow centre is opt-in',async()=>{
  const style=await read('_css__thumbs.scss');
  // Unset, the centre is transparent; the public variable brings it back.
  assert.ok(style.includes('var(--sf-thumb-inner--background-color, var(--sf-range-slider-handle-inner-color, transparent))'));
  // A ring of the surface parts the disc from the fill.
  assert.ok(style.includes('box-shadow: var(--sf-thumb-handle--box-shadow, 0 0 0 var(--sf-thumb-handle--ring-width, 0px) var(--sf-thumb-handle--ring-color, var(--sf-surface-0))'));
  // Hover and press draw a halo of the primary state layer, 8% and 12%.
  assert.ok(style.includes('var(--sf-primary-transparent-select)'));
  assert.ok(style.includes('var(--sf-primary-transparent-active)'));
});

test('the handle stands above the progress, so the fill ends under it',async()=>{
  const layout=await read('_css__range_slider_custom.scss');
  const origin=layout.slice(layout.lastIndexOf('.sf-range-slider .sf-range-slider-origin {'));
  assert.match(origin.slice(0,origin.indexOf('}')),/z-index: 2;/);
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
