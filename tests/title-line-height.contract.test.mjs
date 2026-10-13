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
