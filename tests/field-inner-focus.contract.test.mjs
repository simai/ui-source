import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// A field that draws the focus ring on its wrapper gives the bare control's ring
// up. A page's unlayered `:focus-visible { outline }` beats every layered rule
// whatever its specificity, so a plain `outline: none` in sf.components or
// sf.states could not keep it off, and the page drew a second frame inside the
// field's (owner, 2026-11-01, sf-dropdown on effects.simai.io). An important
// declaration in a layer beats an unlayered one; measured on the built sheets
// with a page rule for every field below. The textarea is not here: its ring is
// drawn on the textarea itself, so a page rule replaces it and draws no second
// frame. The colour input is transparent, so an outline on it is not seen.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const RESETS = [
  ['src/component/dropdown/scss/_css__custom.scss', '.sf-dropdown .sf-dropdown-field > button[aria-haspopup]:focus-visible', 'outline: none !important;'],
  ['src/component/dropdown/scss/_css__custom.scss', '.sf-dropdown .sf-dropdown-field input:focus-visible', 'outline: none !important;'],
  ['src/component/inputs/scss/_css__inputs.scss', '.sf-input input:focus-visible', 'outline: none !important;'],
  ['src/component/country-code/scss/_css_country_code.scss', '.sf-country-code .sf-country-code-field input:focus-visible', 'outline: none !important;'],
  ['src/component/quantity/scss/_css__quantity.scss', '.sf-quantity input:focus-visible', 'outline: none !important;'],
  ['src/component/verification/scss/_css__verification.scss', '.sf-verification-input:focus', 'outline: 0 !important;'],
  ['src/smart/input-lookup/scss/_smart__lookup.scss', '.sf-lookup .sf-lookup-input:focus-visible', 'outline: none !important;'],
  ['src/smart/input-rich/scss/_smart__rich_text.scss', '.sf-rich-text .sf-rich-text-editor:focus-visible', 'outline: none !important;'],
];

test('a field that draws the ring keeps a page rule off the bare control', () => {
  for (const [path, selector, declaration] of RESETS) {
    const css = read(path);
    const at = css.indexOf(`${selector}`);
    assert.ok(at >= 0, `${path}: ${selector}`);
    const body = css.slice(css.indexOf('{', at), css.indexOf('}', at));
    assert.ok(body.includes(declaration), `${path}: ${selector} carries ${declaration}`);
  }
});

test('the wrapper still draws its own ring', () => {
  const rings = [
    ['src/component/dropdown/scss/_css__custom.scss', '.sf-dropdown .sf-dropdown-field:has(> [aria-haspopup]:focus-visible)'],
    ['src/component/inputs/scss/_css__inputs.scss', '.sf-input:not(.sf-input--pointer-focus):has(input:enabled:not(:disabled):not(.disabled):focus-visible) .sf-input-field'],
    ['src/component/country-code/scss/_css_country_code.scss', '.sf-country-code:has(input:enabled:not(:disabled):not(.disabled):focus-visible) .sf-country-code-field'],
    ['src/component/quantity/scss/_css__quantity.scss', '.sf-quantity:not(.sf-quantity--pointer-focus):has(input:not(:disabled):not(.disabled):focus-visible) .sf-quantity-wrap'],
    // The active cell's ring, not the row's (K1, owner R136).
    ['src/component/verification/scss/_css__verification.scss', '.sf-verification:not(.sf-verification--pointer-focus):has(.sf-verification-input:focus-visible) .sf-verification-cell.current'],
    ['src/smart/input-lookup/scss/_smart__lookup.scss', '.sf-lookup:not(.sf-lookup--pointer-focus):has(.sf-lookup-input:focus-visible) .sf-lookup-frame'],
    ['src/smart/input-rich/scss/_smart__rich_text.scss', '.sf-rich-text:not(.sf-rich-text--pointer-focus):has(.sf-rich-text-editor:focus-visible) .sf-rich-text-frame'],
  ];
  for (const [path, selector] of rings) {
    const css = read(path);
    const at = css.indexOf(selector);
    assert.ok(at >= 0, `${path}: ${selector}`);
    assert.match(css.slice(at, css.indexOf('}', at)), /outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/u, path);
  }
});
