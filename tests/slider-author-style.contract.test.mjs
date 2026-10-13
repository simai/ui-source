import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../src/smart/slider/index.js',import.meta.url),'utf8');
const template=await readFile(new URL('../src/smart/slider/js/templates/default.js',import.meta.url),'utf8');
test('Slider projects the shared author style contract to its existing root',()=>{
  assert.match(template,/class=\$\{rootClasses\}\s+style=\$\{context\.rootStyle \|\| nothing\}/);
});
test('Slider cosmetic DOM updates preserve the live engine and do not replace slide contents',()=>{
  const body=source.slice(source.indexOf('  updateDom()'),source.indexOf('  async waitForSliderControls'));
  assert.match(source,/const cosmetic = \['class', 'root-class', 'style', 'root-style'\]/);
  assert.match(source,/changedAttributes\.every\(name => cosmetic\.includes\(name\)\)/);
  assert.match(source,/this\._boundSlider && !this\._boundSlider\.destroyed/);
  assert.match(body,/refreshSlider\(root\)/);
  assert.doesNotMatch(body,/unbindSlider|bindSlider|innerHTML|replaceChildren|dispatchEvent/);
});
test('Slider afterRender callback delegates to the base lifecycle API',()=>{
  assert.match(source,/typeof changedAttributes === 'function'\) return super\.afterRender\(changedAttributes\)/);
});
