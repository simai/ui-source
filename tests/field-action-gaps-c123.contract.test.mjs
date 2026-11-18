import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Owner decision C123 (6) (prototype prototypes/field-icon-actions.html): inside a field, value -> first glyph and
// glyph -> glyph are half the field's inset at every size. Where the 24 floor widens the hit area past the glyph
// plus half an inset (a 1/3 field, a 1/2 field in the compact density and on a phone) the shared field-action rules
// did not compensate: sf-input's clear and reveal stood 8 apart for 6, its value 7 from the glyph for 6, and
// sf-input-lookup's value a quarter inset plus the frame gap too far (12 for 8 at size 1). The compensation is the
// field layer's now (component.inputs, field-action.scss), for every action of every field; the copies in the
// inherited-value slot and sf-input-color are gone. Measured in control/evidence/2026-11-15-field-action-gaps-c123.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const layer = read('src/component/inputs/scss/_field-action.scss');
const inputs = read('src/component/inputs/scss/_css__inputs.scss');
const slot = read('src/smart/helpers/inherited-value.css');
const color = read('src/smart/input-color/js/templates/default.css');
const lookup = read('src/smart/input-lookup/scss/_smart__lookup.scss');

test('the field layer says the standout, the value step and the pair step once, on every frame', () => {
  assert.match(layer, /:is\(#\{\$fields\}\) \{\s+--sf-field-action--standout: calc\(\(max\(var\(--sf-field-action--glyph, var\(--sf-text-height-1\)\) \+ var\(--sf-field-action--inset, var\(--sf-space-1\)\) \/ 2, var\(--sf-c2\)\) - var\(--sf-field-action--glyph, var\(--sf-text-height-1\)\)\) \/ 2\);/u);
  assert.match(layer, /--sf-field-action--value-space: calc\(var\(--sf-field-action--inset, var\(--sf-space-1\)\) \/ 2 - var\(--sf-field-action--standout\)\);/u);
  assert.match(layer, /--sf-field-action--pair-space: calc\(var\(--sf-field-action--inset, var\(--sf-space-1\)\) \/ 2 - 2 \* var\(--sf-field-action--standout\)\);/u);
});

test('an action after another action of the frame stands the pair step from it, in the frame or in a child of it', () => {
  assert.match(layer, /\$action: '\.sf-field-action:not\(\[hidden\]\)';/u);
  assert.match(layer, /:is\(#\{\$fields\}\) > :is\(#\{\$action\}, :has\(#\{\$action\}\)\) ~ #\{\$action\},\s+:is\(#\{\$fields\}\) > :is\(#\{\$action\}, :has\(#\{\$action\}\)\) ~ \* #\{\$action\} \{\s+margin-inline-start: var\(--sf-field-action--pair-space\);/u);
  // a list of frames stays one selector list: every use of $fields is wrapped in :is()
  assert.doesNotMatch(layer.replace(/:is\(#\{\$fields\}\)/gu, ''), /#\{\$fields\}/u);
});

test('the fields read the value step: sf-input, the slot, the colour frame, the lookup', () => {
  assert.match(inputs, /@include field-action\.rules\('\.sf-input-field, \.sf-color-frame'\);/u);
  assert.match(inputs, /input:has\(\+ :is\(\.sf-field-action, :is\(sf-button-copy, sf-copy-button\)\)\) \{\s+--sf-input-input--padding-inline-end: var\(--sf-field-action--value-space\);/u);
  assert.doesNotMatch(inputs, /--sf-field-action--inset\) \/ 4/u);
  assert.doesNotMatch(slot, /--sf-field-inherited-slot--value-space|max\(var\(--sf-field-action--glyph\)/u);
  assert.match(color, /gap: var\(--sf-field-action--value-space\);/u);
  assert.doesNotMatch(color, /max\(var\(--sf-field-action--glyph\)/u);
  assert.match(lookup, /--sf-lookup--column-gap: var\(--sf-space-1\\\/4\);\s+gap: var\(--sf-lookup--chip-row-gap\) var\(--sf-lookup--column-gap\);/u);
  assert.match(lookup, /\.sf-lookup-input:has\(\+ \.sf-field-action\) \{\s+padding-inline-end: var\(--sf-field-action--value-space\);/u);
  assert.match(lookup, /\.sf-lookup-input \+ \.sf-field-action \{\s+margin-inline-start: calc\(-1 \* var\(--sf-lookup--column-gap\)\);/u);
});

test('the versions', () => {
  assert.equal(json('src/component/inputs/passport.json').version, '1.12.1'); // 1.9.0: the script's layout in the sheet (RG-B-53); 1.11.1: a measured-false hint removed (queue item 198), above 1.11.0 on fix/fields-c224-c227 // group build 10: 1.11.1 moved on by the merged branches or a GB10 patch // group build 11: 1.12.0 moved on by the merged branches or a GB11 merge (fix/c178-findings)
  assert.equal(json('src/core/passports/module.smart-helpers.json').version, '1.19.0'); // fix/larena-lf-data: moved on by the Larena LF items // 1.13.0: the anchored badge's .sf-dot (C185 (8)) // group build 9: 1.13.0 moved on by the merged branches or a GB9 patch // C282: 1.13.1 moved on by the language-file patch (Russian is a language file)
  // input-color moved on to 1.13.0 (fix/field-action-gaps-2-c123); its 1.12.1 note stays.
  // Group build 7: the notes numbered above the released pair (1.12.1 -> 1.13.1, 1.13.2 -> 1.15.1).
  for (const [folder, version, current] of [['input-color', '1.13.1', '1.19.4'], ['input-lookup', '1.15.1', '1.17.3']] /* group build 9: input-color 1.18.1 */) {
    const component = json(`src/smart/${folder}/component.json`);
    assert.equal(component.version, current, folder);
    const note = new RegExp(`^version ${version.replaceAll('.', '\\.')} \\(2026-11-15, owner decision C123 \\(6\\)`, 'u');
    assert.ok(component['x-decisions'].some((line) => note.test(line)), `${folder} ${version} note`);
  }
});
