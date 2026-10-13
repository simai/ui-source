import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = async (path) => withoutPublicVariables(await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8'));
const SIZES = ['1\\/2', '1', '2'];

/* Form fields stand in one column of a form, so their parts sit on the same
   axes and take the same rung. Measured before: a text field's leading icon
   was 24px at every size and on mobile, its label 4px further right than a
   dropdown's after a picture; a textarea started its text 8px left of a text
   field's; a dropdown stood 8px under its label where other fields stand 4px;
   a phone list's rows were 4px shorter than the field at sizes 1 and 2 and its
   flags 24x16 at every size. tests/browser/field-composition.cli.js measures
   the result. */
test('field composition: a text field gives up the border and puts its icon on the line', async () => {
  const css = await read('component/inputs/scss/_css__inputs.scss');
  for (const size of SIZES) {
    assert.ok(css.includes(`--sf-input-field--padding-top: calc(var(--sf-ui-${size}--space-y-tightness-default) - var(--sf-px));`), size);
    assert.ok(css.includes(`.sf-input.sf-input--size-${size} > .sf-input-field > .sf-input-left .sf-icon, .sf-input.sf-input--size-${size} > .sf-input-field > .sf-icon {\n    --sf-icon--font-size: var(--sf-text-height-${size});`), `icon ${size}`);
  }
});

test('field composition: a textarea starts its text where a text field does', async () => {
  const css = await read('component/textarea/scss/_css__textarea.scss');
  for (const size of SIZES) {
    assert.ok(css.includes(`--sf-textarea-textarea--padding-inline-start: calc(var(--sf-ui-${size}--space-x) + var(--sf-ui-${size}--text-space-x));`), size);
  }
});

test('field composition: a dropdown label is a flex row like every field label', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  assert.match(css, /\.sf-dropdown \.sf-dropdown-label \{\s*display: flex;\s*\}/);
});

test('field composition: the country list is its field\'s list', async () => {
  const css = await read('component/country-code/scss/_css_country_code_custom.scss');
  const states = css.slice(css.indexOf('@layer sf.states {\n/* The country list'));
  for (const size of SIZES) {
    assert.ok(states.includes(`--sf-country-code-item--padding-top: var(--sf-ui-${size}--space-y-tightness-default);`), size);
    assert.ok(states.includes(`--sf-country-code-item--padding-inline-start: calc(var(--sf-ui-${size}--space-x) + var(--sf-px) - var(--sf-country-code-list--padding-inline-start, 0px));`), size);
    assert.ok(states.includes(`--sf-country-code-flag--height: calc(var(--sf-text-height-${size}) * 3 / 4);`), size);
  }
});
