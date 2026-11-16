import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// C173 (5): one nested-corner rule -- the host's corner less its inset, not
// under 4. A card in a card and a figure in a card were drawn with the card's
// own 8 at an inset of 20 (plain group 1, 2026-11-14).
test('Card gives a card and a figure inside it the nested corner', async () => {
  const css = await read('src/component/card/scss/_css__card.scss');
  const formula = 'max(var(--sf-a4), calc(var(--sf-radius--surface) - var(--sf-inset--panel)))';
  const nested = css.match(/:where\(\.sf-card:not\(\.sf-card--plain\)\) \.sf-card:not\(\.sf-card--plain\) \{[^}]*\}/u)?.[0] || '';
  const figure = css.match(/:where\(\.sf-card:not\(\.sf-card--plain\)\) \.sf-figure > \.sf-figure-media \{[^}]*\}/u)?.[0] || '';
  const caption = css.match(/> \.sf-figure-media \+ \.sf-figure-caption \{[^}]*\}/u)?.[0] || '';

  // C188 (2): the card's corner is the private --sf-card--radius, so a picture
  // at a nested card's edge reads the nested corner too.
  assert.ok(nested.includes(`--sf-card--radius: var(--sf-card-radius, ${formula})`), nested);
  assert.match(css, /border-radius: var\(--sf-card--radius\);/u);
  assert.ok(figure.includes(`border-radius: var(--sf-figure-radius, ${formula})`), figure);
  assert.ok(caption.includes(`border-end-end-radius: var(--sf-figure-radius, ${formula})`), caption);
  // The Framework reads public variables, it never sets them.
  assert.doesNotMatch(css, /(^|[;{\s])--sf-figure-radius\s*:/mu);
});
