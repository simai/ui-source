// Decision C143 (owner 2026-11-14): one content slider, plates over pictures,
// one row under cards, 8 px dots and a counter from eight, one Tab stop for
// the dots, autoplay only with a shown pause button, the next card peeking,
// the frame held from the first paint.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const slider = await read('src/component/slider/js/_slider.js');
const engine = await read('src/component/swiper/js/index.js');
const css = await read('src/component/slider/scss/_css__slider.scss');
const dots = await read('src/component/slider/scss/_css__slider_dots.scss');
const template = await read('src/smart/slider/js/templates/default.js');
const carousel = await read('src/component/carousel/js/_carousel.js');
const core = await read('src/core/scss/_sf_css__placeholder.scss');
const journal = JSON.parse(await read('contracts/changes/journal.json'));

test('sf-carousel is an old name of sf-slider until 2027-01-01, noted once', () => {
  assert.match(carousel, /noteDeprecated\(\{ component: 'sf-carousel', kind: 'class', from: 'sf-carousel', to: 'sf-slider', \.\.\.DEPRECATED \}\)/);
  assert.match(carousel, /remove_after: '2027-01-01'/);
  const rec = journal.records.find((r) => r.id === 'class-sf-carousel-to-sf-slider');
  assert.equal(rec?.remove_after, '2027-01-01');
});

test('Over a picture the controls stand on popup plates with the overlay shadow', () => {
  assert.match(css, /\.sf-slider-arrows--plate \.sf-icon-button \{\s*box-shadow: var\(--sf-shadow-overlay\)/);
  assert.match(css, /@layer sf\.states \{[\s\S]*background-color: var\(--sf-surface-popup\)/);
  assert.match(dots, /\.sf-slider-dots\.sf-slider-dots--plate \{\s*--sf-slider-dots--background-color: var\(--sf-surface-popup\);\s*--sf-slider-dots--box-shadow: var\(--sf-shadow-overlay\)/);
  assert.match(template, /'sf-slider-arrows--plate'/);
});

test('Under cards one row: position at the start, arrows 8 apart at the end (C105 H5, H6)', () => {
  assert.match(css, /\.sf-slider--content \.sf-slider-controls \.sf-slider-arrows \{[^}]*gap: var\(--sf-space-1\\\/3\);[^}]*margin-inline-start: auto/);
  assert.match(css, /\.sf-slider--content \.sf-slider-controls \{[^}]*justify-content: flex-start;[^}]*gap: var\(--sf-slider-gap, var\(--sf-slider--gap, var\(--sf-space-1\)\)\)/);
  assert.match(template, /context\.content\s*\? html`\$\{renderPosition\(context\)\}\$\{renderArrows\(context\)\}`/);
});

test('Dots are 8, the current a 24 x 8 pill; from eight slides a counter', () => {
  assert.match(dots, /--sf-slider-dots-dot--active-width: var\(--sf-c2\)/);
  assert.equal((dots.match(/--sf-slider-dots-dot--width: var\(--sf-a8\)/g) || []).length, 2);
  assert.match(slider, /const DOTS_LIMIT = 7;/);
  assert.match(slider, /type: 'fraction'/);
  assert.match(engine, /options\.type === 'fraction'/);
});

test('The dots are one Tab stop paged by the arrow keys, Home and End', () => {
  assert.match(slider, /keyboard: true,/);
  assert.match(engine, /bullet\.tabIndex = active \? 0 : -1/);
  assert.match(engine, /event\.key === 'Home'/);
  assert.match(engine, /event\.key === 'End'/);
});

test('Autoplay turns only with a shown pause button', () => {
  assert.match(slider, /if \(sliderOptions\.autoplay && !\(rotationButton && isShown\(rotationButton\)\)\) \{\s*delete sliderOptions\.autoplay;/);
  assert.match(template, /root-class="sf-slider-rotation sf-slider-button-rotation"/);
  assert.match(slider, /rotationButton\.removeAttribute\('aria-pressed'\)/);
});

test('Cards peek and the last stop shows the last card whole', () => {
  assert.match(slider, /const PEEK_PER_VIEW = 1\.15;/);
  assert.match(slider, /const PEEK_PER_VIEW_WIDE = 2\.2;/);
  assert.match(engine, /Math\.ceil\(this\.slides\.length - this\.perView\(\) - 1e-6\)/);
  assert.match(engine, /offsetSlides\(\)/);
});

test('The frame is held before the code: core.css holds sf-slider by its ratio', () => {
  assert.match(core, /:where\(sf-slider:not\(:defined\):not\(\[root-class~="sf-slider--content"\]\):not\(\[ratio="auto"\]\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*aspect-ratio: 16 \/ 9;/);
  assert.match(core, /> :not\(:first-child\) \{\s*display: none;/);
  assert.match(css, /aspect-ratio: var\(--sf-slider--ratio\)/);
});
