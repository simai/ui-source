// Owner decision C259 (2026-11-16, variant Б; ui-control
// prototypes/table-actions-phone-study.html#q-table-actions-phone): on a phone
// a table with row actions leaves .table-frame and keeps its key cells -- the
// check box, «≡», the name with its second line, the status, the sum; every
// action stays in the one row menu. A plain table stays in its frame (C146
// (9)). The browser half is tests/browser/table-frame.browser.mjs (390).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const vars = read('src/utility/table/default/scss/_sf_var__table.scss');
const table = read('src/utility/table/default/scss/_sf_css__table.scss');
const frame = read('src/utility/table-frame/default/scss/_sf_css__table_frame.scss');
const docs = read('docs/components/table.md');

test('C259: the phone is below the md breakpoint, the condition one function for the table and its frame', () => {
  assert.match(vars, /@use '\.\.\/\.\.\/\.\.\/\.\.\/core\/scss\/vars\/sf_var__breakpoint' as bp;/u);
  assert.match(vars, /\$table-phone-min: map\.get\(bp\.\$breakpoint-array, md\);/u);
  // A table with row actions: its body rows hold «≡» alone in a cell; and it
  // names its key cells. Without key cells nothing changes.
  assert.match(vars, /@function table-keyed-actions\(\$table: ''\) \{\s*@return ":has\(#\{\$table\}> tbody > tr > \* > sf-button-icon\[icon='menu'\]:only-child, #\{\$table\}> tbody > tr > \* > sf-icon-button\[icon='menu'\]:only-child\):has\(#\{\$table\}> :not\(caption\) > tr > \.table-key\)";/u);
  // No :is() in the conditions: the build lays an :is() as one rule per part,
  // and inside :not() that is a different selector (it hid the check box and
  // kept the frame on the first build of this branch).
  const conditions = vars.slice(vars.indexOf('$table-control-cell'));
  assert.doesNotMatch(conditions, /:is\(/u);
  assert.match(vars, /\$table-keyed-actions: table-keyed-actions\(\);/u);
  assert.match(vars, /\$table-frame-keyed-actions: table-keyed-actions\('> \.table '\);/u);
});

test('C259: on a phone the table keeps the control cells, the key cells and the screen reader head', () => {
  assert.match(table, /@media not all and \(min-width: \$table-phone-min\) \{\s*\.table:where\(#\{\$table-keyed-actions\}\) \{/u);
  assert.match(table, /> :not\(caption\) > tr > :not\(\.table-key, #\{\$table-control-cell\}, :has\(> \.sr-only:only-child\)\) \{\s*display: none;/u);
  // A key cell keeps its words whole and one line (a plain-text status broke
  // letter by letter beside the name's 100 %); the name is what gives way.
  assert.match(table, /\.table:where\(#\{\$table-keyed-actions\}\) \{\s*(?:\/\/[^\n]*\n\s*)*word-break: normal;\s*overflow-wrap: normal;/u);
  assert.match(table, /> :not\(caption\) > tr > \.table-key \{\s*white-space: nowrap;/u);
  // The name takes the width the others leave, one line and an ellipsis, and
  // with its second line stands on the two-line rung (44 on a phone).
  assert.match(table, /> :not\(caption\) > tr > \.table-key:has\(> a\[href\]:not\(\.sf-button\), > \.table-key-line\) \{\s*inline-size: 100%;\s*max-inline-size: 0;/u);
  assert.match(table, /> :not\(caption\) > tr > \.table-key:has\(> \.table-key-line\) \{\s*block-size: var\(--sf-ui-2--control-height\);/u);
  // The second line: hidden at every other width, quiet and cut on a phone.
  assert.match(table, /\.table-key-line \{\s*display: none;/u);
  assert.match(table, /\.table-key-line \{\s*display: block;\s*overflow: hidden;\s*color: var\(--sf-on-surface-variant\);\s*font-size: var\(--sf-text-size-1\\\/2\);\s*line-height: var\(--sf-text-height-1\\\/2\);\s*text-overflow: ellipsis;\s*white-space: nowrap;/u);
});

test('C259: the frame draws nothing around such a table on a phone; a plain frame is unchanged', () => {
  // Weightless conditions: a rule that reaches the frame weighs what it did.
  assert.match(frame, /\.table-frame:not\(:where\(#\{\$table-frame-keyed-actions\}\)\) \{\s*@include frame;\s*\}/u);
  assert.match(frame, /@media \(min-width: \$table-phone-min\) \{\s*\.table-frame:where\(#\{\$table-frame-keyed-actions\}\) \{\s*@include frame;/u);
  assert.equal((frame.match(/@include frame;/gu) || []).length, 2);
});

test('C259: the docs name the key cells and the recipe binds the one menu by for', () => {
  assert.match(docs, /\| `\.table-key` \(inside `\.table`\) \|/u);
  assert.match(docs, /\| `\.table-key-line` \(inside a `\.table-key` cell\) \|/u);
  assert.match(docs, /<sf-menu-context id="orders-menu" popup for="orders"/u);
  assert.match(docs, /menu\.addEventListener\('sf-menu-context-open'/u);
  assert.match(docs, /<td class="table-key"><a href="\/orders\/1001">№ 1001<\/a><span class="table-key-line">/u);
  assert.doesNotMatch(docs, /Keep a table with row actions as `\.table`, not in `\.table-frame`/u);
});
