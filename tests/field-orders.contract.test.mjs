// Field orders FO-1..FO-6 of the ui-view property pages (view round 2, 2026-11-18):
// the yes/no and file controls say their own error, a url's bare domain is an
// address, a phone filter searches the stored form, the set's words come before a
// host draws, sf-form declares a ru.inn field's holder.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completeWebAddress, isWebAddress} from '../src/smart/field-renderers/text-types.js';
import {phoneSearchText} from '../src/smart/field-renderers/phone.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('FO-1: switch, checkbox, segmented and file upload take invalid and error-message', () => {
  for (const [folder, version, noted = version] of [['switch', '1.10.3', '1.10.0'], ['checkbox', '1.6.2', '1.6.0'], ['segmented', '1.8.4', '1.7.0'], ['file-upload', '1.6.4', '1.6.0']]) { // GB13 notes: file-upload 1.6.4 (a folder on a single area) // group build 13: segmented and file-upload moved on by the merged branches
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.equal(manifest.version, version, folder);
    assert.equal(manifest.settings.invalid?.type, 'boolean', `${folder} invalid`);
    assert.equal(manifest.settings['error-message']?.type, 'string', `${folder} error-message`);
    assert.ok(manifest['x-decisions'].some((line) => line.startsWith(`version ${noted} (2026-11-18, field orders FO-1`)), `${folder} note`);
  }
  // The line under a checkbox or a switch is the shared row's; segmented and the upload area draw their own.
  const row = read('src/smart/helpers/checkable-row.js');
  assert.match(row, /export function renderCheckableMessage\(context\)/);
  assert.match(row, /if \(!context\.invalid \|\| !context\.errorMessage\) return '';/);
  assert.match(row, /data-field-message="error"/);
  assert.match(row, /export function linkCheckableMessage\(host, input\)/);
  assert.match(read('src/smart/switch/js/templates/default.js'), /context\.invalid \? 'error' : ''/);
  assert.match(read('src/smart/segmented/js/templates/default.js'), /aria-invalid=\$\{context\.invalid \? 'true' : nothing\}/);
  assert.match(read('src/smart/segmented/js/templates/default.js'), /class=\$\{`sf-button-group-message sf-button-group-message--size-\$\{context\.size\}`\}/);
  assert.match(read('src/smart/file-upload/js/templates/default.js'), /sf-file-upload-error sf-file-upload-error--size-\$\{size\}/);
  // The ink is the error role, in sf.paint (C273); the edges are the error role.
  assert.match(read('src/smart/helpers/checkable-row.css'), /@layer sf\.paint \{\s+\.sf-checkable-message \{\s+color: var\(--sf-error\);/u);
  assert.match(read('src/component/switch/scss/_css_switch.scss'), /\.sf-switch\.error:has\(input\):not\(:has\(input:disabled\)\) \.sf-switch-toggler \{\s+--sf-switch-toggler--border-color: var\(--sf-error\);/u);
  assert.match(read('src/component/button-group/scss/_css__button-group.scss'), /\.sf-button-group\.sf-button-group--invalid > \.sf-button\[class\*='segment-'\] \{\s+border-block-color: var\(--sf-error\);/u);
  assert.match(read('src/component/file-upload/scss/_css__file_upload.scss'), /--sf-file-upload--border-color: var\(--sf-error\);/u);
  // The class runtime still finds the list past the new line.
  assert.match(read('src/component/file-upload/js/_file_upload.js'), /contains\('sf-file-upload-error'\)\) next = next\.nextElementSibling;/);
});

test('FO-1: the field renderers hand options.error to the yes/no and file controls, and sf-form lets them say it', () => {
  const set = read('src/smart/field-renderers/index.js');
  assert.match(set, /export const OWN_ERROR_CONTROLS = Object\.freeze\(\['sf-input-date', 'sf-input-image', 'sf-switch', 'sf-checkbox', 'sf-segmented', 'sf-file-upload'\]\);/);
  const edits = set.slice(set.indexOf('function renderBooleanEdit'), set.indexOf('// The control a field is edited with'));
  for (const tag of ['sf-switch', 'sf-checkbox', 'sf-segmented', 'sf-file-upload', 'sf-input-image']) {
    const blocks = edits.split(`<${tag}`).slice(1).map((rest) => rest.slice(0, rest.indexOf(`</${tag}>`)));
    assert.ok(blocks.some((block) => /\?invalid=\$\{Boolean\(EDIT_ERROR\)\}\s+error-message=\$\{EDIT_ERROR \|\| nothing\}/u.test(block)), tag);
  }
  const form = read('src/smart/form/index.js');
  assert.match(form, /OWN_ERROR_CONTROLS\.includes\(control\.localName\)/);
  assert.match(form, /control\.closest\?\.\('\.sf-field-checklist'\)/);
  assert.doesNotMatch(form, /control\.toggleAttribute\('invalid', Boolean\(message\)\)/);
});

test('FO-5: a bare domain is an https address; other schemes stay refused', () => {
  const cases = {
    'simai.io': 'https://simai.io',
    'simai.io/docs?tab=1#a': 'https://simai.io/docs?tab=1#a',
    'www.simai.io:8080/x': 'https://www.simai.io:8080/x',
    ' simai.io ': 'https://simai.io',
    'https://ui.simai.io/': 'https://ui.simai.io/',
    'javascript:alert(1)': 'javascript:alert(1)',
    'mailto:a@simai.io': 'mailto:a@simai.io',
    'ftp://simai.io': 'ftp://simai.io',
    localhost: 'localhost',
    '/about': '/about',
  };
  for (const [typed, read] of Object.entries(cases)) assert.equal(completeWebAddress(typed), read, typed);
  assert.equal(isWebAddress(completeWebAddress('simai.io')), true);
  for (const bad of ['javascript:alert(1)', 'mailto:a@simai.io', 'ftp://simai.io', 'localhost', 'user:pass@simai.io']) {
    assert.equal(isWebAddress(completeWebAddress(bad)), false, bad);
  }
  // The rule stays strict for a server: isWebAddress itself takes no bare domain.
  assert.equal(isWebAddress('simai.io'), false);
  assert.match(read('src/smart/field-renderers/index.js'), /complete: completeWebAddress,/);
});

test('FO-3: a phone filter searches the stored form', () => {
  assert.equal(phoneSearchText('+7 (916) 123-45-67'), '+79161234567');
  assert.equal(phoneSearchText('916 123-45'), '91612345');
  assert.equal(phoneSearchText('0049 30 1234'), '+49301234');
  assert.equal(phoneSearchText('+7 347 246-85-00 доб. 12'), '+73472468500');
  assert.equal(phoneSearchText('нет цифр'), '');
  assert.match(read('src/smart/field-renderers/index.js'), /phone: renderPhoneFilterControl,/);
  assert.match(read('src/smart/field-renderers/index.js'), /String\(sent \|\| ''\)\.startsWith\('\+'\) \? formatPhone\(sent\)/);
});

test('FO-4: the set asks for its words when it publishes itself, and whenFieldRenderers waits for them', () => {
  assert.match(read('src/smart/field-renderers/index.js'), /pageText\(SET_TEXT, 'containsText', null, SET_NAME\);\s+\/\/ SF\.whenFieldRenderers\(\) settles on this/u);
  const loader = read('src/core/js/loader.js');
  assert.match(loader, /const withSetWords = \(set\) => \{\s+const hold = languageHold\(\);/u);
  assert.match(loader, /if \(SF\.fieldRenderers\?\.renderEditField\) return withSetWords\(SF\.fieldRenderers\);/);
  assert.match(loader, /resolve\(withSetWords\(SF\.fieldRenderers\)\);/);
});

test('FO-6: sf-form declares a ru.inn field\'s holder', () => {
  const manifest = json('src/smart/form/component.json');
  assert.equal(manifest.version, '1.16.0'); // FS-6, FS-9 (feat/form-defects-fs, merged in GB17); // GB17 F1b: start labels take the read list's type // gb17-fields F1, F2: 1.14.0 (C401 labels beside from 20rem; a required checkbox is a consent) // look answers: widths short and medium // GB13 notes: 1.12.3 // form fields: 1.7.0 // group build 13: 1.7.0 moved on by the merged branches or a GB11 merge // group build 18: moved on by the merged branches or a GB15 assembly item
  assert.deepEqual(manifest.settings.fields.schema.items.properties.holder, {type: 'string', enum: ['any', 'organization', 'person']});
  // FL-7: a phone field's starting country is declared too.
  assert.deepEqual(manifest.settings.fields.schema.items.properties.defaultCountry, {type: 'string', pattern: '^[A-Za-z]{2}$'});
  assert.match(manifest.settings.fields.summary, /holder \(a ru\.inn field: any, organization -- 10 digits -- or person -- 12\)/);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.3') // GB19 B: include view owns no lit DOM // GB18 L6; // FS-9 (feat/form-defects-fs, merged in GB17); // gb17-fields F4: option badges take the hue class (C411) // group build 16 returns GB16-3: the phone sheet fills; // group build 16 G8: the filter window's one step, PH-3 band radius; // C396 WM-4: the template parameter width, above 1.26.1 on origin // cards-fw: 1.25.0 // group build 13: 1.25.0 moved on by the merged branches or a GB11 merge
});
