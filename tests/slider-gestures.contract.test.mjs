// sf-slider 1.3.0 (ui-control research 2026-11-14-content-slider): swipe, keys,
// region words, previousIndex, gap, thumbnail radius, quiet arrows. The browser
// side was measured on the stand (probe slider.mjs in the evidence).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engine = await read('src/component/swiper/js/index.js');
const engineSheet = await read('src/component/swiper/scss/index.scss');
const adapter = await read('src/component/slider/js/_slider.js');
const sheet = await read('src/component/slider/scss/_css__slider.scss');
const template = await read('src/smart/slider/js/templates/default.js');
const manifest = JSON.parse(await read('src/smart/slider/component.json'));
const words = {ru: JSON.parse(await read('src/smart/slider/lang/ru.json')).runtime, en: JSON.parse(await read('src/smart/slider/lang/en.json')).runtime};

test('SL-2: the engine pages on a pointer drag and leaves vertical moves to the page', () => {
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dragstart']) {
    assert.match(engine, new RegExp(`addEventListener\\('${name}'`));
    assert.match(engine, new RegExp(`removeEventListener\\('${name}'`));
  }
  assert.match(engine, /Math\.abs\(dy\) >= Math\.abs\(dx\)\) \{ drag\.state = 'off'/);
  assert.match(engine, /allowTouchMove !== false/);
  assert.match(engine, /simulateTouch === false/);
  assert.match(engineSheet, /\.swiper-touch \{\s*touch-action: pan-y pinch-zoom;/);
  assert.match(engine, /prefersReducedMotion\(\) \? 0/);
  assert.match(adapter, /allowTouchMove: false/);
});

test('SL-3: the keys listen on the whole block, mirrored right to left, never in a field', () => {
  assert.match(engine, /resolveElement\(this\.params\.keyboard\?\.el, this\.el\) \|\| this\.el/);
  assert.match(engine, /event\.target\.closest\(EDITABLE\)/);
  assert.match(adapter, /enabled: true,\s*el: root,/);
});

test('SL-5: the block is a named region described as a carousel, its slides as slides', () => {
  assert.match(adapter, /setAttribute\('role', 'region'\)/);
  assert.match(adapter, /aria-roledescription', sliderWord\(root, 'carousel'\)/);
  assert.match(engine, /itemRoleDescriptionMessage/);
  assert.equal(words.ru.carousel, 'карусель');
  assert.equal(words.ru.slide, 'слайд');
  assert.equal(words.ru.position, '{n} из {count}');
  assert.equal(words.en.position, '{n} of {count}');
  assert.equal(manifest.accessibility.role, 'region');
});

test('SL-7: the engine keeps the slide shown before the change', () => {
  assert.match(engine, /if \(changed\) this\.previousIndex = this\.activeIndex;/);
});

test('SL-8 and SL-12: slides stand a space step apart; thumbnails take the small-part radius', () => {
  assert.match(engine, /calc\(\(100% - \$\{\(slidesPerView - 1\) \* gap\}px\) \/ \$\{slidesPerView\}\)/);
  assert.match(sheet, /--sf-slider--space-between: var\(--sf-space-1\\\/2\)/);
  assert.match(sheet, /var\(--sf-slider-thumbnail-radius, var\(--sf-radius--ui\)\)/);
});

test('SL-11: the arrows default to the soft grey icon buttons (C116)', () => {
  assert.equal(manifest.settings['button-type'].default, 'secondary');
  assert.match(template, /secondary: \{ type: 'tonal', scheme: 'on-surface' \}/);
  assert.match(template, /options\[normalizedType\] \|\| options\.secondary/);
});
