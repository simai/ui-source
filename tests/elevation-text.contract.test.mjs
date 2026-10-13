import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A role is dimmed relative to the surface it lies on, and a raised surface
// lightens with its step in the dark theme. One fixed value therefore cannot
// serve every step: --sf-on-surface-variant measured 4.14:1 on the second step
// and 2.93:1 on the fourth, against the 4.5:1 WCAG 1.4.3 asks of text.
//
// This check does the arithmetic rather than matching names, so a retuned
// neutral ramp or a resurfaced step fails here instead of on someone's screen.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const primitives = () => {
  const source = read('src/core/scss/_sf_figma_colors_variables.scss');
  return Object.fromEntries(
    [...source.matchAll(/(--sf-(?:neutral-\d+|white|black)):\s*(#[0-9a-fA-F]{6});/gu)]
      .map(([, name, hex]) => [name, hex]),
  );
};

const themeRoles = () => {
  const source = read('src/core/scss/_sf_css__theme.scss');
  return Object.fromEntries(
    [...source.matchAll(/(--sf-[a-z0-9-]+):\s*light-dark\(\s*var\((--sf-[a-z0-9-]+)\)\s*,\s*var\((--sf-[a-z0-9-]+)\)\s*\)/gu)]
      .map(([, name, light, dark]) => [name, { light, dark }]),
  );
};

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const resolve2 = (roles, hexes, name, mode) => {
  const seen = new Set();
  let current = name;
  while (!hexes[current]) {
    if (seen.has(current) || !roles[current]) return null;
    seen.add(current);
    current = roles[current][mode];
  }
  return hexes[current];
};

test('dimmed text keeps 4.5:1 on every step it is declared for', () => {
  const hexes = primitives();
  const roles = themeRoles();
  const failures = [];
  for (const step of [1, 2, 3, 4, 5]) {
    for (const mode of ['light', 'dark']) {
      const surface = resolve2(roles, hexes, `--sf-elevation-${step}--surface`, mode);
      const text = resolve2(roles, hexes, `--sf-on-elevation-${step}--variant`, mode);
      assert.ok(surface, `elevation ${step} has no surface in the ${mode} theme`);
      assert.ok(text, `elevation ${step} has no dimmed text role in the ${mode} theme`);
      const measured = contrast(text, surface);
      if (measured < 4.5) failures.push(`${mode} step ${step}: ${measured.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(failures, [], 'text on a raised surface has to be read');
});

test('dimmed text stays dimmer than the primary role', () => {
  const hexes = primitives();
  const roles = themeRoles();
  const offenders = [];
  for (const step of [1, 2, 3, 4, 5]) {
    for (const mode of ['light', 'dark']) {
      const surface = resolve2(roles, hexes, `--sf-elevation-${step}--surface`, mode);
      const dimmed = contrast(resolve2(roles, hexes, `--sf-on-elevation-${step}--variant`, mode), surface);
      const primary = contrast(resolve2(roles, hexes, '--sf-on-surface', mode), surface);
      // Without a gap the two roles say the same thing and the hierarchy is gone.
      if (primary / dimmed < 1.2) offenders.push(`${mode} step ${step}: ${(primary / dimmed).toFixed(2)}x`);
    }
  }
  assert.deepEqual(offenders, [], 'a dimmed role that reads like the primary one is not dimmed');
});

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (entry.name.endsWith('.scss')) found.push(path);
    }
  };
  walk('src/component');
  walk('src/smart');
  walk('src/utility');
  return found;
};

test('whatever paints itself with a raised surface carries the matching text role', () => {
  const offenders = [];
  for (const path of styleFiles()) {
    const lines = read(path).split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/--sf-elevation-([0-9])--surface/u);
      if (!match) return;
      const near = lines.slice(Math.max(0, index - 3), index + 4).join('\n');
      if (!near.includes(`--sf-on-elevation-${match[1]}--variant`)) {
        offenders.push(`${path}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    'a surface without its text role leaves the dimmed text at the page value');
});
