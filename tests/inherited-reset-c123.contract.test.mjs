import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Owner decision C123 (variant A; R214; prototype prototypes/field-icon-actions.html) for the shared reset to the
// inherited value (src/smart/helpers/inherited-value.js): every field that draws it -- sf-input, sf-input-textarea,
// sf-dropdown, sf-input-color, sf-switch, sf-input-quantity -- draws the field layer's action, a glyph without a
// plate, not a link icon button. The browser probe tests/browser/inherited-reset-c123.browser.mjs measures it.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const helper = read('src/smart/helpers/inherited-value.js');
const sheet = read('src/smart/helpers/inherited-value.css');
const FIELDS = ['input', 'input-textarea', 'dropdown', 'input-color', 'switch', 'input-quantity'];
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is in the sheet`);
  return css.slice(at, css.indexOf('}', at));
};

test('(1) the reset is the field layer\'s action, its name unchanged', () => {
  assert.match(helper, /<button\s+type="button"\s+class="sf-field-action sf-field-reset"\s+data-inherited-reset\s+aria-label=\$\{component\.resetLabel\}\s+title=\$\{component\.resetLabel\}/u);
  assert.match(helper, /<i class="sf-icon" aria-hidden="true">restart_alt<\/i><\/button>/u);
  assert.doesNotMatch(helper, /sf-icon-button/u);
  assert.doesNotMatch(sheet, /\.sf-field-reset \{[^}]*--sf-icon-button--/u, 'no icon-button variables left for the reset');
});

test('(1) every field that draws it loads the field layer (component.inputs)', () => {
  for (const folder of FIELDS) {
    assert.match(read(`src/smart/${folder}/js/templates/default.js`), /renderInheritedSlot\(/u, folder);
    assert.match(read(`src/smart/${folder}/rule.js`), /\{ name: 'inputs' \}/u, `${folder} loads inputs`);
  }
});

test('(2) the glyph is the field\'s text line outside a box too; the hit area never under 24', () => {
  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) {
    const sizes = rule(sheet, `:is(.sf-textarea-inherited, .sf-switch-inherited, .sf-quantity-inherited).sf-field-inherited-slot--size-${size}`);
    assert.match(sizes, new RegExp(`--sf-field-action--glyph: var\\(--sf-text-height-${size.replace('\\', '\\\\')}\\);`, 'u'));
  }
  assert.match(rule(sheet, '.sf-textarea-inherited > .sf-field-action,\n  .sf-switch-inherited > .sf-field-action'), /--sf-field-action--hit-block: var\(--sf-field-action--hit-inline\);/u);
  // sf-input-quantity's own glyph rule gives the reset back the field action's ink and size.
  assert.match(rule(sheet, '.sf-quantity .sf-quantity-row > .sf-quantity-inherited.sf-field-inherited-slot > .sf-field-action.sf-field-reset .sf-icon'), /--sf-icon--color: var\(--sf-field-action--ink\);/u);
});

test('(6) half an inset from the value and to the next glyph; the last glyph on the inset', () => {
  // The value and pair steps are the field layer's (component.inputs field-action.scss, tests/field-action-gaps-c123.*):
  // the slot reads --sf-field-action--value-space and keeps no copy of the formulas.
  assert.doesNotMatch(sheet, /--sf-field-inherited-slot--value-space/u);
  assert.doesNotMatch(sheet, /\.sf-field-inherited-slot:has\(\+ \.sf-field-action/u);
  assert.equal(sheet.match(/--sf-(?:input|dropdown)-input--padding-inline-end: var\(--sf-field-action--value-space\);/gu)?.length, 2);
  assert.match(rule(sheet, '.sf-dropdown .sf-dropdown-field:has(> .sf-field-inherited-slot > .sf-field-action:not([hidden]))'), /--sf-dropdown-field--gap: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(rule(sheet, '.sf-dropdown .sf-dropdown-field:has(> .sf-field-inherited-slot) > button.sf-field-action:last-child'), /margin-inline-end: calc\(\(var\(--sf-field-action--glyph-size\) - var\(--sf-field-action--hit-inline\)\) \/ 2\);/u);
  assert.match(read('src/smart/input-color/js/templates/default.css'), /\.sf-color-frame:has\(> \.sf-field-action, > \.sf-field-inherited-slot > \.sf-field-action:not\(\[hidden\]\)\) \{/u);
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b/iu, 'no literal colours');
});

test('the versions move with the look', () => {
  // Group build 7: the C123 notes numbered above the released pair; later notes (input-color's C123 (3),
  // the textarea and switch patch without icon-buttons, quantity's C122 names) stand above them.
  // Group build 8: the current numbers moved on (RG-S2 and C201 on input, C209 on input-color, the GB8 patches of moved units).
  const want = {input: ['1.13.0', '1.15.2'], 'input-textarea': ['1.12.0', '1.13.2'], dropdown: ['1.16.0', '1.22.0'], 'input-color': ['1.13.0', '1.19.4'], switch: ['1.7.0', '1.9.3'], 'input-quantity': ['1.9.0', '1.12.2']}; // group build 10: the merged numbers // group build 9: the merged branches' numbers // C282: the language-file patch
  for (const [folder, [version, current]] of Object.entries(want)) {
    const component = JSON.parse(read(`src/smart/${folder}/component.json`));
    assert.equal(component.version, current, folder);
    const note = new RegExp(`^version ${version.replaceAll('.', '\\.')} \\(2026-11-15, owner decision C123`, 'u');
    assert.ok(component['x-decisions'].some((line) => note.test(line)), `${folder} ${version} note`);
  }
  assert.equal(JSON.parse(read('src/core/passports/module.smart-helpers.json')).version, '1.19.0'); // fix/larena-lf-data: moved on by the Larena LF items // 1.13.0: the anchored badge's .sf-dot (C185 (8)); 1.13.1 char-count (area E) // C282: 1.13.1 moved on by the language-file patch (Russian is a language file)
});
