import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readdir} from 'node:fs/promises';

import {FIELD_LADDER, FIELD_SIZES, RETIRED_FIELD_SIZES, fieldSize, ladderSize, nearestFieldSize, retireFieldSizeClass} from '../src/component/field-size.js';
import {withoutPublicVariables} from './support/public-variables.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8').then(withoutPublicVariables);

/* Form fields come in three sizes. The two outer steps were retired because
   nothing used them and they could not hold a field's own pictures, tags and
   targets; this file keeps the scale from growing back one component at a time.
   sf-input kept them first (actions block item 4, 2026-11-08): a toolbar
   search and a hero search stand beside buttons of 1/3 and 3. The fields
   ladder (2026-11-14) puts lookup, quantity, date, code, colour and phone on
   the same five steps (field-size.js FIELD_LADDER), then the textarea and
   the rich text; the rest keep three. */
const INPUT_SIZES = ['1/3', '1/2', '1', '2', '3'];
const FIELDS = {
  dropdown: 'dropdown', 'file-upload': 'file-upload',
};
const RETIRED_CLASS = /\.sf-(dropdown|file-upload|upload-progress)--size-(1\\\/3|3)(?![\w\\/-])/;
const LADDER_FIELDS = ['input', 'input-lookup', 'input-quantity', 'input-date', 'input-code', 'input-color', 'input-country', 'input-textarea', 'input-rich'];

test('field sizes: the scale is 1/2, 1 and 2, and a retired size maps to its neighbour', () => {
  assert.deepEqual([...FIELD_SIZES], ['1/2', '1', '2']);
  assert.deepEqual({...RETIRED_FIELD_SIZES}, {'1/3': '1/2', '3': '2'});
  const warn = console.warn; const said = [];
  console.warn = (m) => said.push(m);
  try {
    assert.equal(fieldSize('1/3', 'probe'), '1/2');
    assert.equal(fieldSize('3', 'probe'), '2');
    assert.equal(fieldSize('3', 'probe'), '2');
    assert.equal(fieldSize('2'), '2');
    assert.equal(fieldSize('7'), '1');
    assert.equal(fieldSize(undefined), '1');
  } finally { console.warn = warn; }
  assert.equal(said.length, 2, 'each retired size warns once per component');
});

test('field sizes: hand-written markup with a retired class is moved to the kept size', () => {
  const classes = new Set(['sf-dropdown', 'sf-dropdown--size-1/3']);
  const root = {classList: {
    contains: (c) => classes.has(c),
    replace: (a, b) => { classes.delete(a); classes.add(b); },
  }};
  const warn = console.warn; console.warn = () => {};
  try { retireFieldSizeClass(root, 'sf-dropdown'); } finally { console.warn = warn; }
  assert.deepEqual([...classes].sort(), ['sf-dropdown', 'sf-dropdown--size-1/2']);
});

async function sheets(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true, recursive: true})) {
    if (entry.isFile() && /\.(scss|css)$/.test(entry.name)) out.push(`${entry.parentPath ?? entry.path}/${entry.name}`);
  }
  return out;
}

test('field sizes: no field sheet styles a retired size', async () => {
  const found = [];
  for (const name of Object.keys(FIELDS)) {
    for (const path of await sheets(new URL(`src/component/${name}/`, ROOT).pathname)) {
      if (RETIRED_CLASS.test(await readFile(path, 'utf8'))) found.push(path);
    }
  }
  assert.deepEqual(found, []);
});

test('field sizes: sf-input stands on the whole control ladder', async () => {
  const sheet = await read('src/component/inputs/scss/_css__custom.scss');
  for (const size of ['1\\/3', '3']) {
    assert.ok(sheet.includes(`.sf-input.sf-input--size-${size} .sf-input-field {\n    block-size: var(--sf-ui-${size}--control-height);`), `.sf-input size ${size}`);
  }
  const pill = sheet.slice(sheet.indexOf('.sf-input.sf-input--radius-rounded {'));
  assert.ok(pill.length > 0 && /^[^}]*var\(--sf-radius-rounded\)/.test(pill), 'radius rounded is a pill');
  const manifest = JSON.parse(await read('src/smart/input/smart.manifest.json'));
  assert.deepEqual(manifest.inputs.properties.size.enum, INPUT_SIZES);
  assert.deepEqual(manifest.inputs.properties.radius.enum, ['', 'default', 'square', 'rounded']);
});

