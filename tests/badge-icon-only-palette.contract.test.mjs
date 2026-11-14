import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {OPTION_BADGE_HUES, OPTION_BADGE_PALETTE, nearestPaletteHue, optionBadgeProps} from '../src/smart/helpers/option-badge.js';

// Badges study 2026-11-14 (ui-control control/research/2026-11-14-badges.md)
// and owner decision C134:
//
//   C134  sf-badge compact (boolean)      -> icon-only (class sf-badge--icon-only)
//   BG-7  option colour from data          -> a static palette step, never the raw hex
//   BG-9  tight side room                  -> space steps (sheet; badge-side-room test)
//
// The rendering is probed on built bytes (probe.json p11-icon-only,
// p11-compact-alias); this file holds what the source promises.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const record = (id) => json('contracts/changes/journal.json').records.find((entry) => entry.id === id);

test('C134 sf-badge: icon-only replaces the boolean compact, a dated setting alias of the shim', () => {
  const component = json('src/smart/badge/component.json');
  assert.equal(component.version, '1.6.0');
  assert.ok(!('compact' in component.settings));
  assert.deepEqual({type: component.settings['icon-only'].type, default: component.settings['icon-only'].default}, {type: 'boolean', default: false});
  assert.doesNotMatch(component.settings['icon-only'].summary, /legacy name|compatibility alias|dated alias/iu, 'icon-only stays printable by the composition');
  const row = json('src/smart/badge/aliases.json').aliases.find((alias) => alias.from === 'compact');
  assert.deepEqual({to: row.to, kind: row.kind, since: row.since, remove_after: row.remove_after}, {to: 'icon-only', kind: 'setting', since: '2026-11-14', remove_after: '2027-01-01'});
  const template = read('src/smart/badge/js/templates/default.js');
  assert.match(template, /const isIconOnly = Boolean\(context\.iconOnly\) && /u);
  assert.match(template, /isIconOnly \? 'sf-badge--icon-only sf-badge--compact' : '',/u);
  assert.doesNotMatch(template, /context\.compact/u);
  const sheet = read('src/component/badges/scss/_css__badges.scss');
  assert.match(sheet, /\n\.sf-badge:is\(\.sf-badge--icon-only, \.sf-badge--compact\) \{/u, 'one class of specificity more than .sf-badge, as before');
  assert.doesNotMatch(sheet, /\.sf-badge\.sf-badge--compact/u);
  assert.equal(json('src/component/badges/passport.json').version, '1.8.0');
  assert.deepEqual(record('attribute-badge-compact-to-icon-only').items, [{component: 'sf-badge', from: 'compact', to: 'icon-only'}]);
  assert.equal(record('attribute-badge-compact-to-icon-only').remove_after, '2027-01-01');
  assert.deepEqual(record('class-badges-compact-to-icon-only').items, [{component: 'sf-badge', from: 'sf-badge--compact', to: 'sf-badge--icon-only'}]);
  // The Framework's own markup writes the new name.
  assert.match(read('src/smart/contents/js/templates/default.js'), / icon-only=\$\{!count && status \? '' : nothing\}/u);
  assert.doesNotMatch(read('src/smart/contents/js/templates/default.js'), / compact=\$\{/u);
});

test('BG-7: a hue table equal to the palette, tone 50 in OKLCH', () => {
  const palette = read('src/core/scss/_sf_static_palette.scss');
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  for (const [name, angle] of Object.entries(OPTION_BADGE_HUES)) {
    const hex = palette.match(new RegExp(`--sf-${name}-50: (#[0-9a-f]{6});`, 'u'))[1];
    const [r, g, b] = [1, 3, 5].map((at) => lin(parseInt(hex.slice(at, at + 2), 16)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const hue = ((Math.atan2(0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * 180) / Math.PI + 360) % 360;
    assert.ok(Math.abs(hue - angle) <= 0.6, `${name}: ${hue.toFixed(1)} vs ${angle}`);
    assert.equal(nearestPaletteHue(hex), name, `${name} tone 50 maps to itself`);
  }
  assert.equal(OPTION_BADGE_PALETTE.length, 16);
});

test('BG-7: a hex from data is drawn as a palette step; no raw colour reaches the style', () => {
  const cases = {'#ff0000': 'red', '#ff69b4': 'pink', '#e91e63': 'red', '#3f51b5': 'indigo', '#009688': 'teal', '#4caf50': 'green', '#2196f3': 'blue', '#ff9800': 'amber', '#9c27b0': 'purple', '#888': 'gray', '#ffffff': 'gray', '#000000': 'gray', '#00bcd4': 'cyan'};
  for (const [hex, hue] of Object.entries(cases)) {
    const props = optionBadgeProps({color: hex});
    assert.equal(props.scheme, 'neutral');
    // C140 (2): through the public variables, a palette step only.
    assert.equal(props.rootStyle, `--sf-badge-background-color: var(--sf-${hue}-50--alfa-24); --sf-badge-color: var(--sf-on-surface)`, hex);
    assert.doesNotMatch(props.rootStyle, /#[0-9a-f]{3,8}|color-mix|--sf-badge--/iu);
  }
  assert.equal(optionBadgeProps({color: 'Teal'}).rootStyle, '--sf-badge-background-color: var(--sf-teal-50--alfa-24); --sf-badge-color: var(--sf-on-surface)');
  assert.equal(optionBadgeProps({color: 'brown'}).rootStyle, '--sf-badge-background-color: var(--sf-brown-50--alfa-24); --sf-badge-color: var(--sf-on-surface)');
  assert.deepEqual(optionBadgeProps({color: 'danger'}), {scheme: 'error', rootStyle: ''});
  assert.deepEqual(optionBadgeProps({scheme: 'success'}), {scheme: 'success', rootStyle: ''});
  assert.deepEqual(optionBadgeProps({color: 'url(x)'}), {scheme: 'neutral', rootStyle: ''});
  assert.equal(json('src/core/passports/module.smart-helpers.json').version, '1.7.0');
});
