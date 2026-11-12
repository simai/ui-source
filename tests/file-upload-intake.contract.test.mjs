// sf-file-upload's intake, run: the class script's helpers from
// `function toBoolean` up to `function bindFileUpload` are evaluated in a
// context with a stub area, so the list a pick or a drop leaves, the entries'
// states and the rejections are measured rather than matched in the source
// (study 2026-11-11, FU-1..FU-12).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/component/file-upload/js/_file_upload.js', import.meta.url), 'utf8');
const words = source.slice(source.indexOf('const FILE_UPLOAD_ITEM_TEXT'), source.indexOf('const FILE_UPLOAD_SELECTOR'));
const helpers = source.slice(source.indexOf('function toBoolean'), source.indexOf('function bindFileUpload'));

function fill(text, vars = {}) {
  return String(text).replace(/\{([a-z][\w-]*)\}/giu, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

function area({attributes = {}, lang = 'ru'} = {}) {
  const events = [];
  const attrs = new Map(Object.entries(attributes));
  const classes = new Set(['sf-file-upload']);
  const root = {
    events,
    lang,
    dataset: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      [Symbol.iterator]: () => classes[Symbol.iterator](),
    },
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    hasAttribute: (name) => attrs.has(name),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    querySelector: () => null,
    querySelectorAll: () => [],
    nextElementSibling: null,
    closest: () => null,
    dispatchEvent(event) {
      events.push({type: event.type, detail: event.detail});
      return true;
    },
  };
  for (const [name, value] of attrs) {
    if (name.startsWith('data-')) root.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
  }
  return root;
}

function load() {
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    document: {querySelector: () => null},
    Element: class Element {},
    fieldSize: (value) => String(value || '1'),
    formatFileSize: (size) => `${Math.round(Number(size) / 1024)} КБ`,
    pageText: (dictionary, key, node) => dictionary[node?.lang || 'ru']?.[key] ?? key,
    pageWord: (dictionary, key, node, {vars, count} = {}) => {
      const word = dictionary[node?.lang || 'ru']?.[key] ?? key;
      const form = typeof word === 'object' ? (count === 1 ? word.one : word.other) ?? word.other : word;
      return fill(form, {...vars, n: count});
    },
  });
  vm.runInContext(`${words.replace('const FILE_UPLOAD_ITEM_TEXT', 'var FILE_UPLOAD_ITEM_TEXT')}\n${helpers}\nthis.api = {applySelectedFiles, normalizeFileItems, getItemEventKey, takeFiles, formatAcceptWords};`, context);
  return context.api;
}

const file = (name, size = 1000, type = 'application/pdf', lastModified = 1) => ({name, size, type, lastModified});
const names = (root) => [...(root.__sfFileUploadItems || [])].map((item) => item.name);
// Values made in the context are of its realm: copy them before deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('FU-1: a second pick on a multiple area adds to the list, and a file already listed is not listed twice', () => {
  const api = load();
  const root = area({attributes: {multiple: ''}});
  api.applySelectedFiles(root, [file('Акт.pdf'), file('Счёт.pdf')], 'input');
  api.applySelectedFiles(root, [file('Смета.xlsx', 4000, 'application/vnd.ms-excel')], 'input');
  assert.deepEqual(names(root), ['Акт.pdf', 'Счёт.pdf', 'Смета.xlsx']);
  api.applySelectedFiles(root, [file('Акт.pdf')], 'input');
  assert.deepEqual(names(root), ['Акт.pdf', 'Счёт.pdf', 'Смета.xlsx']);
  const attached = root.events.filter((event) => event.type === 'sf-file-upload:file-add').map((event) => [event.detail.item.name, event.detail.index]);
  
  assert.deepEqual(plain(attached), [['Акт.pdf', 0], ['Счёт.pdf', 1], ['Смета.xlsx', 2]]);
  const selected = root.events.filter((event) => event.type === 'sf-file-upload:select').map((event) => [...event.detail.files].map((item) => item.name));
  assert.deepEqual(plain(selected), [['Акт.pdf', 'Счёт.pdf'], ['Смета.xlsx']]);
});

test('FU-1: a single area keeps one file; a new choice replaces it and says so with remove {reason: replaced}', () => {
  const api = load();
  const root = area();
  api.applySelectedFiles(root, [file('Устав.pdf')], 'input');
  api.applySelectedFiles(root, [file('Устав-2.pdf')], 'input');
  assert.deepEqual(names(root), ['Устав-2.pdf']);
  const removed = root.events.filter((event) => event.type === 'sf-file-upload:remove');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].detail.item.name, 'Устав.pdf');
  assert.equal(removed[0].detail.reason, 'replaced');
});

