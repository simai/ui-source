// sf-file-upload, joint pass over the plain components (owner 2026-11-16,
// DEV msg-e7fdc64d, RG-FU-1..4): the class rows are the file family's row, the
// row icon takes the icon ladder, the focus keeps its place when a row leaves,
// and the live regions stand from the start and say what happened.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {fileIcon} from '../src/core/js/composition/file-size.mjs';
import {acceptFormats, acceptsFile, fileRejection, positiveLimit} from '../src/component/file-upload/js/intake.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('src/component/file-upload/js/_file_upload.js');
const words = source.slice(source.indexOf('const FILE_UPLOAD_ITEM_TEXT'), source.indexOf('const FILE_UPLOAD_SELECTOR'));
const helpers = source.slice(source.indexOf('function toBoolean'), source.indexOf('function bindFileUpload'));
const lang = Object.fromEntries(await Promise.all(['en', 'ru', 'kk'].map(async (code) => [code, JSON.parse(await read(`src/component/file-upload/lang/${code}.json`)).runtime])));
const smartLang = Object.fromEntries(await Promise.all(['en', 'ru', 'kk'].map(async (code) => [code, JSON.parse(await read(`src/smart/file-upload/lang/${code}.json`)).runtime])));

const fill = (text, vars = {}) => String(text).replace(/\{([a-z][\w-]*)\}/giu, (whole, name) => (name in vars ? String(vars[name]) : whole));

function sibling(name, next = null) {
  return {classList: {contains: (value) => value === name}, textContent: '', hidden: true, nextElementSibling: next, replaceChildren() { this.textContent = ''; }, append() {}};
}

function area({multiple = true} = {}) {
  const attrs = new Map(multiple ? [['multiple', '']] : []);
  const classes = new Set(['sf-file-upload']);
  const status = sibling('sf-file-upload-status');
  const message = sibling('sf-file-upload-message', status);
  return {
    status, events: [], lang: 'ru', dataset: {},
    classList: {add: (n) => classes.add(n), remove: (n) => classes.delete(n), contains: (n) => classes.has(n), toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)), [Symbol.iterator]: () => classes[Symbol.iterator]()},
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    hasAttribute: (name) => attrs.has(name),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    nextElementSibling: message,
    dispatchEvent(event) { this.events.push(event.type); return true; },
  };
}

function load() {
  const context = vm.createContext({
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    document: {querySelector: () => null}, Element: class Element {},
    fieldSize: (value) => String(value || '1'), LANG_WORDS: {en: lang.en, ru: lang.ru},
    fileIcon, acceptFormats, acceptsFile, fileRejection, positiveLimit,
    formatFileSize: (size) => `${Math.round(Number(size) / 1024)} КБ`,
    pageText: (dictionary, key, node) => dictionary[node?.lang || 'ru']?.[key] ?? key,
    pageWord: (dictionary, key, node, {vars, count} = {}) => {
      const word = dictionary[node?.lang || 'ru']?.[key] ?? key;
      const form = typeof word === 'object' ? (count === 1 ? word.one : word.few && count % 10 >= 2 && count % 10 <= 4 ? word.few : word.other) : word;
      return fill(form, {...vars, n: count});
    },
  });
  vm.runInContext(`${words.replace('const FILE_UPLOAD_ITEM_TEXT', 'var FILE_UPLOAD_ITEM_TEXT')}\n${helpers}\nthis.api = {takeFiles, syncFileUploadStateEvents, restoreListFocus: typeof restoreListFocus === 'function' ? restoreListFocus : null};`, context);
  return context.api;
}

const file = (name, size = 2048, type = 'application/pdf') => ({name, size, type, lastModified: 1});

