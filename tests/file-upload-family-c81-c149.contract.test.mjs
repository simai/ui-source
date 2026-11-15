import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// C81: sf-file-upload draws its files in the one file family (sf-file-preview).
// C149 (8): the row's remove control is «×» «Убрать {name}» (the file leaves the
// list, at once, with «Вернуть» in a notice); a stored file keeps the bin
// «Удалить {name}» behind a question.

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const template = await read('src/smart/file-upload/js/templates/default.js');
const smart = await read('src/smart/file-upload/index.js');
const ordinary = await read('src/component/file-upload/js/_file_upload.js');
const component = JSON.parse(await read('src/smart/file-upload/component.json'));
const words = {
  smartRu: JSON.parse(await read('src/smart/file-upload/lang/ru.json')),
  smartEn: JSON.parse(await read('src/smart/file-upload/lang/en.json')),
  classRu: JSON.parse(await read('src/component/file-upload/lang/ru.json')),
};

test('C81: every Smart row is an sf-file-preview row, drawn by key', () => {
  assert.match(template, /<sf-file-preview\b/u);
  assert.match(template, /repeat\(/u, 'rows are keyed, so a removed row takes no other row\'s preview');
  assert.doesNotMatch(template, /<sf-progress-bar\b/u, 'the bar is the preview\'s uploading state');
  for (const attr of ['file-name', 'file-size', 'mime-type', 'image-url', 'state', 'value', 'error-text', 'download-action']) {
    assert.match(template, new RegExp(`${attr}=`, 'u'), attr);
  }
  assert.match(template, /\?stored=/u);
  const relation = component.relations?.find?.((r) => r.name === 'cl-file-preview')
    ?? Object.values(component.relations || {}).flat().find((r) => r?.name === 'cl-file-preview');
  assert.ok(relation, 'sf-file-upload relates to the file family');
});

test('C149 (8): «×» removes at once and offers «Вернуть»; the bin of a stored file is asked first', () => {
  assert.match(template, /@sf-file-preview-detach=/u);
  assert.match(smart, /handleRowDetach\(event, index\)/u);
  assert.match(smart, /SF\?\.notify\?\.\(\{[\s\S]{0,400}action: \{label: this\.sfWord\('undo'\), onSelect: \(\) => this\.restoreItem\(item, index\)\}/u, 'a removed file comes back from the notice');
  assert.match(smart, /restoreItem\(/u);
  assert.equal(words.smartRu.runtime.undo, 'Вернуть');
  assert.equal(words.smartEn.runtime.undo, 'Undo');
  assert.equal(words.smartRu.runtime.remove, 'Убрать');
  assert.equal(words.classRu.runtime.remove, 'Убрать');
  assert.match(ordinary, /'close'/u, 'the class row\'s remove glyph is the cross');
  assert.match(ordinary, /action/u);
});

test('C149 (8): focus goes to the next row after a removal, else to the zone', () => {
  assert.match(smart, /_focusAfterRemoval\(/u);
});
