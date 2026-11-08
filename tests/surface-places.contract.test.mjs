import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The places of the background system (C16, 2026-11-08). Glass over media is
// a place: it re-declares the roles that things on it read, so a control on a
// photo needs no new role. Coloured places are held for the owner's answer
// (the bg-<role> utilities as places); no .sf-surface-<colour> class exists.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const places = read('src/core/scss/_sf_css__surface_places.scss');
const theme = read('src/core/scss/_sf_css__theme.scss');
const rule = (selector) => places.match(new RegExp(`${selector.replace(/\./gu, '\\.')} \\{([^}]+)\\}`, 'u'))?.[1] ?? null;

// What a thing on a place reads. Old or new name, one of the pair.
const ROLES = [
  ['--sf-on-surface'],
  ['--sf-on-surface-variant'],
  ['--sf-on-surface-container--variant', '--sf-on-surface-container-variant'],
  ['--sf-surface-container'], ['--sf-surface-container-hover'], ['--sf-surface-container-active'],
  ['--sf-surface-transparent-hover', '--sf-surface-state-hover'],
  ['--sf-surface-transparent-select', '--sf-surface-state-select'],
  ['--sf-surface-transparent-active', '--sf-surface-state-active'],
  ['--sf-outline'], ['--sf-outline-variant'],
];

test('glass re-declares every role a control on it reads, from white', () => {
  const body = rule('.sf-surface-media');
  assert.ok(body, '.sf-surface-media is declared');
  const names = new Set([...body.matchAll(/(--sf-[a-z0-9-]+):/gu)].map(([, name]) => name));
  assert.deepEqual(ROLES.filter((pair) => !pair.some((name) => names.has(name))).map(([name]) => name), []);
  for (const [, name, value] of body.matchAll(/(--sf-[a-z0-9-]+):\s*([^;]+);/gu)) {
    if (/--alfa-/u.test(value)) assert.match(value, /^var\(--sf-white--alfa-\d+\)$/u, name);
  }
  assert.match(body, /background-color: var\(--sf-surface-media\);/u);
  assert.match(body, /backdrop-filter: blur\(var\(--sf-blur-large\)\);/u);
});

test('no coloured-place class is declared while the owner decides', () => {
  assert.doesNotMatch(places, /\.sf-surface-(primary|secondary|tertiary|error|warning|success|info)\b/u);
});

test('glass is black 48, 64, 80 under white ink in both themes, and the place defaults to the page', () => {
  const value = (role) => (theme.match(new RegExp(`${role}: ([^;]+);`, 'u')) ?? [])[1];
  assert.equal(value('--sf-surface-media'), 'var(--sf-black--alfa-48)');
  assert.equal(value('--sf-surface-media-hover'), 'var(--sf-black--alfa-64)');
  assert.equal(value('--sf-surface-media-active'), 'var(--sf-black--alfa-80)');
  assert.equal(value('--sf-on-surface-media'), 'var(--sf-white)');
  assert.match(value('--sf-surface-place'), /^var\(--sf-surface-(0|page)\)$/u);
});

test('information has the state layers every other status has', () => {
  for (const state of ['hover', 'select', 'active']) {
    assert.match(theme, new RegExp(`--sf-info-(transparent|state)-${state}: light-dark\\(`, 'u'), state);
  }
});
