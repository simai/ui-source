import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import test from 'node:test';
import {GENERATED, run} from '../scripts/generate-component-files.mjs';

// Standard simai.smart-component 1.4, phase 1: scripts/generate-component-files.mjs
// makes seven files of a Smart component from the five a person writes. Until
// phase A rewrites the folders, the files the generator already gives back
// (semantically: JSON with sorted keys, rule.js as the evaluated rule) are
// checked here, so a hand edit to one of them cannot drift from its source.
// The rest are pending, each with the number of differences it has today
// (docs/developer/component-files-1.4-report.md classifies them): a count never
// rises -- a new difference is a new stale fact -- and one that falls is lowered
// here in the same commit, down to removing the pin.

const root = resolve(import.meta.dirname, '..');

const CHECKED = ['rule.js', 'aliases.json', 'studio.fixture.json', 'studio.scenario.json', 'probe.json'];

// smart.manifest.json: committed registry files, stale against component.json
// and lang/ in places, plus the data only they hold (x-registry). Phase A
// regenerates them family by family.
const PENDING_MANIFEST = {
  accordion: 14, alert: 12, avatar: 8, avatars: 9, badge: 10, breadcrumbs: 8, button: 9, 'button-group': 11,
  checkbox: 5, close: 4, 'code-input': 12, color: 10, 'composition-overlay': 63, 'context-menu': 27,
  'copy-button': 14, 'country-code': 9, datepicker: 27, 'download-file': 8, drawer: 20, dropdown: 14,
  'empty-state': 10, 'file-preview': 13, 'file-upload': 52, gallery: 19, 'help-mark': 10, icon: 14,
  'icon-button': 4, 'image-field': 22, 'inline-editor': 19, input: 12, 'list-item': 16, menu: 14, modal: 37,
  'page-header': 14, pagination: 50, popover: 21, 'profile-picker': 22, 'progress-bar': 9, 'progress-scale': 9,
  quantity: 27, radio: 6, 'range-slider': 20, 'reference-link': 6, resizer: 14, skeleton: 4, slider: 7,
  sortable: 22, spinner: 14, steps: 15, switch: 6, tabs: 20, tag: 15, textarea: 13, 'theme-generator': 28,
  toast: 17, toggle: 6, tooltip: 3, tree: 23, 'tree-item': 36,
};

// meta.mjs: twenty hand-written files that describe some attributes (they were
// overrides of generate-smart-studio-artifacts.mjs); the generated one
// describes all of them.
const PENDING_META = {
  alert: 15, badge: 14, button: 8, 'button-group': 3, dropdown: 19, 'file-preview': 23, 'icon-button': 6,
  input: 35, 'list-item': 19, pagination: 34, 'progress-bar': 10, 'progress-scale': 11, skeleton: 11,
  spinner: 11, tag: 9, textarea: 30, toast: 13, toggle: 11, tooltip: 2, 'tree-item': 24,
};

const results = await run({packages: [root], components: []});

test('every Smart component folder reads as a 1.4 view', () => {
  assert.ok(results.length >= 59, `only ${results.length} components`);
  const failed = results.filter((result) => result.error).map((result) => `${result.component}: ${result.error}`);
  assert.deepEqual(failed, []);
});

// In phase 1 these five files are also the bridge's inputs (relations come
// from rule.js, rows from aliases.json, the studio example from the fixture),
// so their equality proves the generator loses nothing on the way to 1.4 --
// phase A can switch their source -- while what protects them from drift
// today is that they name their own component (below) and the manifest pins.
test('fixture, scenario and probe name their own component', () => {
  const wrong = results.flatMap((result) => (result.log?.identity ?? []).map((line) => `${result.component}: ${line}`));
  assert.deepEqual(wrong, []);
});

test(`${CHECKED.join(', ')}: generated equals committed`, () => {
  const drifted = [];
  let compared = 0;
  for (const result of results) {
    for (const file of CHECKED) {
      const entry = result.files[file];
      if (!entry) continue;
      compared += 1;
      if (entry.status === 'identical' || entry.status === 'semantic') continue;
      const first = entry.differences?.slice(0, 3).map((d) => `${d.path}: committed ${d.committed}, generated ${d.generated}`).join('; ') ?? '';
      drifted.push(`${result.component}/${file}: ${entry.status} ${first}`);
    }
  }
  assert.ok(compared > 250, `only ${compared} files compared`);
  assert.deepEqual(drifted, [], 'a generated file differs from its committed copy: change component.json/examples.json/aliases.json, not the generated file (node scripts/generate-component-files.mjs --check)');
});

for (const [file, pending] of [['smart.manifest.json', PENDING_MANIFEST], ['meta.mjs', PENDING_META]]) {
  test(`${file}: known pending, no new differences`, () => {
    const problems = [];
    for (const result of results) {
      const entry = result.files[file];
      if (!entry) continue;
      const count = entry.differences?.length ?? 0;
      const pinned = pending[result.component];
      if (pinned === undefined) {
        if (count) problems.push(`${result.component}/${file}: ${count} differences, and it is not pending`);
      } else if (count > pinned) {
        const paths = entry.differences.map((d) => d.path).join(', ');
        problems.push(`${result.component}/${file}: ${count} differences, pinned ${pinned} (${paths})`);
      } else if (count < pinned) {
        problems.push(`${result.component}/${file}: ${count} differences, fewer than the pinned ${pinned}: lower the pin${count ? '' : ' (remove it: the file is generated now)'}`);
      }
    }
    for (const name of Object.keys(pending)) {
      if (!results.some((result) => result.component === name && result.files[file])) problems.push(`${name}/${file}: pinned, but there is no such file`);
    }
    assert.deepEqual(problems, []);
  });
}

test('the generator makes the seven files of standard 1.4', () => {
  assert.deepEqual([...GENERATED].sort(), ['aliases.json', 'meta.mjs', 'probe.json', 'rule.js', 'smart.manifest.json', 'studio.fixture.json', 'studio.scenario.json']);
});
