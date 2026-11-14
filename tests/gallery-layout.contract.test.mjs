import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const source = await read('src/smart/gallery/index.js');
const css = await read('src/smart/gallery/js/templates/default.css');
const template = await read('src/smart/gallery/js/templates/default.js');
const rule = await read('src/smart/gallery/rule.js');

test('Gallery draws from its sheet and never writes the geometry of the media', () => {
  assert.doesNotMatch(source, /image\.style\.|caption\.style\.|node\.style\.(?!objectPosition)/);
  assert.match(template, /import '\.\/default\.css'/);
  assert.match(rule, /css: true/);
});

test('Gallery values come from the systems: no raw lengths, colours or !important', () => {
  // A media query cannot read a variable: the phone break is the system's
  // md step written out; a zero length in a fallback is no value.
  const sheet = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media \(max-width: 43\.9375rem\)/g, '').replace(/\b0px\b/g, '');
  assert.doesNotMatch(sheet, /\b\d+(?:\.\d+)?(?:px|rem|em)\b|#[0-9a-f]{3,8}\b|!important/);
});

test('Gallery can shrink as a grid or flex item without clipping its content', () => {
  // The public variable first, 0 its fallback (standard 1.3.8 §6).
  assert.match(css, /\.sf-gallery\s*\{\s*min-width:\s*var\(--sf-gallery-min-inline-size, 0\);\s*\}/);
  assert.doesNotMatch(css, /\.sf-gallery\s*\{[^}]*overflow\s*:\s*(hidden|clip)/);
});
