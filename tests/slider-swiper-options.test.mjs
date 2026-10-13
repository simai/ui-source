import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../src/component/slider/js/_slider.js', import.meta.url), 'utf8');
const collect = new Function('Element', `${source.split('function normalizeAutoplayOptions')[0]}\nreturn collectSwiperDataOptions;`)(class Element {});

test('Top-level Swiper options are not mistaken for unrelated nested prefixes', () => {
  assert.deepEqual(collect({dataset: {swiperInitialSlide: '2', swiperSlidesPerGroup: '3', swiperCenteredSlides: 'true'}}), {
    initialSlide: 2, slidesPerGroup: 3, centeredSlides: true,
  });
});

test('Actual nested Swiper prefixes and complete option values remain supported', () => {
  assert.deepEqual(collect({dataset: {swiperAutoplayDelay: '500', swiperKeyboardEnabled: 'true', swiperVirtual: 'false', swiperGridRows: '2'}}), {
    autoplay: {delay: 500}, keyboard: {enabled: true}, virtual: false, grid: {rows: 2},
  });
});
