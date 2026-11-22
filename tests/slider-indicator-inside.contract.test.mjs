// The position inside the picture (owner decision C398, 2026-11-21; carousel
// study #inside-r3, way B): data-indicator="inside", the ink measured from the
// picture behind the row, way A (light dots with a dark ring) where it cannot
// be measured. The browser side (luminance, ink and contrast per picture) is
// measured on the stand (ui-control control/evidence/2026-11-21-carousel-ink).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const adapter = await read('src/component/slider/js/_slider.js');
const sheet = await read('src/component/slider/scss/_css__slider.scss');
const dots = await read('src/component/slider/scss/_css__slider_dots.scss');
const template = await read('src/smart/slider/js/templates/default.js');
const element = await read('src/smart/slider/index.js');
const placeholder = await read('src/core/scss/_sf_css__placeholder.scss');
const manifest = JSON.parse(await read('src/smart/slider/component.json'));
const variables = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
const passport = JSON.parse(await read('src/component/slider/passport.json'));
const INSIDE = '.sf-slider[data-indicator="inside"]:not(.sf-slider--content):not(:has(> .sf-slider-thumbnails))';

test('C398: inside is a choice of picture sliders and heroes; under stays the default', () => {
  assert.deepEqual(manifest.settings.indicator.values, ['under', 'inside']);
  assert.equal(manifest.settings.indicator.default, 'under');
  assert.deepEqual(manifest.settings['indicator-ink'].values, ['auto', 'light', 'dark', 'outline']);
  assert.equal(manifest.settings['indicator-ink'].default, 'auto');
  assert.match(template, /data-indicator=\$\{normalizeOption\(context\.indicator\) === 'inside' \? 'inside' : nothing\}/);
  assert.match(template, /data-indicator-ink=\$\{INKS\.has\(/);
  assert.match(element, /indicator: this\.indicator,\s*indicatorInk: this\.indicatorInk,/);
  // Cards and thumbnails keep the position under.
  assert.match(adapter, /if \(root\.dataset\.indicator !== 'inside' \|\| isContentSlider\(root\)\) return null;/);
  assert.match(adapter, /if \(root\.querySelector\(':scope > \.sf-slider-thumbnails'\)\) return null;/);
});

test('C398: the row stands over the picture a space step above its edge, no plate, the counter in the end corner', () => {
  const at = sheet.indexOf(`${INSIDE} > .sf-slider-controls > :is(.sf-slider-dots, .sf-slider-pagination, .sf-slider-rotation-place) {`);
  assert.ok(at > 0);
  const rule = sheet.slice(at, sheet.indexOf('}', at));
  assert.match(rule, /align-self: end;/);
  assert.match(rule, /grid-row: 1;/);
  assert.match(rule, /margin-block: 0 var\(--sf-slider-dots-offset-block, var\(--sf-space-2\)\);/);
  assert.match(sheet, /> \.sf-slider-dots--count \{\s*grid-column: 4;\s*justify-self: end;\s*margin-inline-end: var\(--sf-space-2\);/);
  // The dots and the pause button share one centre line.
  assert.match(sheet, /margin-block-end: calc\(var\(--sf-slider-dots-offset-block, var\(--sf-space-2\)\) \+ \(var\(--sf-ui-1--control-height\) - var\(--sf-slider-dots-dot--target-size\)\) \/ 2\);/);
  // No :has() inside a :has() anywhere in the slider sheets (one drops its whole selector list).
  const nested = (text) => {
    for (let at = text.indexOf(':has('); at >= 0; at = text.indexOf(':has(', at + 5)) {
      let depth = 1; let end = at + 5;
      for (; end < text.length && depth; end += 1) depth += text[end] === '(' ? 1 : text[end] === ')' ? -1 : 0;
      if (text.slice(at + 5, end).includes(':has(')) return text.slice(at, end);
    }
    return null;
  };
  for (const text of [sheet, dots]) assert.equal(nested(text), null);
  // The undrawn element keeps no room for a bar under the picture.
  assert.match(placeholder, /\[indicator="inside"\]:not\(\[thumbs\]:not\(\[thumbs="false"\]\)\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*--sf-slider--box-bar: 0px;/);
});

test('C398: the inks are roles, the same in both themes; the weakest dot at --sf-opacity-80; outline is a 1 px ring of the dark ink at full strength (CAR-2)', () => {
  assert.match(sheet, /--sf-slider-indicator--ink-light: var\(--sf-on-surface-media\);/);
  assert.match(sheet, /--sf-slider-indicator--ink-dark: var\(--sf-surface-media-active\);/);
  assert.match(sheet, /--sf-slider-indicator--ring: var\(--sf-slider-indicator--ink-dark\);/);
  assert.match(dots, /\[data-ink="outline"\][^{]*\.sf-slider-dots-dot:not\(\.active\) \{\s*opacity: 1;/);
  assert.match(sheet, /\[data-ink="dark"\][^{]*\{\s*--sf-slider-indicator--ink: var\(--sf-slider-indicator--ink-dark\);/);
  assert.match(dots, /--sf-slider-dots-dot--color: var\(--sf-slider-indicator-ink, var\(--sf-slider-indicator--ink\)\);/);
  assert.match(sheet, /--sf-slider-indicator--dot-opacity: var\(--sf-opacity-80\);/);
  assert.match(dots, /\.sf-slider-dots-dot:not\(\.active\) \{\s*opacity: var\(--sf-slider-indicator--dot-opacity\);/);
  assert.match(adapter, /getPropertyValue\('--sf-slider-indicator--dot-opacity'\)/);
  assert.match(dots, /\[data-ink="outline"\][^{]*\.sf-slider-dots-dot \{\s*box-shadow: 0 0 0 var\(--sf-px\) var\(--sf-slider-indicator--ring\);/);
  // No literal colour in the inside rules.
  const inside = [sheet, dots].join('\n').split('\n').filter((line) => line.includes('indicator'));
  assert.ok(inside.every((line) => !/#[0-9a-f]{3,8}\b|rgb\(/i.test(line)), 'no literal colour');
  // The ink changes over --sf-duration-normal, only without reduced motion.
  assert.match(dots, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.sf-slider\[data-indicator="inside"\][^{]*\{\s*transition-duration: var\(--sf-duration-normal\);/);
});

test('C398: the ink is measured from the strip behind the row and falls back to outline', () => {
  assert.match(adapter, /context\.drawImage\(media, \(drawn\.left - box\.left\) \* kx, \(drawn\.top - box\.top\) \* ky, drawn\.width \* kx, drawn\.height \* ky\);/);
  assert.match(adapter, /return \{reason: 'cross-origin'\};/);
  assert.match(adapter, /if \(!\(media instanceof HTMLImageElement\)\) return \{reason: 'media'\};/);
  assert.match(adapter, /if \(!media\.complete \|\| !media\.naturalWidth\) return \{reason: 'loading'\};/);
  // CAR-2: a strip of high variance (fine stripes too) or one the better ink holds under 3:1 is outline,
  // and the strip is read at the row's own pixel size, not averaged on a small canvas.
  assert.match(adapter, /const busy = spread >= INK_MIN_CONTRAST;/);
  assert.match(adapter, /const holds = !busy && scores\[best\] >= INK_MIN_CONTRAST;/);
  assert.match(adapter, /ink: holds \? best : 'outline',/);
  assert.match(adapter, /reason: holds \? strip\.from : busy \? 'high-variance' : 'low-contrast',/);
  assert.match(adapter, /Math\.round\(box\.width\)/);
  assert.match(adapter, /const INK_MIN_CONTRAST = 3;/);
  // A slide on its way is read where it will rest.
  assert.match(adapter, /const dx = frame \? own\.left - frame\.left : 0;/);
  assert.match(adapter, /const events = \['slideChange', 'transitionEnd', 'resize', 'update'\];/);
  assert.match(adapter, /root\.addEventListener\('load', schedule, true\);/);
  assert.match(adapter, /if \(INK_WORDS\.has\(authored\)\) return \{ink: authored, reason: 'author'\};/);
  assert.match(adapter, /createIndicatorInk\(root, slider\),/);
});

test('C398: the ink by hand is a public variable; versions', () => {
  const slider = variables.components.find((entry) => entry.component === 'slider');
  assert.ok(slider.variables.some((variable) => variable.name === '--sf-slider-indicator-ink'));
  assert.ok(manifest['css-variables']['--sf-slider-indicator-ink']);
  assert.equal(passport.version, '2.2.0'); // GB16 returns: the dots offset is the inside position's
  assert.equal(manifest.version, '1.5.0');
});
