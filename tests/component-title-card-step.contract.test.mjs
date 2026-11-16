// The component titles beside a card are card titles (R082 notes N1 and N2 of
// the card title acceptance, decisions C34 and C44): sf-list-attention's
// heading and sf-progress-run's title at rung 1 read the card title's size
// and line, which hold in a compact region, and are semibold. They read text 1
// before, so in compact density they dropped to 14/20 beside a 16/24 card
// title, and the list's heading was medium.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const rule = (sheet, selector) => {
  const start = sheet.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} is declared`);
  return sheet.slice(start, sheet.indexOf('}', start));
};

test('sf-card: the title the others follow', () => {
  const card = read('src/component/card/scss/_css__card.scss');
  assert.match(card, /font-size: var\(--sf-card-title-size, var\(--sf-heading-6--size\)\);\s*line-height: var\(--sf-title--height-card\);\s*font-weight: var\(--sf-card-title-weight, var\(--sf-text--font-weight-6\)\);/u);
});

test('sf-list-attention: the heading is a card title, semibold', () => {
  const sheet = read('src/smart/list-attention/scss/_smart__list-attention.scss');
  assert.match(sheet, /--sf-list-attention--title-size: var\(--sf-heading-6--size\);/u);
  assert.match(sheet, /--sf-list-attention--title-line: var\(--sf-title--height-card\);/u);
  const heading = rule(sheet, '.sf-list-attention-heading');
  assert.match(heading, /font-size: var\(--sf-list-attention--title-size\);/u);
  assert.match(heading, /line-height: var\(--sf-list-attention--title-line\);/u);
  assert.match(heading, /font-weight: var\(--sf-weight--semi-bold\);/u);
  assert.doesNotMatch(heading, /font-weight-medium/u);
  // The frameless head and the phone head's two-line inset stand on the title's line.
  assert.match(rule(sheet, '.sf-list-attention--frame-none .sf-list-attention-head'), /min-block-size: var\(--sf-list-attention--title-line\);/u);
  assert.match(sheet, /\.sf-list-attention-head:has\(\.sf-list-attention-summary-line\) \{[^}]*padding-block: calc\(\(var\(--sf-list-attention--row\) - var\(--sf-list-attention--title-line\) - var\(--sf-list-attention--meta-line\)\) \/ 2\);/u);
});

test('sf-progress-run: the title at rung 1 is a card title; at 1/2 the rung\'s text line', () => {
  const sheet = read('src/smart/progress-run/scss/_smart__progress-run.scss');
  const one = rule(sheet, '.sf-progress-run');
  assert.match(one, /--sf-progress-run--title-size: var\(--sf-heading-6--size\);/u);
  assert.match(one, /--sf-progress-run--title-line: var\(--sf-title--height-card\);/u);
  const half = rule(sheet, '.sf-progress-run.sf-progress-run--size-half');
  assert.match(half, /--sf-progress-run--title-size: var\(--sf-text-size-1\\\/2\);/u);
  assert.match(half, /--sf-progress-run--title-line: var\(--sf-text-height-1\\\/2\);/u);
  const heading = rule(sheet, '.sf-progress-run .sf-progress-run-heading');
  assert.match(heading, /font-size: var\(--sf-progress-run--title-size\);/u);
  assert.match(heading, /line-height: var\(--sf-progress-run--title-line\);/u);
  assert.match(heading, /font-weight: var\(--sf-text--font-weight-6, 600\);/u);
  assert.match(rule(sheet, '.sf-progress-run-state'), /min-block-size: var\(--sf-progress-run--title-line\);/u);
});
