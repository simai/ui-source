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
