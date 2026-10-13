import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const files = [
  'core/scss/_sf_css__shadow.scss',
  'utility/box-shadow/default/scss/_sf_css__shadow.scss',
  'utility/box-shadow/hover/scss/_sf_css__shadow.scss',
  'utility/box-shadow-color/default/scss/_sf_css__box_shadow_color.scss',
  'utility/box-shadow-color/hover/scss/_sf_css__box_shadow_color.scss',
  'utility/box-shadow-color/active/scss/_sf_css__box_shadow_color.scss',
];
const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('owned shadow geometry uses system primitives instead of length literals', () => {
  for (const file of files) {
    const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(source, /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/, file);
  }
});

test('all role/state shadow families share the exact five token geometries', () => {
  const geometry = value => value.replace(/\s*!important\s*$/, '');
  const expected = [...read(files[3]).matchAll(/--sf-ui-shadow-([1-5]):\s*([^;]+);/g)]
    .map(([,level,value]) => [level, geometry(value)]);
  assert.equal(expected.length, 5);
  for (const file of files.slice(4)) {
    const actual = [...read(file).matchAll(/--sf-ui-shadow-([1-5]):\s*([^;]+);/g)]
      .map(([,level,value]) => [level, geometry(value)]);
    assert.deepEqual(actual, expected, file);
  }
  for (const file of files.slice(4)) {
    const values = [...read(file).matchAll(/--sf-ui-shadow-[1-5]:\s*([^;]+);/g)].map(match => match[1]);
    assert.ok(values.every(value => /!important\s*$/.test(value)), file);
  }
});

test('one-pixel shadow offsets remain on the fixed pixel primitive', () => {
  const source = read(files[3]);
  assert.match(source, /--sf-ui-shadow-1:[^;]*var\(--sf-px\)[^;]*calc\(-1 \* var\(--sf-px\)\)/);
});
