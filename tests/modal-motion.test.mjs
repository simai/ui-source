import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {URL} from 'node:url';
const source=await readFile(new URL('../src/component/modal/js/_motion.js',import.meta.url),'utf8');
const {modalTransitionDuration,scheduleModalClose}=await import(`data:text/javascript,${encodeURIComponent(source)}`);
const style=(transitionProperty,transitionDuration,transitionDelay='0s')=>({transitionProperty,transitionDuration,transitionDelay,display:'block'});
test('Motion uses the longest relevant property with CSS list repetition',()=>{
  assert.equal(modalTransitionDuration(style('transform, opacity','100ms, .6s','50ms')),650);
  assert.equal(modalTransitionDuration(style('opacity','0.3s, 9s')),300);
  assert.equal(modalTransitionDuration(style('opacity, color, transform','.2s, 10s','.1s, 0s, .3s')),500);
});
test('No motion, unrelated properties and negative delay cannot hold a modal open',()=>{
  assert.equal(modalTransitionDuration(style('none','0s')),0);
  assert.equal(modalTransitionDuration(style('color','9s')),0);
  assert.equal(modalTransitionDuration(style('opacity','.3s','-.4s')),0);
  assert.equal(modalTransitionDuration(style('all','500ms','-100ms')),400);
});
function fixture(){
  const state={finished:0,rootReads:0,cleared:[],frames:[]};
  const nodes=[style('opacity','0.2s'),style('opacity','0.6s','0.1s')];
  const view={requestAnimationFrame(fn){state.frame=fn;return 7;},cancelAnimationFrame(id){state.frames.push(id);},getComputedStyle(n){return n;},setTimeout(fn,ms){state.callback=fn;state.delay=ms;return 0;},clearTimeout(id){state.cleared.push(id);}};
  const cancel=scheduleModalClose(()=>{state.rootReads++;return{querySelectorAll(){return nodes;}};},()=>state.finished++,view);
  return{state,nodes,cancel};
}
test('Closing waits for projection then accounts for overlay as well as panel',()=>{
  const {state}=fixture();assert.equal(state.rootReads,0);state.frame();assert.equal(state.delay,700);state.callback();assert.equal(state.finished,1);
});
test('Reopen cancels a scheduled frame without touching a later dialog',()=>{
  const {state,cancel}=fixture();cancel();state.frame();assert.equal(state.rootReads,0);assert.deepEqual(state.frames,[7]);
});
test('Cancel clears even zero timer IDs; a queued stale callback is harmless',()=>{
  const {state,cancel}=fixture();state.frame();cancel();state.callback();assert.equal(state.finished,0);assert.deepEqual(state.cleared,[0,0]);
});
test('Hidden elements and reduced-motion zero durations finish without a fixed delay',()=>{
  const {state,nodes}=fixture();nodes[0].display='none';nodes[1].transitionProperty='none';state.frame();assert.equal(state.delay,0);state.callback();assert.equal(state.finished,1);
});
test('Modal motion references Framework tokens and Close keeps forced-color mask paint local',async()=>{
  const modal=await readFile(new URL('../src/component/modal/scss/_css__modal_custom.scss',import.meta.url),'utf8');
  const close=await readFile(new URL('../src/component/close/scss/_css__close.scss',import.meta.url),'utf8');
  assert.match(modal,/var\(--sf-duration-normal\) var\(--sf-animation\)/);
  assert.ok(modal.includes('var(--sf-space-1\\/2)'));
  assert.doesNotMatch(modal,/0\.24s|0\.75rem/);
  assert.match(modal,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(close,/forced-color-adjust: none;\s+background-color: CanvasText;/);
  assert.match(close,/background-color: GrayText;/);
});
