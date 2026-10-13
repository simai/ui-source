import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source=await readFile(new URL('../src/component/range-slider/js/_range_slider.js',import.meta.url),'utf8');
test('range direction follows computed inherited text direction at bind',()=>{
  for(const direction of ['ltr','rtl']){
    const runtime=vm.createContext({getComputedStyle:()=>({direction})});
    vm.runInContext(source.slice(source.indexOf('const '),source.indexOf("if (typeof window !== 'undefined')")),runtime);
    const root={getAttribute:()=>null,hasAttribute:()=>false};
    assert.equal(runtime.createSliderOptions(root).direction,direction);
  }
});
// The runtime places the origin with `inset-inline-start` and nothing else, so
// the origin is a marker standing at the value rather than a box reaching the
// end of the track, and the handle hangs off its start by half its own width.
// Both are logical, so a right-to-left reading needs no second set of offsets —
// and must not have one: a physical override would win over the logical inset
// and put the handle back at the wrong end.
test('the handle hangs off the value marker in logical coordinates',async()=>{
  const style=await readFile(new URL('../src/component/range-slider/scss/_css__range_slider_custom.scss',import.meta.url),'utf8');
  assert.match(style,/\.sf-range-slider-origin\s*\{[^}]*inline-size: 0;[^}]*inset-inline-end: auto;/);
  assert.match(style,/handle-lower,\s*\.sf-range-slider \.sf-range-slider-handle-upper\s*\{\s*inset-inline-end: auto;\s*inset-inline-start: calc\([^;]+\/ -2\);/);
  assert.doesNotMatch(style,/txt-dir-rtl \.sf-range-slider-(origin|handle)\s*\{/,
    'a physical right-to-left override would beat the logical inset');
});
