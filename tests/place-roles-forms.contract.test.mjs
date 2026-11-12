import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Place roles found by the form backgrounds study (DEV 2026-11-10,
// control/research/2026-11-10-form-backgrounds-grouping.md) and the filled
// field's bottom line (C52, owner 2026-11-10, with C41's 8 % fill):
// - the inverse places re-declare the place roles, the other theme's
//   (a field's label on bg-surface-inverse measured 1.31 light, 1.00 dark);
// - the grey plate (bg-surface-container) takes the light grey steps'
//   boundary (a bordered field's edge on it measured 2.90 light);
// - a filled field draws its bottom edge in --sf-outline at rest, and a
//   state that colours the border colours the line with it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const places = read('src/core/scss/mix/_mix__places.scss');
const utility = read('src/utility/background-color/default/scss/_sf_css__background_color.scss');
const popover = read('src/smart/popover/js/templates/default.css');

test('the inverse places re-declare the place roles and the accent on their children', () => {
  assert.match(places, /@mixin sf-place-inverse\(\$surface, \$fixed: false\)/u);
  assert.match(places, /--sf-outline: light-dark\(var\(--sf-neutral-90--alfa-48\), var\(--sf-neutral-50\)\);/u);
  assert.match(places, /\$sf-place-inverse-selectors: \('\.bg-surface-inverse', '\.bg-surface-inverse-fixed'\);/u);
  assert.match(places, /\$sf-place-strong-selectors: list\.join\([^;]*\$sf-place-inverse-selectors/u);
  assert.match(utility, /\.#\{\$infix\}bg-surface-inverse \{\s*@include places\.sf-place-inverse\(var\(--sf-surface-inverse\)\);/u);
  assert.match(utility, /\.#\{\$infix\}bg-surface-inverse-fixed \{\s*@include places\.sf-place-inverse\(var\(--sf-surface-inverse-fixed\), true\);/u);
  assert.match(utility, /\.bg-surface-inverse > \* \{\s*@include places\.sf-place-inverse-accent;/u);
  assert.match(utility, /\.bg-surface-inverse-fixed > \* \{\s*@include places\.sf-place-inverse-accent\(true\);/u);
  // The accent is not re-declared where the outer accent is recorded.
  const mixin = places.slice(places.indexOf('@mixin sf-place-inverse('), places.indexOf('@mixin sf-place-inverse-accent'));
  assert.doesNotMatch(mixin, /--sf-#\{\$role\}: #\{sf-place-light-dark-half\(\$value, if/u);
  // The popover, a sheet that is not Sass, takes back on the inverse places too.
  assert.equal((popover.match(/\.bg-surface-inverse, \.bg-surface-inverse-fixed/gu) ?? []).length, 2);
});

test('the grey plate takes the boundary of the light grey steps', () => {
  assert.match(utility, /\.#\{\$infix\}bg-surface-container \{\s*--sf-on-surface-variant: var\(--sf-on-surface-container-variant\);\s*--sf-outline: #\{string\.unquote\(places\.\$sf-place-step-outline\)\};/u);
  assert.match(places, /\$sf-place-step-outline: 'light-dark\(var\(--sf-neutral-50\), var\(--sf-neutral-90--alfa-48\)\)';/u);
});

const FIELDS = [
  ['src/component/inputs/scss/_css__inputs.scss', '--sf-input-field--line-color', '--sf-input-field--border-color', '--sf-input-border-color', 2],
  ['src/component/textarea/scss/_css__textarea.scss', '--sf-textarea-textarea--line-color', '--sf-textarea-textarea--border-color', '--sf-textarea-border-color', 2],
  ['src/smart/input-lookup/scss/_smart__lookup.scss', '--sf-lookup--line-color', '--sf-lookup--border-color', '--sf-lookup-border-color', 1],
  ['src/smart/input-rich/scss/_smart__rich_text.scss', '--sf-rich-text--line-color', '--sf-rich-text--border-color', '--sf-rich-text-border-color', 1],
  // Every filled dropdown state that colours the border colours it --sf-outline.
  ['src/component/dropdown/scss/_css__dropdown.scss', '--sf-dropdown-field--line-color', '--sf-dropdown-field--border-color', '--sf-dropdown-border-color', 0],
];

test('a filled field draws its bottom line in --sf-outline at rest, and states take it with the border', () => {
  for (const [path, line, border, pub, states] of FIELDS) {
    const css = read(path);
    const esc = (s) => s;
    assert.match(css, new RegExp(`border-block-end-color: var\\(${esc(line)}, var\\(${esc(border)}, transparent\\)\\);`, 'u'), path);
    assert.match(css, new RegExp(`${esc(line)}: var\\(${esc(pub)}, var\\(--sf-outline\\)\\);`, 'u'), path);
    assert.equal((css.match(new RegExp(`${esc(line)}: var\\(${esc(border)}\\);`, 'gu')) ?? []).length, states, path);
  }
});
