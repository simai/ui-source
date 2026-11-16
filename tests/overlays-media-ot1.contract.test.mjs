// Joint pass 2026-11-16, sections Overlays-media and Tools (RG-OT 1-16) and
// owner decisions C245 (the engine owns the strip's accessibility), C246 (dots
// 8 apart) and C247 (.sf-carousel through the slider adapter until 2027-01-01).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engine = await read('src/component/swiper/js/index.js');
const engineSheet = await read('src/component/swiper/scss/index.scss');
const opacity = await read('src/core/figma_variables/figma_opacity.scss');
const slider = await read('src/component/slider/js/_slider.js');
const sliderSheet = await read('src/component/slider/scss/_css__slider.scss');
const dots = await read('src/component/slider/scss/_css__slider_dots.scss');
const carousel = await read('src/component/carousel/js/_carousel.js');
const carouselSheet = await read('src/component/carousel/scss/_css__carousel.scss');
const template = await read('src/smart/slider/js/templates/default.js');

test('RG-OT 1, C245: an edge button is disabled by the engine; the fade is a token and only for a non-button', () => {
  assert.match(opacity, /--sf-opacity-disabled: var\(--sf-opacity-40\);/);
  assert.doesNotMatch(engineSheet, /0\.38/);
  assert.match(engineSheet, /\.swiper-button-disabled:not\(:disabled, :has\(> button:disabled\)\) \{\n {2}opacity: var\(--sf-opacity-disabled\);/);
  assert.match(engine, /disableEdgeButtons\(edges\)/);
  assert.match(engine, /button\.disabled = off;/);
  // a11y: false hands it back to the caller.
  assert.match(engine, /const a11yOn = \(params\) => params\.a11y !== false/);
});

test('RG-OT 2: a fractional count with few slides still drags to its last stop', () => {
  assert.match(engine, /if \(!this\.params\.loop && this\.lastIndex\(\) === 0\) return;/);
  assert.doesNotMatch(engine, /this\.slides\.length <= Math\.ceil\(this\.perView\(\)\)/);
});

test('RG-OT 3: update() counts the slide names again, a copied slide included', () => {
  assert.match(engine, /slide\.dataset\.swiperSlideLabel = label;/);
  assert.match(engine, /current !== slide\.dataset\.swiperSlideLabel/);
});

test('RG-OT 4, 7, C181 (2): breakpoints read the strip width unless breakpointsBase is window', () => {
  assert.match(engine, /this\.originalParams\.breakpointsBase === 'window' \? 'window' : 'container'/);
  assert.match(engine, /new ResizeObserver\(this\._resize\)/);
  assert.match(engine, /point <= width/);
  assert.match(slider, /options\.breakpointsBase = 'container';/);
});

test('C245: no autoplay under reduced motion, in the engine', () => {
  assert.match(engine, /if \(a11yOn\(this\.params\) && prefersReducedMotion\(\)\) return false;/);
});

test('RG-OT 5, C246: the dots are 8 and 8 apart without a size step', () => {
  assert.match(dots, /\.sf-slider-dots \{[^}]*--sf-slider-dots-dot--height: var\(--sf-a8\);[^}]*--sf-slider-dots--gap: var\(--sf-space-1\\\/3\);\n {2}gap: var\(--sf-slider-dots--gap\);/);
  assert.doesNotMatch(dots, /\.sf-slider-dots--size-[12] \{/);
});

test('RG-OT 6: a disabled arrow fades once', () => {
  assert.match(sliderSheet, /\.swiper-button-disabled:not\(:disabled\) \{\n {2}opacity: var\(--sf-opacity-disabled\);/);
  assert.doesNotMatch(sliderSheet, /opacity: 0\.4;/);
});

test('RG-OT 8, 13: the class pause button changes its glyph with its name', () => {
  assert.match(slider, /function paintRotationGlyph\(button, stopped\)/);
  assert.match(slider, /stopped \? 'play_arrow' : 'pause'/);
});

test('RG-OT 9: Smart button-type light writes the class look --light', () => {
  assert.match(template, /light && 'sf-slider-arrows--light'/);
});

test('RG-OT 10-13, C247: the carousel binds through the slider adapter and keeps its API and event', () => {
  assert.match(carousel, /bindSlider\(root, CAROUSEL_PARTS\)/);
  assert.match(carousel, /noteDeprecated\(\{ component: 'sf-carousel'/);
  assert.match(carousel, /'sf:carousel-change'/);
  for (const name of ['bind', 'refresh', 'unbind', 'next', 'previous', 'goTo', 'play', 'pause', 'getState']) {
    assert.match(carousel, new RegExp(`\\b${name}: `));
  }
});

test('RG-OT 14-16: carousel dots, old colour looks and the big switch glyph', () => {
  assert.match(carouselSheet, /\.sf-carousel-pagination-item--active::after \{\n {2}inline-size: var\(--sf-c2\);/);
  assert.match(carouselSheet, /opacity: var\(--sf-opacity-60\);/);
  assert.doesNotMatch(carouselSheet, /--sf-carousel-control--background-color: var\(--sf-secondary-container\)/);
  assert.doesNotMatch(carouselSheet, /--sf-carousel-control--background-color: var\(--sf-surface-inverse\)/);
  assert.doesNotMatch(carouselSheet, /--sf-carousel-pagination--background-color: var\(--sf-surface-inverse\)/);
  assert.match(carouselSheet, /\.sf-carousel-switch--big \.sf-icon \{\n {2}--sf-icon--font-size: var\(--sf-text-height-2\);/);
});
