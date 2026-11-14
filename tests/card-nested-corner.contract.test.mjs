import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// C173 (5): one nested-corner rule -- the host's corner less its inset, not
// under 4. A card in a card and a figure in a card were drawn with the card's
// own 8 at an inset of 20 (plain group 1, 2026-11-14).
test('Card gives a card and a figure inside it the nested corner', async () => {
  const css = await read('src/component/card/scss/_css__card.scss');
  const formula = 'max(var(--sf-a4), calc(var(--sf-radius--surface) - var(--sf-space-2)))';
  const nested = css.match(/:where\(\.sf-card:not\(\.sf-card--plain\)\) \.sf-card:not\(\.sf-card--plain\) \{[^}]*\}/u)?.[0] || '';
  const figure = css.match(/:where\(\.sf-card:not\(\.sf-card--plain\)\) \.sf-figure \{[^}]*\}/u)?.[0] || '';

  assert.ok(nested.includes(`border-radius: var(--sf-card-radius, ${formula})`), nested);
  assert.ok(figure.includes(`--sf-figure-radius: ${formula}`), figure);
});
