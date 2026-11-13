import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The small steps below the ladder (owner decision C132, 2026-11-13; research
// ui-control control/research/2026-11-13-small-ladder.md, variant В): five
// steps 4 · 6 · 8 · 12 · 16, nothing under 4, 4 only for ticks, a coloured
// mark never under 6. 16 is the main ladder's step 1/4; 4 to 12 have no public
// name: the tables are emitted as internal --sf-micro--* properties only.
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
  assert.deepEqual(role('cross'), { '1/3': 8, '1/2': 8, 1: 12, 2: 12, 3: 12 });
  assert.deepEqual(role('badge'), { '1/4': 8, '1/3': 8, '1/2': 12, 1: 12, 2: 16, 3: 16 });
  for (const name of ['point', 'count', 'dot', 'cross', 'badge']) {
    for (const px of Object.values(role(name))) assert.ok(px >= 6, `${name}: ${px}`);
  }
  assert.match(vars, /\$small-step-tick: 4 !default;/u);
});

test('C132: the tables are internal custom properties in the base layer, no public name', () => {
  assert.match(sheet, /--sf-micro--#\{\$role\}-#\{str-replace-slash\(\$host\)\}: #\{size\.small-step\(\$step\)\};/u);
  assert.match(sheet, /--sf-micro--ring-#\{str-replace-slash\(\$host\)\}: var\(--sf-#\{\$width\}\);/u);
  assert.match(sheet, /--sf-micro--tick: #\{size\.small-step\(size\.\$small-step-tick\)\};/u);
  const publicVariables = read('src/core/contracts/public-variables.v1.json');
  assert.doesNotMatch(publicVariables, /--sf-micro/u);
  // --sf-mark--color is the highlight (<mark>); the small steps keep their own
  // prefix so the two families never read as one.
  assert.doesNotMatch(sheet + vars, /--sf-mark--/u);
});

test('C132: a tag 3 cross is 16 on a desktop at normal density, 12 in compact and on a phone', () => {
  const desktop = vars.slice(vars.indexOf('$small-step-roles-desktop: ('), vars.indexOf(') !default;', vars.indexOf('$small-step-roles-desktop: (')));
  assert.match(desktop, /cross: \('3': 16\)/u);
  assert.match(sheet, /@media \(min-width: 60rem\) \{\s*:root:not\(\[data-sf-density="compact"\]\),\s*\[data-sf-density="normal"\] \{/u);
  assert.match(sheet, /\[data-sf-density="compact"\]:not\(:root\) \{/u);
});

test('C132: the small steps name what stays outside them (icon row, control internals, close buttons)', () => {
  const outside = vars.slice(vars.indexOf('// Outside the small steps'), vars.indexOf('@function small-step'));
  for (const part of ['icon row', 'spinner', 'checkbox', 'radio button', 'slider', 'switch knob', 'close button', 'sf-help-mark']) {
    assert.ok(outside.includes(part), part);
  }
});

test('C132: tag cross, avatar badge and the timeline dot read the tables', () => {
  const tags = read('src/component/tags/scss/_css__tags.scss');
  for (const step of ['1\\/3', '1\\/2', '1', '2', '3']) assert.ok(tags.includes(`--sf-tag--close-size: var(--sf-micro--cross-${step});`), step);
  const badge = read('src/component/avatars/scss/_css__avatar_company.scss');
  for (const step of ['1\\/4', '1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(badge.includes(`.sf-avatar-badge--size-${step} {\n    --sf-avatar-badge--width: var(--sf-micro--badge-${step});`), step);
  }
  const timeline = read('src/smart/list-timeline/scss/_smart__list-timeline.scss');
  for (const step of ['1', '1\\/2', '2']) assert.ok(timeline.includes(`--sf-list-timeline--dot: var(--sf-micro--dot-${step});`), step);
  assert.doesNotMatch(timeline, /--sf-list-timeline--dot: var\(--sf-[ab]\d\)/u);
});

test('C132: the status point and the anchored dot read one table, ring outside', () => {
  const point = read('src/component/avatars/scss/_css__avatar_online_indicator.scss');
  for (const step of ['1\\/4', '1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(point.includes(`--sf-online-indicator--width: var(--sf-micro--point-${step});`), step);
    assert.ok(point.includes(`--sf-online-indicator--ring-width: var(--sf-micro--ring-${step});`), step);
  }
  const anchored = read('src/component/badges/scss/_anchored-geometry.scss');
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-micro--point-#\{\$step\}\);/u);
  assert.match(anchored, /--sf-badge--anchored-count: var\(--sf-micro--count-#\{\$step\}\);/u);
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-micro--point-1\\\/3\);/u);
  assert.match(anchored, /--sf-badge--anchored-dot: var\(--sf-micro--point-1\\\/2\);/u);
});

test('C132: avatar 1/4 is 16 on every screen; icon 1/4 is 12', () => {
  const avatars = read('src/component/avatars/scss/_css__avatars.scss');
  const start = avatars.indexOf('.sf-avatar--size-1\\/4 {');
  const block = avatars.slice(start, avatars.indexOf('}', avatars.indexOf('--sf-avatar--width', start)));
  assert.match(block, /--sf-avatar--height: #\{size\.small-step\(16\)/u);
  assert.match(block, /--sf-avatar--width: #\{size\.small-step\(16\)/u);
  assert.match(read('src/core/figma_variables/figma_icon_sizes.scss'), /--sf-icon-size-1\\\/4: var\(--sf-b2\);/u);
});
