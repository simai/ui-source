// The lookup study's defects against decisions already taken (DEV letter msg-e672713ece844a1f8a2f, research
// control/research/2026-11-14-lookup.md in ui-control): LS-1 chips on the C58 / C145 (1) rule, LS-2 the chip's
// avatar, LS-3 the remove target, LS-4 one row with «+N», LS-5 the search line after the spinner delay, LS-15 the
// search box never takes an empty row of its own, LS-16 one word and a line one row high. The drawn result is
// measured on a stand (evidence 2026-11-14-lookup-ls); this file pins the source so a merge cannot drop it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scss = read('src/smart/input-lookup/scss/_smart__lookup.scss');
const template = read('src/smart/input-lookup/js/templates/default.js');
const lookup = read('src/smart/input-lookup/index.js');
const manifest = JSON.parse(read('src/smart/input-lookup/component.json'));

test('LS-1: a chip is the field less --sf-space-1/4 above and below, 4 apart in a row and between rows', () => {
  assert.match(scss, /--sf-lookup--chip-height: calc\(var\(--sf-field-action--height\) - 2 \* var\(--sf-space-1\\\/4\)\);/u);
  assert.match(scss, /--sf-lookup--chip-row-gap: var\((?:--sf-space-1\\\/4|--sf-gap--tags)\);/u);
  assert.match(scss, /gap: var\(--sf-lookup--chip-row-gap\) var\(--sf-space-1\\\/4\);/u);
});

test('LS-2: the avatar in a chip is the chip less 8 and never under 16 (C145 (1), C132)', () => {
  assert.match(scss, /--sf-lookup--chip-avatar: max\(var\(--sf-b6\), calc\(var\(--sf-lookup--chip-height\) - 2 \* var\(--sf-space-1\\\/4\)\)\);/u);
  assert.match(scss, /--sf-avatar--height: var\(--sf-lookup--chip-avatar\);/u);
});

test('LS-3: the remove box is the chip high and up to --sf-c2 wide, so the target is at least 24', () => {
  assert.match(scss, /> \.sf-icon-button\.sf-icon-button--close \{\s*block-size: var\(--sf-lookup--chip-height\);\s*inline-size: min\(var\(--sf-lookup--chip-height\), var\(--sf-c2\)\);/u);
});

test('LS-4: chips="row" keeps one row and a «+N» chip; wrap stays the default', () => {
  assert.deepEqual(manifest.settings.chips.values, ['wrap', 'row']);
  assert.equal(manifest.settings.chips.default, 'wrap');
  assert.match(lookup, /getAttribute\('chips'\)/u);
  assert.match(template, /class="sf-lookup-more-chips"/u);
  assert.match(scss, /\.sf-lookup\.sf-lookup--chips-collapsed \.sf-lookup-frame \{\s*flex-wrap: nowrap;/u);
});

test('LS-5: the «Searching…» line waits the spinner delay (C130 (8), 1 s)', () => {
  assert.match(lookup, /export const SEARCH_LINE_DELAY = 1000;/u);
  assert.match(lookup, /\}, SEARCH_LINE_DELAY\);/u);
});

test('LS-15: the empty search box beside chips leaves the flow at rest', () => {
  assert.match(scss, /\.sf-lookup:has\(\.sf-lookup-chip\) \.sf-lookup-input:not\(\.sf-lookup-input--typed\):not\(:focus\) \{\s*position: absolute;/u);
});

test('LS-16: the spinner says its word to a screen reader only (C138), the line is one row high', () => {
  assert.match(template, /<sf-spinner class="sf-lookup-spinner[^"]*"[^>]* label-hidden aria-hidden="true"><\/sf-spinner>/u);
  assert.match(scss, /\.sf-lookup \.sf-lookup-state:has\(\.sf-lookup-state-text\) \{[^}]*min-block-size: var\(--sf-lookup--row-height\);/u);
});
