import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* WCAG 2.2, 2.5.8: a target is at least 24px on each axis. A size 1 mark is
   20px on mobile and a size 1/2 mark 16, so the native control, which is the
   hit area, reaches past the mark. Measured on the table at 390px before the
   fix: a row tick 22x20, the head tick 20x20, resting on the spacing exception. */
const GROW = 'inset: min(0px, calc((100% - var(--sf-c2)) / 2)) min(0px, calc((100% - var(--sf-c2)) / 2));';

test('control targets: checkbox, radio and switch reach 24px around a smaller mark', async () => {
  for (const [path, selector] of [
    ['component/checkbox/scss/_custom__checkbox.scss', ".sf-checkbox-box > input[type='checkbox'] {"],
    ['component/radio/scss/_css_radio_custom.scss', ".sf-radio-button .sf-radio-button-box > input[type='radio'] {"],
    ['component/switch/scss/_css_switch_custom.scss', ".sf-switch .sf-switch-toggler input[type='checkbox'] {"],
  ]) {
    const css = await read(path);
    const start = css.indexOf(selector);
    assert.ok(start >= 0, path);
    const rule = css.slice(start, css.indexOf('}', start));
    assert.ok(rule.includes(GROW), path);
    assert.match(rule, /position: absolute;/, path);
    // a native control may carry its own size, so the hit area states one
    assert.match(rule, /inline-size: max\(100%, var\(--sf-c2\)\);/, path);
    assert.match(rule, /block-size: max\(100%, var\(--sf-c2\)\);/, path);
  }
});

/* A phone field was 2px taller than the field beside it at every size. It now
   follows the composition standard: the control height outright, the padding
   giving up the border, the chevron on the whole line and the flag at three
   quarters of it, 1.4 times as wide, like a dropdown's flag. */
test('control targets: the country code field follows the ladder', async () => {
  const css = await read('component/country-code/scss/_css_country_code.scss');
  const custom = await read('component/country-code/scss/_css_country_code_custom.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(css.includes(`--sf-country-code-flag-icon--height: calc(var(--sf-text-height-${size}) * 3 / 4);`), size);
    assert.ok(css.includes(`--sf-country-code-flag-icon--width: calc(var(--sf-text-height-${size}) * 3 / 4 * 1.4);`), size);
    assert.ok(css.includes(`--sf-country-code-field--padding-top: calc(var(--sf-ui-${size}--space-y-tightness-default) - var(--sf-px));`), size);
    assert.ok(custom.includes(`.sf-country-code.sf-country-code--size-${size} .sf-country-code-field {\n  block-size: var(--sf-ui-${size}--control-height);`), `field ${size}`);
    assert.ok(custom.includes(`.sf-country-code.sf-country-code--size-${size} .sf-country-code-left .sf-icon {\n  --sf-icon--font-size: var(--sf-text-height-${size});`), size);
  }
});

/* Colour and avatar options are as tall as text options of their size. */
test('control targets: colour and avatar options keep the row of their list', async () => {
  const css = await read('component/dropdown/scss/_css__list-item.scss');
  const states = css.slice(css.indexOf('@layer sf.states {\n/* A colour option'));
  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(states.includes(`.sf-list-item.sf-list-item--color.sf-list-item--size-${size} .sf-tag.sf-tag {`), `colour ${size}`);
    assert.ok(states.includes(`.sf-list-item.sf-list-item--color.sf-list-item--size-${size} {\n  --sf-list-item--padding-bottom: var(--sf-ui-${size}--space-y-tightness-default);`), `colour row ${size}`);
    assert.ok(css.includes(`.sf-list-item.sf-list-item--avatar.sf-list-item--size-${size} .sf-avatar {\n  --sf-avatar--height: var(--sf-text-height-${size});`), `avatar ${size}`);
  }
});
