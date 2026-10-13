import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../src/component/slider/js/_slider.js',import.meta.url),'utf8');
test('Slider supplies author names before vendor initialization without overriding explicit options',()=>{
  const apply=source.slice(source.indexOf('function applyNavigationLabelDefaults'),source.indexOf('function createAutoplayOptions'));
  assert.match(apply,/options\.a11y === false/);
  assert.match(apply,/authored\?\.trim\(\)/);
  assert.match(apply,/\.\.\.defaults,[\s\S]*isPlainObject\(options\.a11y\)/);
  assert.match(source,/applyNavigationLabelDefaults\(sliderOptions, navigationLabels\);\s+const slider = new window\.Swiper/);
  assert.doesNotMatch(apply,/setAttribute|aria-labelledby/);
});
test('Slider releases only its own labels on the exact original navigation nodes',()=>{
  assert.match(source,/root\._sfSliderNavigationLabels\?\.forEach\(\(\{ element, authored, applied \}\)/);
  assert.match(source,/element\.getAttribute\('aria-label'\) !== applied/);
  assert.match(source,/authored === null\) element\.removeAttribute\('aria-label'\)/);
  assert.match(source,/delete root\._sfSliderNavigationLabels/);
});
