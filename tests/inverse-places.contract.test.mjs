import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unfoldModes} from './support/paint-blocks.mjs';

// Inverse places (IP, 2026-11-14), after places states PS-A/PS-B and buttons
// on places. An inverse place (bg-surface-inverse, bg-surface-inverse-fixed)
// is the other theme: beside its accent, the status containers' ink, the link
// and the focus ring are the other theme's too (they read 1.14-1.70:1 and
// 1.01-2.93:1 there). The place keeps what it found, so an opaque place on it
// (a card, a popover's bubble) takes the theme's back. A filled neutral icon
// button labels its plate with the place's accent label where the place
// declares --sf-place--ink, as sf-button does (component.buttons 1.14.0).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const mix = unfoldModes(read('src/core/scss/mix/_mix__places.scss')); // C273: the paint mode blocks unfolded
const icon = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
const block = (source, head) => {
  const start = source.indexOf(head);
  assert.ok(start >= 0, `${head} is declared`);
  return source.slice(start, source.indexOf('\n}', start));
};
const ROLES = 'map.merge($sf-place-accent-roles, map.merge($sf-place-container-ink-roles, $sf-place-glass-link-roles))';

test('IP: an inverse place writes the other theme\'s status ink, link and ring on its children', () => {
  const accent = block(mix, '@mixin sf-place-inverse-accent(');
  assert.ok(accent.includes(`@each $role, $value in ${ROLES} {\n    --sf-#{$role}: #{sf-place-light-dark-half($value, $half)};`));
  assert.ok(accent.includes("$half: if($fixed, 'dark', 'swap');"), 'the fixed inverse takes the dark half');
  assert.ok(accent.includes('--sf-focus--color: var(--sf-focus);'), 'the ring colour follows --sf-focus');
});

test('IP: an inverse place keeps what it found, for an opaque place on it to take back', () => {
  const inverse = block(mix, '@mixin sf-place-inverse(');
  assert.ok(inverse.includes(`@each $role, $value in ${ROLES} {\n    --sf-place--outer-#{$role}: var(--sf-#{$role});`));
  assert.ok(inverse.includes('--sf-place--outer-focus--color: var(--sf-focus--color);'));
  // The take-back covers the inverse places: they are in the strong list.
  assert.ok(mix.includes("$sf-place-inverse-selectors: ('.bg-surface-inverse', '.bg-surface-inverse-fixed');"));
  assert.match(mix, /\$sf-place-strong-selectors: list\.join\(list\.join\(list\.join\(sf-place-selector-list\(\), sf-place-alert-bar-selectors\(\), \$separator: comma\),\n\s+\$sf-place-inverse-selectors/u);
});

test('IP: a filled neutral icon button reads the place accent label only where the place has an ink', () => {
  assert.ok(icon.includes('--sf-icon-button--on-place-ink: color-mix(in srgb, var(--sf-on-primary), var(--sf-place--ink) 0%);'));
  assert.ok(icon.includes('--sf-icon--color: var(--sf-icon-button-color, var(--sf-icon-button--on-place-ink, var(--sf-on-surface-inverse)));'));
  assert.ok(icon.includes('--sf-close-icon--background-color: var(--sf-icon-button-color, var(--sf-icon-button--on-place-ink, var(--sf-on-surface-inverse)));'));
  assert.doesNotMatch(icon, /var\(--sf-icon-button-color, var\(--sf-on-surface-inverse\)\)/u, 'no bare inverse ink left');
});

test('IP: an outline, ghost or link danger icon button writes the place ink, the hue elsewhere', () => {
  for (const hue of ['error', 'error-active']) {
    assert.ok(icon.includes(`--sf-icon--color: var(--sf-icon-button-color, var(--sf-place--ink, var(--sf-${hue})));`), hue);
    assert.ok(icon.includes(`--sf-close-icon--background-color: var(--sf-icon-button-color, var(--sf-place--ink, var(--sf-${hue})));`), hue);
  }
  assert.doesNotMatch(icon, /--sf-(?:icon--color|close-icon--background-color): var\(--sf-icon-button-color, var\(--sf-error(?:-active)?\)\);/u);
});
