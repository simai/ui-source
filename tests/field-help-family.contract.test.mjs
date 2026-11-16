import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');
const json = async (path) => JSON.parse(await read(path));

/* The «?» after a field's label (owner decision C153 (8)) is the help setting
   of every member of the field family (helpers/field-help.js). The file
   upload area, the image, the colour and the code field had none (queue #70,
   2026-11-16): each takes sf-input's name, help, draws sf-help-mark through
   the one helper, fetches it with the field and names it with the family's
   word. The file upload area takes the family's label with it: the mark
   stands after a label. */
const FIELDS = {
  'file-upload': 'src/smart/file-upload/js/templates/default.js',
  'input-image': 'src/smart/input-image/js/templates/default.js',
  'input-color': 'src/smart/input-color/js/templates/default.js',
  'input-code': 'src/smart/input-code/js/templates/default.js',
};
const WORDS = {en: 'More about: {label}', ru: 'Подробнее: {label}'};

test('field help: the file, image, colour and code fields take sf-input\'s help', async () => {
  const input = await json('src/smart/input/smart.manifest.json');
  for (const [name, template] of Object.entries(FIELDS)) {
    const manifest = await json(`src/smart/${name}/smart.manifest.json`);
    const help = manifest.inputs.properties.help;
    assert.ok(help, `${name} offers help`);
    assert.equal(help.type, input.inputs.properties.help.type, `${name} help is a string, as sf-input's`);
    assert.equal(help.default, '', `${name} help is empty by default`);
    assert.ok(manifest.inputs.properties.label, `${name} has the label the mark stands after`);
    const source = await read(template);
    assert.match(source, /import \{renderFieldHelp\} from '\.\.\/\.\.\/\.\.\/helpers\/field-help';/, `${name} draws the mark through the helper`);
    assert.match(source, /renderFieldHelp\(\{help: context\.help, label: context\.label,/, `${name} passes help and label`);
    assert.match(await read(`src/smart/${name}/rule.js`), /name: 'cl-help-mark'/, `${name} fetches sf-help-mark with the field`);
    for (const [locale, word] of Object.entries(WORDS)) {
      const lang = await json(`src/smart/${name}/lang/${locale}.json`);
      assert.equal(lang.runtime.help, word, `${name} ${locale} names the mark by its subject`);
    }
  }
});

test('field help: the colour field\'s mark stands outside the hidden label copy', async () => {
  const source = await read(FIELDS['input-color']);
  assert.match(source, /<span class="sf-color-label-row"><span class="sf-color-label" aria-hidden="true">\$\{context\.label\}<\/span>\$\{renderFieldHelp\(/);
});

test('field help: the file upload label names the area unless the page named it', async () => {
  const source = await read(FIELDS['file-upload']);
  assert.match(source, /const labelledBy = context\.label && !context\.ariaLabel \? context\.labelId : '';/);
  assert.match(source, /aria-labelledby=\$\{labelledBy \|\| nothing\}/);
});
