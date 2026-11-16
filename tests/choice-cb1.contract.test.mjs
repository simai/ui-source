// The class choice controls after the DEV forms study (msg-87cd6785) and the
// owner decisions C221 and C222 (2026-11-16): RG-CB-1..4, RG-RB-1.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `rule ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

test('RG-CB-1: the class label hugs its content; the end position keeps the row', async () => {
  const cases = [
    ['src/component/checkbox/scss/_custom__checkbox.scss', '.sf-checkbox', '.sf-checkbox:has(> .sf-checkbox-container + .sf-checkbox-box:last-child)'],
    ['src/component/radio/scss/_css_radio_custom.scss', '.sf-radio-button', '.sf-radio-button:has(> .sf-radio-button-container + .sf-radio-button-box:last-child)'],
    ['src/component/switch/scss/_css_switch_custom.scss', '.sf-switch', '.sf-switch:has(> .sf-switch-container-wrap + .sf-switch-toggler:last-child)'],
  ];
  for (const [file, block, end] of cases) {
    const css = await source(file);
    assert.match(css, new RegExp(`\\n\\s*${block.replace('.', '\\.')} \\{\\s*inline-size: fit-content;\\s*max-inline-size: 100%;`), `${block} hugs its content`);
    assert.match(rule(css, end), /inline-size: auto;/, `${block} at the end keeps the row`);
  }
});

test('RG-CB-2: the checkbox label takes the text ink in every enabled state', async () => {
  const css = await source('src/component/checkbox/scss/_css__checkbox.scss');
  assert.match(css, /\.sf-checkbox \.sf-checkbox-label \{\s*--sf-checkbox-label--color: var\(--sf-on-surface\);\s*\}/);
  assert.doesNotMatch(css, /\.sf-checkbox:not\(\.error\):has\(input:not\(:checked\)\) \.sf-checkbox-label/);
});

test('RG-CB-3: the mark keeps the size of its box in error', async () => {
  const css = await source('src/component/checkbox/scss/_css__checkbox.scss');
  assert.doesNotMatch(css, /\.sf-checkbox:not\(\.error\)\.sf-checkbox--size-[^ ]*:has\(input[^)]*\) > \.sf-checkbox-box \.sf-icon/);
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(css.includes(`.sf-checkbox.sf-checkbox--size-${size}:has(input) > .sf-checkbox-box .sf-icon {`), `size ${size}`);
  }
});

test('RG-CB-4: hover marks the frame of an unchecked control only', async () => {
  const checkbox = await source('src/component/checkbox/scss/_css__checkbox.scss');
  assert.match(checkbox, /\.sf-checkbox:not\(\.error\):has\(input:enabled:not\(:disabled\):not\(\.disabled\):not\(:checked\):not\(:indeterminate\):hover\)/);
  assert.doesNotMatch(checkbox, /:has\(input:enabled:not\(:disabled\):not\(\.disabled\):hover\)[^{]*\.sf-checkbox-box \{/);
  const radio = await source('src/component/radio/scss/_css_radio.scss');
  assert.match(radio, /\.sf-radio-button:not\(\.error\):has\(input:enabled:not\(:disabled\):not\(\.disabled\):not\(:checked\):hover\)/);
});

test('C221, RG-RB-1: error outweighs checked and selected', async () => {
  const checkbox = await source('src/component/checkbox/scss/_css__checkbox.scss');
  const box = rule(checkbox, '.sf-checkbox.error:has(input:checked, input:indeterminate):not(:has(input:disabled)) .sf-checkbox-box');
  assert.match(box, /--sf-checkbox-box--background-color: var\(--sf-checkbox-invalid-border-color, var\(--sf-error\)\);/);
  assert.match(box, /--sf-checkbox-box--border-color: var\(--sf-checkbox-invalid-border-color, var\(--sf-error\)\);/);
  assert.match(rule(checkbox, '.sf-checkbox.error:has(input:checked, input:indeterminate):not(:has(input:disabled)) > .sf-checkbox-box .sf-icon'), /--sf-icon--color: var\(--sf-on-error\);/);
  const radio = await source('src/component/radio/scss/_css_radio.scss');
  assert.match(rule(radio, '.sf-radio-button.error:has(input:checked):not(:has(input:disabled)) .sf-radio-button-box'), /var\(--sf-error\)/);
  assert.match(rule(radio, '.sf-radio-button.error:has(input:checked):not(:has(input:disabled)) .sf-radio-button-mark'), /--sf-radio-button-mark--background-color: var\(--sf-radio-button-invalid-border-color, var\(--sf-error\)\);/);
  // The error rules come after the selected ones of the same layer.
  assert.ok(radio.indexOf('.sf-radio-button.error:has(input:checked)') > radio.indexOf('.sf-radio-button:has(input:checked):not(:has(input:disabled)) .sf-radio-button-mark'));
});

test('C222: font-sample tiles draw as plain radios with their labels, noted once', async () => {
  const runtime = await source('src/component/radio/js/_radio.js');
  assert.match(runtime, /function retireFontRadioWrap\(wrap\)/);
  assert.match(runtime, /target\.querySelectorAll\?\.\(RADIO_FONT_WRAP_SELECTOR\)\.forEach\(retireFontRadioWrap\)/);
  assert.match(runtime, /retireFontRadioWrap\(wrap\);\n\n    return wrap;/);
  assert.match(runtime, /noteDeprecated\(\{\s*component: 'sf-radio',\s*kind: 'class',\s*from: 'sf-radio-wrap--type-font',\s*to: 'sf-segmented'/);
  assert.match(runtime, /remove_after: RADIO_FONT_REMOVE_AFTER/);
  assert.match(runtime, /const RADIO_FONT_REMOVE_AFTER = '2027-01-01';/);
  assert.match(runtime, /__sfRadioFontWarned/);
  assert.match(runtime, /mark\.classList\.add\('sf-radio-button-mark'\)/);
  const css = await source('src/component/radio/scss/_css_radio_custom.scss');
  assert.match(rule(css, '.sf-radio-wrap--type-font[data-sf-radio-font-retired] > .sf-radio-group--font'), /flex-direction: column;/);
  const journal = JSON.parse(await source('contracts/changes/journal.json'));
  const entry = journal.records.find((item) => item.id === 'class-radio-type-font-to-segmented');
  assert.ok(entry, 'journal entry');
  assert.match(entry.summary, /C222/);
  assert.equal(entry.remove_after, '2027-01-01');
});
