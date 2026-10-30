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

// smart.manifest.json and meta.mjs: a committed file that differs from the
// generated one, pinned with its number of differences (a count never rises; one
// that falls is lowered in the same commit, down to removing the pin). Phase A
// waves 3 to 6 (2026-10-28) regenerated the last of them: none is pending.
const PENDING_MANIFEST = {};
const PENDING_META = {};

// Phase A (waves 1 and 2, then 3 to 6, 2026-10-28): these folders are in the
// 1.4 form -- component.json carries relations, aliases, x-rule and x-registry,
// examples.json the studio example and the conformance page -- and every
// generated file, meta.mjs among them, is byte for byte what the generator
// writes from them. Every Smart component of this repository is listed.
const PHASE_A = [
  'close', 'help-mark', 'reference-link', 'avatar', 'avatars', 'slider', 'breadcrumbs', 'empty-state', 'download-file',
  'color', 'switch', 'page-header', 'menu', 'inline-editor', 'sortable', 'copy-button', 'code-input', 'radio', 'checkbox',
  'accordion', 'resizer', 'tabs', 'icon', 'gallery', 'steps', 'profile-picker', 'range-slider', 'theme-generator',
  'datepicker', 'tree',
  // waves 3 to 6: the meta.mjs families, the small conflicts, the large ones
  'skeleton', 'tooltip', 'alert', 'progress-bar', 'progress-scale', 'toggle', 'badge', 'button', 'icon-button',
  'button-group', 'input', 'textarea', 'dropdown', 'list-item', 'file-preview', 'country-code', 'tag', 'pagination',
  'image-field', 'drawer', 'context-menu', 'toast', 'tree-item', 'spinner', 'popover', 'modal', 'quantity',
  'file-upload', 'composition-overlay',
  // new in the 1.4 form
  'progress-ring',
  // Made in the 1.4 form from the start (2026-10-28).
  'site-header',
  // Made in the 1.4 form from the start (2026-10-30).
  'search',
  'settings-menu',
  'pager',
  // The page's table of contents (2026-10-30).
  'contents',
  'rich-text',
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

test('every Smart component folder of this repository is in the 1.4 form', () => {
  const left = results.filter((result) => result.log?.form !== '1.4').map((result) => result.component);
  assert.deepEqual(left, []);
});

// Rules waves 3 to 6 added to the generator, each pinned on the component it came from.
test('an object setting is a property input, as a list is (context-menu search, image-field value)', () => {
  const manifest = (name) => JSON.parse(results.find((result) => result.component === name).generated['smart.manifest.json']);
  assert.equal(manifest('context-menu').inputs.properties.search.type, 'object');
  assert.deepEqual({type: manifest('image-field').inputs.properties.value.type, default: manifest('image-field').inputs.properties.value.default}, {type: 'object', default: null});
});

test('a native event name with a detail (x-detail) describes that detail (dropdown, quantity change)', () => {
  const manifest = (name) => JSON.parse(results.find((result) => result.component === name).generated['smart.manifest.json']);
  assert.deepEqual(Object.keys(manifest('dropdown').events.change.payload.properties), ['value', 'label', 'values', 'item', 'multiple']);
  assert.equal(manifest('quantity').events.input.payload.type, 'object');
  assert.equal(manifest('toggle').events.change.payload.type, 'null');
});

test('a dated attribute alias of a setting is an input until it ends (modal hide, unclose inverted)', () => {
  const inputs = JSON.parse(results.find((result) => result.component === 'modal').generated['smart.manifest.json']).inputs.properties;
  assert.equal(inputs.hide.type, 'boolean');
  assert.match(inputs.unclose.description, /dismissible .*inverted/u);
  assert.equal(inputs['aria-label'].type, 'string');
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
