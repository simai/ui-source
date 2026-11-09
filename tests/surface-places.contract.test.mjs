import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The places of the background system (C16, 2026-11-08). Glass over media is
// a place: it re-declares the roles that things on it read, so a control on a
// photo needs no new role. Coloured places are the bg-<role> and
// bg-<role>-container utilities (owner, 2026-11-08); no .sf-surface-<colour>
// class exists. An opaque place takes the theme's roles back.

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

test('no coloured-place class is declared: the bg- utilities are the places', () => {
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

const mix = read('src/core/scss/mix/_mix__places.scss');
const utility = read('src/utility/background-color/default/scss/_sf_css__background_color.scss');
const COLOURS = ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error'];

test("an opaque place takes back exactly the theme's values", () => {
  const map = mix.slice(mix.indexOf('$sf-place-theme-roles: ('), mix.indexOf(');', mix.indexOf('$sf-place-theme-roles: (')));
  const entries = [...map.matchAll(/'([a-z0-9-]+)': '([^']+)'/gu)];
  assert.ok(entries.length >= 12, `${entries.length} roles read`);
  const wrong = [];
  for (const [, role, value] of entries) {
    const themed = (theme.match(new RegExp(`\\s--sf-${role}: ([^;]+);`, 'u')) ?? [])[1];
    if (themed !== value) wrong.push(`${role}: place ${value}, theme ${themed}`);
  }
  assert.deepEqual(wrong, [], 'the reset repeats the theme, or a card on a banner is a different card');
  // Every role a coloured place re-declares is one an opaque place takes back.
  const strong = mix.slice(mix.indexOf('@mixin sf-place-strong'));
  const set = new Set(entries.map(([, role]) => role));
  const missed = [...strong.matchAll(/--sf-([a-z0-9-]+):/gu)].map(([, role]) => role).filter((role) => role !== 'surface-place' && !set.has(role));
  assert.deepEqual(missed, []);
});

test('bg-<colour> and bg-<colour>-container are places for all seven colours, and set no text colour', () => {
  assert.match(mix, /\$sf-place-colours: \('primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error'\);/u);
  assert.match(utility, /@each \$c in places\.\$sf-place-colours \{\s*\.#\{\$infix\}bg-#\{\$c\} \{\s*@include places\.sf-place-strong\(\$c\);\s*\}\s*\.#\{\$infix\}bg-#\{\$c\}-container \{\s*@include places\.sf-place-soft\(\$c\);/u);
  for (const name of ['sf-place-strong', 'sf-place-soft']) {
    const body = mix.slice(mix.indexOf(`@mixin ${name}`), mix.indexOf('}', mix.indexOf(`@mixin ${name}`)));
    assert.doesNotMatch(body, /^\s*(color|background(-color)?):/mu, `${name} sets only variables`);
  }
  // The soft place reads the colour's own roles, which every colour has.
  for (const c of COLOURS) {
    for (const role of ['container', 'container-hover', 'container-active', 'state-hover', 'state-select', 'state-active', 'outline', 'container-strong']) {
      assert.match(theme, new RegExp(`--sf-${c}-${role}: light-dark\\(`, 'u'), `--sf-${c}-${role}`);
    }
    assert.match(theme, new RegExp(`--sf-on-${c}: light-dark\\(`, 'u'), `--sf-on-${c}`);
  }
  // hover: and active: only paint.
  assert.match(utility, /\.#\{\$event\}\\:bg-#\{\$bg-color-name\}:#\{\$event\} \{\s*background-color: [^;]+;\s*\}/u);
});

test('the popover, a sheet that is not Sass, writes the place out as the mixin does', () => {
  const popover = read('src/smart/popover/js/templates/default.css');
  const map = mix.slice(mix.indexOf('$sf-place-theme-roles: ('), mix.indexOf(');', mix.indexOf('$sf-place-theme-roles: (')));
  for (const [, role, value] of map.matchAll(/'([a-z0-9-]+)': '([^']+)'/gu)) {
    if (role === 'on-surface-variant') continue;
    assert.ok(popover.includes(`--sf-${role}: ${value};`), `popover --sf-${role}`);
  }
  assert.match(popover, /--sf-surface-place: var\(--sf-popover-background-color, var\(--sf-surface-popup\)\);/u);
  assert.match(popover, /--sf-on-surface-variant: var\(--sf-on-surface-popup-variant\);/u);
});
