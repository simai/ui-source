import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const corePath = 'src/core/scss/_sf_css__scroll.scss';
const barPath = 'src/component/scrollbar/scss/_css__scrollbar.scss';
const hoverPath = 'src/utility/scroll-hover/default/scss/_sf_css__scroll_hover.scss';
const subtlePath = 'src/utility/scroll-subtle/default/scss/_sf_css__scroll_subtle.scss';

// Non-text contrast (WCAG 1.4.11) for every thumb the kit draws itself. The rest
// colour is one role for all of them -- --sf-on-neutral-container-graphic, opaque
// neutral-50/60 -- which clears 3:1 on every step of the surface ladder in both
// themes: 4.47 / 4.27 / 3.94 light and 5.95 / 5.42 / 4.77 dark over surface-0 /
// surface-1 / surface-2, computed from the released pair's core.css bytes
// (2026-10-22, control/VISUAL-DECISIONS.md). What it replaced was below or near
// the threshold: the page's own thumb at 1.00-1.14:1, the overlay ink at
// 2.09-2.70:1, the standard preset at 2.80-3.12:1, the legacy class at 1.30-1.69:1.
// C16 (2026-11-09): the rest colour is the boundary role, --sf-outline, which
// clears 3:1 on every place (surfaces research 5.2) and follows a coloured place
// or glass, where an opaque grey would be drawn on the colour.
const REST = 'var(--sf-outline)';
// The held state has to stay above that rest, and --sf-on-surface-variant cannot:
// in the dark theme it is neutral-60, the rest colour itself.
const HELD = 'var(--sf-on-surface)';

test('every page scrollbar draws its thumb in the boundary role', () => {
  const css = read(corePath);

  assert.match(css, new RegExp(`--sf-scroll-bg-thumb:\\s*${REST.replace(/[()]/g, '\\$&')}`));
  assert.doesNotMatch(css, /--sf-scroll-bg-thumb:\s*var\(--sf-surface-\d\)/);
  // The thumb is painted from that variable, so a page overriding it keeps its address.
  assert.match(css, /::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--sf-scroll-bg-thumb\)/s);
});

test('the scrollbar component paints rest and held in one pair', () => {
  const css = read(barPath);
  const rest = REST.replace(/[()]/g, '\\$&');

  // The drawn overlay thumb, through its public variable.
  assert.match(css, new RegExp(`--sf-scrollbar-thumb-color:\\s*${rest}`));
  assert.doesNotMatch(css, /--sf-scrollbar-thumb-color:\s*color-mix/);
  // C208 (1): held is the place's text, through the component's hook.
  assert.match(css, /--sf-scrollbar--thumb-hover:\s*var\(--sf-on-surface\)/);
  assert.match(css, /background:\s*var\(--sf-scrollbar--thumb-hover\)/);
  // C208, SB-7: the standard preset is core's system bar; it sets no
  // scrollbar-color, which would switch Chrome 121+ to the platform's bar.
  assert.doesNotMatch(css, /scrollbar-color:\s*var\(/);
  // The legacy .scrollbar class is published in this sheet and named in no
  // document; it takes the same pair until the question of removing a public
  // class is answered on its own.
  assert.match(css, new RegExp(`\\.scrollbar::-webkit-scrollbar-thumb\\s*\\{\\s*background:\\s*${rest}`));
  assert.doesNotMatch(css, /var\(--sf-surface-4\)/);
  // Held, both places, and nothing left on the role that would match the rest in dark.
  assert.equal(css.match(/var\(--sf-on-surface\)/gu)?.length, 2);
  assert.doesNotMatch(css, /var\(--sf-on-surface-variant\)/);
});

test('core holds the one hover rule: rest the boundary, held the text (C208 (1))', () => {
  const css = read(corePath);
  assert.match(css, new RegExp(`--sf-scroll--thumb-hover:\\s*${HELD.replace(/[()]/g, '\\$&')}`));
  assert.match(css, /::-webkit-scrollbar-thumb:hover,\s*::-webkit-scrollbar-thumb:active\s*\{\s*background-color:\s*var\(--sf-scroll--thumb-hover\)/);
});

test('the two scroll utilities keep their own addresses', () => {
  // scroll-hover reads the kit's variables: the thumb is transparent at rest and
  // the boundary while the area is hovered or focused (C208 (1): no width change).
  const hover = read(hoverPath);
  assert.match(hover, /--sf-scroll-bg-thumb:\s*var\(--sf-transparent\)/);
  assert.match(hover, /&:is\(:hover, :focus-within\)\s*\{\s*--sf-scroll-bg-thumb:\s*var\(--sf-outline\)/);
  assert.doesNotMatch(hover, /var\(--sf-surface-\d\)/);
  assert.doesNotMatch(hover, /scrollbar-(?:width|color):/);

  // scroll-subtle is how a page asks for a quieter bar on purpose: the place's
  // text on the ink steps of the alpha scale, 48 at rest, 64 held (C208 (1)).
  const subtle = read(subtlePath);
  assert.match(subtle, /--sf-scroll-bg-thumb:\s*color-mix\(in srgb, var\(--sf-transparent\), var\(--sf-on-surface\) 48%\)/);
  assert.match(subtle, /--sf-scroll--thumb-hover:\s*color-mix\(in srgb, var\(--sf-transparent\), var\(--sf-on-surface\) 64%\)/);
});
