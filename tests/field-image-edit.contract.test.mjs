import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// A `file` field whose variant is `image` and which holds one file is edited
// with sf-image-field (simai/ui-source#27): the thumbnail, «Заменить…»,
// «Убрать» and a drop on it. Everything else a file field can be -- several
// files, the card and list variants, a file that is not an image -- keeps the
// preview-and-zone pair. The value goes through setFieldValue as every
// control's does; an uploading host is handed the File too.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const body = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, source.indexOf('\n}\n', start));
};

test('only a single image is drawn with sf-image-field', () => {
  assert.match(body('isSingleImageField'),
    /return String\(field\.variant \?\? ''\) === 'image' && field\.multiple !== true && storedFiles\(value\)\.length <= 1;/u);
  // The decision is the file editor's first line, so every other file field
  // reaches the pair it reached before.
  assert.match(body('renderFileEdit'), /^function renderFileEdit\(field, value, host\) \{\n    if \(isSingleImageField\(field, value\)\) return renderImageEdit\(field, value, host\);\n/u);
  // The variant is the registry's own, not a new name.
  const file = PROPERTY_TYPES.find((entry) => entry.type === 'file');
  assert.ok(file.variants.some((variant) => variant.id === 'image'));
  // The map still names one editor for a file.
  assert.match(source, /\n    file: renderFileEdit,\n/u);
});

test('the image field takes the field as the other controls do', () => {
  const edit = body('renderImageEdit');
  const element = edit.slice(edit.indexOf('<sf-image-field'), edit.indexOf('></sf-image-field>'));
  assert.match(element, /size=\$\{EDIT_SIZE\}/u);
  assert.match(element, /name=\$\{fieldName\(field\)\}/u);
  // A property, never the attribute: a File does not survive JSON, and a
  // changed attribute releases the object URL the thumbnail shows.
  assert.match(element, /\.value=\$\{stored\}/u);
  assert.doesNotMatch(element, /\svalue=/u);
  // The panel prints the label: the field takes it as its name only.
  assert.match(element, /aria-label=\$\{field\.label \|\| field\.key \|\| ''\}/u);
  assert.doesNotMatch(element, /(?<!aria-)label=/u);
  assert.match(element, /\?required=\$\{Boolean\(field\.required\)\}/u);
  assert.match(element, /\?disabled=\$\{field\.readonly === true\}/u);
  // The accept filter and the quiet line under the field are the host's.
  assert.match(element, /accept=\$\{field\.accept \? String\(field\.accept\) : nothing\}/u);
  assert.match(element, /hint=\$\{field\.uploadSupportingText \|\| nothing\}/u);
  assert.match(edit, /const stored = storedFiles\(value\)\[0\] \?\? null;/u);
});

test('its change feeds setFieldValue, in the shape the host sent, and an uploading host gets the File', () => {
  const edit = body('renderImageEdit');
  assert.equal((edit.match(/@[a-z-:]+=/gu) ?? []).join(), '@change=', 'the canonical change and nothing else');
  assert.match(edit, /const next = event\.detail\?\.value \?\? null;\n\s+host\.setFieldValue\(field, asList \? \(next \? \[next\] : \[\]\) : next\);/u);
  assert.match(edit, /const asList = Array\.isArray\(value\);/u);
  assert.match(edit, /if \(file && host\.startFieldUpload\) \{\n\s+host\.startFieldUpload\(field, \[\{name: file\.name, state: 'process', progress: 0, file\}\]\);/u);
  // No request leaves the set: the transfer is the host's.
  assert.doesNotMatch(edit, /\bfetch\(|XMLHttpRequest/u);
});

test('the registry lists required for a file, which the image field reads', () => {
  const file = PROPERTY_TYPES.find((entry) => entry.type === 'file');
  assert.deepEqual(file.params, ['accept', 'multiple', 'formats', 'uploadText', 'uploadSupportingText', 'uploadHint', 'required', 'readonly']);
});

test('view and cell of an image already show the image, and are unchanged', () => {
  assert.match(body('renderFileView'), /image-url=\$\{asImage && file\.href \? String\(file\.href\) : nothing\}/u);
  assert.match(body('renderFileCell'), /if \(isImageField\(field\)\) return renderFilePreviewCell\(value\);/u);
});

test('sf-image-field takes a value set before it was defined, and a name without a label', () => {
  const component = readFileSync(join(root, 'src/smart/image-field/index.js'), 'utf8');
  assert.match(component, /if \(Object\.prototype\.hasOwnProperty\.call\(this, 'value'\)\) \{\n\s+const early = this\.value;\n\s+delete this\.value;\n\s+this\._value = normaliseImageValue\(early\);/u);
  assert.match(component, /ariaLabel: \{attribute: 'aria-label', default: ''\},/u);
  assert.match(component, /get ariaLabel\(\) \{ return this\.getProp\('ariaLabel'\) \|\| ''; \}/u);
  assert.match(component, /group: this\.label \|\| this\.ariaLabel \|\| words\.group,/u);
  const manifest = JSON.parse(readFileSync(join(root, 'src/smart/image-field/smart.manifest.json'), 'utf8'));
  assert.equal(manifest.inputs.properties['aria-label']?.type, 'string');
});
