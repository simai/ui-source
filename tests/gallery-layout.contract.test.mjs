import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/smart/gallery/index.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/smart/gallery/js/templates/default.css',import.meta.url),'utf8');
const template=await readFile(new URL('../src/smart/gallery/js/templates/default.js',import.meta.url),'utf8');
const rule=await readFile(new URL('../src/smart/gallery/rule.js',import.meta.url),'utf8');

test('Gallery does not mutate authored media geometry during nested rendering',()=>{
  assert.doesNotMatch(source,/_applySliderLayout|image\.style\.|caption\.style\.|node\.style\./);
  assert.match(template,/import '\.\/default\.css'/);
  assert.match(rule,/css: true/);
  assert.match(template,/joinClasses\('sf-gallery-lightbox-panel min-w-0 max-w-full', context\.panelClass\)/);
});

test('Gallery uses existing Slider projection tokens and spacing-backed viewport defaults',()=>{
  for(const name of ['height','min-height'])assert.ok(css.includes(`--sf-slider-slide--${name}`));
  for(const name of ['width','height','object-fit'])assert.ok(css.includes(`--sf-slider-slide-img--${name}`));
  assert.match(css,/--sf-gallery-media--max-height, calc\(100dvh - var\(--sf-space-6\) \* 2\)/);
  assert.doesNotMatch(css,/\b\d+(?:px|rem|em)\b|#[0-9a-f]{3,8}\b|!important/);
  assert.doesNotMatch(source,/96px|48px/);
  assert.match(css,/:where\(\[data-sf-gallery-slider='lightbox'\]\) :where\(figure, picture\)/);
});

test('Gallery can shrink as a grid or flex item without clipping its content',()=>{
  assert.match(css,/\.sf-gallery\s*\{\s*min-width:\s*0;\s*\}/);
  assert.doesNotMatch(css,/\.sf-gallery\s*\{[^}]*overflow\s*:\s*(hidden|clip)/);
});
