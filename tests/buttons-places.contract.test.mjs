import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Buttons on places (component.buttons 1.14.0, 2026-11-14), after places states
// PS-A/PS-B. A strong coloured place, the duo gradient, glass and an inverse
// place declare their ink as --sf-place--ink; the page does not, and an opaque
// place takes it back (initial). What a button writes in a hue, or in the
// theme's inverse ink, follows that hook there and keeps its own value elsewhere.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(resolve(root, 'src/component/buttons/scss/_css__buttons.scss'), 'utf8');
const custom = readFileSync(resolve(root, 'src/component/buttons/scss/_css__buttons_custom.scss'), 'utf8');

test('a filled on-surface button labels its plate with the place accent label only where the place has an ink', () => {
  assert.ok(main.includes('--sf-button--on-place-ink: color-mix(in srgb, var(--sf-on-primary), var(--sf-place--ink) 0%);'),
    'the gate: invalid, so the fallback, wherever --sf-place--ink is not declared');
  assert.ok(main.includes('--sf-button-text-container--color: var(--sf-button-color, var(--sf-button--on-place-ink, var(--sf-on-surface-inverse)));'));
  assert.ok(main.includes('--sf-icon--color: var(--sf-button--on-place-ink, var(--sf-on-surface-inverse));'));
  assert.ok(main.includes('--sf-button--focus-ink: var(--sf-button--on-place-ink, var(--sf-on-surface-inverse, var(--sf-surface-page)));'));
});

test('outline, surface and ghost secondary and danger write the place ink, the hue elsewhere, in every state', () => {
  for (const hue of ['secondary', 'secondary-hover', 'secondary-active']) {
    assert.match(custom, new RegExp(`--sf-icon--color: var\\(--sf-place--ink, var\\(--sf-${hue}\\)\\);`, 'u'), hue);
  }
  assert.ok(custom.includes('--sf-button-text-container--color: var(--sf-button-color, var(--sf-place--ink, var(--sf-secondary)));'));
  assert.ok(main.includes('--sf-button-text-container--color: var(--sf-button-color, var(--sf-place--ink, var(--sf-error)));'));
  for (const hue of ['error-hover', 'error-active']) {
    assert.ok(main.includes(`--sf-button-text-container--color: var(--sf-place--ink, var(--sf-${hue}));`), hue);
    assert.ok(main.includes(`--sf-icon--color: var(--sf-place--ink, var(--sf-${hue}));`), hue);
  }
  // No bare hue left on these labels.
  assert.doesNotMatch(custom, /--sf-(?:button-text-container--|icon--)color: var\(--sf-secondary(?:-hover|-active)?\);/u);
  assert.doesNotMatch(main, /--sf-(?:button-text-container--|icon--)color: var\(--sf-error(?:-hover|-active)?\);/u);
});

test('a pressed filled secondary takes its own pressed step', () => {
  const rule = main.slice(main.indexOf('.sf-button.sf-button--default.sf-button--secondary:not(:disabled):not(.disabled):active, .sf-button.sf-button--default.sf-button--secondary:not(:disabled):not(.disabled).active {'));
  assert.match(rule.slice(0, rule.indexOf('}')), /--sf-button--background-color: var\(--sf-secondary-active\);/u);
  const primary = main.slice(main.indexOf('.sf-button.sf-button--default.sf-button--primary:not(:disabled):not(.disabled):active'));
  assert.ok(!primary.slice(0, primary.indexOf('{')).includes('secondary'), 'primary\'s pressed rule no longer names secondary');
});
