// Form fields (2026-11-18): sf-form 1.7.0 edits every field type the record
// card still edited with its own form (record card order FO-C305-1) through
// a field host; sf-dropdown 1.20.6 relabels the options a parent rewrites;
// the link's address box takes a path and an anchor; simai.property-view-port
// 1.21.0 describes the history, the neighbours and revision_moved (C305).
// The behaviour is measured on the built bytes (ui-control evidence
// 2026-11-18-form-fields, probe card.html).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('sf-form 1.7.0 takes a field host, a property only, and an action to draw again', () => {
  const manifest = json('src/smart/form/component.json');
  assert.equal(manifest.version, '1.14.2'); // FS-6, FS-9 (feat/form-defects-fs, merged in GB17); // GB17 F1b // gb17-fields F1, F2: 1.14.0 (C401 labels beside from 20rem; a required checkbox is a consent) // look answers: widths short and medium // GB13 notes: 1.12.3 // group build 13: 1.7.0 moved on by the merged branches or a GB11 merge
  const setting = manifest.settings['field-host'];
  assert.equal(setting.type, 'object');
  assert.equal(setting.default, null);
  for (const name of ['getFieldOptionsPage', 'loadFieldOptions', 'startFieldUpload', 'getFieldUploads', 'retryFieldUpload', 'renderField']) {
    assert.ok(setting.summary.includes(name), name);
  }
  assert.deepEqual(manifest.actions['refresh-fields']['x-outcomes'], ['applied']);
  assert.ok(manifest['x-decisions'].some((line) => line.startsWith('version 1.7.0 (2026-11-18, record card order FO-C305-1')));
});

