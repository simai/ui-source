import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {check, checkScopes, roleStepFindingsIn} from '../scripts/check-role-tokens.mjs';
import {contract, validate} from '../scripts/generate-role-tokens.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* Role tokens (owner decision C173, 2026-11-14, refining C156; research
   ui-control/control/research/2026-11-14-role-tokens.md). C173 replaces the
   C105 line «no new variable names»: a few names above the scales, each an
   alias of a step. These tests are the source check of point 9; the
   acceptance probe measures that the names resolve to their steps. */

test('C173 (9): the source check passes -- names, density scopes, role gaps, scrim', () => {
  assert.deepEqual(check(), []);
});

test('C173 (1)(2)(4)(5)(6)(8): thirteen names of the form --sf-<area>--<role>, within the cap of 17', () => {
  const data = contract();
  assert.deepEqual(validate(data), []);
  assert.equal(data.cap, 17);
  assert.deepEqual(data.tokens.map((token) => token.name), [
    '--sf-gap--actions', '--sf-gap--toolbar', '--sf-gap--tags', '--sf-gap--groups', '--sf-gap--icon-text', '--sf-gap--icon-inline',
    '--sf-inset--panel', '--sf-inset--plate',
    '--sf-radius--inner',
    '--sf-line--border', '--sf-line--indicator',
    '--sf-hit--min', '--sf-hit--touch',
  ]);
  const px = Object.fromEntries(data.tokens.map((token) => [token.name, [token.px.desktop, token.px.compact, token.px.phone]]));
  assert.deepEqual(px['--sf-gap--actions'], [8, 4, 8]);
  assert.deepEqual(px['--sf-gap--toolbar'], [4, 4, 4]);
  assert.deepEqual(px['--sf-gap--tags'], [4, 4, 4]);
  assert.deepEqual(px['--sf-gap--groups'], [16, 12, 12]);
  assert.deepEqual(px['--sf-gap--icon-text'], [12, 8, 8]);
  assert.deepEqual(px['--sf-gap--icon-inline'], [4, 4, 4]);
  assert.deepEqual(px['--sf-inset--panel'], [20, 16, 16]);
  assert.deepEqual(px['--sf-inset--plate'], [4, 4, 4]);
  assert.deepEqual(px['--sf-line--border'], [1, 1, 1]);
  assert.deepEqual(px['--sf-line--indicator'], [2, 2, 2]);
  assert.deepEqual(px['--sf-hit--min'], [24, 24, 24]);
  assert.deepEqual(px['--sf-hit--touch'], [44, 44, 44]);
  // (5) one nested-corner rule: the host corner less the inset, never below 4.
  assert.equal(data.tokens.find((token) => token.name === '--sf-radius--inner').value, 'max(var(--sf-a4), calc(var(--sf-radius--surface) - var(--sf-inset--plate)))');
  // (7) the five layers come later, as their own group: not declared now.
  assert.deepEqual(data.deferred[0].names, ['--sf-layer--sticky', '--sf-layer--popup', '--sf-layer--overlay', '--sf-layer--toast', '--sf-layer--tooltip']);
  // (8) no role names for heights, icons, shadows, motion, focus.
  for (const token of data.tokens) assert.doesNotMatch(token.name, /height|icon-size|shadow|duration|ease|focus/u);
});

test('C173 RT-15: every step-dependent role is declared again in both density regions', async () => {
  assert.deepEqual(checkScopes(), []);
  const density = await read('src/core/scss/_sf_css__density.scss');
  for (const region of ['compact', 'normal']) {
    const block = density.slice(density.indexOf(`[data-sf-density="${region}"] {`));
    assert.ok(block.includes('--sf-gap--actions: var(--sf-space-1\\/3);'), `${region}: --sf-gap--actions`);
    assert.ok(block.includes('--sf-inset--panel: var(--sf-space-2);'), `${region}: --sf-inset--panel`);
  }
  // The generators agree with what is written.
  execFileSync(process.execPath, ['scripts/generate-role-tokens.mjs', '--check'], {cwd: root});
  execFileSync(process.execPath, ['scripts/generate-density.mjs', '--check'], {cwd: root});
});

