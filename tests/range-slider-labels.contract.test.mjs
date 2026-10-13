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
