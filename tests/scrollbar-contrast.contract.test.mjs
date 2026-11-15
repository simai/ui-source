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
// C210 (2): the held thumb takes one quiet step, the place's secondary text,
// never its text colour (owner 2026-11-15).
const HELD = 'var(--sf-on-surface-variant)';

test('every scrollbar draws its thumb in the boundary role', () => {
  const css = read(corePath);

  assert.match(css, new RegExp(`--sf-scroll-bg-thumb:\\s*${REST.replace(/[()]/g, '\\$&')}`));
  assert.doesNotMatch(css, /--sf-scroll-bg-thumb:\s*var\(--sf-surface-\d\)/);
  // The engine reads that variable off the area, so a page overriding it keeps its address.
  assert.match(read('src/core/js/scrollbars.js'), /'--sf-scroll--rest-colour': prop\('--sf-scroll-bg-thumb'\)/);
});

test('the scrollbar component paints no thumb of its own', () => {
  const css = read(barPath);
  assert.doesNotMatch(css, /background(?:-color)?:\s*var\(--sf-(?:outline|on-surface)/);
  assert.doesNotMatch(css, /var\(--sf-surface-4\)/);
});

test('core holds the one colour rule: rest the boundary, held the secondary text (C210 (2))', () => {
  const css = read(corePath);
  assert.match(css, new RegExp(`--sf-scroll--thumb-held:\\s*${HELD.replace(/[()]/g, '\\$&')}`));
});

test('the two retired scroll utilities keep their own addresses until 2027-01-01', () => {
  const hover = read(hoverPath);
  assert.match(hover, /--sf-scroll-bg-thumb:\s*var\(--sf-transparent\)/);
  assert.doesNotMatch(hover, /scrollbar-(?:width|color):/);
  const subtle = read(subtlePath);
  assert.match(subtle, /--sf-scroll-bg-thumb:\s*color-mix\(in srgb, var\(--sf-transparent\), var\(--sf-on-surface\) 48%\)/);
});
