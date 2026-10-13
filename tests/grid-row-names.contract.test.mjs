import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Columns and rows are the same idea turned ninety degrees, and a developer
// reaches for the same words: col-span-2 beside row-span-2. Rows only answered to
// grid-row-span-2, so the documentation promised classes that did not exist. The
// short names are now the public ones and the long ones still answer.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const BREAKPOINTS = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];
const FAMILIES = [
  { family: 'grid-row', file: '_sf_css__grid_row.scss', short: 'row-', long: 'grid-row-' },
  { family: 'grid-row-start', file: '_sf_css__grid_row_start.scss', short: 'row-start-', long: 'grid-row-start-' },
  { family: 'grid-row-end', file: '_sf_css__grid_row_end.scss', short: 'row-end-', long: 'grid-row-end-' },
];

test('every breakpoint of a row family emits the short name and keeps the long one', () => {
  for (const { family, file, short, long } of FAMILIES) {
    for (const breakpoint of BREAKPOINTS) {
      const css = read(`src/utility/${family}/${breakpoint}/scss/${file}`);
      assert.match(css, new RegExp(String.raw`\.#\{\$infix\}${short}#\{`, 'u'), `${family}/${breakpoint}: short name`);
      assert.match(css, new RegExp(String.raw`\.#\{\$infix\}${long}#\{`, 'u'), `${family}/${breakpoint}: long name kept`);
    }
  }
});

test('the row names mirror the column ones', () => {
  // The pairs that make the two axes read alike. A column family that grew a new
  // value without its row twin is the drift this catches.
  const pairs = [
    ['grid-column/default/scss/_sf_var__grid_column.scss', 'grid-row/default/scss/_sf_var__grid_row.scss'],
    ['grid-column-start/default/scss/_sf_var__grid_column_start.scss', 'grid-row-start/default/scss/_sf_var__grid_row_start.scss'],
    ['grid-column-end/default/scss/_sf_var__grid_column_end.scss', 'grid-row-end/default/scss/_sf_var__grid_row_end.scss'],
  ];
  const keys = (path) => [...read(`src/utility/${path}`).matchAll(/^\s*([a-z0-9-]+):/gmu)].map(([, key]) => key);
  for (const [columnPath, rowPath] of pairs) {
    const columnKeys = new Set(keys(columnPath));
    const rowKeys = new Set(keys(rowPath));
    // Rows need not span twelve columns, but every non-numeric value a column
    // understands — auto, full — a row must understand too.
    const words = [...columnKeys].filter((key) => !/^(?:span-)?\d+$/u.test(key));
    for (const word of words) {
      assert.ok(rowKeys.has(word), `${rowPath}: no row twin for the column value ${word}`);
    }
  }
});
