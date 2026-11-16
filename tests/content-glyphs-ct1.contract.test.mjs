// Content study glyph defects (DEV letter, section Content, pair
// 5.20261115.1622, 2026-11-16): emoji 14-15, flag 20-22, highlight 23-25 and
// owner decision C232, icons 26-29, kbd 30. Tags 33 live in
// tags-c145.contract.test.mjs and tag-close-size.contract.test.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('14-15 emoji: the box stands at the line top; no skin class without a rule', () => {
  const scss = read('src/component/emoji/scss/_css_emoji.scss');
  assert.match(scss, /vertical-align: top;/);
  assert.doesNotMatch(scss, /vertical-align: middle;/);
  assert.doesNotMatch(read('src/component/emoji/js/_emoji.js'), /`sf-emoji--skin-\$\{/);
});

test('20 and 22 flag: ladder defaults and the middle of the text line', () => {
  const scss = read('src/component/flag/scss/_css__flag.scss');
  assert.match(scss, /var\(--sf-flag--default-size, var\(--sf-text-height-1\\\/2\)\)/);
  assert.match(scss, /\.sf-flag--circle \{\s*--sf-flag--default-size: var\(--sf-text-height-1\);/);
  assert.doesNotMatch(scss, /--sf-flag--default-size: var\(--sf-icon-size/);
  assert.match(scss, /vertical-align: calc\(var\(--sf-text--middle\) - var\(--sf-flag--height\) \/ 2\);/);
  assert.match(read('src/core/scss/_sf_css__typograpy.scss'), /--sf-text--middle: 0\.3633em;/);
});

test('21 flag: an unknown code keeps the asked shape and clears the picture', () => {
  const js = read('src/component/flag/js/_flag.js');
  assert.match(js, /function clear\(element, shape\)/);
  assert.match(js, /return fallback \? null : shape;/);
  assert.match(js, /if \(!shape\) \{ clear\(element, asked\); return; \}/);
  assert.match(js, /if \(triedOther\) \{ clear\(element, asked\); return; \}/);
});

test('23-25 highlight: data-lang loads it; plain header buttons with name tooltips (C201, C232, C48)', () => {
  const rule = read('src/component/highlight/rule.js');
  assert.match(rule, /\\bdata-lang\\s\*=/);
  assert.match(rule, /name: 'tooltip'/);
  const js = read('src/component/highlight/js/index.js');
  assert.match(js, /sf-icon-button--plain/);
  assert.doesNotMatch(js, /sf-icon-button--(?:link|ghost)/);
  assert.match(js, /function nameTooltip\(/);
  assert.match(js, /sf-tooltip sf-tooltip--dark/);
});

test('30 kbd: a one-character key is marked square and given back when it grows', () => {
  // The module imports its JSON words without an import attribute (bundler
  // syntax), so the contract reads the source.
  const js = read('src/component/kbd/js/index.js');
  assert.match(js, /export function markSquareKey\(element\)/);
  assert.match(js, /if \(element\.classList\.contains\('sf-kbd--group'\)\) return false;/);
  assert.match(js, /if \(square && !element\.classList\.contains\(SQUARE\)\)/);
  assert.match(js, /if \(!square && marked\)/, 'only a square this script marked is given back');
  assert.match(js, /markSquareKeys\(/);
});

test('27 icons: a class glyph is marked for the rtl mirror by name and data-mirror', async () => {
  const {markMirrorGlyph} = await import('../src/core/js/icon-glyphs.js');
  const glyph = (mirror) => {
    const attrs = new Map(mirror ? [['data-mirror', mirror]] : []);
    return {getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null), hasAttribute: (n) => attrs.has(n),
      setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n), attrs};
  };
  const arrow = glyph();
  assert.equal(markMirrorGlyph(arrow, 'arrow_forward'), true);
  assert.ok(arrow.attrs.has('data-sf-icon-mirror'));
  assert.equal(markMirrorGlyph(arrow, 'star'), false, 'a renamed glyph gives the mark back');
  assert.ok(!arrow.attrs.has('data-sf-icon-mirror'));
  assert.equal(markMirrorGlyph(glyph('off'), 'arrow_forward'), false);
  assert.equal(markMirrorGlyph(glyph('on'), 'star'), true);
  assert.match(read('src/core/js/iconSubsetRuntime.js'), /markMirrorGlyph\(el, icon\)/);
});

test('26 icons: a subset sheet without the manifest family is rebuilt from the manifest', async () => {
  globalThis.window ??= {SF_BOOT_CONFIG: {}, sfPath: '/distr'};
  const {initIconSubsetState, installIconSubsetRuntime} = await import('../src/core/js/iconSubsetRuntime.js');
  class Loader { constructor() { this.uniqueIcons = new Map(); initIconSubsetState(this); } }
  installIconSubsetRuntime(Loader);
  const loader = new Loader();
  const manifest = {type: 'rounded', family: 'Material Symbols Rounded', axes: {wght: {mode: 'fixed', value: 400}},
    fonts: [{weight: 400, url: 'https://icons.simai.io/ms/font/abc.woff2'}]};
  const wrong = "@font-face { font-family: 'Material Symbols Outlined Subset'; src: url(x.woff2); }";
  const rebuilt = loader.iconSubsetSheetText(wrong, manifest);
  assert.notEqual(rebuilt, wrong);
  assert.match(rebuilt, /font-family: 'Material Symbols Rounded Subset'/);
  const right = "@font-face { font-family: 'Material Symbols Rounded Subset'; }";
  assert.equal(loader.iconSubsetSheetText(right, manifest), right);
  assert.equal(loader.iconSubsetSheetText(wrong, null), wrong);
});

test('26 icons: a name the font knows is not reported missing while the face loads', () => {
  const js = read('src/core/js/icon-glyphs.js');
  assert.match(js, /function recheckMissing\(/);
  assert.match(js, /function watchFaces\(/);
  assert.match(js, /loadingdone/);
  assert.match(js, /sf-icons-subset:ready/);
});

test('28-29 icons: the middle of the line and the ladder region steps', () => {
  const scss = read('src/component/icons/scss/_css__icons.scss');
  assert.match(scss, /@property --sf-icon--text-middle \{\s*syntax: '<length>';\s*inherits: true;\s*initial-value: 0;/);
  assert.match(scss, /:where\(:has\(> \.sf-icon\)\) \{\s*--sf-icon--text-middle: var\(--sf-text--middle\);/);
  assert.match(scss, /vertical-align: calc\(var\(--sf-icon--text-middle\) - /);
});
