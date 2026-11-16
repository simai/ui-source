import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A heading sets its line height from its own ladder, --sf-title--height-N,
// separate from the one body text uses. Three of its twelve steps had drifted
// to the font size itself: title-2 at 16/16 on a narrow screen, title-1 at
// 16/16 on a wide one, title-5 at 22/24. At a ratio of 1.00 the lines sit flush
// and the descenders of a heading that wraps collide with the line beneath —
// in Russian that is у, р, д, ц, щ, which is most headings.
//
// The rest of the ladder sits between 1.11 and 1.20, so that is the band this
// check holds it to. The arithmetic is done here rather than the names matched,
// so a retuned size ladder fails in the suite instead of on a page.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const MINIMUM = 1.1;

const primitives = () => {
  const source = read('src/core/scss/vars/_sf_var__size.scss');
  const values = {};
  let range = null;
  for (const line of source.split('\n')) {
    const header = line.match(/^\s*([a-i]):\s*\(/u);
    if (header) { range = header[1]; continue; }
    const step = line.match(/^\s*([0-9]):\s*([0-9.]+)rem/u);
    if (step && range) values[`--sf-${range}${step[1]}`] = Number(step[2]) * 16;
  }
  return values;
};

// Each file declares the narrow values first and repeats them inside the
// min-width block, so the first match is the narrow mode and the last the wide.
const ladder = (path, prefix) => {
  const source = read(path);
  const narrow = {};
  const wide = {};
  for (const [, step, token] of source.matchAll(new RegExp(`${prefix}-([0-9]+):\\s*var\\((--sf-[a-i][0-9])\\)`, 'gu'))) {
    if (narrow[step] === undefined) narrow[step] = token;
    else wide[step] = token;
  }
  return { narrow, wide };
};

test('a heading leaves room between its lines', () => {
  const px = primitives();
  const heights = ladder('src/core/figma_variables/figma_text_title_height.scss', '--sf-title--height');
  const sizes = ladder('src/core/figma_variables/figma_text_text_size.scss', '--sf-text--size');
  const offenders = [];
  for (const mode of ['narrow', 'wide']) {
    for (const step of Object.keys(heights[mode])) {
      const size = px[sizes[mode][step]];
      const height = px[heights[mode][step]];
      if (!size || !height) continue;
      const ratio = height / size;
      if (ratio < MINIMUM) offenders.push(`${mode} title-${step}: ${size}/${height} = ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(offenders, [], `a heading line height under ${MINIMUM} of its size collides with the line beneath`);
});

test('the heading ladder only ever grows', () => {
  const px = primitives();
  const heights = ladder('src/core/figma_variables/figma_text_title_height.scss', '--sf-title--height');
  for (const mode of ['narrow', 'wide']) {
    const steps = Object.keys(heights[mode]).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < steps.length; i += 1) {
      const previous = px[heights[mode][String(steps[i - 1])]];
      const current = px[heights[mode][String(steps[i])]];
      assert.ok(current >= previous,
        `${mode} title-${steps[i]} is ${current} while title-${steps[i - 1]} is ${previous}`);
    }
  }
});

// The card title line (owner decision C89, 2026-11-12, amending R082): the
// card title is the heading-6 step on --sf-title--height-card -- 16/24 on a
// desktop, as rung 2, and 14/20 on a phone, the line of the 14 px text under
// it, where rung 2 gives 14/18 and two title lines stood tighter than the
// description. A named step of the title ladder, after rungs 1..12, read from
// the size scale here so a retuned ladder fails in the suite.
test('the card title line is 24 on a desktop and 20 on a phone (C89)', () => {
  const px = primitives();
  const source = read('src/core/figma_variables/figma_text_title_height.scss');
  const card = [...source.matchAll(/--sf-title--height-card:\s*var\((--sf-[a-i][0-9])\)/gu)].map(([, token]) => px[token]);
  assert.deepEqual(card, [20, 24], 'narrow then wide');
  const heights = ladder('src/core/figma_variables/figma_text_title_height.scss', '--sf-title--height');
  const sizes = ladder('src/core/figma_variables/figma_text_text_size.scss', '--sf-text--size');
  const roles = read('src/core/figma_variables/figma_typography_roles.scss');
  assert.match(roles, /--sf-heading-6--size: var\(--sf-text--size-1\);/u, 'the card title size is the heading-6 step, text rung 1');
  const title = {narrow: [px[sizes.narrow['1']], card[0]], wide: [px[sizes.wide['1']], card[1]]};
  assert.deepEqual(title, {narrow: [14, 20], wide: [16, 24]});
  for (const [mode, [size, height]] of Object.entries(title)) {
    assert.ok(height / size >= MINIMUM, `${mode} card title ${size}/${height}`);
  }
  // Between rungs 2 and 3 in both modes, so the ladder still only grows.
  const index = {narrow: 0, wide: 1};
  for (const mode of ['narrow', 'wide']) {
    assert.ok(px[heights[mode]['2']] <= card[index[mode]] && card[index[mode]] <= px[heights[mode]['3']],
      `${mode} card line ${card[index[mode]]} between title-2 ${px[heights[mode]['2']]} and title-3 ${px[heights[mode]['3']]}`);
  }
  // A new name: no 5.x compatibility alias, and density never moves it.
  assert.doesNotMatch(source, /--sf-title-height-card/u);
  assert.doesNotMatch(read('src/core/scss/_sf_css__density.scss'), /--sf-title--height-card/u);
  // The card reads it, not rung 2 and not a raw length.
  const sheet = read('src/component/card/scss/_css__card.scss');
  assert.match(sheet, /\.sf-card > :is\(h1, h2, h3, h4, h5, h6\) \{[^}]*line-height: var\(--sf-title--height-card\);/u);
  assert.match(sheet, /font-size: var\(--sf-card-title-size, var\(--sf-heading-6--size\)\);/u);
});
