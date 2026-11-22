import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-form (owner decision C182, 2026-11-14): what its source promises, held
// without a browser. The behaviour is probed on the built bytes by
// src/smart/form/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/form/component.json');
const source = read('src/smart/form/index.js');
const template = read('src/smart/form/js/templates/default.js');
const sheet = read('src/smart/form/scss/_smart__form.scss');

test('C182 (2), (9): sf-form of family form, apply submit|instant, labels, footer, the descriptor list', () => {
  assert.equal(manifest.tag, 'sf-form');
  assert.equal(manifest.family, 'form');
  assert.equal(manifest.version, '1.13.1'); // forms-fb: FO-1..FO-4 // look answers: widths short and medium // GB13 notes: 1.12.3 (a required yes/no as buttons asks for an answer) // group build 13: 1.12.0 (written as 1.9.0 on fix/larena-lf-data, LF-12) // 1.11.0 (written as 1.8.0 and 1.6.0, above 1.9.0 on origin) // 1.10.0 (written as 1.4.0, above HEAD's released 1.4.0): field conditions (FO-3) // 1.7.0 form fields: a hidden field is not sent (FO3-1) // 1.4.0: field conditions (FO-3) // 1.2.0: fields and groups declared late (first paint R222 FP-8) // group build 9: 1.2.0 moved on by the merged branches or a GB9 patch // C282: 1.2.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.3.1 moved on by the merged branches or a GB10 patch
  assert.deepEqual(Object.keys(manifest.settings), ['fields', 'groups', 'field-host', 'apply', 'size', 'state', 'labels', 'footer', 'label']);
  assert.deepEqual(manifest.settings.apply.values, ['submit', 'instant', 'answer']);
  assert.ok(manifest.settings.labels.values.includes('start'));
  assert.ok(manifest.settings.footer.values.includes('sticky'));
  assert.deepEqual(manifest.settings.fields.schema.items.properties.width.enum, ['short', 'medium', 'full', 's', 'm']); // look answers: the field width steps, s and m dated until 2027-01-01
  for (const key of ['key', 'label', 'hint', 'help', 'width', 'group', 'propertyType']) {
    assert.ok(manifest.settings.fields.schema.items.properties[key], key);
  }
  assert.deepEqual(Object.keys(manifest.values), ['value', 'mode', 'valid', 'dirty']);
  assert.deepEqual(Object.keys(manifest.events), ['input', 'change', 'submit', 'answer', 'invalid', 'cancel']);
  assert.equal(manifest.events.submit.cancelable, true);
  // The fields' own native input and change bubble through the form: its own are sf-form-*.
  assert.equal(manifest.events.input['x-native'], false);
  assert.equal(manifest.events.change['x-native'], false);
  assert.deepEqual(Object.keys(manifest.actions), ['check-validity', 'reset', 'refresh-fields', 'set-errors']);
});

test('C182 (1), (3): the controls are the field renderers\' own, the frame is the form\'s', () => {
  assert.match(source, /import \{OWN_ERROR_CONTROLS, PROPERTY_TYPES, fieldConditions, fieldTemplate, propertyModes, renderEditField, renderViewField\} from '\.\.\/field-renderers\/index\.js';/u);
  // apply instant still reaches the renderers; the yes/no control is the field's template (C303 (4)):
  // a checkbox takes its label beside the box, a switch and the buttons a label row.
  assert.match(source, /\{apply: 'instant'\}/u);
  assert.match(source, /const checkbox = editing && drawn\.type === 'boolean' && drawn\.template === 'checkbox' && field\.readonly !== true;/u);
});

test('C182 (6): errors at the fields, a summary role alert with links from two errors, the focus to it', () => {
  assert.match(template, /class="sf-form-summary" role="alert" tabindex="-1"/u);
  // From two errors; a host error a hidden field holds counts as one (FO3-1).
  assert.match(source, /wrong\.length \+ hidden\.length > 1 \? this\.focusSummary\(\) : this\.focusField\(wrong\[0\]\)/u);
  assert.match(source, /errorList: editing && \(\(this\._submitted && errors\.length \+ hiddenErrors\.length > 1\) \|\| hiddenErrors\.length\)/u);
});

