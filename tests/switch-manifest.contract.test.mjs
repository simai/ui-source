import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-switch, the first component built from its component.json (standard
// simai.smart-component 1.3.8 §3, §4, §11, §16.20, §17.1). The browser half,
// on the built bytes, is tests/browser/switch-manifest.browser.mjs.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const {propsFromManifest, readManifest} = await import('../src/core/js/element-manifest.js');
const {readAliasTable} = await import('../src/core/js/alias-table.js');

const manifest = json('src/smart/switch/component.json');

test('the switch element is made from its component.json, language files and aliases', () => {
  const source = read('src/smart/switch/index.js');
  for (const file of ['./component.json', './aliases.json', './lang/en.json', './lang/ru.json']) {
    assert.ok(source.includes(`from '${file}'`), file);
  }
  assert.match(source, /elementFromManifest\(manifest, \{\s*base: InheritedValueField\(SfBaseElement\),\s*lang: \{ en, ru \},\s*source: 'ru',\s*aliases,/);
  assert.match(source, /class SfSwitch extends SwitchElement/);
  // The hand-written settings are gone: the manifest makes them.
  for (const name of ['size', 'label', 'description', 'help', 'disabled', 'name', 'value']) {
    assert.doesNotMatch(source, new RegExp(`\\n  get ${name}\\(\\) \\{`), name);
  }
  // Words live in the language files, not in the bundle (#45 item 5).
  assert.doesNotMatch(source, /SWITCH_TEXT|включено/);
  assert.match(source, /this\.sfWord\(this\.inheritedOn \? 'on' : 'off'\)/);
});

test('the manifest makes the settings the base reads; value defaults to "on" (#38)', () => {
  const props = propsFromManifest(manifest);
  assert.deepEqual(Object.keys(props), ['size', 'label', 'description', 'help', 'disabled', 'name', 'value', 'checked']);
  assert.equal(props.value.default, 'on');
  assert.deepEqual(props.size.values, ['1/2', '1', '2']);
  const described = readManifest(manifest);
  assert.equal(described.events.change.name, 'change', 'a native event keeps its name');
  assert.deepEqual(described.hostStates, {'data-inherited': 'boolean'});
  assert.equal(described.form.submits, 'value');
  assert.equal(json('src/smart/switch/smart.manifest.json').inputs.properties.value.default, 'on');
  const template = read('src/smart/switch/js/templates/default.js');
  assert.match(template, /\.value=\$\{value \|\| 'on'\}/);
  assert.match(template, /name=\$\{name \|\| nothing\}/);
});

test('the language files say every runtime word in ru and en', () => {
  const en = json('src/smart/switch/lang/en.json');
  const ru = json('src/smart/switch/lang/ru.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime.on, 'включено');
  assert.equal(en.runtime.off, 'off');
});

test('aliases.json: the trait event sf-field:reset follows sf-field-reset; the host attribute needs no shim', () => {
  const table = json('src/smart/switch/aliases.json');
  const {rows, refused} = readAliasTable(table, {tag: 'sf-switch'});
  assert.deepEqual(rows.map((row) => [row.from, row.to, row.kind, row.remove_after]), [['sf-field:reset', 'sf-field-reset', 'event', '2026-12-01']]);
  assert.deepEqual(refused.map((one) => one.from), ['aria-label']);
});

test('the on look follows the checked checkbox in the markup, not a script class (#46 item 3)', () => {
  const sheet = read('src/component/switch/scss/_css_switch.scss');
  assert.doesNotMatch(sheet, /\.sf-switch\.active/);
  assert.match(sheet, /\.sf-switch:has\(input:checked\) \.sf-switch-inner \{/);
});

test('the host is the form control; the inner checkbox carries no name where ElementInternals exist (§17.1)', () => {
  const source = read('src/smart/switch/index.js');
  assert.match(source, /name: this\.sfInternals \|\| inherited \? '' : props\.name/);
  assert.match(source, /this\.syncInheritedState\(\);\s*this\.sfSyncForm\(\);/);
  assert.match(source, /this\._writeChecked\(input\.checked\);[\s\S]*?this\.sfSyncForm\(\);\s*\};/);
});
