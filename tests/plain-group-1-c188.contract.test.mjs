import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Owner decision C188 (2026-11-14): card, divider, figure caption and icon in
// a circle (research ui-control control/research/2026-11-14-plain-group-1.md,
// prototype prototypes/plain-group-1-study.html).
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const block = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  return css.slice(start, css.indexOf('}', start) + 1);
};

test('C188 (1): a card has no footer or subtitle part; its .sf-actions row stands at the foot', async () => {
  const css = await read('src/component/card/scss/_css__card.scss');
  assert.match(block(css, '  .sf-card > .sf-actions:last-child'), /margin-block-start: auto/u);
  // The row itself is the core's .sf-actions (C173 (3)); the card does not draw it.
  assert.doesNotMatch(css, /\n  \.sf-actions \{/u);
  assert.doesNotMatch(css, /\.sf-card-(?:footer|subtitle|foot)\b/u);
});

test('C188 (2): a figure as the first block goes to the card edge with the card top corners', async () => {
  const css = await read('src/component/card/scss/_css__card.scss');
  const edge = block(css, '  .sf-card:not(.sf-card--plain) > .sf-figure:first-child');
  assert.match(edge, /margin-block-start: calc\(-1 \* var\(--sf-card-padding-block, var\(--sf-space-2\)\)\)/u);
  assert.match(edge, /margin-inline: calc\(-1 \* var\(--sf-card-padding-inline, var\(--sf-space-2\)\)\)/u);
  const media = block(css, '  .sf-card:not(.sf-card--plain) > .sf-figure:first-child > .sf-figure-media');
  assert.match(media, /border-start-start-radius: calc\(var\(--sf-card--radius\) - var\(--sf-card-border-width, var\(--sf-px\)\)\)/u);
  assert.match(media, /border-end-end-radius: var\(--sf-0\)/u);
  // A narrow card's inset is a share of its column: the rest is clipped at its edge.
  assert.match(block(css, '  .sf-card:not(.sf-card--plain):has(> .sf-figure:first-child)'), /overflow: clip/u);
  // Inside the body the nested corner of C173 (5) stays.
  assert.match(css, /:where\(\.sf-card:not\(\.sf-card--plain\)\) \.sf-figure > \.sf-figure-media \{\s*border-radius: var\(--sf-figure-radius, max\(var\(--sf-a4\)/u);
});

test('C188 (3): a caption on the line is small, muted, 12 from the lines, no frame; the framed caption is an alias', async () => {
  const [css, script] = await Promise.all([
    read('src/component/contentDivider/scss/_css__contentDivider.scss'),
    read('src/component/contentDivider/js/_contentDivider.js'),
  ]);
  const root = block(css, '  .sf-divider');
  assert.match(root, /--sf-divider--gap: var\(--sf-space-1\\\/2\)/u);
  assert.match(root, /--sf-divider-content--padding: var\(--sf-0\)/u);
  assert.match(root, /--sf-divider-content--color: var\(--sf-on-surface-variant\)/u);
  assert.match(root, /--sf-divider-content--font-size: var\(--sf-text-size-1\\\/2\)/u);
  const framed = block(css, '  .sf-divider-content-border');
  assert.match(framed, /border: 0/u);
  assert.doesNotMatch(framed, /padding|radius/u);
  assert.match(script, /'sf-divider-content-border': 'sf-divider-content'/u);
});

test('C188 (4): buttons on the line are sf-button 1/2 outline 8 apart; the divider own paint is an alias', async () => {
  const [css, script, rule, journal] = await Promise.all([
    read('src/component/contentDivider/scss/_css__contentDivider.scss'),
    read('src/component/contentDivider/js/_contentDivider.js'),
    read('src/component/contentDivider/rule.js'),
    read('contracts/changes/journal.json'),
  ]);
  assert.match(block(css, '  .sf-divider-buttons'), /--sf-divider-buttons--gap: var\(--sf-space-1\\\/3\)/u);
  assert.match(css, /sf-button size="1\/2" appearance="outline"/u);
  assert.match(script, /'sf-divider-button': 'sf-button'/u);
  assert.match(script, /remove_after: '2027-01-01'/u);
  assert.match(rule, /js: true/u);
  const record = JSON.parse(journal).records.find((entry) => entry.id === 'class-content-divider-c188-aliases');
  assert.ok(record, 'journal record');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map((item) => item.from), ['sf-divider-content-border', 'sf-divider-button']);
});

test('C188 (5): the caption stands 8 under its picture at every width', async () => {
  const css = await read('src/component/figure/scss/_css__figure.scss');
  assert.match(block(css, '  .sf-figure'), /gap: var\(--sf-figure-gap, var\(--sf-space-1\\\/3\)\)/u);
  const docs = await read('src/component/figure/docs/docs.md');
  assert.match(docs, /after « · »/u);
});

test('C188 (6): one ratio list for the figure and a card picture', async () => {
  const css = await read('src/component/figure/scss/_css__figure.scss');
  for (const ratio of ['1x1', '4x3', '3x2', '16x9', '21x9']) assert.ok(css.includes(`.sf-figure--ratio-${ratio}`), ratio);
  const docs = await read('src/component/figure/docs/docs.md');
  assert.match(docs, /1:1 · 4:3 · 3:2 · 16:9 · 21:9 · auto/u);
});

test('C188 (7): size 3 draws its glyph one icon step above size 2', async () => {
  const css = await read('src/component/featured-icon/scss/_css_featured-icon.scss');
  const size3 = block(css, '  .sf-featured-icon--size-3');
  assert.match(size3, /--sf-featured-icon--icon-size: calc\(var\(--sf-text-height-2\) \+ var\(--sf-a4\)\)/u);
});

test('C188 (8): two looks, tonal by default and solid; medium and elevated draw tonal', async () => {
  const css = await read('src/component/featured-icon/scss/_css_featured-icon.scss');
  const tonal = css.match(/\.sf-featured-icon--soft,[^{]*\{[^}]*\}/u)?.[0] || '';
  for (const name of ['light', 'medium', 'mid', 'elevated', 'modern']) assert.ok(tonal.includes(`.sf-featured-icon--${name}`), name);
  assert.match(tonal, /--sf-featured-icon--background-color: var\(--sf-featured-icon--container\)/u);
  assert.match(block(css, '  .sf-featured-icon--solid,\n  .sf-featured-icon--dark'), /var\(--sf-featured-icon--tone\)/u);
  assert.doesNotMatch(css, /container-strong|shadow-flat|shadow-raised/u);
  for (const shape of ['circle', 'square']) assert.ok(css.includes(`.sf-featured-icon--${shape}`), shape);
});

test('C188 (9): the default circle is grey with the glyph in on-surface-variant; primary by choice', async () => {
  const css = await read('src/component/featured-icon/scss/_css_featured-icon.scss');
  const base = block(css, '  .sf-featured-icon');
  assert.match(base, /--sf-featured-icon--container: var\(--sf-surface-container\)/u);
  assert.match(base, /--sf-featured-icon--on-container: var\(--sf-on-surface-variant\)/u);
  assert.match(block(css, '  .sf-featured-icon--primary'), /--sf-featured-icon--container: var\(--sf-primary-container\)/u);
});
