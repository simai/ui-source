import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Shadow geometry is written once (C20): src/core/scss/mix/_mix__shadow.scss,
// steps of the size ladder. The utilities draw it from there; the coloured
// ones (until 2027-01-01) change only the two colours.
const files = [
  'core/scss/_sf_css__shadow.scss',
  'core/scss/mix/_mix__shadow.scss',
  'utility/box-shadow/default/scss/_sf_css__shadow.scss',
  'utility/box-shadow/hover/scss/_sf_css__shadow.scss',
  'utility/drop-shadow/default/scss/_sf_css__filter_drop_shadow.scss',
  'utility/drop-shadow/hover/scss/_sf_css__filter_drop_shadow.scss',
  'utility/box-shadow-color/default/scss/_sf_css__box_shadow_color.scss',
  'utility/box-shadow-color/hover/scss/_sf_css__box_shadow_color.scss',
  'utility/box-shadow-color/active/scss/_sf_css__box_shadow_color.scss',
  'utility/drop-shadow-color/default/scss/_sf_css__filter_drop_shadow_color.scss',
  'utility/drop-shadow-color/hover/scss/_sf_css__filter_drop_shadow_color.scss',
];
const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const code = file => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('owned shadow geometry uses system primitives instead of length literals', () => {
  for (const file of files) {
    assert.doesNotMatch(code(file), /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/, file);
  }
});

test('the shadow utilities draw the one geometry; the coloured ones set only the two colours', () => {
  for (const file of files.slice(2, 6)) {
    assert.match(code(file), /@use '[./]*core\/scss\/mix\/mix__shadow' as shadow;/u, `${file} reads the geometry`);
    assert.doesNotMatch(code(file), /--sf-ui-shadow-|level-ratio/u, file);
  }
  for (const file of files.slice(6)) {
    const declared = [...code(file).matchAll(/(--sf-[a-z0-9-]+)\s*:/gu)].map(([, name]) => name);
    assert.deepEqual([...new Set(declared)].sort(), ['--sf-shadow-ambient-color', '--sf-shadow-key-color'], file);
  }
  for (const file of files.slice(7)) {
    if (file.includes('/default/')) continue;
    const values = [...code(file).matchAll(/--sf-shadow-[a-z]+-color:\s*([^;]+);/g)].map(match => match[1]);
    assert.ok(values.length && values.every(value => /!important\s*$/.test(value)), file);
  }
});

test('one-pixel shadow offsets remain on the fixed pixel primitive', () => {
  assert.match(read(files[1]), /'raised': \(\('0', 'var\(--sf-px\)', 'var\(--sf-a2\)', 'key'\)/);
});
