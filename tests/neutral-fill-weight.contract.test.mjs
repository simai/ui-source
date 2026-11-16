import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The weight of the neutral fill (C113, owner 2026-11-13; research
// control/research/2026-11-12-tonal-buttons.md; before it C41, 2026-11-10,
// 8/12/16). --sf-surface-container is 12 in both themes, its hover 16, its
// press 20 and the strong step 24 -- on neutral-50 in the light theme and
// neutral-90 in the dark, and on white for glass over media -- and the
// disabled plate 8, under the lightest working plate. Every place that
// re-declares the roles writes them out (an ancestor's value cannot be read in
// CSS), so a copy at a former step left every card, popup and window at the
// old weight while the page had the new one. Nothing may declare the fill
// roles at another step: not the sources, and not the built sheets a page gets.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const FILL_ROLES = ['--sf-surface-container', '--sf-surface-container-hover', '--sf-surface-container-active'];
const STEPS = {'--sf-surface-container': 12, '--sf-surface-container-hover': 16, '--sf-surface-container-active': 20};
const DISABLED = 8;
// A neutral or white step, as a fill role's value: it must be the role's step.
const TONE = /--sf-(?:neutral-(?:50|90)|white)--alfa-(\d+)\b/gu;

const files = (directory, extensions) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : files(path, extensions);
  return extensions.includes(extname(entry.name)) ? [path] : [];
});

const declarations = (css) => [...css.replace(/\/\*[\s\S]*?\*\//gu, '').matchAll(/([^{};]+)\{([^{}]*)\}/gu)]
  .flatMap(([, selector, body]) => [...body.matchAll(/(--sf-[a-z0-9-]+)\s*:\s*([^;]+)/gu)]
    .map(([, name, value]) => ({selector: selector.trim(), name, value: value.trim()})));

const neutral = (step) => `light-dark(var(--sf-neutral-50--alfa-${step}), var(--sf-neutral-90--alfa-${step}))`;

test('the theme, the opaque places and glass declare the fill at 12, 16 and 20, and the disabled plate at 8', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const mix = read('src/core/scss/mix/_mix__places.scss');
  const glass = read('src/core/scss/_sf_css__surface_places.scss');
  for (const [role, step] of Object.entries(STEPS)) {
    assert.ok(theme.includes(`${role}: ${neutral(step)};`), `theme ${role} at ${step}`);
    assert.ok(mix.includes(`'${role.slice(5)}': '${neutral(step)}'`), `sf-place ${role} at ${step}`);
    assert.ok(glass.includes(`${role}: var(--sf-white--alfa-${step});`), `glass ${role} at ${step}`);
  }
  assert.ok(theme.includes(`--sf-surface-container-strong: ${neutral(24)};`), 'the strong step is 24');
  assert.ok(theme.includes(`--sf-surface-disabled: ${neutral(DISABLED)};`), 'theme disabled plate at 8');
  assert.ok(mix.includes(`'surface-disabled': '${neutral(DISABLED)}'`), 'sf-place disabled plate at 8');
  assert.ok(glass.includes(`--sf-surface-disabled: var(--sf-white--alfa-${DISABLED});`), 'glass disabled plate at 8');
  assert.match(mix, /--sf-surface-disabled: #\{sf-ink\(\$c, 8\)\};/u, 'a strong place disabled plate at 8');
});

test('no source declares a neutral fill role at another step', () => {
  const wrong = [];
  const want = {...STEPS, '--sf-surface-disabled': DISABLED};
  for (const path of files(resolve(root, 'src'), ['.scss', '.css', '.js', '.mjs'])) {
    const text = readFileSync(path, 'utf8');
    for (const [, name, value] of text.matchAll(/(--sf-surface-(?:container(?:-hover|-active)?|disabled))\s*:\s*([^;'"`]+)/gu)) {
      const steps = [...value.matchAll(TONE)].map(([, step]) => Number(step));
      if (steps.some((step) => step !== want[name])) wrong.push(`${path.slice(root.length + 1)}: ${name}: ${value.trim()}`);
    }
  }
  assert.deepEqual(wrong, [], 'a copy of a former neutral fill');
});

// The built sheets, read from the candidate (UI_CORE_ROOT / UI_SMART_ROOT). A
// distribution built before C113 is skipped, not passed.
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const smartDistribution = process.env.UI_SMART_ROOT ?? resolve(root, '../ui-smart');
const built = [resolve(distribution, 'distr'), resolve(smartDistribution, 'smart')]
  .filter((directory) => existsSync(directory))
  .flatMap((directory) => files(directory, ['.css']))
  .filter((path) => !path.endsWith('.min.css'));
const core = built.find((path) => path.endsWith('/core/css/core.css'));
const weighed = core && readFileSync(core, 'utf8').includes(`--sf-surface-container:${neutral(12)}`.replace(/, /gu, ','))
  || core && readFileSync(core, 'utf8').includes(`--sf-surface-container: ${neutral(12)}`);

test('in the built sheets no neutral fill copy is left at the former steps', {skip: !weighed && 'the built sheets predate C113'}, () => {
  const wrong = [];
  let fills = 0;
  for (const path of built) {
    for (const {selector, name, value} of declarations(readFileSync(path, 'utf8'))) {
      if (!FILL_ROLES.includes(name) && name !== '--sf-surface-disabled') continue;
      // A strong coloured place fills with its own ink at 12/16/20 (white in
      // the light theme, tone 20 in the dark): a named exception, not neutral.
      if (/--sf-[a-z]+-20--alfa-/u.test(value)) continue;
      const tones = [...value.matchAll(/--sf-(neutral-(?:50|90)|white)--alfa-(\d+)/gu)];
      if (!tones.length) continue;
      fills += 1;
      for (const [, , step] of tones) {
        if (Number(step) !== (STEPS[name] ?? DISABLED)) wrong.push(`${path}: ${selector} ${name}: ${value}`);
      }
    }
  }
  assert.ok(fills >= 30, `only ${fills} neutral fill declarations were read`);
  assert.deepEqual(wrong, []);
});
