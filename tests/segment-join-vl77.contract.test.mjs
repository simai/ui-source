import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Owner remark VL-77 (2026-11-24): the line between two joined parts of a
// split control was white at 24 on every fill -- seen on the dark fills, lost
// on the light ones. The line is the label ink of the look at the quiet
// line's step (24); an icon ghost segment draws the group's outline as a
// ghost button does. tests/browser/segment-join-contrast.browser.mjs measures it.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const buttons = read('src/component/buttons/scss/_css__buttons.scss');
const icons = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
const iconsCustom = read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss');

test('a join is the look\'s label ink at 24, not white', () => {
  assert.match(buttons, /\.sf-button:not\(\.sf-button--outline\):is\(\.segment-start, \.segment-middle\) \{\s*border-inline-end-color: color-mix\(in srgb, var\(--sf-button--join-ink, currentColor\) 24%, transparent\);/u);
  assert.match(icons, /\.sf-icon-button:not\(\.sf-icon-button--outline\):is\(\.segment-start, \.segment-middle\) \{\s*border-inline-end-color: color-mix\(in srgb, var\(--sf-icon-button--join-ink, currentColor\) 24%, transparent\);/u);
  for (const sheet of [buttons, icons]) assert.doesNotMatch(sheet, /segment-middle\) \{\s*border-inline-end-color: var\(--sf-white--alfa-24/u);
});

test('each filled look names its label role as the join ink', () => {
  for (const role of ['--sf-on-primary', '--sf-on-surface-inverse', '--sf-on-primary-container', '--sf-on-surface', '--sf-on-error', '--sf-on-error-container']) {
    assert.ok(buttons.includes(`--sf-button--join-ink: var(--sf-button-color, var(${role}`) || buttons.includes(`--sf-button--join-ink: var(--sf-button-color, var(--sf-button--on-place-ink, var(${role}`), `sf-button: ${role}`);
    assert.ok(icons.includes(`--sf-icon-button--join-ink: var(--sf-icon-button-color, var(${role}`) || icons.includes(`--sf-icon-button--join-ink: var(--sf-icon-button-color, var(--sf-icon-button--on-place-ink, var(${role}`), `sf-icon-button: ${role}`);
  }
  assert.ok(buttons.includes('--sf-button--join-ink: var(--sf-on-surface-disabled);'));
  assert.ok(icons.includes('--sf-icon-button--join-ink: var(--sf-on-surface-disabled);'));
});

test('an icon ghost segment draws the group outline, as a ghost button segment does', () => {
  assert.match(iconsCustom, /\.sf-icon-button:is\(\.sf-icon-button--ghost, \.sf-icon-button--link\)\[class\*="segment-"\] \{\s*border-color: var\(--sf-outline\);/u);
  assert.match(iconsCustom, /\.sf-icon-button:is\(\.sf-icon-button--ghost, \.sf-icon-button--link\)\.segment-start \{\s*--sf-icon-button--border-inline-start-width: var\(--sf-px\);/u);
});

test('versions', () => {
  assert.equal(JSON.parse(read('src/component/buttons/passport.json')).version, '1.22.5');
  assert.equal(JSON.parse(read('src/component/icon-buttons/passport.json')).version, '1.21.0'); // GB21 A: rail name tooltip // GB19 integration: 1.20.3 (VL-77) moved on by touch size (1.20.4)
});
