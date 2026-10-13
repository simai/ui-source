import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('ordinary Icons has valid semantic defaults and token geometry', async () => {
  const styles = await read('src/component/icons/scss/_css__icons.scss');

  assert.match(styles, /--sf-icon--weight: var\(--sf-weight--regular\)/);
  assert.match(styles, /--sf-icon--optical-size: 24/);
  assert.match(styles, /--sf-icon--line-height: 1/);
  assert.match(styles, /color: var\(--sf-icon--color, currentColor\)/);
  assert.match(styles, /font-size: var\(--sf-icon--font-size, var\(--sf-icon-size-3\)\)/);
  assert.doesNotMatch(styles, /--sf-icon--optical-size:\s*inherit/);
  assert.doesNotMatch(styles, /(?<![-\w])\d+(?:\.\d+)?(?:px|rem|em)(?![-\w])/);
});

test('ordinary Icons publishes canonical modifiers and compatibility aliases', async () => {
  const styles = await read('src/component/icons/scss/_css__icons.scss');

  for (const value of ['rounded', 'sharp', 'filled']) {
    assert.match(styles, new RegExp(`\\.sf-icon--${value}`));
  }
  assert.match(styles, /@each \$name in \(thin, extra-light, light, regular, medium, semi-bold, bold\)/);
  assert.match(styles, /\.sf-icon--weight-#\{\$name\}/);
  assert.match(styles, /\.sf-icon-rounded/);
  assert.match(styles, /\.sf-icon-shape/);
  assert.match(styles, /\.sf-icon-filled/);
});

test('Loader tracks canonical and legacy ordinary icon descriptors', async () => {
  const [runtime, rule] = await Promise.all([
    read('src/core/js/iconSubsetRuntime.js'),
    read('src/component/icons/rule.js'),
  ]);

  assert.match(runtime, /"sf-icon--weight-medium", "500"/);
  assert.match(runtime, /"sf-icon--rounded", "rounded"/);
  assert.match(runtime, /"sf-icon--sharp", "sharp"/);
  assert.match(runtime, /classList\.contains\("sf-icon--filled"\)/);
  assert.match(runtime, /\.sf-icon:is\(\.sf-icon--sharp, \.sf-icon-shape\)/);
  assert.match(rule, /js: false/);
});

test('Smart Icons projects the canonical ordinary vocabulary', async () => {
  const [source, template] = await Promise.all([
    read('src/smart/icons/index.js'),
    read('src/smart/icons/js/templates/default.js'),
  ]);

  assert.match(source, /sharp: this\.iconType === "sharp"/);
  assert.match(template, /sf-icon--weight-\$\{weightClass\}/);
  assert.match(template, /sf-icon--rounded/);
  assert.match(template, /sf-icon--sharp/);
  assert.match(template, /sf-icon--filled/);
});

test('Icons documentation covers semantics and every public variation', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, families, weights, fill, sizes, color, rotation] = await Promise.all([
    readUiDoc('content/ru/components/content/icons.md'),
    readUiDoc('examples/components/icons/overview/index.html'),
    readUiDoc('examples/components/icons/families/index.html'),
    readUiDoc('examples/components/icons/weights/index.html'),
    readUiDoc('examples/components/icons/fill/index.html'),
    readUiDoc('examples/components/icons/sizes/index.html'),
    readUiDoc('examples/components/icons/color/index.html'),
    readUiDoc('examples/components/icons/rotation/index.html'),
  ]);

  assert.match(page, /role="img"/);
  // sf-icon-loaded is Loader-internal state: the page must say not to write it.
  assert.match(page, /sf-icon-loaded/);
  assert.match(overview, /aria-hidden="true"/);
  assert.match(overview, /role="img" aria-label=/);
  assert.match(families, /sf-icon--rounded/);
  assert.match(families, /sf-icon--sharp/);
  assert.match(weights, /sf-icon--weight-thin/);
  assert.match(fill, /sf-icon--filled/);
  assert.match(sizes, /sf-icon--size-1\/4/);
  assert.match(sizes, /sf-icon--size-7/);
  assert.match(color, /color-primary/);
  assert.match(rotation, /sf-icon--rotate-315/);
  assert.doesNotMatch(`${overview}${families}${weights}${fill}${sizes}${color}${rotation}`, /style=/);
});
