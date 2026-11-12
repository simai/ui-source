import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('Projection declines detached or missing-field surfaces without mutation',async()=>{
  // The refusal paths never reach geometry or the scrollbar's mark, so the
  // bundled helpers are stubbed.
  const source=(await read('src/component/dropdown/portal.js')).replace("import BundledPosition from '../../core/js/position.js';","const BundledPosition=null;").replace("import {PanelScrollbar} from '../panel-scrollbar.js';","const PanelScrollbar=class{watch(){}mark(){}disconnect(){}};");
  const {openDropdownPortal,closeDropdownPortal}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(openDropdownPortal({},{}),false);
  assert.equal(openDropdownPortal({},{showPopover(){throw new Error('detached');},isConnected:false}),false);
  assert.equal(openDropdownPortal({querySelector(){return null;}},{showPopover(){throw new Error('no field');},isConnected:true}),false);
  assert.equal(closeDropdownPortal(undefined),false);
});
test('Dropdown native projection retains ancestry and restores only owned styles',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.match(source,/native:typeof list\.showPopover==='function'/);
  assert.match(source,/list\.setAttribute\('popover','manual'\)/);
  assert.doesNotMatch(source,/removeAttribute\('style'\)/);
  assert.match(source,/getPropertyPriority/);
  assert.match(source,/setProperty\(name,value,priority\)/);
  assert.match(source,/resize\?\.disconnect/);
  assert.match(source,/cancelAnimationFrame/);
  assert.match(source,/visualViewport\?\.removeEventListener/);
});
test('Dropdown placement measures semantic spacing and bounds the available viewport',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.doesNotMatch(source,/viewportMargin = 8|offset = 4|9999/);
  assert.match(source,/window\.visualViewport/);
  // Geometry is the shared SF.Position contract: the width of a field, and a
  // height the viewport bounds. A trigger the consumer handed in is not a
  // field, so the list is not made as wide as it -- an icon button would give
  // the list the width of a glyph.
  assert.match(source,/position\(\)\.anchor\(field, list, \{/);
  assert.match(source,/matchWidth: field\.classList\.contains\('sf-dropdown-field'\)/);
  assert.match(source,/fitHeight: true/);
  // And it hangs from whichever of the two is there: looking only for the
  // field, the portal never opened for a dropdown with its own trigger, so the
  // list stayed in the page with no placement at all.
  assert.match(source,/\.sf-dropdown-field, \.sf-dropdown-trigger/);
  const position=await read('src/core/js/position.js');
  assert.match(position,/var\(--sf-space-1\\\\\/4\)/);
  assert.match(position,/var\(--sf-space-1\\\\\/2\)/);
  for(const name of ['offset(','flip(','size(','shift(','autoUpdate('])assert.ok(position.includes(name),name);
});
test('Both Dropdown owners share native projection and release it on lifecycle changes',async()=>{
  for(const path of ['src/component/dropdown/js/_dropdown.js','src/smart/dropdown/index.js']){
    const source=await read(path);assert.match(source,/openDropdownPortal/);assert.match(source,/closeDropdownPortal/);
  }
  const base=await read('src/component/dropdown/js/_dropdown.js');
  assert.equal((base.match(/event\.currentTarget !== root && root\.contains\(event\.currentTarget\)/g)||[]).length,2);
});

test('Fallback uses inherited Framework context, bounded placement and reversible ownership',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.match(source,/syncFallbackContext\(root,state\)/);
  assert.match(source,/name\.startsWith\('--sf-'\)/);
  for(const name of ['text-transform','word-spacing','font-variation-settings','line-height'])assert.ok(source.includes(`'${name}'`));
  assert.match(source,/var\(--sf-z-index-9\)/);
  assert.match(source,/state\.parent\.insertBefore\(list,state\.next\)/);
  assert.match(source,/state\.context\.remove\(\)/);
  assert.match(source,/state\.inheritance\?\.disconnect\(\)/);
  const smart=await read('src/smart/dropdown/index.js');
  assert.match(smart,/previousRoot===this\._dropdownRoot \? previousList : null/);
  assert.doesNotMatch(smart,/viewportMargin = 8|offset = 4|9999|_legacyPortalPositioned/);
});

test('Base portal subscriptions follow active projection, not initial configuration',async()=>{
  const source=await read('src/component/dropdown/js/_dropdown.js');
  const ensure=source.slice(source.indexOf('function ensurePortalList'),source.indexOf('function restorePortalList'));
  const restore=source.slice(source.indexOf('function restorePortalList'),source.indexOf('function getItemValue'));
  assert.match(ensure,/list\.addEventListener\('click',onRootClick\)/);
  assert.match(restore,/list\.removeEventListener\('click',root\.__sfDropdownPortalClick\)/);
  assert.match(source,/attributeFilter: \["class", "disabled", "portal", "data-portal"\]/);
});

