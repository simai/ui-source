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
  // Dots 8 apart (owner decision C246); the press area is the step wide and a target high.
  assert.match(dots,/--sf-slider-dots--gap: var\(--sf-space-1\\\/3\);\n  gap: var\(--sf-slider-dots--gap\);/);
  assert.match(dots,/width: calc\(100% \+ 2 \* var\(--sf-slider-dots-dot--stroke-width, var\(--sf-px\)\) \+ var\(--sf-slider-dots--gap\)\);\n  height: max\(100%, var\(--sf-slider-dots-dot--target-size\)\);/);
});
test('Slider content mode is opt-in and retains explicit media dimension overrides',()=>{
  assert.match(slider,/\.sf-slider--content \.sf-slider-slide\s*\{\s*height: var\(--sf-slider-slide--height, auto\);\s*min-height: var\(--sf-slider-slide--min-height, 0\)/);
  assert.match(slider,/\.sf-slider--content \.sf-slider-controls\s*\{\s*position: static/);
  // Pictures (carousel study 2026-11-21): the controls lend their parts to the
  // block's grid; the arrows take the strip's row, the position a row under it.
  assert.match(slider,/\.sf-slider:not\(\.sf-slider--content\) > \.sf-slider-controls \{\s*display: contents;/);
  assert.match(slider,/> \.sf-slider-arrows \{[^}]*grid-row: 1;[^}]*padding-inline: var\(--sf-slider-arrow-offset-inline, var\(--sf-space-2\)\);/s);
});
test('Smart Slider fallback surfaces use the semantic surface radius',()=>{
  assert.match(template,/class="radius-surface bg-primary/);
  assert.doesNotMatch(template,/class="radius-3 bg-(?:primary|secondary|tertiary)/);
});
test('Slider defaults bridge semantic spacing and duration tokens into Swiper',()=>{
  assert.match(slider,/--sf-slider--duration: var\(--sf-duration-normal\)/);
  // Several slides in view stand a half step apart (SL-8).
  assert.match(slider,/--sf-slider--space-between: var\(--sf-space-1\\\/2\)/);
  assert.match(slider,/--sf-slider-thumbnails--space-between: var\(--sf-space-1\\\/2\)/);
  assert.doesNotMatch(template,/data-space-between=\$\{String\(context\.spaceBetween\)\}/);
  assert.doesNotMatch(template,/data-speed=\$\{String\(context\.speed\)\}/);
});
test('A slider with a ratio has no slide floor: the frame is the ratio, nothing is cut (GB10)',()=>{
  // The 192 floor (--sf-f2) stood under a 16/9 window 158 high at 390 and cut 34 px of the slide.
  const rule=slider.match(/\.sf-slider:not\(\.sf-slider--content\):not\(\[data-ratio="auto"\]\)\[data-ratio\] > \.sf-slider-main\.swiper \.sf-slider-slide \{\s*min-height: ([^;]+);/);
  assert.ok(rule,'the ratio slider sets its own slide floor');
  assert.equal(rule[1],'0');
  // Content sliders and sliders with no ratio keep the variable and its default.
  assert.match(slider,/\.sf-slider \.sf-slider-slide \{[^}]*min-height: var\(--sf-slider-slide--min-height, var\(--sf-f2\)\)/s);
});
