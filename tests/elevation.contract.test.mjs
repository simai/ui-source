import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Height is two things at once: the shadow under an element and the surface it
// stands on. In the light theme the shadow does the work. In the dark theme it
// does none — it is black, the background is nearly black, and the whole
// five-step ramp measured three to seven units of brightness out of 255, below
// what anyone notices. There the step of the surface carries the height.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('a raised surface is declared for every step, each above the last', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const steps = [];
  for (const step of [1, 2, 3, 4, 5]) {
    const found = theme.match(
      new RegExp(`--sf-elevation-${step}--surface: light-dark\\(var\\(--sf-surface-0\\), var\\(--sf-surface-(\\d)\\)\\)`, 'u'),
    );
    assert.ok(found, `step ${step} keeps the ordinary surface in the light theme and rises in the dark one`);
    steps.push(Number(found[1]));
  }

  // The page itself stands on surface 0, so the first step has to leave it. At
  // surface 1 it did not: 1.10:1 against the page, which nobody sees on a large
  // filled area. Every step after it stands strictly higher than the one below,
  // except the last, which may share the top of the ladder.
  assert.ok(steps[0] > 1, `the first step must clear surface 1, found surface ${steps[0]}`);
  for (let i = 1; i < steps.length - 1; i += 1) {
    assert.ok(
      steps[i] > steps[i - 1],
      `step ${i + 1} stands on surface ${steps[i]}, not above step ${i} on surface ${steps[i - 1]}`,
    );
  }
  assert.ok(
    steps[4] >= steps[3],
    'the last step may share the top of the ladder, never fall below it',
  );

  for (const surface of new Set(steps)) {
    assert.match(
      theme,
      new RegExp(`--sf-surface-${surface}: light-dark\\(`, 'u'),
      `surface ${surface} must be a declared role`,
    );
  }
});

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.scss')) found.push(path);
    }
  };
  walk('src/component');
  walk('src/smart');
  return found;
};

test('a shadow comes from a role, not from a colour written by hand', () => {
  const offenders = [];
  for (const path of styleFiles()) {
    for (const line of read(path).split('\n')) {
      if (!/box-shadow:/u.test(line)) continue;
      if (/var\(--sf-/u.test(line)) continue;      // роль или её переменная
      if (/\b(none|inherit|initial|unset)\b/u.test(line)) continue;
      if (/rgba?\(|#[0-9a-f]{3}/iu.test(line)) offenders.push(`${path}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [],
    'a hand-written shadow colour knows nothing about the theme it lands in');
});

// A panel that opens above the page paints itself, and in the dark theme that
// paint is what shows the height. A knob or a thumb is not a panel: it sits on
// a track and keeps its own colour, so the list names the panels rather than
// guessing from what stands near a shadow.
const RAISED_PANELS = [
  ['src/component/context-menu/scss/_css__context_menu.scss', 3],
  ['src/component/menu/scss/_css__menu.scss', 2],
  ['src/component/datepicker/scss/_css_datepicker.scss', 3],
  ['src/component/country-code/scss/_css_country_code.scss', 3],
  ['src/smart/drawer/scss/_smart__drawer.scss', 4],
];

test('a panel that opens above the page stands on the surface of its step', () => {
  const offenders = [];
  for (const [path, step] of RAISED_PANELS) {
    const source = read(path);
    if (!source.includes(`var(--sf-elevation-${step}--surface)`)) {
      offenders.push(`${path}: step ${step} is not on its raised surface`);
    }
  }
  assert.deepEqual(offenders, [],
    'on the plain surface such a panel is invisible in the dark theme');
});

// A level is asked for once. The utility that sets only the shadow stays for
// the rare case, but it must not be the thing a person reaches for when they
// mean height — in the dark theme that leaves the panel flat.
test('one class carries a whole level', () => {
  const source = read('src/utility/elevation/default/scss/_sf_css__elevation.scss');
  assert.match(source, /background-color: var\(--sf-elevation-#\{\$level\}--surface\)/u,
    'the class sets the surface');
  assert.match(source, /box-shadow: var\(--sf-elevation-#\{\$level\}--shadow\)/u,
    'and the shadow, in the same declaration block');
  const bundle = read('src/core/utility-full.js');
  assert.match(bundle, /utility\/elevation\/default\/index\.scss/u,
    'and the group is in the bundle, otherwise the class does not exist');
});
