// Tools study OT 27-37 and owner decision C244 (DEV letter msg-92e0e0fa,
// 2026-11-16): the source rules that keep the fixes. Measured in a browser on
// the build (ui-control helper evidence ot-frame); these pin the rules.
import test from 'node:test';
import {unfoldModes} from './support/paint-blocks.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('OT 37: with no theme class the root follows the device and declares the roles', () => {
  const sheet = read('src/core/scss/_sf_css__theme.scss');
  assert.match(sheet, /:root \{\s*color-scheme: light dark;\s*\}\s*\.theme-light \{\s*color-scheme: light;/u);
  assert.match(sheet, /:root,\s*\.theme-light,\s*\.theme-dark \{\s*--sf-neutral:/u);
  assert.match(read('docs/developer/theme-first-paint.md'), /sf-theme=\(light\|dark\)/u);
});

test('C244: the single theme button shows the theme on screen, says the next, has no pressed state', () => {
  const js = read('src/component/theme/js/_theme.js');
  assert.match(js, /const glyph = isDark \? 'dark_mode' : 'light_mode';/u);
  assert.match(js, /removeAttribute\('aria-pressed'\)/u);
  assert.doesNotMatch(js, /setAttribute\('aria-pressed'/u);
  assert.equal(json('src/component/theme/lang/ru.json').runtime['cycle-next'], '{name}. Нажмите — {next}');
  assert.equal(json('src/component/theme/passport.json').version, '1.3.2'); // C282: 1.3.0 moved on by the language-file patch (Russian is a language file) // C278: 1.3.1 moved on by the language packs
});

test('OT 27: a hide-show pair shows one button before its script', () => {
  const sheet = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(sheet, /\.sf-hide-show:not\(\[data-hide-show-init\]\):is\(\[data-state="hidden"\]/u);
  assert.match(sheet, /\.sf-hide-show:not\(\[data-hide-show-init\]\):not\(\[data-state="hidden"\]/u);
});

test('OT 28: print-only is hidden on screen by the core sheet', () => {
  assert.match(read('src/core/scss/_sf_css__hide.scss'), /@media not print \{\s*\.print-only \{\s*display: none;/u);
});

test('OT 29-30: sf-outline keeps one row step and its text at the list inset', () => {
  const sheet = read('src/component/outline/scss/_outline.scss');
  assert.match(sheet, /\.sf-outline__list \.sf-outline__list \{[^}]*padding-block-start: var\(--sf-outline--gap\);/u);
  assert.match(sheet, /padding-inline-start: calc\(var\(--sf-outline--link-padding-inline\) - var\(--sf-outline--indicator-width\)\);/u);
  assert.equal(json('src/component/outline/passport.json').version, '1.2.0'); // group build 10: 1.1.3 moved on by the merged branches or a GB10 patch
});

test('OT 31: sf-contents column ring takes the control corner', () => {
  // C273: the column mixin writes the corner in its shape mode; unfolded it reads as one (group build 10).
  assert.match(unfoldModes(read('src/smart/contents/scss/_smart__contents.scss')), /\.sf-contents-link:focus-visible \{\s*border-radius: var\(--sf-radius--ui\);/u);
});

test('OT 35: the sf-scrollbar root draws the ring its viewport cannot', () => {
  const sheet = read('src/component/scrollbar/scss/_css__scrollbar.scss');
  assert.match(sheet, /\.sf-scrollbar__viewport:focus-visible \{\s*outline: none;\s*\}/u);
  assert.match(sheet, /\.sf-scrollbar:has\(> \.sf-scrollbar__viewport:focus-visible\) \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--offset\);/u);
  assert.equal(json('src/component/scrollbar/passport.json').version, '1.5.2'); // C282: 1.4.2 moved on by the language-file patch (Russian is a language file) // C278: 1.5.1 moved on by the language packs
});

test('OT 36: Firefox keeps a coloured page bar', () => {
  assert.match(read('src/core/scss/_sf_css__scroll.scss'), /html \{\s*scrollbar-color: var\(--sf-scroll-bg-thumb\) var\(--sf-transparent\);/u);
});