test('field sizes: Smart manifests offer the three sizes and nothing else', async () => {
  for (const name of ['dropdown', 'file-upload']) {
    const manifest = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`));
    assert.deepEqual(manifest.inputs.properties.size.enum, [...FIELD_SIZES], name);
  }
});

test('field sizes: the fields of the field ladder offer its five steps', async () => {
  assert.deepEqual([...FIELD_LADDER], INPUT_SIZES);
  assert.deepEqual(['1/3', '3', ' 2 ', 'x', undefined].map((size) => ladderSize(size)), ['1/3', '3', '2', '1', '1']);
  for (const name of LADDER_FIELDS) {
    const manifest = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`));
    assert.deepEqual(manifest.inputs.properties.size.enum, INPUT_SIZES, name);
  }
  const datepicker = JSON.parse(await read('src/smart/input-date/smart.manifest.json'));
  assert.deepEqual(datepicker.inputs.properties['input-size'].enum, INPUT_SIZES, 'datepicker input-size');
  for (const name of [...LADDER_FIELDS.slice(1, 6).filter((n) => n !== 'input-color'), 'input-textarea', 'input-rich']) {
    assert.match(await read(`src/smart/${name}/index.js`), /ladderSize\(/, `${name} reads its size on the ladder`);
  }
});

test('field sizes: the ladder fields size their outer steps from the shared ladder', async () => {
  const sheets = {
    'src/smart/input-lookup/scss/_smart__lookup.scss': 'sf-lookup',
    'src/component/quantity/scss/_css__quantity.scss': 'sf-quantity',
    'src/component/verification/scss/_css__verification_custom.scss': 'sf-verification',
    'src/component/country-code/scss/_css_country_code_custom.scss': 'sf-country-code',
    'src/component/textarea/scss/_css__textarea.scss': 'sf-textarea',
    'src/smart/input-rich/scss/_smart__rich_text.scss': 'sf-rich-text',
  };
  for (const [path, block] of Object.entries(sheets)) {
    const sheet = await read(path);
    assert.match(sheet, /@use '[./]+(component\/)?inputs\/scss\/field-ladder' as ladder;/, `${path} reads the ladder`);
    assert.ok(sheet.includes(`ladder.size-class('${block}'`), `${path} sizes its outer steps from it`);
  }
  const colour = await read('src/smart/input-color/js/templates/default.css');
  for (const size of ['1\\/3', '3']) {
    assert.ok(colour.includes(`--sf-color--control-height: var(--sf-ui-${size}--control-height);`), `input-color ${size}`);
  }
});

test('field sizes: every field reads its size through the one rule', async () => {
  const sources = [
    'src/component/inputs/js/_inputs.js', 'src/component/textarea/js/_textarea.js',
    'src/component/quantity/js/_quantity.js', 'src/component/country-code/js/_country_code.js',
    'src/component/file-upload/js/_file_upload.js', 'src/component/dropdown/js/_dropdown.js',
    'src/smart/input/index.js', 'src/smart/input-textarea/index.js', 'src/smart/dropdown/index.js',
    'src/smart/file-upload/index.js', 'src/smart/file-upload/js/templates/default.js',
    'src/smart/input-country/index.js', 'src/smart/input-date/index.js',
  ];
  for (const path of sources) {
    const source = await read(path);
    assert.match(source, /from '[./]+(component\/)?field-size'/, `${path} imports the field size rule`);
    assert.doesNotMatch(source, /\['1\/3', '1\/2', '1', '2', '3'\]/, `${path} keeps no private five-size list`);
  }
  for (const path of ['src/component/dropdown/js/_dropdown.js', 'src/smart/dropdown/js/templates/default.js']) {
    const map = (await read(path)).match(/const FIELD_TAG = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
    assert.deepEqual([...map.matchAll(/"([^"]+)":/g)].map((m) => m[1]), [...FIELD_SIZES], path);
  }
});

/* Checkbox, radio and switch sit next to fields in the same form, so they
   share the field scale. A list with the whole scale asks for the nearest of
   the three: a size 1/2 list used to ask for a 1/3 checkbox that never existed. */
test('field sizes: checkbox, radio and switch have the same three sizes', async () => {
  const boxes = {
    checkbox: ['src/component/checkbox/scss/_css__checkbox.scss', '.sf-checkbox.sf-checkbox--size-1\\/2 .sf-checkbox-box {\n    --sf-checkbox-box--height: var(--sf-text-height-1\\/2);'],
    radio: ['src/component/radio/scss/_css_radio.scss', '.sf-radio-button.sf-radio-button--size-1\\/2 .sf-radio-button-box {\n  --sf-radio-button-box--height: var(--sf-text-height-1\\/2);'],
    switch: ['src/component/switch/scss/_css_switch.scss', '.sf-switch.sf-switch--size-1\\/2 {\n  --sf-switch--track-height: var(--sf-text-height-1\\/2);'],
  };
  for (const [name, [path, rule]] of Object.entries(boxes)) {
    assert.ok((await read(path)).includes(rule), `${name} size 1/2`);
    const manifest = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`));
    assert.deepEqual(manifest.inputs.properties.size.enum, [...FIELD_SIZES], name);
  }
  for (const path of ['src/smart/list-item/index.js', 'src/smart/list-item/js/templates/default.js']) {
    const source = await read(path);
    assert.equal((source.match(/checkbox: nearestFieldSize\(size\)/g) || []).length, 2, path);
  }
  assert.deepEqual(['1/3', '1/2', '1', '2', '3', 'x'].map(nearestFieldSize), ['1/2', '1/2', '1', '2', '2', '1']);
});
