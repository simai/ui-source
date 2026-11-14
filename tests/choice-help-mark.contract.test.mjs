// Checkbox, radio and switch: help is a real «?» (sf-help-mark) outside the
// control's activation; the name is the label text alone; position end; the
// radio icon beside the label is the line; the tag check is the tag's line
// (audit 2026-11-11, W1-W4, W8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const kind of ['checkbox', 'radio', 'switch']) {
  test(`${kind}: the help setting draws sf-help-mark, and the label keeps presses from the help`, async () => {
    const source = await read(`src/smart/${kind}/js/templates/default.js`);
    // The help, the text column and the row come from the shared base (C63 W9).
    const base = await read('src/smart/helpers/checkable-row.js');
    assert.match(base, /<sf-help-mark class=\$\{className\} size=\$\{CHECKABLE_HELP_SIZE\[context\.size\] \|\| '1\/3'\} text=\$\{context\.help\}/);
    assert.match(base, /CHECKABLE_HELP_SIZE = Object\.freeze\(\{'1\/2': '1\/3', 1: '1\/3', 2: '1\/2'\}\)/);
    assert.match(source, /renderCheckableHelp\(context, 'sf-[a-z-]+-help'\)/);
    assert.match(source, /return renderCheckableRow\(size, control, helpContent\);/);
    assert.match(source, /@click=\$\{keepHelpOutOfLabel\}/);
    assert.doesNotMatch(source, /aria-hidden="true"(?: icon="\$\{help\}"|>\$\{help\})/);
    const manifest = JSON.parse(await read(`src/smart/${kind}/component.json`));
    assert.equal(manifest.settings.help.type, 'string');
    assert.ok(manifest.relations.some((relation) => relation.name === 'cl-help-mark'));
    for (const lang of ['ru', 'en']) {
      assert.match(JSON.parse(await read(`src/smart/${kind}/lang/${lang}.json`)).runtime.help, /\{label\}/);
    }
  });
}

test('the helper names the input by the label text and cancels the label activation from the help', async () => {
  const source = await read('src/component/checkable-text-helper.js');
  assert.match(source, /export function keepHelpOutOfLabel\(event\)/);
  assert.match(source, /closest\('sf-help-mark, \[slot="help"\]'\)/);
  assert.match(source, /text: '\.sf-checkbox-label, \[data-sf-checkbox-label\]'/);
  assert.match(source, /text: '\.sf-radio-button-text, \[data-sf-radio-label\]'/);
  assert.match(source, /root\.htmlFor = input\.id/);
});

test('position end grows the text column; the help stands above the hit area; no pressed paint from the help', async () => {
  const custom = await read('src/component/checkbox/scss/_custom__checkbox.scss');
  assert.match(custom, /\.sf-checkbox:has\(> \.sf-checkbox-box:last-child\) > \.sf-checkbox-container \{\s*flex: 1 1 auto;/);
  for (const path of ['src/component/checkbox/scss/_custom__checkbox.scss', 'src/component/radio/scss/_css_radio_custom.scss', 'src/component/switch/scss/_css_switch_custom.scss']) {
    assert.match(await read(path), /-top \.sf-help-mark \{\s*position: relative;\s*z-index: var\(--sf-z-index-1\);/);
  }
  const pressed = await read('src/component/checkbox/scss/_css__checkbox.scss');
  // Pressing paints no fill since C121 (CR-1): the two pressed rules left are
  // the label's ink, and they still leave a press on the help alone.
  assert.equal((pressed.match(/:active\):not\(:has\(sf-help-mark:active, \[slot="help"\]:active\)\)/g) || []).length, 2);
  assert.doesNotMatch(pressed, /:active\)[^{]*\.sf-checkbox-box \{/);
});

test('radio: an icon beside the label is the line of its size; tag check: a mark only when chosen (C145 (2))', async () => {
  const radio = await read('src/component/radio/scss/_css_radio.scss');
  for (const step of ['1\\/2', '1', '2']) {
    assert.ok(radio.includes(`.sf-radio-button.sf-radio-button--size-${step} > .sf-radio-button-container > .sf-radio-button-top > .sf-icon {\n  --sf-icon--font-size: var(--sf-text-height-${step});`));
  }
  const tags = await read('src/component/tags/scss/_css__tags.scss');
  // C145 (2): no square; the chosen tag's check mark is an icon, the picture
  // of the tag's size (tag - 8, C58), hidden until the tag is chosen.
  assert.match(tags, /\.sf-tag:not\(\.active\) \.sf-tag-check \{\s*display: none;/);
  assert.doesNotMatch(tags, /\.sf-tag \.sf-tag-check \{[^}]*border:/);
  assert.doesNotMatch(tags, /\.sf-tag \.sf-tag-check \{[^}]*--sf-icon-size-1/);
});
