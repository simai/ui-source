import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';

// Group B of the form fields, built from their component.json (standard
// simai.smart-component 1.3.8 §3, §4, §6, §11, §12, §16.20, §17.1): what each
// folder holds and how its index.js uses it. The browser half, on the built
// bytes, is each folder's probe.json, run by tests/browser/manifest-probes.browser.mjs.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const {readManifest} = await import('../src/core/js/element-manifest.js');
const {readAliasTable} = await import('../src/core/js/alias-table.js');

const COMPONENTS = {
  'country-code': {class: 'SfCountryCode', sheets: 'src/component/country-code/scss'},
  color: {class: 'SfColor', sheets: 'src/smart/color/js/templates'},
  'range-slider': {class: 'SfRangeSlider', sheets: 'src/component/range-slider/scss'},
  'button-group': {class: 'SfButtonGroup', sheets: 'src/component/button-group/scss'},
  'image-field': {class: 'SfImageField', sheets: 'src/smart/image-field/scss'},
  'file-upload': {class: 'SfFileUpload', sheets: 'src/component/file-upload/scss'},
  datepicker: {class: 'SfDatepicker', sheets: 'src/component/datepicker/scss'},
};

const sheets = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url))
  .filter((name) => /\.s?css$/u.test(name))
  .map((name) => read(`${dir}/${name}`))
  .join('\n');

