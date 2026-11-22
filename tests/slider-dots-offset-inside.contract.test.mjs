import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// component.slider 2.2.0 (group build 16 returns): --sf-slider-dots-offset-block
// is the inside position's distance from the picture's bottom edge (C398);
// under the picture the block's gap is that distance and the variable is not read.
test('the dots offset is the inside position\'s distance, default --sf-space-2', () => {
  const sheet = read('src/component/slider/scss/_css__slider.scss');
  assert.match(sheet, /margin-block: 0 var\(--sf-slider-dots-offset-block, var\(--sf-space-2\)\);/u);
  assert.equal((sheet.match(/margin-block-end: calc\(var\(--sf-slider-dots-offset-block, var\(--sf-space-2\)\) \+/gu) || []).length, 2);
  assert.doesNotMatch(sheet, /margin-block-start: calc\(var\(--sf-slider-dots-offset-block/u);
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const entry = contract.components.flatMap((one) => one.variables ?? []).find((one) => one.name === '--sf-slider-dots-offset-block');
  assert.equal(entry.role, 'margin-block-end');
  assert.equal(entry.default, 'var(--sf-space-2)');
});
