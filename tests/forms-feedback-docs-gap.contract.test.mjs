// Defects found while the docs' missing Smart pages were written (DEV letters
// msg-ee572eff and msg-4f3adb0f, 2026-11-21/22; ui-control evidence
// control/evidence/2026-11-22-smart-pages-gap and 2026-11-22-live-examples-2):
// sf-tag-group TG-1..TG-4 and REF-1, sf-form FO-1..FO-4, the progress ring's
// public value PR-1 and sf-progress-scale's resize PS-1. The behaviour is
// driven by tests/browser/forms-feedback-docs-gap.browser.mjs on a build; this
// file holds the source and the generated contracts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fieldSchema} from '../scripts/generate-component-files.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const LANGUAGES = ['ru', 'en', 'de', 'es', 'fr', 'it', 'pt-br', 'ja', 'ko', 'zh-hans', 'ar'];

test('TG-1: a cross without close-label is named by its tag, in every language', () => {
  const tag = read('src/smart/tag/index.js');
  assert.match(tag, /get closeLabel\(\) \{\s*const given = this\.getAttribute\('close-label'\);\s*if \(given !== null\) return given;/u);
  assert.match(tag, /this\.sfWord\('remove-named', \{vars: \{label: name\}\}\) : this\.sfWord\('remove'\)/u);
  for (const code of LANGUAGES) {
    const words = json(`src/smart/tag/lang/${code}.json`).runtime;
    assert.ok(words.remove, `${code}: remove stays for a tag with no name`);
    assert.match(words['remove-named'], /\{label\}/u, `${code}: remove-named names the tag`);
  }
  assert.match(json('src/smart/tag/component.json').settings['close-label'].summary, /Удалить Москва/u);
});

test('TG-2: a cross pressed or Enter moves the focus to the neighbour, as Delete does', () => {
  const group = read('src/smart/tag-group/index.js');
  // Heard on the way down, before the page removes the tag.
  assert.match(group, /this\.addEventListener\('sf-tag-close', this\._close, true\);/u);
  assert.match(group, /this\.removeEventListener\('sf-tag-close', this\._close, true\);/u);
  const handler = group.slice(group.indexOf('  onTagClose(event) {'));
  assert.match(handler, /if \(!tag\.contains\(doc\.activeElement\) && !pressed\) return;/u);
  assert.match(handler, /this\.focusAt\(Math\.min\(index, left\.length - 1\)\)/u);
  // Delete asks the tag and leaves the focus to the same handler.
  const keys = group.slice(group.indexOf('  onKeydown(event) {'), group.indexOf('  onTagClose(event) {'));
  assert.match(keys, /event\.preventDefault\(\);\s*tag\.onClose\?\.\(\);\s*\}\n/u);
  assert.doesNotMatch(keys, /requestAnimationFrame/u);
});

test('TG-3, REF-1: the manifest declares selected, selected-ids and the name of aria-label', () => {
  const inputs = json('src/smart/tag-group/smart.manifest.json').inputs.properties;
  assert.deepEqual(inputs.selected, {type: 'string', default: '', description: json('src/smart/tag-group/component.json').values.selected.summary});
  assert.equal(inputs['selected-ids'].type, 'array');
  assert.deepEqual(inputs['selected-ids'].default, []);
  assert.ok(inputs['aria-label'].description.length > 20, 'aria-label is described');
  const group = read('src/smart/tag-group/index.js');
  assert.match(group, /if \(\(name === 'selected' \|\| name === 'selected-ids'\) && newValue !== null/u);
  assert.match(group, /chooseEarly\(keys\) \{\s*if \(!this\._settled\) this\._chosen = keys;/u);
});

test('TG-4: a group without selection does not make a bare tag a toggle', () => {
  const tag = read('src/smart/tag/index.js');
  assert.match(tag, /normalize\(group\.getAttribute\('selection'\) \|\| 'none'\) !== 'none'/u);
  assert.doesNotMatch(tag, /getAttribute\('selection'\) \|\| 'many'/u);
  assert.equal(json('src/smart/tag-group/component.json').settings.selection.default, 'none');
});

test('FO-1: apply instant sends one sf-form-change per commit', () => {
  const form = read('src/smart/form/index.js');
  // The only change event is applyField's, which sends a value once.
  assert.equal(form.match(/this\.sfEmit\('change'/gu).length, 1);
  assert.match(form, /if \(this\.isInstant && !this\.typing\(\)\) this\.applyField\(key\);/u);
  assert.match(form, /if \(now === before\) return;\s*this\._applied\.set\(key, now\);\s*this\.sfEmit\('change', \{key, value\}\);/u);
  assert.match(form, /this\.addEventListener\('input', this\._onTyping, true\);/u);
  // Leaving the field applies what was typed.
  assert.match(form, /if \(this\.isInstant\) this\.applyField\(key\);/u);
});

test('FO-2: the submit button submits without the browser\'s form submission', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /this\.addEventListener\('click', this\._onPress\);/u);
  const handler = form.slice(form.indexOf('  onSubmitPress(event) {'));
  assert.match(handler, /closest\?\.\('button\[type="submit"\], input\[type="submit"\]'\)/u);
  assert.match(handler, /event\.preventDefault\(\);\s*this\.submit\(\);/u);
});

test('FO-3: the input and change value is any JSON value in the manifest', () => {
  assert.deepEqual(fieldSchema('any'), {});
  const component = json('src/smart/form/component.json');
  const events = json('src/smart/form/smart.manifest.json').events;
  for (const [verb, name] of [['input', 'sf-form-input'], ['change', 'sf-form-change']]) {
    assert.equal(component.events[verb].carries.value, 'any');
    assert.deepEqual(events[name].payload.properties.value, {}, name);
  }
});

test('FO-4: a field left by a press keeps its check until the press is over', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /const PRESS_ENDS = \['pointerup', 'pointercancel', 'mouseup', 'dragend'\];/u);
  assert.match(form, /this\.addEventListener\('pointerdown', this\._onPressStart, true\);/u);
  assert.match(form, /if \(this\._pressing\) \{\s*this\._held\.add\(key\);\s*return;\s*\}/u);
  // The release comes a task after the press ends, after its click.
  assert.match(form, /setTimeout\(\(\) => this\.releaseChecks\(\), 0\);/u);
});

