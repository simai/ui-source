import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import { URL } from 'node:url';

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const uiDoc = (file) => readFile(`${process.env.UI_DOC_ROOT}/${file}`, 'utf8');

test('Close remains a decorative glyph and the native Icon Button owns the action', async () => {
  const template = await source('src/smart/close/js/templates/default.js');
  const manifest = JSON.parse(await source('src/smart/close/smart.manifest.json'));
  assert.match(template, /aria-hidden="true"/);
  assert.doesNotMatch(template, /<button|tabindex|aria-label/);
  assert.deepEqual(manifest.accessibility.keyboard, []);
  assert.equal(manifest.accessibility.accessible_name, 'internal');
  assert.match(manifest.accessibility.focus, /containing native button/i);
});

test('Smart Close closes the complete released size axis and rejects unknown input', async () => {
  // The element's size is made from component.json (core/js/element-manifest.js):
  // the attribute, the property, and an unknown value read as the default.
  const runtime = await source('src/smart/close/index.js');
  const manifest = JSON.parse(await source('src/smart/close/smart.manifest.json'));
  const component = JSON.parse(await source('src/smart/close/component.json'));
  const sizes = ['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7'];
  assert.deepEqual(manifest.inputs.properties.size.enum, sizes);
  assert.deepEqual(component.settings.size, {type: 'enum', values: sizes, default: '1/3'});
  assert.match(runtime, /elementFromManifest\(manifest/);
  assert.match(runtime, /size: this\.size/);
});

test('Close rendered geometry and colour are token-owned and font-independent', async () => {
  const css = await source('src/component/close/scss/_css__close.scss');
  for (const size of ['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7']) {
    assert.match(css, new RegExp(`--sf-text-size-${size.replace('/', '\\\\/')}`));
  }
  // The glyph takes the paler of the two roles for what stands on a surface.
  // It was --sf-outline, the role of a boundary: 4.47:1, and moved with a
  // theme's borders rather than with its text.
  assert.match(css, /--sf-close-icon--background-color: var\(--sf-close-color, var\(--sf-on-surface-variant\)\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /font-family|Material Symbols/);
});

test('Close documentation uses runnable action and glyph examples', async () => {
  const page = await uiDoc('content/ru/components/actions/close.md');
  const overview = await uiDoc('examples/components/close/overview/index.html');
  const sizes = await uiDoc('examples/components/close/sizes/index.html');
  const glyphSizes = await uiDoc('examples/components/close/glyph-sizes/index.html');
  for (const id of ['overview', 'sizes', 'glyph-sizes']) {
    assert.match(page, new RegExp(`components/close/${id}`));
  }
  assert.match(overview, /<button[^>]+sf-icon-button[^>]+aria-label=/);
  assert.doesNotMatch(overview, /<button[^>]+class="[^"]*sf-close/);
  assert.equal((sizes.match(/<button/g) || []).length, 5);
  assert.equal((glyphSizes.match(/aria-hidden="true"/g) || []).length, 10);
});
