import assert from 'node:assert/strict';
import test from 'node:test';
import {registerThemeTests, section} from './support/foundation-tokens.mjs';

// Foundations standard, sizes and the size ladder (owner decision C181 (4);
// rules C01, C11, C18, C22, C27, C36, C44, C79, C89, C103, C132). The page's
// Numbers table is resolved against the built core sheet, so a ladder step
// cannot change without the page, nor the page without the step.

registerThemeTests(test, assert, {page: 'foundation-size-ladder.md', files: ['core/css/core.css']});

test('foundation-size-ladder.md: the Numbers table covers every step of the control ladder', async () => {
  const {readDoc} = await import('./support/foundation-tokens.mjs');
  const numbers = section(readDoc('foundation-size-ladder.md'), 'Numbers');
  for (const step of ['1/3', '1/2', '1', '2', '3']) {
    for (const token of [`--sf-text-size-${step}`, `--sf-text-height-${step}`, `--sf-ui-${step}--control-height`]) {
      assert.ok(numbers.includes(`\`${token}\``), `${token} has a row`);
    }
  }
});

test('foundation-size-ladder.md: the small steps are 4, 6, 8, 12 and 16 only (C132)', async () => {
  const {readDoc, tableRows, code} = await import('./support/foundation-tokens.mjs');
  const rows = tableRows(section(readDoc('foundation-size-ladder.md'), 'Numbers'))
    .filter((row) => /^--sf-micro--(?!ring)/u.test(code(row.token) || ''));
  assert.ok(rows.length >= 10, 'the small-step rows are listed');
  for (const row of rows) {
    for (const scenario of ['normal', 'compact', 'phone']) {
      assert.ok([4, 6, 8, 12, 16].includes(Number(row[scenario])), `${code(row.token)} ${scenario} ${row[scenario]} is a small step`);
    }
  }
});
