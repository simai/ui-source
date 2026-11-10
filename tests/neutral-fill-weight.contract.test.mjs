import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The weight of the neutral fill (C41, owner 2026-11-10; research
// control/research/2026-11-10-container-weight.md). --sf-surface-container is
// 8 in both themes, its hover 12, its press 16 and the strong step 24 -- on
// neutral-50 in the light theme and neutral-90 in the dark, and on white for
// glass over media. Every place that re-declares the roles writes them out
// (an ancestor's value cannot be read in CSS), so a copy at the former
// 16/20/24 left every card, popup and window at the old weight while the page
// had the new one. Nothing may declare the fill roles at the former steps:
// not the sources, and not the built sheets a page gets.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const FILL_ROLES = ['--sf-surface-container', '--sf-surface-container-hover', '--sf-surface-container-active'];
const STEPS = {'--sf-surface-container': 8, '--sf-surface-container-hover': 12, '--sf-surface-container-active': 16};
// A neutral or white step at the former weight, as a fill role's value.
const FORMER = /--sf-(?:neutral-(?:50|90)|white)--alfa-(?:20|24|32)\b|--sf-(?:neutral-(?:50|90)|white)--alfa-16\b/u;

const files = (directory, extensions) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : files(path, extensions);
  return extensions.includes(extname(entry.name)) ? [path] : [];
});

const declarations = (css) => [...css.replace(/\/\*[\s\S]*?\*\//gu, '').matchAll(/([^{};]+)\{([^{}]*)\}/gu)]
  .flatMap(([, selector, body]) => [...body.matchAll(/(--sf-[a-z0-9-]+)\s*:\s*([^;]+)/gu)]
    .map(([, name, value]) => ({selector: selector.trim(), name, value: value.trim()})));

const neutral = (step) => `light-dark(var(--sf-neutral-50--alfa-${step}), var(--sf-neutral-90--alfa-${step}))`;

test('the theme, the opaque places and glass declare the fill at 8, 12 and 16', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const mix = read('src/core/scss/mix/_mix__places.scss');
  const glass = read('src/core/scss/_sf_css__surface_places.scss');
  for (const [role, step] of Object.entries(STEPS)) {
    assert.ok(theme.includes(`${role}: ${neutral(step)};`), `theme ${role} at ${step}`);
    assert.ok(mix.includes(`'${role.slice(5)}': '${neutral(step)}'`), `sf-place ${role} at ${step}`);
    assert.ok(glass.includes(`${role}: var(--sf-white--alfa-${step});`), `glass ${role} at ${step}`);
  }
  assert.ok(theme.includes(`--sf-surface-container-strong: ${neutral(24)};`), 'the strong step is 24');
});

test('no source declares a neutral fill role at the former 16/20/24', () => {
  const wrong = [];
  for (const path of files(resolve(root, 'src'), ['.scss', '.css', '.js', '.mjs'])) {
    const text = readFileSync(path, 'utf8');
    for (const [, name, value] of text.matchAll(/(--sf-surface-container(?:-hover|-active)?)\s*:\s*([^;'"`]+)/gu)) {
      if (FORMER.test(value) && !value.includes(`alfa-${STEPS[name]})`) && !value.includes(`alfa-${STEPS[name]}\``)) {
        wrong.push(`${path.slice(root.length + 1)}: ${name}: ${value.trim()}`);
      }
    }
  }
  assert.deepEqual(wrong, [], 'a copy of the former neutral fill');
});

// The built sheets, read from the candidate (UI_CORE_ROOT / UI_SMART_ROOT). A
// distribution built before C41 is skipped, not passed.
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const smartDistribution = process.env.UI_SMART_ROOT ?? resolve(root, '../ui-smart');
const built = [resolve(distribution, 'distr'), resolve(smartDistribution, 'smart')]
  .filter((directory) => existsSync(directory))
  .flatMap((directory) => files(directory, ['.css']))
  .filter((path) => !path.endsWith('.min.css'));
const core = built.find((path) => path.endsWith('/core/css/core.css'));
const weighed = core && readFileSync(core, 'utf8').includes(`--sf-surface-container:${neutral(8)}`.replace(/, /gu, ','))
  || core && readFileSync(core, 'utf8').includes(`--sf-surface-container: ${neutral(8)}`);

test('in the built sheets no neutral fill copy is left at the former steps', {skip: !weighed && 'the built sheets predate C41'}, () => {
  const wrong = [];
  let fills = 0;
  for (const path of built) {
    for (const {selector, name, value} of declarations(readFileSync(path, 'utf8'))) {
      if (!FILL_ROLES.includes(name)) continue;
      const tones = [...value.matchAll(/--sf-(neutral-(?:50|90)|white)--alfa-(\d+)/gu)];
      if (!tones.length) continue;
      fills += 1;
      for (const [, , step] of tones) {
        if (Number(step) !== STEPS[name]) wrong.push(`${path}: ${selector} ${name}: ${value}`);
      }
    }
  }
  assert.ok(fills >= 30, `only ${fills} neutral fill declarations were read`);
  assert.deepEqual(wrong, []);
});
