// Order of the SIMAI View round (2026-11-17): the table head's text colour had
// no public variable, so a set's table could change it only with a rule of its
// own. utility.table 1.8.0 publishes --sf-table-head-color, its default the
// role the head already took (C146 (2), the quiet supporting role), and the
// head reads it. .table keeps ten public variables (§6: 5-10).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const vars = read('src/utility/table/default/scss/_sf_var__table.scss');
const table = read('src/utility/table/default/scss/_sf_css__table.scss');

const tableBlock = () => {
  const start = table.indexOf('    .table {');
  assert.ok(start > 0, 'the .table rule');
  return table.slice(start, table.indexOf('inline-size: 100%;', start));
};

test('--sf-table-head-color defaults to the quiet head role', () => {
  assert.match(vars, /\$table-head-color: var\(--sf-on-surface-variant\);/u);
  assert.match(tableBlock(), /#\{\$prefix\}head-color: #\{\$table-head-color\};/u);
});

test('the head cells read the variable, not the role', () => {
  const head = table.match(/> thead > tr > th \{([\s\S]*?)font-weight/u);
  assert.ok(head, 'the head rule');
  assert.match(head[1], /color: var\(#\{\$prefix\}head-color\);/u);
  assert.doesNotMatch(head[1], /--sf-on-surface-variant/u);
});

test('.table declares ten public variables (5-10)', () => {
  const declared = [...tableBlock().matchAll(/^\s*#\{\$prefix\}([a-z-]+):/gmu)].map((match) => match[1]);
  assert.deepEqual(declared, ['color', 'head-color', 'border-color', 'accent-bg', 'stripe-color', 'stripe-bg', 'active-color', 'active-bg', 'hover-color', 'hover-bg']);
  assert.ok(declared.length >= 5 && declared.length <= 10);
});

test('the passport names the minor version that adds it', () => {
  assert.equal(JSON.parse(read('src/utility/table/passport.json')).version, '1.8.0');
});
