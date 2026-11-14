// Gallery defects GL-1/2/3/4/5/7/8/10 (ui-control study 2026-11-14-gallery),
// against decisions C116, C143, C18, C97, C92/C98, C130: quiet arrows on
// plates, thumbnails as buttons, the place shown, the frame held from the
// first paint without cropping, a small muted caption, keys and swipe in the
// lightbox, the focus given back, lazy copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('src/smart/gallery/component.json'));
const gallery = await read('src/smart/gallery/index.js');
const template = await read('src/smart/gallery/js/templates/default.js');
const css = await read('src/smart/gallery/js/templates/default.css');
const slider = await read('src/component/slider/js/_slider.js');
const sliderCss = await read('src/component/slider/scss/_css__slider.scss');
const core = await read('src/core/scss/_sf_css__placeholder.scss');

test('GL-1: the arrows are the slider quiet ones on plates (C116, C143 (2))', () => {
  assert.equal(manifest.settings['button-type'].default, 'secondary');
});

test('GL-3: the place is shown: dots, a counter from eight (C143 (4), C97 (7))', () => {
  assert.equal(manifest.settings.dots.default, true);
  assert.match(gallery, /const DELEGATED_SLIDER_DEFAULTS = \{\s*arrows: 'true',\s*dots: 'true'/);
});

test('GL-2: thumbnails are named buttons, one Tab stop, paged by the keys, with the control radius (C18, C143 (5))', () => {
  assert.match(slider, /slide\.setAttribute\('role', 'button'\)/);
  assert.match(slider, /slide\.tabIndex = active \? 0 : -1/);
  assert.match(slider, /event\.key === 'Home'\) next = 0;\s*else if \(event\.key === 'End'\) next = last/);
  assert.match(slider, /thumb: 'Перейти к слайду \{n\}'/);
  assert.match(sliderCss, /\.sf-slider-thumbnails \.swiper-slide \{\s*border-radius: var\(--sf-slider-thumbnail--border-radius, var\(--sf-slider-thumbnail-radius, var\(--sf-radius--ui\)\)\)/);
  assert.match(sliderCss, /:has\(> \.sf-slider-thumbnails\) > \.sf-slider-controls \{\s*inset-block-end:/);
});

test('GL-7: one frame from the first paint, the first picture ratio, contained (C143 (8), C130)', () => {
  assert.equal(manifest.settings.ratio.default, 'auto');
  assert.match(gallery, /_frameRatio\(\) \{[\s\S]*getAttribute\('width'\), image\.getAttribute\('height'\)/);
  assert.match(template, /--sf-gallery--ratio: \$\{context\.frameRatio\}/);
  assert.equal((template.match(/ratio="auto"/g) || []).length, 1);
  assert.match(css, /--sf-slider-slide-img--object-fit: var\(--sf-gallery-object-fit, contain\)/);
  assert.match(css, /aspect-ratio: var\(--sf-gallery--ratio, 16 \/ 9\)/);
  assert.match(core, /:where\(sf-gallery:not\(:defined\)\):not\(:has\(> \[data-sf-static\]\)\) > :not\(:first-child\) \{\s*display: none;/);
  assert.match(core, /:where\(sf-gallery:not\(:defined\):not\(\[thumbs="false"\]\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*padding-block-end: calc\(var\(--sf-space-1\) \+ var\(--sf-d2\)\)/);
  assert.match(gallery, /_holdUndefinedSlider\(sliderElement, mode\)/);
});

test('GL-8: the caption is small and on-surface-variant (C92 view 8, C98)', () => {
  assert.match(css, /color: var\(--sf-gallery-caption-color, var\(--sf-on-surface-variant\)\);\s*font-size: var\(--sf-text-size-1\\\/2\);\s*line-height: var\(--sf-text-height-1\\\/2\)/);
  assert.match(core, /> :first-child :where\(figcaption\) \{\s*color: var\(--sf-on-surface-variant\);\s*font-size: var\(--sf-text-size-1\\\/2\)/);
});

test('GL-4 and GL-5: the lightbox pages with keys and swipe; the focus goes back', () => {
  assert.match(gallery, /document\.addEventListener\('keydown', this\._handleViewerKeyDown\)/);
  assert.match(gallery, /else if \(event\.key === 'Home'\) next = 1;\s*else if \(event\.key === 'End'\) next = total;/);
  assert.match(gallery, /_lightboxPointerMoved\(event\)/);
  assert.match(gallery, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => this\._restoreFocus\(\)\)\)/);
});

test('GL-10: copies past the first shown picture load lazily; the source is set last', () => {
  assert.match(gallery, /copySlide\(slide, mode === 'inline' && index === this\.current - 1\)/);
  assert.match(gallery, /node\.loading = eager \? 'eager' : 'lazy'/);
  assert.match(gallery, /held\[index\]\.forEach\(\(\[name, value\]\) => node\.setAttribute\(name, value\)\)/);
});