test('C173 (3): .sf-actions is a wrapping row at --sf-gap--actions, in the base layer under the utilities', async () => {
  const sheet = await read('src/core/scss/_sf_css__actions.scss');
  assert.match(sheet, /@layer sf\.base \{\s*\.sf-actions \{\s*display: flex;\s*flex-wrap: wrap;\s*align-items: center;\s*gap: var\(--sf-gap--actions\);\s*\}/u);
  assert.match(sheet, /\.sf-actions--end \{\s*justify-content: flex-end;\s*\}/u);
  const index = await read('src/core/scss/index.scss');
  assert.ok(index.indexOf('figma_role_tokens') > index.indexOf("@use 'sf_css__typograpy';"), 'the roles follow the ladder');
  assert.ok(index.indexOf('figma_role_tokens') < index.indexOf("@use 'sf_css__density';"), 'the density regions follow the roles');
  assert.ok(index.includes("@use 'sf_css__actions';"));
});

test('C173 (9): the check reads a row of buttons, a toolbar and a row of tags, and lets a column and a role token pass', () => {
  const sheet = `
    .x-footer { display: flex; gap: var(--sf-space-1\\/3); }
    .x-toolbar { gap: var(--sf-a4); }
    .x-tags { --sf-x-tags-gap: 4px; }
    .x-form-actions { display: flex; flex-direction: column; gap: var(--sf-space-1); }
    .x-actions { gap: var(--sf-gap--actions); }
    .x-buttons { gap: var(--sf-x-buttons-gap); }
    .x-modal-footer { gap: var(--sf-x-footer-gap, var(--sf-gap--actions)); }
    // .x-actions { gap: 12px; }
  `;
  const found = roleStepFindingsIn(sheet, 'x.scss').map((finding) => [finding.selector, finding.role, finding.expected]);
  assert.deepEqual(found, [
    ['.x-footer', 'actions', '--sf-gap--actions'],
    ['.x-toolbar', 'toolbar', '--sf-gap--toolbar'],
    ['.x-tags', 'tags', '--sf-gap--tags'],
  ]);
});

test('C173: the Framework rows of buttons, toolbars and tags read their role tokens', async () => {
  const rows = [
    ['src/component/modal/scss/_css__modal_custom.scss', 'gap: var(--sf-modal-footer-gap, var(--sf-gap--actions));'],
    ['src/component/alerts/scss/_css__alerts.scss', '--sf-alert-buttons--gap: var(--sf-gap--actions);'],
    ['src/component/contentDivider/scss/_css__contentDivider.scss', '--sf-divider-buttons--gap: var(--sf-gap--actions);'],
    ['src/component/placeholder/scss/_css__placeholder.scss', '--sf-placeholder-actions--gap: var(--sf-gap--actions);'],
    ['src/smart/header-page/scss/_smart__page_header.scss', 'gap: var(--sf-page-header-actions-gap, var(--sf-gap--actions));'],
    ['src/smart/empty-state/scss/_smart__empty_state.scss', 'gap: var(--sf-empty-state-actions-gap, var(--sf-gap--actions));'],
    ['src/smart/confirm/js/templates/default.css', 'gap: var(--sf-gap--actions);'],
    ['src/smart/wizard/scss/_smart__wizard.scss', 'gap: var(--sf-gap--actions);'],
    ['src/smart/input-rich/scss/_smart__rich_text.scss', 'gap: var(--sf-gap--toolbar);'],
    ['src/component/dropdown/scss/_css__dropdown.scss', '--sf-dropdown-tag-container--gap: var(--sf-gap--tags);'],
    ['src/smart/input-lookup/scss/_smart__lookup.scss', 'var(--sf-gap--tags)'],
  ];
  for (const [file, text] of rows) assert.ok((await read(file)).includes(text), `${file}: ${text}`);
});