test('PR-1: the ring\'s value is the public --sf-progress-ring-value; the former name is an alias', () => {
  const sheet = read('src/component/progress-ring/scss/_css__progress_ring.scss');
  assert.match(sheet, /\.sf-progress-ring \{\s*--sf-progress-ring--value: var\(--sf-progress-ring-value, 0\);/u);
  assert.match(sheet, /@property --sf-progress-ring--value \{/u);
  assert.match(read('src/smart/progress-ring/js/templates/default.js'), /`--sf-progress-ring-value: \$\{unknown \? 0 : value\}`/u);
  assert.match(read('src/smart/file-download/js/templates/default.js'), /`--sf-progress-ring-value:\$\{context\.value\}`/u);
  for (const folder of ['progress-ring', 'file-download']) {
    assert.doesNotMatch(read(`src/smart/${folder}/js/templates/default.js`), /--sf-progress-ring--value:/u, folder);
  }
  assert.equal(json('src/smart/progress-ring/component.json')['css-variables']['--sf-progress-ring-value'].type, 'number');
  assert.match(read('src/component/progress-ring/docs/docs.md'), /\| `--sf-progress-ring-value` \|/u);
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'token-progress-ring-value-public');
  assert.ok(record, 'journal record');
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), [['--sf-progress-ring--value', '--sf-progress-ring-value']]);
});

test('PS-1: the class renderer writes the text into the node the template drew', () => {
  const renderer = read('src/component/progress-scale/js/_progress_scale.js');
  assert.match(renderer, /function writeScaleText\(text, value\) \{/u);
  assert.match(renderer, /if \(words\[0\]\.data !== value\) words\[0\]\.data = value;/u);
  const render = renderer.slice(renderer.indexOf('function renderProgressScale(root) {'), renderer.indexOf('function bindProgressScale(root) {'));
  assert.doesNotMatch(render, /text\.textContent =/u);
  assert.match(render, /writeScaleText\(text, /u);
  // show-text changes what the template holds: drawn again, not patched.
  const element = read('src/smart/progress-scale/index.js');
  const patched = element.match(/const directPatchAttributes = \[([^\]]*)\]/u)[1];
  assert.doesNotMatch(patched, /'show-text'/u);
  assert.match(patched, /'value'/u);
});

test('FO-4: the field family holds its leave check while a pointer is pressed', () => {
  const field = read('src/smart/helpers/form-field.js');
  assert.match(field, /const PRESS_KEY = Symbol\.for\('simai\.framework\.field-press'\);/u);
  assert.match(field, /export function afterPress\(check\) \{\s*const shared = fieldPress\(\);\s*if \(shared\.down\) shared\.queue\.push\(check\);\s*else check\(\);/u);
  const leave = field.slice(field.indexOf("this.addEventListener('focusout', (event) => {", field.indexOf('export const ShownValidity')));
  assert.match(leave, /afterPress\(\(\) => \{\s*if \(!this\.isConnected \|\| \(!this\.__sfTouched && !formTried\(this\)\)\) return;/u);
  assert.equal(json('src/core/passports/module.smart-helpers.json').version, '1.20.0');
});
