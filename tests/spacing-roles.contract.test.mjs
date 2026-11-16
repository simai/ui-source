import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  declarationsOf, expectedSteps, lintSpacingRoles, repo, review, REVIEW_PATH, roleOf, roleTable, stepOf, tableSteps,
} from '../scripts/lint-spacing-roles.mjs';

// The spacing roles on the component sources (owner decisions C105, C144;
// C178: every general rule has an automatic check in the pair build). The
// role table is read from the geometry standard, the one tests/horizontal-
// spacing.contract.test.mjs holds and the spacing gate measures on a page.

test('C178 spacing roles: the table comes from the geometry standard', () => {
  const table = roleTable();
  assert.deepEqual(expectedSteps(table), {H2: '--sf-space-1/2', H3: '--sf-space-1/4', H6: '--sf-space-1'});
  const onTable = tableSteps(table);
  for (const step of ['--sf-space-1/4', '--sf-space-1/3', '--sf-space-1/2', '--sf-space-1', '--sf-space-2', '0', 'auto', '--sf-px', '--sf-ui-1/2--text-space-x', '--sf-ui-2--space-x']) assert.ok(onTable(step), step);
  for (const step of ['--sf-a4', '--sf-b0', '--sf-space-3/4', '--sf-space-1/6', '6px']) assert.ok(!onTable(step), step);
  // The table as C173 writes it (a role token beside each step) reads the same.
  const doc = readFileSync(join(repo, 'docs/foundation-composition-geometry.md'), 'utf8')
    .replace('| `--sf-space-1/2` | 12', '| `--sf-space-1/2` = `--sf-gap--icon-text` | 12');
  assert.equal(expectedSteps(roleTable(doc)).H2, '--sf-space-1/2');
});

test('C178 spacing roles: a sheet is read through nesting, fallbacks and the file\'s own variables', () => {
  const sheet = [
    '.sf-x { &-row { gap: var(--sf-x--gap, var(--sf-space-1\\/3)); } }',
    '.sf-x { --sf-x-icon--gap: var(--sf-space-1\\/2); }',
    '.sf-x .sf-x-icon { margin-inline-end: var(--sf-x-icon--gap); }',
    '.sf-x-stack { display: flex; flex-direction: column; gap: var(--sf-a4); }',
    '@media (min-width: 40rem) { .sf-x .sf-x-lead { column-gap: var(--sf-gap--icon-text); } }',
  ].join('\n');
  const declarations = declarationsOf(sheet);
  assert.deepEqual(declarations.map(({property, selector}) => `${selector} ${property}`), [
    '.sf-x-row gap', '.sf-x --sf-x-icon--gap', '.sf-x .sf-x-icon margin-inline-end',
    '.sf-x-stack display', '.sf-x-stack flex-direction', '.sf-x-stack gap', '.sf-x .sf-x-lead column-gap',
  ]);
  assert.deepEqual(declarations.at(-1).at, ['@media (min-width: 40rem)']);
  const local = new Map([['--sf-x-icon--gap', 'var(--sf-space-1\\/2)']]);
  assert.equal(stepOf('var(--sf-x--gap, var(--sf-space-1\\/3))', local), '--sf-space-1/3');
  assert.equal(stepOf('var(--sf-x-icon--gap)', local), 'declared', 'a variable the file declares is read where it is declared');
  assert.equal(stepOf('var(--sf-gap--icon-text)', new Map(), {'--sf-gap--icon-text': '--sf-space-1/2'}), '--sf-space-1/2', 'a C173 role token is its step');
  assert.equal(stepOf('var(--sf-a0)', new Map(), {'--sf-a0': '0'}), '0');
});

test('C178 spacing roles: the role a rule names', () => {
  const role = (selector, property, folder) => roleOf({selector, property}, folder);
  assert.equal(role('.sf-list-item .sf-list-item-icon', 'margin-inline-end', 'list-item'), 'H2');
  assert.equal(role('.sf-alert-bar', '--sf-alert-bar--icon-gap', 'alert-bar'), 'H2');
  assert.equal(role('.sf-checkbox--size-1', '--sf-checkbox--gap', 'checkbox'), 'H2', 'a choice: the box to its label');
  assert.equal(role('.sf-checkbox .sf-checkbox-top', 'gap', 'checkbox'), null);
  assert.equal(role('.sf-breadcrumbs-item .sf-breadcrumbs-item-container', 'gap', 'breadcrumbs'), 'H3');
  assert.equal(role('.sf-header-groups', 'column-gap', 'header-page'), 'H6');
  assert.equal(role('.sf-avatar-group', 'gap', 'avatars'), null, 'neighbours are H5');
  assert.equal(role('.sf-button .sf-button-icon', 'gap', 'buttons'), null, 'a control is H1, measured on the page');
  assert.equal(role('.sf-list-item .sf-list-item-icon', 'row-gap', 'list-item'), null, 'vertical');
});

test('C178 spacing roles: a picture off its role and a primitive off the table are found', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sf-spacing-roles-'));
  try {
    mkdirSync(join(folder, 'docs'));
    cpSync(join(repo, 'docs/foundation-composition-geometry.md'), join(folder, 'docs/foundation-composition-geometry.md'));
    mkdirSync(join(folder, 'src/core'), {recursive: true});
    mkdirSync(join(folder, 'src/component/list-item/scss'), {recursive: true});
    writeFileSync(join(folder, 'src/component/list-item/scss/_x.scss'), [
      '.sf-list-item .sf-list-item-icon { margin-inline-end: var(--sf-space-1\\/3); }',
      '.sf-list-item .sf-list-item-wrap { gap: var(--sf-a6); }',
      '.sf-list-item .sf-list-item-avatar-label { column-gap: var(--sf-space-1\\/2); }',
    ].join('\n'));
    const found = lintSpacingRoles({base: folder}).filter((one) => !one.ok);
    assert.deepEqual(found.map(({role, step, line}) => `${line} ${role} ${step}`), ['1 H2 --sf-space-1/3', '2 table --sf-a6']);
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});

test('C178 spacing roles: the Framework sources hold the role table; every finding left is listed with its owner', () => {
  const findings = lintSpacingRoles();
  assert.ok(findings.filter((one) => one.role === 'table').length > 400, 'the horizontal distances are read');
  assert.ok(findings.filter((one) => one.role === 'H2').length >= 15, 'the rows that name their picture are read');
  const list = JSON.parse(readFileSync(join(repo, REVIEW_PATH), 'utf8'));
  for (const entry of list.reviewed) assert.ok(entry.owner && entry.reason && entry.status, `${entry.file}: a listed finding names its owner and why`);
  const {open, stale} = review(findings, list.reviewed);
  assert.deepEqual(open.map((one) => `${one.file}:${one.line} ${one.role} ${one.property}: ${one.value} -> ${one.step} (expected ${one.expect})`), [],
    'a horizontal distance off the role table: use the role\'s step (docs/foundation-composition-geometry.md §5)');
  assert.deepEqual(stale.map((one) => `${one.file} ${one.role} ${one.property} ${one.step}: listed ${one.count ?? 1}, found ${one.found}`), [],
    'a fixed finding leaves contracts/spacing-roles-review.json');
});
