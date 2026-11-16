// Owner decision C185 (plain group 2, 2026-11-14): the table classes, the
// meter scale's steps and the one status dot. ui-control
// control/docs-review/decisions.md C185, control/research/2026-11-14-plain-group-2.md.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('C185 (1), (2): the row follows the density; table-sm and table-small are dated former words', async () => {
  const [table, loader, journal] = await Promise.all([
    read('src/utility/table/default/scss/_sf_var__table.scss'),
    read('src/core/js/loader.js'),
    read('contracts/changes/journal.json'),
  ]);
  // Row and head are the size-1 control height, which the density sets.
  assert.match(table, /\$table-row-block-size: var\(--sf-ui-1--control-height\);/u);
  // One table of retired class names (group build 6: C185's loader list
  // joined the C187 table, src/core/js/retired-classes.table.js), which the
  // Loader reads for every class token of the page.
  const {default: retired} = await import(new URL('src/core/js/retired-classes.table.js', root));
  const {retiredClassName} = await import(new URL('src/core/js/utility-class-aliases.js', root));
  const row = retired.records.find((item) => item.journal === 'class-table-sm-to-density');
  assert.ok(row, 'the retired-classes table holds the C185 record');
  assert.deepEqual([row.component, row.since, row.remove_after], ['table', '2026-11-14', '2027-01-01']);
  for (const name of ['table-sm', 'table-small']) {
    assert.equal(row.names[name], 'data-sf-density="compact"', name);
    const found = retiredClassName(name);
    assert.deepEqual([found.found.component, found.to], ['table', 'data-sf-density="compact"'], name);
  }
  assert.doesNotMatch(loader, /FORMER_CLASSES|noteFormerClass/u);
  assert.match(loader, /noteUtilityClassAlias\(token\);/u);
  const record = JSON.parse(journal).records.find((row) => row.id === 'class-table-sm-to-density');
  assert.ok(record, 'journal record');
  assert.equal(record.kind, 'class');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map((item) => item.from), ['table-sm', 'table-small']);
});