test('sf-form forwards the record half of the renderers\' host and keeps the value half', () => {
  const source = read('src/smart/form/index.js');
  assert.match(source, /export const FIELD_HOST_METHODS = Object\.freeze\(\[\s+'getFieldOptionsPage', 'getFieldOptionSearch', 'setFieldOptionSearch', 'loadFieldOptions',\s+'getFieldUploads', 'startFieldUpload', 'retryFieldUpload',\s+'getFieldText', 'formatFieldValue',\s+\]\);/u);
  // The form's own host for the field goes last, so a stored file is written into the form.
  assert.match(source, /const answer = outer\[name\]\.call\(outer, \.\.\.args, host\);/u);
  assert.match(source, /setFieldValue: \(one, value\) => this\.writeValue\(one\?\.key \?\? field\.key, value\)/u);
  // The types a component set draws are the registry's `set` types, drawn by renderField.
  assert.match(source, /const SET_TYPES = new Set\(PROPERTY_TYPES\.filter\(\(entry\) => entry\.set\)/u);
  assert.match(source, /control = this\.fieldHost\.renderField\(field, value, host, \{editing: editing && field\.readonly !== true, size\}\) \?\? null;/u);
  // A picker nobody pages shows its value; without a host a picker pages its own options, a file keeps the chosen files.
  assert.match(source, /if \(control === null \|\| control === undefined\) control = renderViewField\(/u);
  assert.match(source, /export function optionsPage\(field, search = ''\)/u);
  assert.match(source, /export function chosenFiles\(items\)/u);
  assert.match(source, /mime: String\(file\.type \?\? item\?\.mime \?\? ''\), file\};/u);
  // The record shapes stay the renderers': a picked record {value, label}.
  assert.match(read('src/smart/field-renderers/index.js'), /const resolved = \(item\) => \(\{value: item\.value, label: String\(item\.label \?\? item\.value\)\}\);/u);
});

test('a link\'s address box is text with the address keyboard: a path and an anchor are addresses', () => {
  const source = read('src/smart/field-renderers/index.js');
  const edit = source.slice(source.indexOf('function renderLinkEdit'), source.indexOf('function renderInnEdit'));
  assert.doesNotMatch(edit, /input-type="url"/u);
  assert.match(edit, /inputmode="url"/u);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.29.1'); // FS-9 (feat/form-defects-fs, merged in GB17); // gb17-fields F4: option badges take the hue class (C411) // group build 16 returns GB16-3: the phone sheet fills; // group build 16 G8: the filter window's one step, PH-3 band radius; // feat/field-width merged: the width parameter (C396) // GB13 notes: 1.26.1 // group build 13: 1.25.0 moved on by the merged branches or a GB11 merge
});

test('sf-dropdown 1.20.6 reads the option elements again when their owner rewrites them', () => {
  assert.equal(json('src/smart/dropdown/component.json').version, '1.25.3'); // GB17: fields F4 joined, 1.25.3; // gb17-fields F4: the option badge's hue class (C411), above 1.25.1 on origin // group build 16 G8: PH-1..PH-3, band variables; // feat/field-width merged: the width setting (C396) // group build 13: 1.20.6 moved on by the merged branches or a GB11 merge // group build 14: 1.22.0 moved on by the merged branches or the C278 language patch
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.29.1'); // FS-9 (feat/form-defects-fs, merged in GB17); // gb17-fields F4: option badges take the hue class (C411) // group build 16 returns GB16-3: the phone sheet fills; // group build 16 G8: the filter window's one step, PH-3 band radius; // C396 WM-4: the template parameter width, above 1.26.1 on origin // group build 13: 1.25.0 moved on by the merged branches or a GB11 merge
});

test('sf-dropdown 1.20.6 reads the option elements again when their owner rewrites them', () => {
  assert.equal(json('src/smart/dropdown/component.json').version, '1.25.3'); // GB17: fields F4 joined, 1.25.3; // gb17-fields F4: the option badge's hue class (C411), above 1.25.1 on origin // group build 16 G8: PH-1..PH-3, band variables; // C396 WM-4: the width setting // group build 13: 1.20.6 moved on by the merged branches or a GB11 merge
  const source = read('src/smart/dropdown/index.js');
  assert.match(source, /this\.watchOptionNodes\(optionNodes\);/u);
  assert.match(source, /this\._optionWatch\.observe\(node, \{attributes: true\}\);/u);
  assert.match(source, /this\._options = nodes\.map\(\(node\) => parseOptionNode\(node, this\.size\)\)\.filter\(Boolean\);/u);
});

test('simai.property-view-port 1.21.0: history, neighbours, revision_moved, include_archived', () => {
  const at = 'src/core/contracts/ports/simai.property-view-port';
  const port = json(`${at}/1.21.0/port.json`);
  assert.equal(port.version, '1.21.0');
  assert.deepEqual(port.capabilities['record-history'].intents, ['record.history']);
  assert.deepEqual(port.capabilities['record-neighbours'].intents, ['record.neighbours']);
  const history = port.intents['record.history'];
  assert.equal(history.capability, 'record-history');
  assert.equal(history.payload.properties.limit.maximum, 50);
  const change = port.data.history_page.schema.properties.events.items.properties.changes.items.properties;
  assert.equal(change.sealed.type, 'boolean');
  const neighbours = port.intents['record.neighbours'];
  assert.equal(neighbours.capability, 'record-neighbours');
  assert.equal(neighbours.payload.properties.query.properties.include_archived.type, 'boolean');
  assert.deepEqual(neighbours.answer_data.required, ['listed', 'previous', 'next']);
  assert.match(port.intents['group.save'].summary, /revision_moved/u);
  assert.match(port.answer.schema.properties.reason.description, /revision_moved/u);
  const kit = json(`${at}/1.21.0/kit/manifest.json`);
  for (const id of ['history-is-a-page-newest-first', 'history-names-a-sealed-field-without-values', 'history-without-the-capability',
    'neighbours-name-the-previous-and-the-next', 'neighbours-without-the-capability', 'group-save-revision-moved-is-a-conflict']) {
    assert.ok(kit.cases.includes(id), id);
    assert.ok(existsSync(new URL(`../${at}/1.21.0/kit/cases/${id}.json`, import.meta.url)), id);
  }
  assert.equal(port.conformance.cases, kit.cases.length);
  // The edition before is unchanged: 65 cases.
  assert.equal(json(`${at}/1.20.0/port.json`).conformance.cases, 65);
});
