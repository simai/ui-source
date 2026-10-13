import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = file => readFile(new URL(`../src/component/${file}`, import.meta.url), 'utf8');
for (const [kind, file] of [['inputs','_css__inputs.scss'], ['textarea','_css__textarea.scss'], ['quantity','_css__quantity.scss']]) {
  test(`${kind}: focus-visible and system outline are independent of validation`, async () => {
    const css = await source(`${kind}/scss/${file}`);
    assert.doesNotMatch(css, /:focus(?![\w-])/);
    assert.match(css, /:focus-visible/);
    assert.doesNotMatch(css, /[^{}]*:not\(\.error\)[^{}]*:focus-visible/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
    assert.match(css, /outline:\s*var\(--sf-focus-outline-width\) solid currentColor/);
  });
}
test('Quantity button focus stays inside joined controls; shadow is never a background', async () => {
  const css = await source('quantity/scss/_css__quantity.scss');
  assert.doesNotMatch(css, /--background-color:\s*var\(--sf-ui-focus\)/);
  // The step button brings its own ring; inside the field it only turns inwards.
  assert.match(css, /\.sf-quantity:not\(\.sf-quantity--pointer-focus\) \.sf-icon-button\.sf-quantity-count:not\(:disabled\):focus-visible\s*\{\s*outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
});