test('RG-FU-1 (C81): the class row is the family row, one height in every state', () => {
  const draw = source.slice(source.indexOf('function createUploadProgressItem'), source.indexOf('function renderFileUploadItems'));
  // The sf-file-preview row's class markup in a list item, as the Smart area.
  assert.match(draw, /'sf-file-preview',\s*'sf-file-preview--row'/u);
  assert.match(draw, /wrap\.className = 'sf-file-upload-item'/u);
  assert.match(draw, /wrap\.setAttribute\('role', 'listitem'\)/u);
  // The bar stands in the size line's place and «Повторить» among the actions:
  // neither adds a line to the row.
  assert.match(draw, /className = 'sf-file-preview-progress'/u);
  assert.match(draw, /className = 'sf-file-preview-actions'/u);
  assert.match(draw, /retryHost\.className = 'sf-file-preview-retry'/u);
  assert.doesNotMatch(draw, /sf-upload-progress-repeat|sf-upload-progress--size-|content\.append\(retry\)/u);
  // One row at every zone size: the row's own steps, not the zone's.
  assert.doesNotMatch(draw, /normalizedSize|--size-\$\{/u);
  assert.match(draw, /sf-progress-bar--size-1\/2/u);
  assert.match(draw, /sf-icon-button--size-1'/u);
  // The spans hold the bar and the button as the Smart hosts do: no box.
  return read('src/component/file-preview/scss/_css__file_preview.scss').then((css) => {
    assert.match(css, /\.sf-file-preview span:is\(\.sf-file-preview-progress, \.sf-file-preview-retry\) \{\s*display: contents;/u);
  });
});

test('RG-FU-2 (C151 (1)): a hand-written row icon takes the icon ladder, not the text sizes', async () => {
  const css = await read('src/component/file-upload/scss/_css__upload_progress.scss');
  for (const size of ['1\\/2', '1', '2']) {
    const block = css.match(new RegExp(`\\.sf-upload-progress\\.sf-upload-progress--size-${size.replace('/', '\\/')} \\.sf-icon \\{[^}]*\\}`, 'u'))?.[0] || '';
    for (const property of ['font-size', 'height', 'width']) {
      assert.ok(block.includes(`--sf-icon--${property}: var(--sf-text-height-${size});`), `${size} ${property}: ${block}`);
    }
    // The ladder is the step's text line (sf-icon's $sf-icon-ladder), not
    // the text size.
    assert.doesNotMatch(block, /--sf-text-size-/u);
  }
});

test('RG-FU-3: a row taken out gives the focus to the next row, the previous when it was last, the zone when none', () => {
  const api = load();
  assert.equal(typeof api.restoreListFocus, 'function', 'the list keeps its focus');
  assert.doesNotMatch(source, /container\.innerHTML = ''/u);
  const focused = [];
  const button = (row, action, shown = true) => ({focus: () => focused.push(`${row}:${action}`), getClientRects: () => (shown ? [{}] : [])});
  // A failed row holds «Повторить» twice (C260): the focus goes to the one
  // the sheet draws.
  const list = (count) => ({
    querySelectorAll: () => Array.from({length: count}, (_, index) => ({
      querySelectorAll: (selector) => (selector.includes('"retry"')
        ? [button(index, 'retry-words', false), button(index, 'retry-icon')]
        : [button(index, 'remove')]),
    })),
  });
  const zone = {focus: () => focused.push('zone')};
  api.restoreListFocus(zone, list(2), {index: 1, action: 'remove'}); // the 2nd of 3 left
  api.restoreListFocus(zone, list(2), {index: 2, action: 'remove'}); // the last of 3 left
  api.restoreListFocus(zone, list(0), {index: 0, action: 'remove'}); // the only one left
  api.restoreListFocus(zone, list(2), null); // the focus was not in the list
  api.restoreListFocus(zone, list(2), {index: 0, action: 'retry'}); // a narrow row's icon
  assert.deepEqual(focused, ['1:remove', '1:remove', 'zone', '0:retry-icon']);
  const render = source.slice(source.indexOf('function renderFileUploadItems'), source.indexOf('function emitFileUploadItemAdd'));
  assert.match(render, /const held = listFocus\(container\);[\s\S]*restoreListFocus\(root, container, held\);/u);
});

test('RG-FU-4: the live regions stand with the zone and say a file added, sent and not sent', async () => {
  const bind = source.slice(source.indexOf('function bindFileUpload'), source.indexOf('function unbindFileUpload'));
  assert.match(bind, /getStatus\(root, true\);/u, 'an ordinary zone gets its regions when bound');
  const getStatus = source.slice(source.indexOf('function getStatus'), source.indexOf('function announceFileUpload'));
  assert.match(getStatus, /getMessage\(root, true\)/u, 'the message region is made with it');
  const template = await read('src/smart/file-upload/js/templates/default.js');
  assert.match(template, /<div class="sf-file-upload-message" role="status" hidden><\/div>\s*<div class="sf-file-upload-status" role="status" aria-atomic="true"><\/div>/u);
  const css = await read('src/component/file-upload/scss/_css__file_upload.scss');
  assert.match(css, /\.sf-file-upload-status \{\s*position: absolute;[^}]*clip-path: inset\(50%\);/u);

  const api = load();
  const root = area();
  api.takeFiles(root, [file('Акт.pdf')], 'input');
  assert.equal(root.status.textContent, '«Акт.pdf» добавлен');
  api.takeFiles(root, [file('Счёт.pdf'), file('Смета.pdf')], 'drop');
  assert.equal(root.status.textContent, 'Добавлено 2 файла');
  const listed = root.__sfFileUploadItems.map((item) => ({...item}));
  listed[0].state = 'done';
  api.syncFileUploadStateEvents(root, listed, root.__sfFileUploadItems);
  assert.equal(root.status.textContent, '«Акт.pdf» загружен');
  const next = listed.map((item) => ({...item}));
  next[1].state = 'error';
  next[1].errorMessage = 'нет связи';
  api.syncFileUploadStateEvents(root, next, listed);
  assert.equal(root.status.textContent, '«Счёт.pdf» не загрузился: нет связи');
  // A stored list set from scratch is not news; the per cent is never said.
  const quiet = area();
  api.syncFileUploadStateEvents(quiet, [{name: 'Старый.pdf', state: 'done'}], []);
  assert.equal(quiet.status.textContent, '');

  for (const code of ['en', 'ru', 'kk']) {
    for (const key of ['said-added', 'said-added-many', 'said-done', 'said-error', 'said-error-line']) {
      assert.ok(lang[code][key], `component ${code} ${key}`);
      assert.deepEqual(smartLang[code][key], lang[code][key], `Smart ${code} ${key}`);
    }
  }
});

test('C223: on a screen that cannot drag the zone does not ask to drag', async () => {
  const css = await read('src/component/file-upload/scss/_css__file_upload.scss');
  assert.match(css, /@media \(pointer: coarse\) and \(not \(any-pointer: fine\)\) \{\s*\.sf-file-upload \.sf-file-upload-drag \{\s*display: none;/u);
  const template = await read('src/smart/file-upload/js/templates/default.js');
  assert.match(template, /<span class="sf-file-upload-link">\$\{context\.linkText\}<\/span>\s*\$\{context\.text \? html` <span class="sf-file-upload-drag">\$\{context\.text\}<\/span>`/u);
  assert.match(source, /drag\.className = 'sf-file-upload-drag';\s*drag\.textContent = text \?\?/u, 'the class draws the part');
  const bind = source.slice(source.indexOf('function bindFileUpload'), source.indexOf('function unbindFileUpload'));
  assert.match(bind, /if \(!isManagedRenderRoot\(root\)\) wrapDragWords\(root\);/u, 'the author\'s bare words are wrapped when bound');
});
