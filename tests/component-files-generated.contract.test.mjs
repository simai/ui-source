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
  alert: 12, badge: 10, button: 10, 'button-group': 7, 'composition-overlay': 59, 'context-menu': 27, 'country-code':
  9, drawer: 13, dropdown: 12, 'file-preview': 11, 'file-upload': 45, 'icon-button': 5, 'image-field': 19, input: 9,
  'list-item': 14, modal: 25, pagination: 34, popover: 21, 'progress-bar': 9, 'progress-scale': 9, quantity: 28,
  skeleton: 4, spinner: 14, tag: 13, textarea: 14, toast: 17, toggle: 7, tooltip: 3, 'tree-item': 34,
};

// meta.mjs: twenty hand-written files that describe some attributes (they were
// overrides of generate-smart-studio-artifacts.mjs); the generated one
// describes all of them.
const PENDING_META = {
  alert: 15, badge: 14, button: 8, 'button-group': 3, dropdown: 19, 'file-preview': 23, 'icon-button': 6, input: 35,
  'list-item': 19, pagination: 34, 'progress-bar': 10, 'progress-scale': 11, skeleton: 11, spinner: 11, tag: 9,
  textarea: 30, toast: 13, toggle: 11, tooltip: 2, 'tree-item': 24,
};

// Phase A (waves 1 and 2, 2026-10-28): these folders are in the 1.4 form --
// component.json carries relations, aliases, x-rule and x-registry,
// examples.json the studio example and the conformance page -- and every
// generated file is byte for byte what the generator writes from them.
const PHASE_A = [
  'close', 'help-mark', 'reference-link', 'avatar', 'avatars', 'slider', 'breadcrumbs', 'empty-state', 'download-file',
  'color', 'switch', 'page-header', 'menu', 'inline-editor', 'sortable', 'copy-button', 'code-input', 'radio', 'checkbox',
  'accordion', 'resizer', 'tabs', 'icon', 'gallery', 'steps', 'profile-picker', 'range-slider', 'theme-generator',
  'datepicker', 'tree',
];

// Gate 1 (§4): the top-level fields of component.json are a closed list; 1.4
// adds relations and aliases. A tool's field starts with x-, $comment is kept.
const TOP_FIELDS = ['id', 'tag', 'version', 'kind', 'family', 'package', 'traits', 'implements', 'settings', 'values', 'events',
  'actions', 'keys', 'roles', 'rules', 'layouts', 'slots', 'form', 'validity', 'selection', 'entry-state', 'window', 'computed',
  'layer', 'side-effects', 'keyboard', 'port', 'connects', 'templates', 'presentation', 'styles', 'examples', 'docs', 'lang',
  'accessibility', 'host-states', 'css-variables', 'parts', 'relations', 'aliases'];

const results = await run({packages: [root], components: []});

test('phase A folders are in the 1.4 form and generate every file byte for byte', () => {
  const problems = [];
  for (const name of PHASE_A) {
    const result = results.find((item) => item.component === name);
    if (!result) { problems.push(`${name}: no such component`); continue; }
    if (result.log?.form !== '1.4') problems.push(`${name}: component.json has no relations (not in the 1.4 form)`);
    for (const [file, entry] of Object.entries(result.files)) {
      if (entry.status !== 'identical') problems.push(`${name}/${file}: ${entry.status}${entry.differences ? ` (${entry.differences.slice(0, 3).map((d) => d.path).join(', ')})` : ''}`);
    }
    for (const field of Object.keys(result.view?.component ?? {})) {
      if (field === '$comment' || field.startsWith('x-') || TOP_FIELDS.includes(field)) continue;
      problems.push(`${name}/component.json: unknown top-level field ${field} (gate 1, §4)`);
    }
  }
  assert.deepEqual(problems, [], 'edit component.json or examples.json, then node scripts/generate-component-files.mjs --write --component <name>');
});

test('a folder in the 1.4 form is listed in phase A', () => {
  const unlisted = results.filter((result) => result.log?.form === '1.4' && !PHASE_A.includes(result.component)).map((result) => result.component);
  assert.deepEqual(unlisted, []);
});

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
