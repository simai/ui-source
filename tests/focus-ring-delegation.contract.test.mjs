import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A component that draws the ring on the part the person sees must also take
// the ring away from the control that actually holds the focus. The global
// `:focus-visible` rule paints whatever is focused, so a component that only
// adds its own ring ends up with two: one around the field and one around the
// bare input inside it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.scss$/u.test(entry.name)) found.push(path);
    }
  };
  walk('src/component');
  return found;
};

// A delegating rule matches on the control's focus and then names a different
// element to carry the ring: `.sf-x:has(input…:focus-visible) .sf-x-field`.
const delegating = /:has\(\s*>?\s*input[^)]*:focus-visible\s*\)\s*([^{,]*?)\s*\{/gu;

// The component gives the ring back with an `outline: none` on the control,
// under a selector that reaches the same component.
const silencing = (source, component) => {
  const pattern = new RegExp(
    `\\${component}[^{]*\\binput[^{]*:focus-visible[^{]*\\{[^}]*outline:\\s*none`,
    'u');
  return pattern.test(source);
};

// A component is a directory, not a file: the variant that delegates and the
// rule that silences the control often live side by side in different files, so
// the whole component is read as one stylesheet.
const componentSources = () => {
  const merged = new Map();
  for (const path of styleFiles()) {
    const component = path.split('/').slice(0, 3).join('/');
    merged.set(component, (merged.get(component) || '') + '\n' + read(path));
  }
  return merged;
};

test('a component that delegates the ring silences the control inside it', () => {
  const offenders = [];
  for (const [path, source] of componentSources()) {
    for (const match of source.matchAll(delegating)) {
      const target = match[1].trim();
      // An empty target means the ring lands on the component root itself, so
      // the control is not the element being ringed either way.
      if (!target) continue;
      const component = (source.slice(0, match.index).match(/\.sf-[a-z0-9-]+/giu) || []).pop();
      if (!component) continue;
      const base = component.replace(/--.*$/u, '');
      if (!silencing(source, base)) offenders.push(`${path}: ${base} → ${target}`);
    }
  }
  assert.deepEqual([...new Set(offenders)], [],
    'these components draw the ring on a wrapper without taking it off the control');
});

test('the ring stands off the element so it cannot merge with an equal fill', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  const offset = border.match(/--sf-focus--offset:\s*([^;]+);/u);
  assert.ok(offset, 'the focus offset token is declared in the border layer');
  assert.notEqual(offset[1].trim(), 'var(--sf-a0)',
    'a flush ring disappears into a control filled with the focus colour');
});
