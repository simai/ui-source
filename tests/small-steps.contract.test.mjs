import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The small steps below the ladder (owner decision C132, 2026-11-13; research
// ui-control control/research/2026-11-13-small-ladder.md, variant В): five
// steps 4 · 6 · 8 · 12 · 16, nothing under 4, 4 only for ticks, a coloured
// mark never under 6. 16 is the main ladder's step 1/4; 4 to 12 have no public
// name: the tables are emitted as internal --sf-mark--* properties only.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const vars = read('src/core/scss/vars/_sf_var__size.scss');
const sheet = read('src/core/scss/_sf_css__size.scss');

test('C132: the five small steps are steps of the size scale', () => {
  const map = vars.slice(vars.indexOf('$small-steps: ('), vars.indexOf(') !default;', vars.indexOf('$small-steps: (')));
  const steps = Object.fromEntries([...map.matchAll(/(\d+): ([a-z]\d),/gu)].map(([, px, token]) => [px, token]));
  assert.deepEqual(steps, { 4: 'a4', 6: 'a6', 8: 'a8', 12: 'b2', 16: 'b6' });
});

test('C132: one table by host step; a coloured mark is never under 6, 4 is the tick', () => {
  const role = (name) => {
    const line = vars.match(new RegExp(`\\t${name}:\\s*\\(([^)]*)\\)`, 'u'))[1];
    return Object.fromEntries([...line.matchAll(/'([^']+)': (\d+)/gu)].map(([, host, px]) => [host, Number(px)]));
  };
  assert.deepEqual(role('point'), { '1/4': 6, '1/3': 6, '1/2': 8, 1: 12, 2: 12, 3: 16 });
  assert.deepEqual(role('count'), { 1: 16, 2: 16, 3: 16 });
  assert.deepEqual(role('dot'), { '1/3': 6, '1/2': 6, 1: 8, 2: 8, 3: 12 });
  assert.deepEqual(role('cross'), { 2: 12 });
  for (const name of ['point', 'count', 'dot', 'cross']) {
    for (const px of Object.values(role(name))) assert.ok(px >= 6, `${name}: ${px}`);
  }
  assert.match(vars, /\$small-step-tick: 4 !default;/u);
});

test('C132: the tables are internal custom properties in the base layer, no public name', () => {
  assert.match(sheet, /--sf-mark--#\{\$role\}-#\{str-replace-slash\(\$host\)\}: #\{size\.small-step\(\$step\)\};/u);
  assert.match(sheet, /--sf-mark--ring-#\{str-replace-slash\(\$host\)\}: var\(--sf-#\{\$width\}\);/u);
  assert.match(sheet, /--sf-mark--tick: #\{size\.small-step\(size\.\$small-step-tick\)\};/u);
  const publicVariables = read('src/core/contracts/public-variables.v1.json');
  assert.doesNotMatch(publicVariables, /--sf-mark/u);
});

test('C132: the status point and the anchored dot read one table, ring outside', () => {
  const point = read('src/component/avatars/scss/_css__avatar_online_indicator.scss');
  for (const step of ['1\\/4', '1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(point.includes(`--sf-online-indicator--width: var(--sf-mark--point-${step});`), step);
    assert.ok(point.includes(`--sf-online-indicator--ring-width: var(--sf-mark--ring-${step});`), step);
  }
  const anchored = read('src/component/badges/scss/_anchored-geometry.scss');
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-mark--point-#\{\$step\}\);/u);
  assert.match(anchored, /--sf-badge--anchored-count: var\(--sf-mark--count-#\{\$step\}\);/u);
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-mark--point-1\\\/3\);/u);
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-mark--point-1\\\/2\);/u);
});

test('C132: avatar 1/4 is 16 on every screen; icon 1/4 is 12', () => {
  const avatars = read('src/component/avatars/scss/_css__avatars.scss');
  const start = avatars.indexOf('.sf-avatar--size-1\\/4 {');
  const block = avatars.slice(start, avatars.indexOf('}', avatars.indexOf('--sf-avatar--width', start)));
  assert.match(block, /--sf-avatar--height: #\{size\.small-step\(16\)/u);
  assert.match(block, /--sf-avatar--width: #\{size\.small-step\(16\)/u);
  assert.match(read('src/core/figma_variables/figma_icon_sizes.scss'), /--sf-icon-size-1\\\/4: var\(--sf-b2\);/u);
});
