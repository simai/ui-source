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

test('GB16-1/2: fewer than two letters -- an icon tab draws its icon alone, the trigger keeps its words while the icon fits', () => {
  assert.deepEqual(squeezeStep({tabRoom: 50, textRoom: 9.5, twoLetters: 27, iconOnly: 40, moreGain: 74}), {icon: true, compact: false});
});

test('GB16-1: the whole icon does not stand beside «Ещё (n)» -- the trigger draws its glyph alone', () => {
  assert.deepEqual(squeezeStep({tabRoom: 16, textRoom: 0, twoLetters: 27, iconOnly: 40, moreGain: 74}), {icon: true, compact: true});
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
