import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// C21 (owner, 2026-11-08; completes item 2 of C18): the heading ladder. h1 is
// text step 6, h2 5, h3 3, h4 2, h5 and h6 1. A heading is never larger than
// the level above it; the spaces before headings are not part of this ladder.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json'));
const LEVELS = ['1', '2', '3', '4', '5', '6'];

// The size primitives in px (1rem = 16px): --sf-a0 ... --sf-i9.
const primitives = {};
for (const [, range, body] of read('src/core/scss/vars/_sf_var__size.scss').matchAll(/\b([a-i]):\s*\(([^)]*)\)/gu)) {
  for (const [, step, rem] of body.matchAll(/(\d+):\s*([\d.]+)rem/gu)) primitives[`${range}${step}`] = Number(rem) * 16;
}

// A generated ladder file: mobile is the first :root, desktop the one under 60rem.
function ladder(path, prefix) {
  const [mobile, desktop] = read(path).split(/@media \(min-width: (?:60rem|960px)\)/u);
  const take = (css) => Object.fromEntries([...css.matchAll(new RegExp(`--${prefix}-([\\d\\\\/]+):\\s*var\\(--sf-([a-i]\\d)\\)`, 'gu'))]
    .map(([, step, primitive]) => [step.replace('\\', ''), primitives[primitive]]));
  return {mobile: take(mobile), desktop: take(desktop)};
}
const sizes = ladder('src/core/figma_variables/figma_text_text_size.scss', 'sf-text--size');
const heights = ladder('src/core/figma_variables/figma_text_title_height.scss', 'sf-title--height');
const roles = read('src/core/figma_variables/figma_typography_roles.scss');

const measure = (screen) => LEVELS.map((level) => {
  const {size, height} = contract.typography.roles.heading[level];
  return {level, size: sizes[screen][size], height: heights[screen][height]};
});

test('C21: the contract names the owner\'s steps and the sheet reads them', () => {
  const steps = Object.fromEntries(LEVELS.map((level) => [level, contract.typography.roles.heading[level].size]));
  assert.deepEqual(steps, {1: '6', 2: '5', 3: '3', 4: '2', 5: '1', 6: '1'});
  for (const level of LEVELS) {
    const {size, height} = contract.typography.roles.heading[level];
    assert.equal(size, height, `h${level} takes its line height from its own step`);
    assert.match(roles, new RegExp(`--sf-heading-${level}--size: var\\(--sf-text--size-${size}\\);`, 'u'));
    assert.match(roles, new RegExp(`--sf-heading-${level}--height: var\\(--sf-title--height-${size}\\);`, 'u'));
  }
});

test('C21: no heading is larger than the level above it, on a phone or a desktop', () => {
  for (const screen of ['mobile', 'desktop']) {
    const rows = measure(screen);
    for (const row of rows) assert.ok(Number.isFinite(row.size) && Number.isFinite(row.height), `h${row.level} resolves on ${screen}`);
    for (let index = 1; index < rows.length; index += 1) {
      assert.ok(rows[index].size <= rows[index - 1].size, `${screen}: h${rows[index].level} ${rows[index].size}px is larger than h${rows[index - 1].level} ${rows[index - 1].size}px`);
      assert.ok(rows[index].height <= rows[index - 1].height, `${screen}: h${rows[index].level}'s line is taller than h${rows[index - 1].level}'s`);
    }
  }
});

test('C21: the measured ladder', () => {
  assert.deepEqual(measure('desktop').map(({size}) => size), [36, 32, 24, 20, 16, 16]);
  assert.deepEqual(measure('desktop').map(({height}) => height), [40, 36, 28, 24, 18, 18]);
  assert.deepEqual(measure('mobile').map(({size}) => size), [24, 22, 18, 16, 14, 14]);
});