test('C182 (7): the buttons under the fields, «Сохранить» first and never disabled, the unsaved note a status', () => {
  const footer = template.slice(template.indexOf('function footerBlock'));
  assert.ok(footer.indexOf('sf-form-submit') < footer.indexOf('sf-form-cancel'));
  assert.doesNotMatch(footer.slice(footer.indexOf('sf-form-submit'), footer.indexOf('sf-form-cancel')), /disabled/u);
  assert.match(footer, /class="sf-form-state" role="status"/u);
  assert.match(sheet, /\.sf-form-actions \{[^}]*gap: var\((?:--sf-space-1\\\/3|--sf-gap--actions)\);/u);
  assert.match(sheet, /\.sf-form-footer\[data-sticky\] \{[^}]*position: sticky;/u);
});

test('C182 (4), (5), C52: one column, pairs from 44rem, labels beside from 40rem, gaps from the space system', () => {
  assert.match(sheet, /@container \(min-width: #\{mq\.container-step\(h1\)\}\)/u);
  assert.match(sheet, /@container \(min-width: #\{mq\.container-step\(h0\)\}\)/u);
  assert.match(sheet, /--sf-form--field-gap: var\(--sf-form-field-gap, var\(--sf-space-1\)\);/u);
  assert.match(sheet, /--sf-form--group-gap: var\(--sf-form-group-gap, var\(--sf-space-3\)\);/u);
  // No raw pixel value anywhere in the sheet.
  assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//gu, ''), /\d+px/u);
});

test('C182 (8): view draws the values with renderViewField and «Изменить»', () => {
  assert.match(source, /renderViewField\(field, value, host, this\.size === '1\/2' \? \{size: '1\/2'\} : \{\}\)/u);
  assert.match(template, /class="sf-form-edit" appearance="outline"/u);
});

test('the name is registered in the Framework\'s family form and the rule list', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('form'));
  assert.ok(framework.names.some(({element}) => element === 'sf-form'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/form\/rule\.js';/u);
});

test('the words: ru and en runtime words, the Russian ones of the decision', () => {
  const ru = json('src/smart/form/lang/ru.json').runtime;
  assert.equal(ru.submit, 'Сохранить');
  assert.equal(ru.unsaved, 'Есть несохранённые изменения');
  assert.equal(ru.edit, 'Изменить');
  assert.deepEqual(Object.keys(json('src/smart/form/lang/en.json').runtime), Object.keys(ru));
});

test('the pure parts: fields normalized, grouped in order, values counted as given', async () => {
  // Read without the element (no DOM): the helpers are plain functions.
  const body = source.slice(source.indexOf('export const WIDTHS'), source.indexOf('const FormElement'));
  const module = await import(`data:text/javascript,${encodeURIComponent(body)}`);
  const fields = module.normalizeFields([{key: 'a', label: 'A', propertyType: 'string', width: 'xl'}, {key: 'a', propertyType: 'string'}, {label: 'no key'}, {key: 'b', propertyType: 'integer', group: 'g', width: 's'}]);
  assert.deepEqual(fields.map((field) => `${field.key}:${field.width}`), ['a:', 'b:short']);
  // s and m are the dated names of short and medium (DEV look answer 2026-11-20), told to the note once each read.
  const told = [];
  const widths = module.normalizeFields([{key: 'c', propertyType: 'string', width: 'm'}, {key: 'd', propertyType: 'string', width: 'medium'}, {key: 'e', propertyType: 'string', width: 'full'}], (from, to) => told.push(`${from}>${to}`));
  assert.deepEqual(widths.map((field) => field.width), ['medium', 'medium', 'full']);
  assert.deepEqual(told, ['m>medium']);
  const groups = module.groupFields(fields, [{key: 'g', label: 'G'}, {key: 'empty', label: 'E'}]);
  assert.deepEqual(groups.map((group) => `${group.key}:${group.fields.map((field) => field.key).join(',')}`), ['g:b', ':a']);
  assert.equal(module.hasValue(''), false);
  assert.equal(module.hasValue([]), false);
  assert.equal(module.hasValue(0), true);
  assert.equal(module.hasValue(false), true);
});
