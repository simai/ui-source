import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync(new URL('../src/component/carousel/js/_carousel.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/component/carousel/scss/_css__carousel.scss', import.meta.url), 'utf8');
const rule = fs.readFileSync(new URL('../src/component/carousel/rule.js', import.meta.url), 'utf8');

// Owner decision C247: until its removal (2027-01-01) .sf-carousel binds
// through the slider adapter and gets the slider's accessibility and words.
const slider = fs.readFileSync(new URL('../src/component/slider/js/_slider.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../src/component/swiper/js/index.js', import.meta.url), 'utf8');

test('Carousel scopes Swiper and supports Loader-time insertion', () => {
  assert.match(js, /import \{ bindSlider, unbindSlider \} from '\.\.\/\.\.\/slider\/js\/_slider\.js'/);
  assert.match(js, /bindSlider\(root, CAROUSEL_PARTS\)/);
  assert.match(slider, /new window\.Swiper\(mainEl, sliderOptions\)/);
  assert.match(js, /MutationObserver/);
  assert.doesNotMatch(js, /new Swiper\('\.swiper'/);
  assert.match(rule, /relation: \[\{ name: 'swiper' \}\]/);
});

test('Carousel exposes the WAI container and slide semantics', () => {
  // Region and slides in the page's language (RG-OT 10): the slider's words.
  assert.match(slider, /root\.setAttribute\('aria-roledescription', sliderWord\(root, 'carousel'\)\)/);
  assert.match(slider, /itemRoleDescriptionMessage: root\.dataset\.slideRoledescription \|\| sliderWord\(root, 'slide'\)/);
  assert.match(slider, /position: '\{n\} из \{count\}'/);
  assert.match(engine, /slide\.setAttribute\('aria-hidden', String\(!visible\)\)/);
  assert.match(engine, /slide\.toggleAttribute\('inert', !visible/);
  assert.match(slider, /mainEl\.setAttribute\('aria-live', slider\.autoplay\?\.running \? 'off' : 'polite'\)/);
  // One Tab stop for the dots, paged by the arrow keys (RG-OT 11).
  assert.match(slider, /keyboard: true,/);
  assert.match(js, /bulletClass: 'sf-carousel-pagination-item'/);
  // An edge switch is a disabled button (RG-OT 12).
  assert.match(engine, /button\.disabled = off;/);
});

test('Carousel autoplay fails closed and has explicit stop ownership', () => {
  assert.match(js, /rotation: '\.sf-carousel-rotation'/);
  assert.match(slider, /if \(sliderOptions\.autoplay && !\(rotationButton && isShown\(rotationButton\)\)\) \{\s*delete sliderOptions\.autoplay;/);
  assert.match(slider, /root\.dataset\.pauseLabel/);
  assert.match(slider, /root\.dataset\.playLabel/);
  assert.match(slider, /root\.addEventListener\('focusin', onFocusIn\)/);
  // The glyph follows the name (RG-OT 13).
  assert.match(slider, /paintRotationGlyph\(rotationButton, stopped\)/);
  assert.match(engine, /prefersReducedMotion\(\)\) return false;/);
  assert.match(js, /root\._sfSliderRotation\.stop\(\)/);
});

test('Carousel presentation uses Framework tokens and focus-visible', () => {
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /var\(--sf-ui-1--control-height\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /0\.25s|0\.5s|768px|color:\s*white/);
});
