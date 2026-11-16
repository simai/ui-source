import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {code, compareNumbers, registerThemeTests, ROOT_PX, section, tableRows} from './support/foundation-tokens.mjs';

// Foundations standard, breakpoints and container steps (owner decision
// C181 (4); rules C01, C18, C22, C181 (1)(2)). The Numbers tables are resolved
// against the built core sheet; the breakpoints also against the Sass array
// the media queries are written from.

const {doc, sheet, skip} = registerThemeTests(test, assert, {page: 'foundation-container-steps.md', files: ['core/css/core.css']});

test('foundation-container-steps.md: the breakpoints are the Sass breakpoint array', () => {
  const sass = readFileSync(new URL('../src/core/scss/vars/_sf_var__breakpoint.scss', import.meta.url), 'utf8');
  const array = Object.fromEntries([...sass.matchAll(/^\s*(sm|md|lg|xl|xxl):\s*([\d.]+)rem\b/gmu)].map((m) => [m[1], Number(m[2]) * ROOT_PX]));
  const page = Object.fromEntries(tableRows(section(doc, 'Numbers'))
    .map((row) => [code(row.token).replace('--sf-breakpoint-', ''), Number(row.normal)]));
  assert.deepEqual(page, array);
});

test('foundation-container-steps.md: every pending container step is a step of the size scale', {skip}, () => {
  assert.deepEqual(compareNumbers(sheet, doc, 'Pending'), []);
  for (const row of tableRows(section(doc, 'Pending'))) assert.match(code(row.token), /^--sf-[a-i]\d$/u, 'a size-scale step');
});