test('Changing projection preserves the active search but never focuses a hidden panel',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.match(source,/const active=list\.contains\(document\.activeElement\)/);
  assert.match(source,/active&&!list\.hidden&&state\.root\.isConnected/);
  assert.match(source,/active\.focus\(\{preventScroll:true\}\)/);
});

test('Fallback projection stays inside the nearest modal interaction boundary',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.match(source,/root\.closest\('dialog\[open\], \[role="dialog"\]\[aria-modal="true"\]'\)/);
  assert.match(source,/\(boundary\|\|document\.body\)\.append\(state\.context\)/);
});

test('Both projection paths dismiss through their owner when ancestors become unavailable',async()=>{
  const source=await read('src/component/dropdown/portal.js');
  assert.match(source,/\[inert\]/);
  assert.match(source,/getComputedStyle\(field\)\.visibility/);
  assert.match(source,/state\.onUnavailable\?\.\(\)/);
  assert.match(source,/'hidden','inert','aria-hidden','open'/);
  for(const path of ['src/component/dropdown/js/_dropdown.js','src/smart/dropdown/index.js']){
    assert.match(await read(path),/openDropdownPortal\([^;]+\(\)=>[^;]*closeDropdown\(/);
  }
});

test('The list\'s own scroll does not reposition the panel (R171)',async()=>{
  const portal=await readFile(new URL('../src/component/dropdown/portal.js',import.meta.url),'utf8');
  assert.match(portal,/export function scrolledInside\(list, event\) \{[\s\S]*?event\?\.type !== 'scroll'[\s\S]*?list\.contains\(target\)/);
  const smart=await readFile(new URL('../src/smart/dropdown/index.js',import.meta.url),'utf8');
  assert.match(smart,/this\._viewportHandler = \(event\) => \{\s*if \(scrolledInside\(this\._list, event\)\) return;\s*this\.positionPortalList\(\);/);
  const base=await readFile(new URL('../src/component/dropdown/js/_dropdown.js',import.meta.url),'utf8');
  assert.match(base,/if\(scrolledInside\(getList\(root\),event\)\)return;/);
});

// A list in place has the anchored list's height rule (R171 follow-up,
// 2026-11-12): the larger room the screen gives above or below the field, less
// the panel's edge padding; a list short of it by less than the padding keeps
// its whole height (R018). Measured with a stubbed screen and SF.Position.
test('A list in place takes the anchored list\'s room as its height cap',async()=>{
  const source=(await read('src/component/dropdown/portal.js')).replace("import BundledPosition from '../../core/js/position.js';","const BundledPosition=null;").replace("import {PanelScrollbar} from '../panel-scrollbar.js';","const PanelScrollbar=class{watch(){}mark(){}disconnect(){}};");
  globalThis.SF={Position:{resolveLength:value=>value.includes('1\\/2')?8:4}};
  globalThis.document={documentElement:{clientHeight:900,clientWidth:1440}};
  const {fitDropdownInPlace}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const make=(fieldTop,height,hidden=0)=>{
    const props={};
    const field={getBoundingClientRect:()=>({top:fieldTop,bottom:fieldTop+40})};
    const root={querySelector:()=>field};
    return {props,list:{parentElement:root,closest:()=>root,style:{setProperty:(name,value)=>{props[name]=value;}},
      querySelector:()=>({scrollHeight:height+hidden,clientHeight:height}),getBoundingClientRect:()=>({top:fieldTop+44,height})}};
  };
  // Field at the top: the room below (900 - 8 - 104).
  let {props,list}=make(60,2400);
  assert.equal(fitDropdownInPlace(list,list.getBoundingClientRect()),788);
  assert.equal(props['--sf-dropdown-available-block-size'],'788px');
  // Near the bottom: the room the anchored list would take above (760 - 4 - 8).
  ({props,list}=make(760,2400));
  assert.equal(fitDropdownInPlace(list,list.getBoundingClientRect()),748);
  // Capped earlier, the hidden rows still count toward its whole height.
  ({props,list}=make(60,500,1900));
  assert.equal(fitDropdownInPlace(list,list.getBoundingClientRect()),788);
  // Short of the room by less than the padding: its whole height.
  ({props,list}=make(60,794));
  assert.equal(fitDropdownInPlace(list,list.getBoundingClientRect()),794);
  delete globalThis.SF;delete globalThis.document;
  const css=await read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(css,/\.sf-dropdown \.sf-list:not\(\[data-sf-portal\]\) \{\s*display: flex;\s*flex-direction: column;\s*max-block-size: var\(--sf-dropdown-available-block-size, calc\(100dvh - 2 \* var\(--sf-space-1\\\/2\)\)\);/);
  assert.match(css,/\.sf-dropdown \.sf-list:not\(\[data-sf-portal\]\) > \.sf-list-container-wrap \{\s*overflow-y: auto;/);
});