for (const [folder, spec] of Object.entries(COMPONENTS)) {
  const base = `src/smart/${folder}`;

  test(`${folder}: the element is made from its component.json, language files and aliases`, () => {
    const source = read(`${base}/index.js`);
    for (const file of ['./component.json', './aliases.json', './lang/en.json', './lang/ru.json']) {
      assert.ok(source.includes(`from '${file}'`), `${folder} imports ${file}`);
    }
    assert.match(source, /elementFromManifest\(manifest, \{/u);
    assert.match(source, new RegExp(`class ${spec.class} extends `, 'u'));
  });

  test(`${folder}: the manifest has no open to-do, its decisions are written, and it names its files`, () => {
    const manifest = json(`${base}/component.json`);
    assert.equal(manifest.tag, `sf-${folder}`);
    assert.equal(manifest['x-todo'], undefined, 'every x-todo is decided');
    assert.ok(Array.isArray(manifest['x-decisions']) && manifest['x-decisions'].length > 0, 'decisions are recorded');
    for (const file of [manifest.examples, 'probe.json', manifest.templates.default.file]) {
      assert.ok(existsSync(new URL(`../${base}/${file}`, import.meta.url)), `${folder}/${file} exists`);
    }
    const examples = json(`${base}/${manifest.examples}`);
    assert.ok(Array.isArray(examples) && examples.length >= 3, 'named examples');
    for (const example of examples) assert.ok(example.name && example.settings && example.expect, JSON.stringify(example));
    const probe = json(`${base}/probe.json`);
    assert.equal(probe.component, manifest.tag);
    assert.ok(probe.checks.length >= 3);
    const ids = probe.checks.map((check) => check.id);
    assert.equal(new Set(ids).size, ids.length, 'check ids are unique');
    // Every declared key is driven by a check (gate 16).
    const keys = new Set(Object.values(manifest.keyboard || {}).flatMap((map) => Object.keys(map)).filter((key) => key !== 'Tab'));
    const driven = JSON.stringify(probe.checks);
    for (const key of keys) assert.ok(driven.includes(`keyboard:${key}`) || driven.includes(`'${key}'`) || driven.includes(`\\"${key}\\"`), `${folder}: key ${key} is driven by a check`);
  });

  test(`${folder}: five to ten public variables, each read by the sheet with a fallback (§6)`, () => {
    const manifest = json(`${base}/component.json`);
    const names = Object.keys(manifest['css-variables']);
    assert.ok(names.length >= 5 && names.length <= 10, `${folder}: ${names.length}`);
    const source = sheets(spec.sheets);
    for (const name of names) assert.ok(source.includes(`var(${name},`), `${name} is read with a fallback`);
    const contract = json('src/core/contracts/public-variables.v1.json').components.find((entry) => entry.component === folder);
    assert.ok(contract, `${folder} is in public-variables.v1.json`);
    assert.deepEqual(contract.variables.map((one) => one.name).sort(), [...names].sort());
  });

  test(`${folder}: the language files say every runtime word in ru and en`, () => {
    const en = json(`${base}/lang/en.json`);
    const ru = json(`${base}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime || {}).sort(), Object.keys(ru.runtime || {}).sort());
    const manifest = readManifest(json(`${base}/component.json`));
    for (const member of manifest.members) {
      if (member.word) assert.ok(en.runtime[member.word] !== undefined && ru.runtime[member.word] !== undefined, `${member.name} -> runtime.${member.word}`);
    }
  });

  test(`${folder}: every alias row is dated; the shim takes the rows it can serve`, () => {
    const table = json(`${base}/aliases.json`);
    for (const row of table.aliases) {
      assert.equal(row.since, '2026-10-27', `${row.from}`);
      assert.equal(row.remove_after, '2026-12-01', `${row.from}`);
    }
    const {refused} = readAliasTable(table, {tag: `sf-${folder}`});
    for (const one of refused) {
      const row = table.aliases[one.index];
      assert.ok(row.to === null || row.shim === 'none', `${folder}: ${row.from} is refused (${one.reason}) without being a host attribute or a documentary row`);
    }
  });
}

test('sf-country-code: the host is the form control; the inner tel input carries no name and joins no form (§17.1)', () => {
  const source = read('src/smart/country-code/index.js');
  assert.match(source, /class SfCountryCode extends FormField\(CountryCodeElement\)/u);
  assert.match(source, /controlName: this\.sfInternals \? '' : this\.name/u);
  assert.match(source, /controlForm: this\.sfInternals \? '' : this\.getAttribute\('form'\)/u);
  const manifest = json('src/smart/country-code/component.json');
  assert.equal(manifest.settings.form, undefined, 'form is a host attribute, read by the browser');
  assert.deepEqual(manifest.form.validity, ['value-missing', 'custom-error']);
  assert.equal(json('src/smart/country-code/lang/ru.json').runtime['value-missing'], 'Введите номер телефона.');
});

test('sf-color: shown is the base value; the painted colour is effective-value, a dated documentary rename (§4.1, §4.3)', () => {
  const source = read('src/smart/color/index.js');
  assert.doesNotMatch(source, /\n {4}get shown\(\) \{/u, 'the component no longer shadows the base value shown');
  assert.match(source, /\n {4}get effectiveValue\(\) \{/u);
  assert.match(source, /class SfColor extends FormField\(ColorElement\)/u);
  assert.match(source, /base: InheritedValueField\(SfBaseElement\)/u);
  const manifest = json('src/smart/color/component.json');
  assert.deepEqual(Object.keys(manifest.values), ['value', 'effective-value']);
  assert.deepEqual(manifest['host-states'], {'data-inherited': 'boolean'});
  const rows = json('src/smart/color/aliases.json').aliases;
  assert.deepEqual(rows.map((row) => [row.from, row.to]), [['sf-field:reset', 'sf-field-reset'], ['shown', 'effective-value']]);
  // Words come from the language files, trait words with them (§11).
  assert.doesNotMatch(source, /COLOR_TEXT|Выбрать цвет/u);
  assert.equal(json('src/smart/color/lang/ru.json').runtime.reset, 'Сбросить к наследуемому');
  // Without ElementInternals only: the hidden input.
  assert.match(source, /hiddenName: this\.sfInternals \? "" : this\.name/u);
  assert.match(read('src/smart/color/js/templates/default.js'), /context\.hiddenName/u);
});

test('sf-range-slider: prefix is prefix-text; step is a number or null; disabled is drawn by the template (§3.1, §4.2, §5.3)', () => {
  const source = read('src/smart/range-slider/index.js');
  assert.doesNotMatch(source, /\n {2}get prefix\(\) \{/u, 'prefix is the browser\'s own property');
  assert.doesNotMatch(source, /classList\.toggle\('disabled'/u);
  assert.match(source, /'prefix-text',/u);
  assert.match(read('src/smart/range-slider/js/templates/default.js'), /data-prefix=\$\{valueOrNothing\(context\.prefixText\)\}/u);
  const manifest = json('src/smart/range-slider/component.json');
  assert.deepEqual(manifest.settings.step, {type: 'number', nullable: true, default: null});
  assert.equal(manifest.settings['prefix-text'].type, 'string');
  assert.equal(manifest.form, undefined, 'not a form control in this version');
  const {rows} = readAliasTable(json('src/smart/range-slider/aliases.json'), {tag: 'sf-range-slider'});
  assert.deepEqual(rows.map((row) => [row.kind, row.from, row.to]), [['setting', 'prefix', 'prefix-text'], ['event', 'sf-range-slider-change', 'change'], ['event', 'onSliderChange', 'change']]);
});

test('sf-button-group: select and clear are the manifest\'s actions; change once; the host is the form control (§4.4, §8, §17.1)', () => {
  const source = read('src/smart/button-group/index.js');
  assert.match(source, /class SfButtonGroup extends FormField\(ButtonGroupElement\)/u);
  assert.doesNotMatch(source, /\n {2}select\(nextValue\) \{|\n {2}clear\(\) \{/u, 'the actions are generated from the manifest');
  assert.match(source, /actions: \{\n {4}select\(\{ value: nextValue \} = \{\}\) \{/u);
  assert.doesNotMatch(source, /THEME_SWITCH_TEXT|Как в системе/u);
  assert.doesNotMatch(source, /new CustomEvent\('change'/u);
  assert.match(source, /hiddenName: this\.sfInternals \? '' : this\.name/u);
  const manifest = json('src/smart/button-group/component.json');
  assert.deepEqual(Object.keys(manifest.actions), ['select', 'clear']);
  assert.deepEqual(Object.keys(manifest.settings.items.of), ['id', 'value', 'label', 'icon', 'count', 'icon-only', 'loading', 'disabled']);
  assert.equal(json('src/smart/button-group/lang/ru.json').runtime.system, 'Как в системе');
});

test('sf-image-field: vocabulary names with dated colon aliases, error is invalid, ids from the instance path (§7.1.1, §16.20, §17.2)', () => {
  const source = read('src/smart/image-field/index.js');
  assert.match(source, /class SfImageField extends FormField\(ImageFieldElement\)/u);
  for (const verb of ['attach', 'detach', 'rejected']) assert.match(source, new RegExp(`this\\.sfEmit\\('${verb}', `, 'u'), verb);
  assert.doesNotMatch(source, /new CustomEvent\('sf-image-field:/u, 'the colon names are the shim\'s');
  assert.doesNotMatch(source, /let sequence|\+\+sequence/u, 'no counter ids');
  assert.match(source, /partId\(instancePath\(this, \{kind: 'sf-image-field'\}\)\)/u);
  assert.doesNotMatch(source, /IMAGE_FIELD_TEXT/u);
  const manifest = json('src/smart/image-field/component.json');
  assert.equal(manifest.settings.error, undefined, 'error is a dated alias of invalid');
  assert.deepEqual(Object.keys(manifest.actions), ['clear', 'choose', 'remove-image', 'take-file', 'set-error']);
  assert.deepEqual(manifest['host-states'], {'data-dragged-over': 'boolean'});
  const rows = json('src/smart/image-field/aliases.json').aliases.filter((row) => row.to);
  assert.deepEqual(rows.map((row) => [row.from, row.to]), [
    ['sf-image-field:select', 'sf-image-field-attach'],
    ['sf-image-field:remove', 'sf-image-field-detach'],
    ['sf-image-field:reject', 'sf-image-field-rejected'],
    ['error', 'invalid'],
  ]);
});

test('sf-file-upload: each entry is a stream (§10.8); the colon names follow the vocabulary names (vocabulary 1.1.5 §9.1)', () => {
  const source = read('src/smart/file-upload/index.js');
  assert.match(source, /class SfFileUpload extends FileUploadElement/u);
  for (const verb of ['begun', 'chunk', 'cancelled']) assert.match(source, new RegExp(`this\\.sfEmit\\('${verb}', `, 'u'), verb);
  assert.match(source, /'sf-file-upload:file-complete': 'completed'/u);
  assert.match(source, /'sf-file-upload:file-error': 'failed'/u);
  // change keeps its native name through sfEmit (core/js/element-manifest.js eventName).
  assert.match(source, /this\.sfEmit\('change', chosen\)/u);
  assert.doesNotMatch(source, /FILE_UPLOAD_TEXT|pageText/u);
  assert.doesNotMatch(source, /\n {2}removeItem\(index\) \{|\n {2}clear\(\) \{/u, 'remove-item and clear are the manifest\'s actions');
  const manifest = json('src/smart/file-upload/component.json');
  for (const verb of ['begun', 'chunk', 'completed', 'failed', 'cancelled']) assert.ok(manifest.events[verb], verb);
  assert.deepEqual(manifest.events.failed.carries.reason, 'string');
  assert.equal(manifest.form, undefined, 'the area submits nothing; the host uploads');
  const rows = json('src/smart/file-upload/aliases.json').aliases.filter((row) => row.to);
  assert.deepEqual(rows.map((row) => row.to.replace('sf-file-upload-', '')), ['attach', 'attached', 'detach', 'rejected', 'retry', 'completed', 'failed', 'finished']);
  assert.ok(rows.every((row) => row.from.startsWith('sf-file-upload:')), 'only the names that shipped');
  // The dragged-over look reads the host state too (§5.3).
  assert.match(read('src/component/file-upload/scss/_css__file_upload.scss'), /sf-file-upload\[data-dragged-over\] > \.sf-file-upload:not\(\[disabled\]\):not\(\.disabled\) \{/u);
});

test('sf-datepicker: a leaf with outcome actions; the form gets the ISO date; the panel id from the path (§4.4, §7.1.1, §17.1)', () => {
  const source = read('src/smart/datepicker/index.js');
  assert.match(source, /class SfDatepicker extends FormField\(DatepickerElement\)/u);
  for (const method of ['openPanel', 'closePanel', 'togglePanel', 'choosePreset', 'chooseCustomRange']) {
    assert.doesNotMatch(source, new RegExp(`\\n {4}${method}\\(`, 'u'), `${method} is generated from the manifest's action`);
  }
  assert.match(source, /this\.sfEmit\('change', detail\)/u);
  assert.doesNotMatch(source, /new CustomEvent\('(?:change|sf-datepicker-change)'|emitComponentEvent\('change'/u);
  assert.doesNotMatch(source, /DATEPICKER_TEXT|datepickerSequence/u);
  assert.match(source, /partId\(instancePath\(this, \{kind: 'sf-datepicker'\}\), 'panel'\)/u);
  assert.match(source, /if \(startValue && endValue\) return `\$\{startValue\}\/\$\{endValue\}`;/u);
  assert.match(source, /boxName: this\.sfInternals \? '' : this\.inputName/u);
  const manifest = json('src/smart/datepicker/component.json');
  assert.equal(manifest.kind, 'leaf');
  assert.ok(manifest['x-decisions'].some((line) => line.startsWith('assembly: it stays a leaf')));
  assert.deepEqual(Object.keys(manifest.actions), ['open-panel', 'close-panel', 'toggle-panel', 'choose-preset', 'choose-custom-range']);
  assert.equal(manifest.settings.presets.type, 'list');
  assert.equal(manifest['side-effects'], undefined, 'the panel is never moved to the end of body');
});