test('FU-6: extra files dropped on a single area are said, with reason count, not dropped silently', () => {
  const api = load();
  const root = area();
  const added = api.takeFiles(root, [file('1.pdf'), file('2.pdf'), file('3.pdf')], 'drop');
  assert.equal(added.length, 1);
  assert.deepEqual(names(root), ['1.pdf']);
  const reject = root.events.find((event) => event.type === 'sf-file-upload:reject');
  assert.ok(reject, 'reject is sent');
  assert.deepEqual(plain([...reject.detail.rejected].map((entry) => [entry.name, entry.reason])), [['2.pdf', 'count'], ['3.pdf', 'count']]);
  assert.equal(reject.detail.rejected[0].message, '«2.pdf» не добавлен: сюда можно только один файл');
  assert.equal(reject.detail.source, 'drop');
  assert.equal(root.__sfFileUploadRejected.length, 2);
});

test('FU-7: a wrong type is refused on a pick as on a drop, and the message names what is allowed', () => {
  const api = load();
  const root = area({attributes: {accept: '.pdf,image/*'}});
  api.takeFiles(root, [file('photo.heic', 100, '')], 'input');
  assert.deepEqual(names(root), []);
  const reject = root.events.find((event) => event.type === 'sf-file-upload:reject');
  assert.equal(reject.detail.source, 'input');
  assert.equal(reject.detail.rejected[0].reason, 'type');
  assert.equal(reject.detail.rejected[0].message, '«photo.heic» не подходит: можно PDF, изображения');
  api.takeFiles(root, [file('Скан.pdf')], 'input');
  assert.deepEqual(names(root), ['Скан.pdf']);
  assert.equal(root.__sfFileUploadRejected.length, 0, 'a choice without rejections clears the message');
});

test('FU-7: a multiple area says a file that is already listed', () => {
  const api = load();
  const root = area({attributes: {multiple: ''}});
  api.takeFiles(root, [file('Акт.pdf')], 'input');
  api.takeFiles(root, [file('Акт.pdf'), file('Счёт.pdf')], 'input');
  assert.deepEqual(names(root), ['Акт.pdf', 'Счёт.pdf']);
  const reject = root.events.filter((event) => event.type === 'sf-file-upload:reject').at(-1);
  assert.equal(reject.detail.rejected[0].reason, 'duplicate');
});

test('FU-7: the formats line reads people words, not «*»', () => {
  const api = load();
  assert.equal(api.formatAcceptWords('.pdf, .docx, application/pdf, image/*', area()), 'PDF, DOCX, изображения');
  assert.equal(api.formatAcceptWords('video/*', area({lang: 'en'})), 'video');
});

test('FU-8: size, count and total limits refuse a file with its reason, an empty file is never added', () => {
  const api = load();
  const root = area({attributes: {multiple: '', 'data-max-size': String(5 * 1024 * 1024), 'data-max-files': '3', 'data-max-total-size': String(6 * 1024 * 1024)}});
  const big = file('Скан.pdf', 14 * 1024 * 1024);
  api.takeFiles(root, [big, file('Пустой.pdf', 0), file('1.pdf', 2 * 1024 * 1024), file('2.pdf', 2 * 1024 * 1024), file('3.pdf', 3 * 1024 * 1024)], 'input');
  assert.deepEqual(names(root), ['1.pdf', '2.pdf']);
  const reject = root.events.find((event) => event.type === 'sf-file-upload:reject');
  assert.deepEqual(plain([...reject.detail.rejected].map((entry) => [entry.name, entry.reason])), [['Скан.pdf', 'size'], ['Пустой.pdf', 'empty'], ['3.pdf', 'total']]);
  assert.equal(reject.detail.rejected[0].message, '«Скан.pdf» — 14336 КБ, а можно до 5120 КБ');
  api.takeFiles(root, Array.from({length: 4}, (_, index) => file(`Файл ${index + 1}.pdf`, 100)), 'input');
  assert.deepEqual(names(root), ['1.pdf', '2.pdf', 'Файл 1.pdf']);
  const counted = root.events.filter((event) => event.type === 'sf-file-upload:reject').at(-1).detail.rejected;
  assert.deepEqual(plain([...counted].map((entry) => entry.reason)), ['count', 'count', 'count']);
  assert.equal(counted[0].message, '«Файл 2.pdf» не добавлен: можно не больше 3 файла');
});

test('FU-8: min-size and the English words', () => {
  const api = load();
  const root = area({attributes: {'min-size': '2048'}, lang: 'en'});
  api.takeFiles(root, [file('tiny.pdf', 1024)], 'drop');
  const reject = root.events.find((event) => event.type === 'sf-file-upload:reject');
  assert.equal(reject.detail.rejected[0].reason, 'min-size');
  assert.equal(reject.detail.rejected[0].message, '“tiny.pdf” is 1 КБ; it must be at least 2 КБ');
});
