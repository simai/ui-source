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
const REST = 'var(--sf-on-neutral-container-graphic)';
// The held state has to stay above that rest, and --sf-on-surface-variant cannot:
// in the dark theme it is neutral-60, the rest colour itself.
const HELD = 'var(--sf-on-surface)';

test('every page scrollbar draws its thumb in the graphic role', () => {
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
  // The standard preset, for Firefox and for WebKit.
  assert.match(css, new RegExp(`scrollbar-color:\\s*${rest}\\s+var\\(--sf-transparent\\)`));
  assert.match(css, new RegExp(`::-webkit-scrollbar-thumb\\s*\\{[^}]*background:\\s*${rest}`, 's'));
  // The legacy .scrollbar class is published in this sheet and named in no
  // document; it takes the same pair until the question of removing a public
  // class is answered on its own.
  assert.match(css, new RegExp(`\\.scrollbar::-webkit-scrollbar-thumb\\s*\\{\\s*background:\\s*${rest}`));
  assert.doesNotMatch(css, /var\(--sf-surface-4\)/);
  // Held, both places, and nothing left on the role that would match the rest in dark.
  assert.equal(css.match(/var\(--sf-on-surface\)/gu)?.length, 2);
  assert.doesNotMatch(css, /var\(--sf-on-surface-variant\)/);
  assert.ok(css.includes(`background-color: ${HELD}`));
});

test('the two scroll utilities keep their own addresses', () => {
  // scroll-hover reads the kit's variable, so it follows the repaint rather than
  // holding a colour of its own.
  const hover = read(hoverPath);
  assert.match(hover, /scrollbar-color:\s*var\(--sf-scroll-bg-thumb\)/);
  assert.match(hover, /background-color:\s*var\(--sf-scroll-bg-thumb\)/);
  assert.doesNotMatch(hover, /var\(--sf-surface-\d\)/);

  // scroll-subtle is how a page asks for a quieter bar on purpose; it is not
  // repainted, and after the repaint it is the explicit way to get the old one.
  const subtle = read(subtlePath);
  assert.match(subtle, /--sf-scroll-bg-thumb:\s*var\(--sf-scroll-thumb-subtle\)/);
  assert.match(subtle, /var\(--sf-on-surface\)\s*10%/);
  assert.match(subtle, /var\(--sf-on-surface\)\s*20%/);
});
