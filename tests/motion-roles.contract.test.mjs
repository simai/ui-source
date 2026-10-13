import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Movement in the set has two roles and one setting behind it.
//
//   --sf-duration-fast | -normal | -slow   how long
//   --sf-animation, --sf-ease-*            how it accelerates
//   prefers-reduced-motion: reduce         whether it moves at all
//
// The progress bar named a fourth duration, --sf-duration-default, which is
// declared nowhere. A custom property that resolves to nothing takes the whole
// declaration with it, so the bar's width had no transition and jumped; measured
// on the published runtime, transition-duration came out 0s. Nothing warned,
// because there was no fallback to fall back to.
//
// And three components of the twenty-six that move did not ask the system
// whether to. The icon was the one that mattered: two infinite animations, and
// infinite is the case the setting exists for.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const styleFiles = (directory) => {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(resolve(root, dir))) return;
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (entry.name.endsWith('.scss') || entry.name.endsWith('.css')) found.push(path);
    }
  };
  walk(directory);
  return found;
};

const declaredDurations = () => {
  const source = read('src/core/scss/vars/_sf_var__animation.scss');
  return [...source.matchAll(/^\s*['"]?([a-z-]+)['"]?\s*:/gmu)].map((m) => m[1]);
};

test('every duration a component names is one the scale declares', () => {
  // The scale is built from a map, so the names come from the map rather than
  // from a list repeated here.
  const names = new Set(declaredDurations());
  assert.ok(names.size >= 3, `the duration scale looks empty: ${[...names].join(', ')}`);
  const offenders = [];
  for (const path of [...styleFiles('src/component'), ...styleFiles('src/smart'), ...styleFiles('src/utility')]) {
    read(path).split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/var\(\s*--sf-duration-([a-z-]+)\s*([,)])/gu)) {
        const [, name, next] = match;
        if (names.has(name)) continue;
        // A fallback keeps the declaration alive, so it is a smell, not a defect.
        if (next === ',') continue;
        offenders.push(`${path}:${index + 1}: --sf-duration-${name}`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    'a duration that resolves to nothing takes its whole declaration with it');
});

test('a component that moves lets the system stop it', () => {
  const moves = new Set();
  const asks = new Set();
  for (const path of styleFiles('src/component')) {
    const component = path.split('/')[2];
    const css = read(path);
    // A transition or an animation that actually runs; `0s` is how a component
    // stops itself and does not count as movement.
    if (/(?:^|[;{\s])(?:transition|animation)(?:-duration|-property)?\s*:(?![^;]*\b0s\b)[^;]+;/u.test(css)) {
      moves.add(component);
    }
    if (css.includes('prefers-reduced-motion')) asks.add(component);
  }
  const silent = [...moves].filter((name) => !asks.has(name)).sort();
  assert.deepEqual(silent, [],
    'the setting exists so a person can stop movement; a component has to honour it');
});
