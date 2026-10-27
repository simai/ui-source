/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';

const uiDocRoot = process.env.UI_DOC_ROOT;
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readUiDoc = path => readFile(`${uiDocRoot}/${path}`, 'utf8');

// The Smart pages' examples live under smart-components/ since the Smart
// migration (ui-doc 5b299228); their overview is `overview` there.
const SMART_EXAMPLES = {'smart-overview': 'smart-components/file-upload/overview'};
const examplePath = (id) => SMART_EXAMPLES[id] ?? `components/file-upload/${id}`;

test('FileUpload keeps File objects for application transport and clears the picker for reselection', async () => {
  const source = await read('src/component/file-upload/js/_file_upload.js');
  assert.match(source, /file,\s*\}\)\);/);
  assert.match(source, /applySelectedFiles\(root, files, 'input'\);\s*event\.target\.value = '';/);
  assert.doesNotMatch(source, /new FormData|fetch\(|XMLHttpRequest/);
});

test('FileUpload documentation follows the user-facing component template and source events', async () => {
  const [ordinary, smart] = await Promise.all([
    readUiDoc('content/ru/components/forms/file-upload.md'),
    readUiDoc('content/ru/smart-components/forms/file-upload.md'),
  ]);

  for (const heading of ['# Загрузка файлов', '## Пример', '## Разметка', '## Состояния', '## Доступность', '## JavaScript']) {
    assert.match(ordinary, new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  // The select event reports where the files came from.
  assert.match(ordinary, /\| `sf-file-upload:select` \|[^\n]*`source` \(`input` или `drop`\)/);
  assert.doesNotMatch(ordinary, /sf-file-upload:change/);
  // The picker is cleared after selection, so a native form submit does not
  // carry the file: the reader must learn that the application sends it.
  assert.match(ordinary, /не добавляет[^.]*в нативный `FormData`/);
  assert.match(smart, /нейтральное значение по умолчанию — `upload_file`/);

  const ordinaryExamples = ['overview', 'selection', 'sizes', 'composition', 'state-process', 'state-done', 'state-error', 'state-disabled', 'actions'];
  const smartExamples = ['smart-overview', 'smart-selection', 'smart-sizes', 'smart-states', 'smart-disabled', 'smart-customization'];
  for (const id of [...ordinaryExamples, ...smartExamples]) {
    const path = examplePath(id);
    assert.match(`${ordinary}\n${smart}`, new RegExp(path));
    await readUiDoc(`examples/${path}/index.html`);
  }
});

test('FileUpload examples do not promise validation or introduce local design CSS', async () => {
  const ids = ['overview', 'selection', 'sizes', 'composition', 'state-process', 'state-done', 'state-error', 'state-disabled', 'actions', 'smart-overview', 'smart-selection', 'smart-sizes', 'smart-states', 'smart-disabled', 'smart-customization'];
  const examples = await Promise.all(ids.map(id => readUiDoc(`examples/${examplePath(id)}/index.html`)));
  const source = examples.join('\n');
  assert.doesNotMatch(source, /до\s+\d+\s*(?:МБ|КБ)/i);
  assert.doesNotMatch(source, /<style\b|style\s*=\s*["'][^"']*(?:px|rem)/i);
  assert.match(source, /root-class="p-2 bg-surface-container radius-default"/);
});

// The item shape was readable only in the source, and the methods looked like
// the only way to listen (consumer case ui-mail.file-upload-browser-recipe,
// 2026-10-21).
test('FileUpload documents the item it exchanges, the two text attributes and binding before upgrade', async () => {
  const [docs, ordinary, smart] = await Promise.all([
    read('src/smart/file-upload/docs/docs.md'),
    read('src/component/file-upload/js/_file_upload.js'),
    read('src/smart/file-upload/index.js'),
  ]);

  // Every documented key is one the component actually reads.
  for (const key of ['id', 'name', 'fileName', 'fileSize', 'sizeText', 'progress', 'state', 'status', 'errorMessage', 'retryText', 'icon', 'file']) {
    assert.ok(docs.includes(`\`${key}\``), `the item's ${key} is documented`);
  }
  assert.match(ordinary, /\['process', 'done', 'error'\]\.includes\(state\)/);
  assert.match(docs, /`process` \(the bar\), `done` \(the check\), `error` \(the retry button\)/);

  // text is the words after the link, not the whole prompt.
  // Its default is the language file's word (standard 1.3.8 §11, §16 item 44).
  assert.match(smart, /text: this\.text,/);
  const uploadManifest = JSON.parse(await read('src/smart/file-upload/component.json'));
  assert.equal(uploadManifest.settings.text['default-from'], 'runtime.text');
  assert.equal(JSON.parse(await read('src/smart/file-upload/lang/ru.json')).runtime.text, 'или перетащите его сюда');
  assert.match(docs, /the words \*\*after\*\* the link/);

  // The methods are addEventListener, so the event works before the upgrade.
  assert.match(smart, /onFileAdd\(handler, options\) \{\s*if \(typeof handler === 'function'\) \{\s*this\.addEventListener\('sf-file-upload:file-add'/);
  assert.match(docs, /## Binding before the element is upgraded/);
  assert.match(docs, /customElements\.whenDefined\('sf-file-upload'\)/);
  assert.match(docs, /## A browser-only import: select → validate → store → retry/);
});
