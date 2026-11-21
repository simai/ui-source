// Carousel study (owner decision relayed by DEV msg-b19a2893, 2026-11-21;
// ui-control control/research/2026-11-21-carousel): the scroll track, the
// arrows a space step inside the edge, the bar under pictures, the timed
// position, keys on, the thumbnail ring. The browser side is measured on the
// stand (probe carousel.mjs in the evidence).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engine = await read('src/component/swiper/js/index.js');
const engineSheet = await read('src/component/swiper/scss/index.scss');
const adapter = await read('src/component/slider/js/_slider.js');
const sheet = await read('src/component/slider/scss/_css__slider.scss');
const dots = await read('src/component/slider/scss/_css__slider_dots.scss');
const carousel = await read('src/component/carousel/js/_carousel.js');
const carouselSheet = await read('src/component/carousel/scss/_css__carousel.scss');
const template = await read('src/smart/slider/js/templates/default.js');
const placeholder = await read('src/core/scss/_sf_css__placeholder.scss');
const passport = async (name) => JSON.parse(await read(`src/component/${name}/passport.json`));

test('1: the track is the browser scroll with snap points by default; cssMode false keeps the transform strip', () => {
  assert.match(engine, /this\.css = options\.cssMode !== false;/);
  assert.match(engine, /if \(this\.css\) this\.attachScrollTrack\(\);\s*else this\.attachPointer\(\);/);
  assert.match(engineSheet, /\.swiper-css-mode > \.swiper-wrapper \{[^}]*overflow-x: auto;[^}]*overscroll-behavior-x: contain;[^}]*scroll-snap-type: x mandatory;[^}]*scrollbar-width: none;/s);
  assert.match(engineSheet, /\.swiper-css-mode > \.swiper-wrapper > \.swiper-slide \{[^}]*scroll-snap-align: start;[^}]*scroll-snap-stop: always;/s);
  // touch is the browser's; the mouse pulls the strip with the snap off.
  assert.match(engineSheet, /\.swiper-css-mode\.swiper-touch \{\s*touch-action: auto;/);
  assert.match(engineSheet, /\.swiper-css-mode\.swiper-dragging > \.swiper-wrapper \{[^}]*scroll-snap-type: none;/s);
  assert.match(engine, /event\.pointerType !== 'mouse'/);
  // a vertical wheel stays the page's; the scroll moves the active slide.
  assert.match(engine, /event\?\.type === 'wheel' && Math\.abs\(event\.deltaX\) <= Math\.abs\(event\.deltaY\)/);
  assert.match(engine, /const next = this\.nearestStop\(\);/);
  // a trackpad stream and a finger let go past 15 % of a slide page, as the mouse drag does.
  assert.match(engine, /track\.addEventListener\('wheel', this\._wheel, \{passive: false\}\);/);
  assert.match(engine, /const pages = Math\.abs\(gesture\.travel\) > this\.stepSize\(\) \* DRAG_RATIO;/);
  assert.match(engine, /if \(Math\.abs\(travel\) <= this\.stepSize\(\) \* DRAG_RATIO\) return;/);
  assert.match(engine, /behavior: 'smooth'|smooth \? 'smooth' : 'instant'/);
});