test('C185 (3): zebra 4, hover and selected 8 over it (12 on a stripe), a primary line at the selected row start', async () => {
  const [vars, table, stripe, active] = await Promise.all([
    read('src/utility/table/default/scss/_sf_var__table.scss'),
    read('src/utility/table/default/scss/_sf_css__table.scss'),
    read('src/utility/table-stripe/default/scss/_sf_css__table_stripe.scss'),
    read('src/utility/table-active/default/scss/_sf_css__table_active.scss'),
  ]);
  assert.match(vars, /\$table-stripe-bg: var\(--sf-surface-state-hover\);/u);
  assert.match(vars, /\$table-hover-bg: var\(--sf-surface-state-select\);/u);
  assert.match(vars, /\$table-active-bg: var\(--sf-surface-state-select\);/u);
  assert.match(vars, /\$table-state-stripe-bg: var\(--sf-surface-state-active\);/u);
  assert.match(vars, /\$table-selected-line-color: var\(--sf-primary\);/u);
  assert.match(table, /> tbody > tr\[aria-selected='true'\] > \* \{/u);
  for (const [name, css] of [['table', table], ['table-active', active]]) {
    assert.match(css, /box-shadow: inset \$table-selected-line-width 0 0 \$table-selected-line-color;/u, name);
    assert.match(css, /&:dir\(rtl\) \{\s*box-shadow: inset calc\(-1 \* #\{\$table-selected-line-width\}\) 0 0 \$table-selected-line-color;/u, name);
  }
  assert.match(stripe, /tr\[aria-selected='true'\]:nth-of-type\(odd\)>\*/u);
  assert.match(active, /\.table-stripe > tbody > tr\.table-active:nth-of-type\(odd\) > :nth-child\(n\)/u);
});

test('C185 (4): the first column of .table-frame stands still with its line at the end', async () => {
  const frame = await read('src/utility/table-frame/default/scss/_sf_css__table_frame.scss');
  assert.match(frame, /> :not\(caption\) > tr > :first-child \{\s*position: sticky;\s*inset-inline-start: 0;/u);
  assert.match(frame, /border-inline-end: var\(--sf-px\) solid var\(--sf-table-frame-border-color\);/u);
});

test('C185 (5): the scale draws 2 to 10 steps, floor, the level words at the row end', async () => {
  const [ordinary, template, element, css, manifest, ru, en] = await Promise.all([
    read('src/component/progress-scale/js/_progress_scale.js'),
    read('src/smart/progress-scale/js/templates/default.js'),
    read('src/smart/progress-scale/index.js'),
    read('src/component/progress-scale/scss/_css__progress_scale.scss'),
    read('src/smart/progress-scale/component.json'),
    read('src/smart/progress-scale/lang/ru.json'),
    read('src/smart/progress-scale/lang/en.json'),
  ]);
  assert.match(ordinary, /return Math\.max\(2, Math\.min\(10, parsed\)\);/u);
  assert.match(ordinary, /Math\.floor\(\(normalizeProgressScaleValue\(value\) \/ 100\) \* steps \+ 1e-9\)/u);
  assert.match(ordinary, /root\.setAttribute\('aria-valuemax', level \? String\(steps\) : '100'\);/u);
  assert.match(template, /Math\.max\(2, Math\.min\(10, parsed\)\)/u);
  assert.match(template, /Array\.from\(\{ length: steps \}/u);
  assert.match(template, /levelSteps \? 'sf-progress-scale--level' : ''/u);
  assert.match(element, /this\.sfWord\('of-steps', \{vars: \{value: lit, total: steps\}\}\)/u);
  assert.match(css, /\.sf-progress-scale\.sf-progress-scale--level \{\s*--sf-progress-scale--gap: var\(--sf-progress-scale-gap, var\(--sf-space-1\\\/2\)\);/u);
  assert.match(css, /grid-auto-flow: column;\s*grid-auto-columns: minmax\(0, 1fr\);/u);
  const steps = JSON.parse(manifest).settings.steps;
  assert.deepEqual([steps.type, steps.min, steps.max, steps.optional], ['number', 2, 10, true]);
  assert.equal(JSON.parse(ru).runtime['of-steps'], '{value} из {total}');
  assert.equal(JSON.parse(en).runtime['of-steps'], '{value} of {total}');
});

test('C185 (7), (8): one dot, no box padding, the mark gap, three forms', async () => {
  const css = await read('src/component/dot/scss/_css_dot.scss');
  assert.doesNotMatch(css, /padding-(top|bottom|inline)|--sf-dot--padding|line-height: 0/u);
  assert.match(css, /--sf-dot-item--ring: var\(--sf-a2\);[^}]*gap: var\(--sf-dot--gap, var\(--sf-space-1\\\/2\)\);[^}]*padding: 0;/u);
  assert.match(css, /\.sf-dot\.sf-dot--ring \.sf-dot-item \{\s*box-shadow:\s*0 0 0 var\(--sf-dot-item--ring\) var\(--sf-surface-place, var\(--sf-surface-page\)\),\s*0 0 0 calc\(2 \* var\(--sf-dot-item--ring\)\) var\(--sf-dot-item--background-color\);/u);
  assert.match(css, /\.sf-dot\.sf-dot--hollow \.sf-dot-item \{\s*background-color: transparent;\s*box-shadow: inset 0 0 0 var\(--sf-dot-item--ring\) var\(--sf-dot-item--background-color\);/u);
  // The hollow default grey is declared before the statuses, so a status wins.
  assert.ok(css.indexOf('.sf-dot.sf-dot--hollow {') < css.indexOf('.sf-dot.sf-dot--primary {'));
  assert.match(css, /\.sf-dot:is\(\.sf-dot--size-1\\\/4, \.sf-dot--size-1\\\/3\) \{\s*--sf-dot-item--ring: var\(--sf-a1\);/u);
});
