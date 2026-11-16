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
  assert.equal(manifest.version, '1.2.2'); // C268: pointer-events-* in the template (utilities-c264)
  assert.deepEqual(Object.keys(manifest.settings), ['fields', 'groups', 'apply', 'labels', 'footer', 'label']);
  assert.deepEqual(manifest.settings.apply.values, ['submit', 'instant']);
  assert.ok(manifest.settings.labels.values.includes('start'));
  assert.ok(manifest.settings.footer.values.includes('sticky'));
  assert.deepEqual(manifest.settings.fields.schema.items.properties.width.enum, ['s', 'm', 'full']);
  for (const key of ['key', 'label', 'hint', 'help', 'width', 'group', 'propertyType']) {
    assert.ok(manifest.settings.fields.schema.items.properties[key], key);
  }
  assert.deepEqual(Object.keys(manifest.values), ['value', 'mode', 'valid', 'dirty']);
  assert.deepEqual(Object.keys(manifest.events), ['input', 'change', 'submit', 'invalid', 'cancel']);
  assert.equal(manifest.events.submit.cancelable, true);
  // The fields' own native input and change bubble through the form: its own are sf-form-*.
  assert.equal(manifest.events.input['x-native'], false);
  assert.equal(manifest.events.change['x-native'], false);
  assert.deepEqual(Object.keys(manifest.actions), ['check-validity', 'reset', 'set-errors']);
});

test('C182 (1), (3): the controls are the field renderers\' own, the frame is the form\'s', () => {
  assert.match(source, /import \{propertyModes, renderEditField, renderViewField\} from '\.\.\/field-renderers\/index\.js';/u);
  // apply instant reaches the renderers: a required yes/no is a switch there, a checkbox otherwise (C165 (4)).
  assert.match(source, /\{apply: 'instant'\}/u);
});

test('C182 (6): errors at the fields, a summary role alert with links from two errors, the focus to it', () => {
  assert.match(template, /class="sf-form-summary" role="alert" tabindex="-1"/u);
  assert.match(source, /wrong\.length > 1 \? this\.focusSummary\(\) : this\.focusField\(wrong\[0\]\)/u);
  assert.match(source, /errorList: editing && this\._submitted && errors\.length > 1/u);
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
  assert.match(source, /renderViewField\(field, value, host\)/u);
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
  assert.deepEqual(fields.map((field) => `${field.key}:${field.width}`), ['a:', 'b:s']);
  const groups = module.groupFields(fields, [{key: 'g', label: 'G'}, {key: 'empty', label: 'E'}]);
  assert.deepEqual(groups.map((group) => `${group.key}:${group.fields.map((field) => field.key).join(',')}`), ['g:b', ':a']);
  assert.equal(module.hasValue(''), false);
  assert.equal(module.hasValue([]), false);
  assert.equal(module.hasValue(0), true);
  assert.equal(module.hasValue(false), true);
});
