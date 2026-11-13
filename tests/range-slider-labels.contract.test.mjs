import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../src/component/range-slider/js/_range_slider.js',import.meta.url),'utf8');
const runtime=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('const '),source.indexOf("if (typeof window !== 'undefined')")),runtime);
test('label positions clamp endpoints and detect overlap in either direction',()=>{
  for(const centers of [[0,300],[300,0]]){
    const plan=runtime.planLabelPositions(300,centers,[100,100],4);
    assert.equal(plan.merged,false);
    assert.deepEqual([...plan.positions].sort((a,b)=>a-b),[0,200]);
  }
  for(const centers of [[147,153],[153,147],[150,150]]){
    assert.equal(runtime.planLabelPositions(300,centers,[100,100],4).merged,true);
  }
  assert.equal(runtime.planLabelPositions(100,[0,100],[100,100],4).merged,true);
});
test('single label clamps without manufacturing a range',()=>{
  assert.deepEqual([...runtime.planLabelPositions(300,[0],[100]).positions],[0]);
  assert.deepEqual([...runtime.planLabelPositions(300,[300],[100]).positions],[200]);
  assert.equal(runtime.planLabelPositions(300,[150],[100]).merged,false);
});
test('label resources are instance-owned and released before engine destruction',()=>{
  assert.ok(source.indexOf('root?.[SLIDER_LABEL_STATE]?.release()')<source.indexOf('root.noUiSlider.destroy()'));
  assert.ok(source.includes('state.observer?.disconnect()'));
  assert.ok(source.includes('cancelAnimationFrame(state.frame)'));
  assert.ok(source.includes("removeEventListener('loadingdone', schedule)"));
  assert.ok(source.includes("row.setAttribute('aria-hidden', 'true')"));
  assert.ok(source.includes('mutation.removedNodes.forEach'));
  assert.ok(source.includes('if (!(node instanceof Element) || node.isConnected) return;'));
});

test('caption typography uses inheritable semantic text roles',async()=>{
  const style=await readFile(new URL('../src/component/range-slider/scss/_css__thumbs.scss',import.meta.url),'utf8');
  assert.ok(style.includes('var(--sf-thumb-text--font-size, var(--sf-text-small--size))'));
  assert.ok(style.includes('var(--sf-thumb-text--line-height, var(--sf-text-small--height))'));
  assert.doesNotMatch(style,/--sf-thumb-text--font-size:/);
});

test('C78: label is the visible name, value-display shows the value; the former words still work',async()=>{
  const smart=await readFile(new URL('../src/smart/slider-range/index.js',import.meta.url),'utf8');
  const template=await readFile(new URL('../src/smart/slider-range/js/templates/default.js',import.meta.url),'utf8');
  const manifest=JSON.parse(await readFile(new URL('../src/smart/slider-range/component.json',import.meta.url),'utf8'));
  assert.equal(manifest.settings.label.type,'string');
  assert.deepEqual(manifest.settings['value-display'].values,['none','text','tooltip']);
  assert.match(smart,/const VALUE_DISPLAYS = \['none', 'text', 'tooltip'\];/);
  assert.match(smart,/from: `label="\$\{legacy\}"`, to: `value-display="\$\{legacy\}"`/);
  assert.match(template,/class="sf-range-slider-name" id=\$\{context\.nameId\}/);
  assert.match(template,/data-labelledby=\$\{context\.name \? context\.nameId : nothing\}/);
  assert.ok(source.includes("const visibleName = root.getAttribute('data-labelledby');"));
});
// Acceptance R4: the host rewrites the value line and the scale numbers as the
// handles move. Written as text parts, that rewrite took lit's markers with it,
// and the next render (prefix set after the first, through its alias) threw on
// insertBefore and never reached the root's data-prefix.
test('texts the host rewrites are property bindings, not text parts',async()=>{
  const template=await readFile(new URL('../src/smart/slider-range/js/templates/default.js',import.meta.url),'utf8');
  assert.match(template,/<span class="sf-range-slider-output" aria-hidden="true" \.textContent=\$\{context\.outputText \?\? ''\}><\/span>/u);
  assert.match(template,/\.textContent=\$\{mark\.text \?\? ''\}\n\s*><\/span>/u);
  assert.doesNotMatch(template,/sf-range-slider-output"[^>]*>\$\{/u);
});
