import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync(new URL('../src/component/carousel/js/_carousel.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/component/carousel/scss/_css__carousel.scss', import.meta.url), 'utf8');
const rule = fs.readFileSync(new URL('../src/component/carousel/rule.js', import.meta.url), 'utf8');

test('Carousel scopes Swiper and supports Loader-time insertion', () => {
  assert.match(js, /new window\.Swiper\(main, options\)/);
  assert.match(js, /MutationObserver/);
  assert.doesNotMatch(js, /new Swiper\('\.swiper'/);
  assert.match(rule, /relation: \[\{ name: 'swiper' \}\]/);
});

test('Carousel exposes the WAI container and slide semantics', () => {
  assert.match(js, /aria-roledescription', 'carousel'/);
  assert.match(js, /aria-roledescription', 'slide'/);
  assert.match(js, /aria-hidden/);
  assert.match(js, /toggleAttribute\('inert'/);
  assert.match(js, /aria-live', playing \? 'off' : 'polite'/);
});

test('Carousel autoplay fails closed and has explicit stop ownership', () => {
  assert.match(js, /autoplayRequested[\s\S]*rotation instanceof HTMLButtonElement/);
  assert.match(js, /root\.dataset\.playLabel/);
  assert.match(js, /root\.dataset\.pauseLabel/);
  assert.match(js, /onFocusIn = \(\) => pauseCarousel/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test('Carousel presentation uses Framework tokens and focus-visible', () => {
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /var\(--sf-ui-1--control-height\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /0\.25s|0\.5s|768px|color:\s*white/);
});