test('1: loop and autoplay go from the last slide to the first; pause keeps the time left', () => {
  assert.match(engine, /if \(this\.params\.loop\) next = \(\(next % length\) \+ length\) % length;/);
  assert.match(engine, /if \(options\.stopOnLastSlide\) \{ api\.stop\(\); return; \}\s*this\.slideTo\(back \? last : 0\);/);
  assert.match(engine, /left = Math\.max\(0, left - \(Date\.now\(\) - startedAt\)\);/);
  assert.match(engine, /this\.emit\('autoplayPause'\)/);
  assert.match(engine, /this\.emit\('autoplayResume'\)/);
  assert.match(adapter, /if \(held\) slider\.autoplay\.pause\?\.\(\);/);
  assert.match(adapter, /root\.toggleAttribute\('data-rotation-held'/);
});

test('2: arrows a space step inside the edge, hover or focus reveal on fine pointers, never on touch', () => {
  assert.match(sheet, /padding-inline: var\(--sf-slider-arrow-offset-inline, var\(--sf-space-2\)\);/);
  assert.doesNotMatch(sheet, /--sf-slider-arrow-offset-inline, var\(--sf-space-1\)/);
  assert.match(sheet, /:is\(:hover, :has\(:focus-visible\)\)/);
  assert.match(carouselSheet, /\.sf-carousel-switch--next \{\s*inset-inline-end: var\(--sf-space-2\);/);
  assert.match(carouselSheet, /\.sf-carousel-switch--prev \{\s*inset-inline-start: var\(--sf-space-2\);/);
});

test('3: the position stands under the picture; timed only with autoplay, frozen while held', () => {
  assert.match(sheet, /> \.sf-slider-controls > :is\(\.sf-slider-dots, \.sf-slider-pagination\) \{[^}]*grid-column: 2;/s);
  assert.match(sheet, /> \.sf-slider-controls > \.sf-slider-rotation-place \{[^}]*grid-column: 3;/s);
  assert.match(template, /const place = authored \? '' : 'bare';/);
  assert.match(adapter, /const timed = Boolean\(parts\.timed && sliderOptions\.autoplay && pagination && pagination\.type !== 'fraction'\);/);
  assert.match(adapter, /--sf-slider-dots--delay/);
  assert.match(carousel, /timed: false,/);
  assert.match(dots, /\.sf-slider-dots\.sf-slider-dots--timed \{[^}]*--sf-slider-dots-dot--active-width: var\(--sf-c6\);/s);
  assert.match(dots, /animation: sf-slider-dots-fill var\(--sf-slider-dots--delay\) linear both;/);
  assert.match(dots, /\[data-rotation-held\] \.sf-slider-dots--timed \.sf-slider-dots-dot\.active::after \{\s*animation-play-state: paused;/);
  // the undrawn picture slider keeps room for the bar under it.
  assert.match(placeholder, /--sf-slider--box-bar: calc\(var\(--sf-space-1\) \+ var\(--sf-ui-1\\\/3--control-height\)\);/);
  assert.match(placeholder, /--sf-slider--box-bar: calc\(var\(--sf-space-1\) \+ var\(--sf-ui-1--control-height\)\);/);
});

test('keys page while the focus is in the slider unless turned off', () => {
  assert.match(adapter, /const keyboardOff = sliderOptions\.keyboard === false/);
  assert.match(adapter, /if \(!keyboardOff\) \{/);
});

test('5: the shown thumbnail is ringed inside its edge and scrolled into view in its strip', () => {
  assert.match(sheet, /\.swiper-slide-thumb-active \{[^}]*outline: var\(--sf-focus--width\) solid var\(--sf-slider-thumbnails-ring--color, var\(--sf-primary\)\);[^}]*outline-offset: calc\(-1 \* var\(--sf-focus--width\)\);/s);
  assert.match(sheet, /\.sf-slider-thumbnails > \.swiper-wrapper \{\s*justify-content: safe center;/);
  assert.match(adapter, /const reveal = \(\) => \{/);
  assert.match(adapter, /thumbs\.on\?\.\('resize', reveal\);/);
});

test('2 (round 2): the reveal fades, slides 4 px and scales from 0.9 in 0.3 s; reduced motion fades only', () => {
  assert.match(sheet, /scale: 0\.9;\s*transition-duration: var\(--sf-duration-normal\);\s*transition-property: opacity, scale, translate;\s*transition-timing-function: var\(--sf-ease-move\);/);
  assert.match(sheet, /\.sf-slider-button-next \{\s*translate: var\(--sf-a4\) 0;/);
  assert.match(sheet, /scale: none;\s*transition-property: opacity;\s*translate: none;/);
});

test('versions: engine and class slider are majors, the carousel a minor on the same engine', async () => {
  assert.equal((await passport('swiper')).version, '2.0.0');
  assert.equal((await passport('slider')).version, '2.0.0');
  assert.equal((await passport('carousel')).version, '1.6.0');
  const ranges = (p) => Object.fromEntries(p.dependencies.map((d) => [d.id, d.range]));
  assert.equal(ranges(await passport('slider'))['component.swiper'], '^2.0.0');
  assert.equal(ranges(await passport('carousel'))['component.swiper'], '^2.0.0');
  assert.equal(ranges(await passport('carousel'))['component.slider'], '^2.0.0');
  assert.equal(JSON.parse(await read('src/smart/slider/component.json')).version, '1.4.0');
});
