import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = file => readFile(new URL(`../src/component/${file}`, import.meta.url), 'utf8');
// C153 (4), R242 (2026-11-14): focus by mouse or keys draws one 2 px edge of the
// focus colour inside the field -- an outline at minus its width, so no ring
// outside a scrolling container cuts and nothing moves.
for (const [kind, file] of [['inputs','_css__inputs.scss'], ['textarea','_css__textarea.scss'], ['quantity','_css__quantity.scss']]) {
  test(`${kind}: focus-visible and system outline are independent of validation`, async () => {
    const css = await source(`${kind}/scss/${file}`);
    assert.match(css, /:focus\)[^{]*\{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--inset\);/);
    assert.match(css, /:focus-visible/);
    assert.doesNotMatch(css, /[^{}]*:not\(\.error\)[^{}]*:focus-visible/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
    assert.match(css, /outline:\s*var\(--sf-focus--width\) solid currentColor/);
  });
}
test('Quantity button focus stays inside joined controls; shadow is never a background', async () => {
  const css = await source('quantity/scss/_css__quantity.scss');
  assert.doesNotMatch(css, /--background-color:\s*var\(--sf-ui-focus\)/);
  // The step button brings its own ring; inside the field it only turns inwards.
  assert.match(css, /\.sf-quantity:not\(\.sf-quantity--pointer-focus\) \.sf-icon-button\.sf-quantity-count:not\(:disabled\):focus-visible\s*\{\s*outline-offset: var\(--sf-focus--inset\)/);
});
