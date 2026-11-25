import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// The SIMAI Framework side of the owner's remarks on the View list (ui-control
// control/standards/view-list-register.json, 2026-11-22): VL-43 the filter
// window's condition head paler than the chip, VL-54 a row's badge the row's
// text, VL-65 the words of a value not set paler than the label (C402).
// VL-45 (the footer's inset, C397 PH-9) is held by filter-window-c397.

const theme = read('src/core/scss/_sf_css__theme.scss');
const role = (name) => (theme.match(new RegExp(`\\s--sf-${name}: ([^;]+);`, 'u')) ?? [])[1] ?? null;

test('VL-43: the quiet plate is the state family\'s 8, under the control plate', () => {
  assert.equal(role('surface-container-low'), 'light-dark(var(--sf-neutral-50--alfa-8), var(--sf-neutral-90--alfa-8))');
  assert.equal(role('surface-container'), 'light-dark(var(--sf-neutral-50--alfa-12), var(--sf-neutral-90--alfa-12))');
});

test('VL-43: the band of sf-dropdown lays the quiet plate, a page still tints it', () => {
  const css = read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(css, /--sf-dropdown-field--background-color: var\(--sf-dropdown-background-color, var\(--sf-surface-container-low\)\);/u);
  assert.equal(json('src/smart/dropdown/component.json').version, '1.25.3'); // GB17: fields F4 joined, 1.25.3; // group build 17: VL-43 and DSA-2 both wrote 1.25.1
});

test('VL-65: the not-set ink is the text ink at the ink family\'s 64, and every place says it', () => {
  assert.equal(role('on-surface-not-set'), 'light-dark(var(--sf-neutral-10--alfa-64), var(--sf-neutral-90--alfa-64))');
  const palette = read('src/core/scss/_sf_figma_colors_variables.scss');
  assert.match(palette, /--sf-neutral-10--alfa-64: #1a1b1fa3;/u);
  assert.match(palette, /--sf-neutral-90--alfa-64: #e3e2e7a3;/u);
  const mix = read('src/core/scss/mix/_mix__places.scss');
  assert.match(mix, /'on-surface-not-set': 'light-dark\(var\(--sf-neutral-10--alfa-64\), var\(--sf-neutral-90--alfa-64\)\)',/u);
  const strong = mix.slice(mix.indexOf('@mixin sf-place-strong('));
  assert.match(strong, /--sf-on-surface-not-set: #\{sf-ink\(\$c, 80\)\};/u, 'a strong colour: the place\'s dim ink');
  assert.match(read('src/core/scss/_sf_css__surface_places.scss'), /--sf-on-surface-not-set: var\(--sf-white--alfa-80\);/u, 'glass: white at 80');
  assert.match(read('src/smart/popover/js/templates/default.css'), /--sf-on-surface-not-set: light-dark\(var\(--sf-neutral-10--alfa-64\), var\(--sf-neutral-90--alfa-64\)\);/u);
});

test('VL-65: the not-set ink holds 4.5:1 and stays paler than the label on the neutral surfaces', () => {
  const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (ink, alpha, bg) => ink.map((v, k) => Math.round(v * alpha + bg[k] * (1 - alpha)));
  const N = {100: '#ffffff', 98: '#faf9fe', 95: '#f1f0f6', 90: '#e3e2e7', 80: '#c6c6cb', 70: '#ababb0', 40: '#5d5e63', 25: '#3a3b40', 20: '#2f3035', 15: '#24262a', 10: '#1a1b1f', 5: '#0f1115'};
  // light: page, area, surface-2 with the label --sf-on-surface-variant (40)
  for (const s of [100, 98, 95]) {
    const bg = rgb(N[s]);
    const notSet = ratio(over(rgb(N[10]), 0.64, bg), bg);
    assert.ok(notSet >= 4.5, `light on ${s}: ${notSet.toFixed(2)}`);
    assert.ok(notSet < ratio(rgb(N[40]), bg), `light on ${s}: paler than the label`);
  }
  // dark: page, area, surface-2, surface-3, the popup's step (the popup's label is 80)
  for (const [s, label] of [[5, 70], [10, 70], [15, 70], [20, 70], [25, 80]]) {
    const bg = rgb(N[s]);
    const notSet = ratio(over(rgb(N[90]), 0.64, bg), bg);
    assert.ok(notSet >= 4.5, `dark on ${s}: ${notSet.toFixed(2)}`);
    assert.ok(notSet < ratio(rgb(N[label]), bg), `dark on ${s}: paler than the label`);
  }
});

test('VL-65: sf-list-description draws the words of an empty value in the not-set ink', () => {
  const css = read('src/smart/list-description/scss/_smart__list-description.scss');
  assert.match(css, /\.sf-list-description-empty \{\s*color: var\(--sf-on-surface-not-set\);\s*\}/u);
  assert.equal(json('src/smart/list-description/component.json').version, '1.4.1');
});

test('VL-54: a cell\'s badge stands on the line of the row\'s text and keeps a word\'s room', () => {
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /const CELL_BADGE_LINE = 'text';/u);
  assert.match(source, /const CELL_BADGE_ROOM = '--sf-badge-padding-inline: var\(--sf-space-1\\\\\/2\)';/u);
  const choice = source.slice(source.indexOf('function renderChoiceCell('), source.indexOf('function renderHostFormattedCell('));
  assert.match(choice, /line: CELL_BADGE_LINE,/u);
  assert.match(choice, /rootStyle: CELL_BADGE_ROOM,/u); // GB17: the hue is the badge's setting (C411), the cell keeps only the word's room
  const badges = source.slice(source.indexOf('function renderChoicesBadgesCell('), source.indexOf('function renderChoicesBadgesCell(') + 1600);
  assert.match(badges, /line: CELL_BADGE_LINE,/u);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.2') // GB19 B: include view owns no lit DOM // GB18 L6; // GB17: FS-9 joined; gb17-fields F4 joined
});
