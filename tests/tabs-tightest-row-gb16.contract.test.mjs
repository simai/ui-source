import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {squeezeStep} from '../src/core/js/overflow-row.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Group build 16 returns GB16-1 and GB16-2 (DEV's answer to question 1): the
// current tab alone beside «Ещё» keeps two letters before its ellipsis, else
// its icon alone, else «Ещё» draws its glyph alone; a tab of words keeps two
// letters and the ellipsis. The current tab never goes into «Ещё».
test('GB16-1/2: two letters fit -- the ellipsis, nothing else changes', () => {
  assert.deepEqual(squeezeStep({tabRoom: 60, textRoom: 30, twoLetters: 27, iconOnly: 40, moreGain: 74}), {icon: false, compact: false});
});

test('GB16-1/2: fewer than two letters even beside the glyph alone -- an icon tab draws its icon alone, the trigger keeps its words while the icon fits', () => {
  assert.deepEqual(squeezeStep({tabRoom: 50, textRoom: -60, twoLetters: 27, iconOnly: 40, moreGain: 74, compactTextRoom: 14}), {icon: true, compact: false});
});

test('GB16-1: the whole icon does not stand beside «Ещё (n)» -- the trigger draws its glyph alone', () => {
  assert.deepEqual(squeezeStep({tabRoom: 16, textRoom: -80, twoLetters: 27, iconOnly: 40, moreGain: 74, compactTextRoom: 0}), {icon: true, compact: true});
});

// Group build 16 return GB16-5: the label is decided again beside the
// glyph-alone trigger before the tab gives up its words. The 176 px row at
// 1440 drew «Заказ» as its icon beside a bare chevron with 90 px empty; the
// whole word (45.1 px) fits there.
test('GB16-5: two letters do not stand beside «Ещё (n)» but do beside its glyph -- the label stays, the trigger draws its glyph', () => {
  assert.deepEqual(squeezeStep({tabRoom: 46, textRoom: 9.5, twoLetters: 27, iconOnly: 40, moreGain: 90.5, compactTextRoom: 45.1}), {icon: false, compact: true});
  // Measured beside the glyph is what counts; without it, the room and the gain.
  assert.deepEqual(squeezeStep({tabRoom: 46, textRoom: 9.5, twoLetters: 27, iconOnly: 40, moreGain: 90.5}), {icon: false, compact: true});
  assert.deepEqual(squeezeStep({tabRoom: 46, textRoom: 9.5, twoLetters: 27, iconOnly: 40, moreGain: 90.5, compactTextRoom: 20}), {icon: true, compact: false});
  // No gain (the trigger is a glyph already): nothing to decide again.
  assert.deepEqual(squeezeStep({tabRoom: 50, textRoom: 9.5, twoLetters: 27, iconOnly: 40, moreGain: 0, compactTextRoom: 45}), {icon: true, compact: false});
});

test('GB16-5: sf-tabs measures the label beside the glyph-alone trigger and hands it to the step', () => {
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /compactTextRoom = labelWidth\(\);\n      container\.removeAttribute\('data-sf-tabs-more-compact'\);/u);
  assert.match(source, /squeezeStep\(\{tabRoom, textRoom, twoLetters, iconOnly, moreGain, compactTextRoom\}\)/u);
  // The tabs «Ещё» holds leave the row before the current one is measured.
  const layout = source.slice(source.indexOf('  layoutRow() {'), source.indexOf('  squeezeCurrent(host, list, more'));
  assert.ok(layout.indexOf("host.classList.add('sf-tabs-overflowed')") < layout.indexOf('this.squeezeCurrent('), 'overflowed before the squeeze');
});

// Group build 16 return GB16-6: the hidden names are the Framework tooltip.
test('GB16-6: the glyph-alone trigger and the icon-alone tab name a Framework tooltip of their hidden words', () => {
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /this\.layoutRow\(\);\n    this\.syncRowTips\(\);/u);
  assert.match(source, /container\.hasAttribute\('data-sf-tabs-more-compact'\)/u);
  assert.match(source, /element\.classList\.contains\('sf-tabs-icon-only'\)/u);
  assert.match(source, /surface\.className = 'sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-tabs-tooltip';/u);
  assert.match(source, /if \(!rowTipsAsked\) rowTipsAsked = globalThis\.SF\?\.Loader\?\.ensurePlugin\?\.\('tooltip'\) === true;/u);
  assert.match(source, /removeAttribute\('data-tooltip'\)/u);
});

test('GB16-2: a tab of words keeps two letters; the trigger gives way, never the current tab', () => {
  assert.deepEqual(squeezeStep({tabRoom: 30, textRoom: 9.5, twoLetters: 27, iconOnly: null, moreGain: 74}), {icon: false, compact: true});
  assert.deepEqual(squeezeStep({tabRoom: 30, textRoom: 9.5, twoLetters: 27, iconOnly: null, moreGain: 0}), {icon: false, compact: false});
});

test('GB16-1/2: sf-tabs runs the step on the squeezed current tab and clears it on every layout', () => {
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /this\.squeezeCurrent\(hosts\[laid\.squeezed\], list, more, extraFor \? extraFor\(this\._overflowed\.length\) : 0\)/u);
  assert.match(source, /host\.classList\.remove\('sf-tabs-overflowed', 'sf-tabs-squeezed', 'sf-tabs-icon-only'\)/u);
  assert.match(source, /container\?\.removeAttribute\('data-sf-tabs-more-compact'\)/u);
  assert.match(source, /--sf-tabs--squeezed-min/u);
});

test('GB16-1: the icon-only tab and the compact trigger are drawn by the tabs sheet, their words out of sight', () => {
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /\.sf-tabs-top > \.sf-tabs-icon-only > button,\n  \.sf-tabs-top > \.sf-button\[data-sf-tabs-icon-only\] \{\n    flex: none;\n    max-inline-size: none;/u);
  assert.match(sheet, /\.sf-tabs-top-container\[data-sf-tabs-more-compact\] > \.sf-tabs-more > button \{\n    --sf-button--padding-inline-start: var\(--sf-button--padding-top\);/u);
  assert.match(sheet, /clip-path: inset\(50%\);/u);
  assert.match(sheet, /min-inline-size: var\(--sf-tabs--squeezed-min, calc\(var\(--sf-px\) \* 0\)\);/u);
});
