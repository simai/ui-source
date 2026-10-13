import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const css=await readFile(new URL('../src/component/slider/scss/_css__slider_dots.scss',import.meta.url),'utf8');
test('Slider dots distinguish selected fill from inactive contour using semantic foreground roles',()=>{
  assert.doesNotMatch(css,/var\(--sf-(?:primary|neutral|secondary)-\d/);
  assert.match(css,/--sf-slider-dots-dot--background-color: transparent/);
  assert.match(css,/\.sf-slider-dots-dot\.active\s*\{\s*--sf-slider-dots-dot--background-color: var\(--sf-slider-dots-dot--color\)/);
  for(const role of ['primary','on-primary','on-primary-container','on-surface','on-surface-inverse'])assert.match(css,new RegExp(`--sf-slider-dots-dot--color: var\\(--sf-${role}\\)`));
});
test('Slider dot focus is modality-aware and cannot cross half the neighbor gap',()=>{
  // The clamp stays — the dots are small and close — but the colour and style
  // are the system's.
  assert.match(css,/outline: min\(var\(--sf-focus--width\), calc\(var\(--sf-slider-dots--gap\) \/ 2\)\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.doesNotMatch(css,/:focus(?!-visible)/);
  assert.match(css,/@media \(forced-colors: active\)/);
  assert.match(css,/border-color: Highlight;\s*background-color: Highlight/);
});
