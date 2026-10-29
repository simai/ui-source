import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The inherited-value state of the input family (simai/ui-source#28): a field
// whose empty value means «what the parent says» shows that value as inherited,
// keeps the form value empty, and offers a reset back to it. Written once in
// src/smart/helpers/inherited-value.js and opted into by each control; the
// browser probe tests/browser/inherited-value.browser.mjs drives it on the
// built bytes. This holds the seams that a probe cannot see break quietly.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const helper = read('src/smart/helpers/inherited-value.js');
const sheet = read('src/smart/helpers/inherited-value.css');

const CONTROLS = {
  input: {tag: 'sf-input', relation: /name: 'icon-buttons'/u},
  textarea: {tag: 'sf-textarea', relation: /name: 'icon-buttons'/u},
  dropdown: {tag: 'sf-dropdown', relation: /name: 'icon-buttons'/u},
  color: {tag: 'sf-color', relation: /name: 'cl-icon-button'/u},
  switch: {tag: 'sf-switch', relation: /name: 'icon-buttons'/u},
};

test('the shared state names one cancellable event and draws one slot', () => {
  // The field sends the trait's current name; the dated sf-field:reset
  // follows it from the shim (aliases.json rows, §16 item 20).
  assert.match(helper, /export const INHERITED_RESET_EVENT = 'sf-field-reset';/u);
  assert.match(helper, /new CustomEvent\(INHERITED_RESET_EVENT, \{[\s\S]*?bubbles: true,[\s\S]*?composed: true,[\s\S]*?cancelable: true/u);
  // The trait event names the element (standard 1.3.8 §20, field-inherit@1).
  assert.match(helper, /detail: \{\s*tag: this\.localName,\s*value: this\.inheritedOwnValue\(\),\s*inheritedValue: this\.inheritedValue,\s*name:/u);
  // Prevented, nothing changes; not prevented, the value empties and focus
  // goes back to the control rather than to the vanished button.
  assert.match(helper, /if \(!this\.dispatchEvent\(event\)\) return false;\s*this\.clearOwnValue\(\);/u);
  assert.match(helper, /this\.inheritedFocusTarget\(\)\?\.focus\?\.\(/u);
  // Announced: the control carries the value; the marker is not read twice.
  assert.match(helper, /setAttribute\('aria-description', this\.inheritedDescription\(\)\)/u);
  assert.match(helper, /data-inherited-marker\s+aria-hidden="true"/u);
  // The reset is a real button with a name, one step down the ladder.
  assert.match(helper, /<button\s+type="button"\s+class="sf-field-reset sf-icon-button[^"]*sf-icon-button--size-\$\{step\}"/u);
  assert.match(helper, /aria-label=\$\{component\.resetLabel\}/u);
  assert.match(helper, /STEP_DOWN = Object\.freeze\(\{'1\/2': '1\/3', '1': '1\/2', '2': '1'\}\)/u);
  // The words, in both shipped languages.
  assert.match(helper, /inherited: 'наследуется', reset: 'Сбросить к наследуемому'/u);
  assert.match(helper, /inherited: 'inherited', reset: 'Reset to inherited'/u);
});

test('the slot takes its sizes from the ladder and its ink from the roles', () => {
  // The sheet escapes a fractional size the way CSS does: size-1\/2.
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(sheet.includes(`.sf-field-inherited-slot--size-${size} {\n    --sf-field-inherited-slot--inset: calc((var(--sf-ui-${size}--control-height)`), size);
  }
  assert.match(sheet, /\.sf-field-inherited \{\s*color: var\(--sf-on-surface-variant\);/u);
  // The dropdown's chevron joins the row without growing the field.
  assert.match(sheet, /:has\(> \.sf-field-inherited-slot\) > button \{\s*position: static;/u);
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b/iu, 'no literal colours');
});

for (const [folder, {tag, relation}] of Object.entries(CONTROLS)) {
  test(`${tag} opts into the inherited value`, () => {
    const source = read(`src/smart/${folder}/index.js`);
    const template = read(`src/smart/${folder}/js/templates/default.js`);
    const rule = read(`src/smart/${folder}/rule.js`);
    const manifest = JSON.parse(read(`src/smart/${folder}/smart.manifest.json`));

    // sf-switch takes its plumbing from component.json over the same base.
    assert.match(source, /extends InheritedValueField\(SfBaseElement\)|base: InheritedValueField\(SfBaseElement\)/u);
    assert.match(source, /inheritedValue: \{\s*attribute: ['"]inherited-value['"]/u);
    assert.match(source, /resetLabel: \{\s*attribute: ['"]reset-label['"]/u);
    assert.match(source, /inheritedFocusTarget\(\) \{/u);
    assert.match(source, /clearOwnValue\(\) \{/u);
    assert.match(source, /this\.syncInheritedState\(\);/u);
    assert.match(template, /renderInheritedSlot\(context\.component/u);
    // The slot's sheet and the button's both load with the control.
    assert.match(rule, /css: true/u);
    assert.match(rule, relation);

    const properties = manifest.inputs.properties;
    for (const name of ['inherited-value', 'inherited-text', 'reset-label']) assert.ok(properties[name], `${tag} manifest declares ${name}`);
    // The trait's event is declared as the shared event field-reset (§8,
    // §20.2): one current name for the family, with the tag in the detail. The
    // retired sf-field:reset keeps its own entry until the alias ends, and
    // names the current event as the one it stands for.
    assert.equal(manifest.events['sf-field-reset']?.payload?.type, 'object');
    assert.deepEqual(Object.keys(manifest.events['sf-field-reset'].payload.properties), ['tag', 'value', 'inheritedValue', 'name']);
    assert.equal(manifest.events['sf-field-reset'].canonical, true);
    assert.match(manifest.events['sf-field-reset'].summary, /cancellable/u);
    assert.equal(manifest.events['sf-field:reset']?.payload?.type, 'object');
    assert.deepEqual(Object.keys(manifest.events['sf-field:reset'].payload.properties), ['value', 'inheritedValue', 'name']);
    assert.equal(manifest.events['sf-field:reset'].alias_of, 'sf-field-reset');
    assert.ok(manifest.methods.resetToInherited, `${tag} manifest declares resetToInherited`);
    const sources = manifest.provenance.source_artifacts.map(({path}) => path);
    assert.ok(sources.includes('src/smart/helpers/inherited-value.js') && sources.includes('src/smart/helpers/inherited-value.css'),
      `${tag} names the shared state among its sources, so a change to it is a drift its manifest sees`);

    assert.match(read(`src/smart/${folder}/docs/docs.md`), /## Inherited value[\s\S]*sf-field-reset/u);
  });
}

test('the form gets nothing while the value is inherited', () => {
  // A switch submits nothing while inherited: the host is the form control
  // (ElementInternals) and its checkbox is never named; without
  // ElementInternals the checkbox is not named while inherited. «off» chosen by
  // a person is its own value, kept as checked="false".
  const toggle = read('src/smart/switch/index.js');
  assert.match(toggle, /checkboxName: this\.sfInternals \|\| inherited \? '' : props\.name/u);
  assert.match(toggle, /sfFormValue\(\) \{\s*if \(this\.isInherited\) return null;/u);
  assert.match(toggle, /else if \(this\.hasInheritedValue\) this\.setAttribute\('checked', 'false'\);/u);
  // The text fields and the dropdown show it as their placeholder, never as
  // their value; the dropdown shows its options' labels.
  assert.match(read('src/smart/input/js/templates/default.js'), /const shownPlaceholder = context\.inheritedValue \|\| placeholder;/u);
  assert.match(read('src/smart/textarea/js/templates/default.js'), /placeholder=\$\{context\.inheritedValue \|\| placeholder\}/u);
  assert.match(read('src/smart/dropdown/js/templates/default.js'), /placeholder=\$\{context\.inheritedLabel \|\| context\.placeholder\}/u);
  // A reset on an uncontrolled sf-input does not write a value attribute: that
  // would swap the native input and drop the focus the reset gives back.
  assert.match(read('src/smart/input/index.js'), /if \(this\.hasAttribute\('value'\)\) \{\s*this\.value = '';/u);
});
