import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// sf-dropdown 1.6.0: a field with nothing chosen says so (Larena, 2026-11-06).
// The browser half is tests/browser/dropdown-empty-state.browser.mjs.
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const json = async (file) => JSON.parse(await read(file));

test('the placeholder defaults to the language word runtime.empty, in both languages', async () => {
  const component = await json('src/smart/dropdown/component.json');
  assert.match(component.version, /^1\.6\.\d+$/u);
  assert.equal(component.settings.placeholder['default-from'], 'runtime.empty');
  assert.equal(Object.hasOwn(component.settings.placeholder, 'default'), false);
  assert.equal((await json('src/smart/dropdown/lang/ru.json')).runtime.empty, 'Не выбрано');
  assert.equal((await json('src/smart/dropdown/lang/en.json')).runtime.empty, 'Not selected');
  const manifest = await json('src/smart/dropdown/smart.manifest.json');
  assert.match(manifest.version, /^1\.6\.\d+$/u);
  assert.equal(Object.hasOwn(manifest.inputs.properties.placeholder, 'default'), false);
});

test('the dropdown shows the word without choosing anything', async () => {
  const source = await read('src/smart/dropdown/index.js');
  assert.match(source, /get placeholder\(\) \{\s*return this\.getAttribute\('placeholder'\) \|\| this\.sfWord\('empty'\);/);
  assert.match(source, /placeholder: this\.placeholder,/);
  // Nothing in the dropdown picks an option for the person.
  assert.doesNotMatch(source, /_selectedValues = \[[^\]]*options\[0\]/);
});

test('the choice field renderers pass the field placeholder, else leave the word to the dropdown', async () => {
  const source = await read('src/smart/field-renderers/index.js');
  for (const name of ['renderChoiceEdit', 'renderChoicesEdit']) {
    const start = source.indexOf(`function ${name}(`);
    const body = source.slice(start, source.indexOf('\n}\n', start));
    assert.match(body, /placeholder=\$\{field\.placeholder \|\| nothing\}/, name);
  }
});
