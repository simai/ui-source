import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const dots=await readFile(new URL('../src/component/slider/scss/_css__slider_dots.scss',import.meta.url),'utf8');
const slider=await readFile(new URL('../src/component/slider/scss/_css__slider.scss',import.meta.url),'utf8');
const template=await readFile(new URL('../src/smart/slider/js/templates/default.js',import.meta.url),'utf8');
test('Slider reserves semantic pointer targets while retaining geometric marker sizes',()=>{
  assert.match(dots,/--sf-slider-dots-dot--target-size: var\(--sf-ui-1\\\/3--control-height\)/);
  assert.doesNotMatch(dots,/--sf-text-size/);
  assert.match(dots,/\.sf-slider-dots-dot::before/);
  assert.match(dots,/gap: max\(var\(--sf-slider-dots--gap\), calc\(var\(--sf-slider-dots-dot--target-size\) - var\(--sf-slider-dots-dot--width\) \+ var\(--sf-space-1\\\/4\)\)\)/);
});
test('Slider content mode is opt-in and retains explicit media dimension overrides',()=>{
  assert.match(slider,/\.sf-slider--content \.sf-slider-slide\s*\{\s*height: var\(--sf-slider-slide--height, auto\);\s*min-height: var\(--sf-slider-slide--min-height, 0\)/);
  assert.match(slider,/\.sf-slider--content \.sf-slider-controls\s*\{\s*position: static/);
  assert.match(slider,/\.sf-slider \.sf-slider-controls\s*\{[^}]*position: absolute/s);
});
test('Smart Slider fallback surfaces use the semantic surface radius',()=>{
  assert.match(template,/class="radius-surface bg-primary/);
  assert.doesNotMatch(template,/class="radius-3 bg-(?:primary|secondary|tertiary)/);
});
test('Slider defaults bridge semantic spacing and duration tokens into Swiper',()=>{
  assert.match(slider,/--sf-slider--duration: var\(--sf-duration-normal\)/);
  assert.match(slider,/--sf-slider--space-between: var\(--sf-space-1\)/);
  assert.match(slider,/--sf-slider-thumbnails--space-between: var\(--sf-space-1\\\/2\)/);
  assert.doesNotMatch(template,/data-space-between=\$\{String\(context\.spaceBetween\)\}/);
  assert.doesNotMatch(template,/data-speed=\$\{String\(context\.speed\)\}/);
});
