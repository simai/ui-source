import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

// Two neutral roles, and a job for each. The boundary a person reads to find a
// control has to carry 3:1 against the surface behind it — WCAG 1.4.11 — and
// only the solid role does: measured 4.47:1 in the light theme and 5.56:1 in
// the dark one, against 1.34:1 and 1.91:1 for the translucent one. The
// translucent role draws the edge of an area and the lines inside it, where
// nothing has to be identified.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => withoutPublicVariables(readFileSync(resolve(root, path), 'utf8'));

const componentStyles = (component) => {
  const directory = `src/component/${component}/scss`;
  return readdirSync(resolve(root, directory))
    .filter((name) => name.endsWith('.scss'))
    .map((name) => read(`${directory}/${name}`))
    .join('\n');
};

// The border a person reads to find the control, named by the variable the
// component paints it with.
const CONTROLS = [
  ['inputs', '--sf-input-field--border-color'],
  ['textarea', '--sf-textarea-textarea--border-color'],
  ['dropdown', '--sf-dropdown-field--border-color'],
  ['quantity', '--sf-quantity-wrap--border-color'],
  ['country-code', '--sf-country-code-field--border-color'],
  ['checkbox', '--sf-checkbox-box--border-color'],
  ['radio', '--sf-radio-button-box--border-color'],
  ['switch', '--sf-switch-toggler--border-color'],
];

test('a control carries the boundary a person can actually see', () => {
  const offenders = [];
  for (const [component, variable] of CONTROLS) {
    const source = componentStyles(component);
    // States paint the same variable with their own colour — error, disabled,
    // the primary of a hover. What the rule is about is the resting boundary:
    // the solid role has to be there, and the role that draws an area must not.
    const uses = [...source.matchAll(new RegExp(`${variable}:\\s*var\\(--sf-([a-z-]+)\\)`, 'gu'))]
      .map((match) => match[1]);
    if (!uses.length) { offenders.push(`${component}: ${variable} is not declared`); continue; }
    // The resting boundary is --sf-outline, which holds 3:1 by its own
    // contract. It was a third role, --sf-outline-control, until 2026-10-08.
    if (!uses.includes('outline')) offenders.push(`${component}: ${variable} never takes the boundary role`);
    if (uses.includes('outline-variant')) offenders.push(`${component}: ${variable} takes the area role`);
  }
  assert.deepEqual(offenders, [],
    'a control boundary takes the solid role; the translucent one measures 1.34:1 and fails 1.4.11');
});

test('a border is a pixel, not a fraction of the text size', () => {
  const offenders = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (!entry.name.endsWith('.scss')) continue;
      const source = read(path);
      for (const line of source.split('\n')) {
        // A fallback is a width too: var(--sf-thing--width, var(--sf-a1)) sets the
        // border in rem wherever the host did not override it, which is the common
        // case. Matching only the direct form let nine of these stand.
        if (/border[a-z-]*(?:width)?:[^;]*var\(--sf-a1\)/u.test(line)) offenders.push(`${path}: ${line.trim()}`);
      }
    }
  };
  walk('src');
  assert.deepEqual(offenders, [],
    'a border in rem thickens with the type scale while the ones in --sf-px do not');
});

test('a divider can take the role a divider is supposed to have', () => {
  const source = read('src/utility/divider-color/default/scss/_sf_var__divider_color.scss');
  assert.match(source, /'outline-variant':\s*'outline-variant'/u,
    'the utility must offer the translucent role, which is what a line inside an area takes');
});

test('the two default radii are named after what they are put on', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  assert.match(border, /--sf-radius--ui:/u, 'the small control radius');
  assert.match(border, /--sf-radius--surface:/u, 'and the large block radius, with a name that says so');
});

test('the semantic radii have utilities, not only tokens', () => {
  const source = read('src/utility/border-radius/default/scss/_sf_var__radius.scss');
  assert.match(source, /'ui':\s*'-ui'/u, 'radius-ui exists as a class');
  assert.match(source, /'surface':\s*'-surface'/u, 'and so does radius-surface');
});
