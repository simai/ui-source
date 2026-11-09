import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A nested block takes its padding and its corner from the same step, and each
// level inside steps down: p-4 radius-4, then p-3 radius-3, and so on. The rule
// only works while both ladders offer the same steps. They had already drifted:
// --sf-radius-4 was declared and no class ever exposed it, so the outermost
// level of the rule could not be written at all.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const declaredRadiusSteps = () => {
  const source = read('src/core/figma_variables/figma_radius.scss');
  return new Set(
    [...source.matchAll(/--sf-radius-((?:[0-9]+)(?:\\\/[0-9]+)?):/gu)]
      .map(([, step]) => step.replace(/\\/gu, '')),
  );
};

const utilitySteps = (path, pattern) => new Set(
  [...read(path).matchAll(pattern)].map(([, step]) => step.replace(/\\\\/gu, '')),
);

test('every declared radius step is a class somebody can write', () => {
  const declared = declaredRadiusSteps();
  const offered = utilitySteps(
    'src/utility/border-radius/default/scss/_sf_var__radius.scss',
    /'((?:[0-9]+)(?:\\\\\/[0-9]+)?)':/gu,
  );
  for (const step of declared) {
    assert.ok(offered.has(step), `--sf-radius-${step} is declared and no radius-${step} class offers it`);
  }
});

test('the padding ladder and the radius ladder share the steps the rule uses', () => {
  const radius = utilitySteps(
    'src/utility/border-radius/default/scss/_sf_var__radius.scss',
    /'((?:[0-9]+)(?:\\\\\/[0-9]+)?)':/gu,
  );
  // The steps the nesting rule pairs. A block smaller than 1/2 is a control,
  // and controls take their corner from the role, not from the ladder.
  for (const step of ['1/2', '1', '2', '3', '4']) {
    assert.ok(radius.has(step), `the rule pairs p-${step} with radius-${step}, which is not offered`);
  }
});

// The nesting check ui-chat asked for (simai/ui-source#31), against the
// step-down rule: a container p-N radius-N holds a block radius-(N-1). An
// inner corner larger than the outer one, with an inset smaller than that
// inner corner, would bulge past the container's curve; and a container's own
// corner wider than its inset would let its content touch the curve. Checked
// on both ladders, mobile and desktop (60rem), in pixels from the primitives
// of the adaptive-sizing contract (docs/foundation-radius-nesting.md).
const primitives = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json')).primitives;
const px = (token) => {
  const match = /^--sf-([a-i])(\d)$/u.exec(token);
  if (!match) return null;
  const {startPx, stepPx} = primitives[match[1]];
  return startPx + stepPx * Number(match[2]);
};
const ladder = (path, name) => {
  const source = read(path);
  const desktopAt = source.indexOf('@media (min-width: 60rem)');
  const parse = (part) => Object.fromEntries([...part.matchAll(new RegExp(`--sf-${name}-((?:[0-9]+)(?:\\\\\\/[0-9]+)?):\\s*var\\((--sf-[a-i]\\d)\\)`, 'gu'))]
    .map(([, step, token]) => [step.replace(/\\/gu, ''), px(token)]));
  return {mobile: parse(source.slice(0, desktopAt)), desktop: {...parse(source.slice(0, desktopAt)), ...parse(source.slice(desktopAt))}};
};

test('the step-down rule never puts a larger corner inside a smaller one (simai/ui-source#31)', () => {
  const radius = ladder('src/core/figma_variables/figma_radius.scss', 'radius');
  const space = ladder('src/core/figma_variables/figma_space.scss', 'space');
  const steps = ['1/2', '1', '2', '3', '4'];
  for (const mode of ['mobile', 'desktop']) {
    for (const [index, step] of steps.entries()) {
      const outer = radius[mode][step];
      const inset = space[mode][step];
      assert.ok(Number.isFinite(outer) && Number.isFinite(inset), `${mode}: radius-${step} and p-${step} resolve to pixels`);
      assert.ok(outer <= inset, `${mode}: radius-${step} (${outer}px) is wider than p-${step} (${inset}px)`);
      if (index === 0) continue;
      const inner = radius[mode][steps[index - 1]];
      assert.ok(!(inner > outer && inset < inner), `${mode}: radius-${steps[index - 1]} (${inner}px) inside radius-${step} (${outer}px) with p-${step} (${inset}px)`);
      assert.ok(inner <= outer, `${mode}: the ladder steps down, radius-${steps[index - 1]} <= radius-${step}`);
    }
  }
});
