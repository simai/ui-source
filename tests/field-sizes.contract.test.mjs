import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readdir} from 'node:fs/promises';

import {FIELD_SIZES, RETIRED_FIELD_SIZES, fieldSize, nearestFieldSize, retireFieldSizeClass} from '../src/component/field-size.js';
import {withoutPublicVariables} from './support/public-variables.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8').then(withoutPublicVariables);

/* Form fields come in three sizes. The two outer steps were retired because
   nothing used them and they could not hold a field's own pictures, tags and
   targets; this file keeps the scale from growing back one component at a time. */
const FIELDS = {
  inputs: 'input', textarea: 'textarea', dropdown: 'dropdown', quantity: 'quantity',
  verification: 'verification', 'country-code': 'country-code', 'file-upload': 'file-upload',
};
const RETIRED_CLASS = /\.sf-(input|textarea|dropdown|quantity|verification|verification-form|country-code|file-upload|upload-progress)--size-(1\\\/3|3)(?![\w\\/-])/;

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
  const smartInputs = await read('src/smart/inputs/js/templates/default.css');
  if (RETIRED_CLASS.test(smartInputs)) found.push('src/smart/inputs/js/templates/default.css');
  assert.deepEqual(found, []);
});

test('field sizes: Smart manifests offer the three sizes and nothing else', async () => {
  for (const name of ['inputs', 'textarea', 'dropdown', 'file-upload', 'country-code']) {
    const manifest = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`));
    assert.deepEqual(manifest.inputs.properties.size.enum, [...FIELD_SIZES], name);
  }
  const datepicker = JSON.parse(await read('src/smart/datepicker/smart.manifest.json'));
  assert.deepEqual(datepicker.inputs.properties['input-size'].enum, [...FIELD_SIZES], 'datepicker input-size');
});

test('field sizes: every field reads its size through the one rule', async () => {
  const sources = [
    'src/component/inputs/js/_inputs.js', 'src/component/textarea/js/_textarea.js',
    'src/component/quantity/js/_quantity.js', 'src/component/country-code/js/_country_code.js',
    'src/component/file-upload/js/_file_upload.js', 'src/component/dropdown/js/_dropdown.js',
    'src/smart/inputs/index.js', 'src/smart/textarea/index.js', 'src/smart/dropdown/index.js',
    'src/smart/file-upload/index.js', 'src/smart/file-upload/js/templates/default.js',
    'src/smart/country-code/index.js', 'src/smart/datepicker/index.js',
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
