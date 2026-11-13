// sf-file-upload in a form (FU-9): the value, form-value and validity methods
// of the Smart class run over a stub host with ElementInternals' two calls
// recorded, so what a form gets is measured rather than matched in the source.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {fileNameFromAddress, formatFileSize} from '../src/core/js/composition/file-size.mjs';

const source = await readFile(new URL('../src/smart/file-upload/index.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('  get value() {'), source.indexOf('  // form.reset(): back to the stored files'));
const helpers = source.slice(source.indexOf('// A stored file in the sf-input-image shape'), source.indexOf('class SfFileUpload extends'));
const words = JSON.parse(await readFile(new URL('../src/smart/file-upload/lang/ru.json', import.meta.url), 'utf8')).runtime;

function host(attributes = {}) {
  const context = vm.createContext({FormData, File, fileNameFromAddress, formatFileSize, Number, String, JSON, Array, Object});
  vm.runInContext(`
    const itemState = (item) => (['ready', 'process', 'done', 'error'].includes(item?.state) ? item.state : 'process');
    ${helpers}
    class Host {
      constructor(attributes, words) {
        this.attributes = new Map(Object.entries(attributes));
        this.words = words;
        this._items = [];
        this.validity = null;
        this.sfInternals = {setValidity: (flags, message) => { this.validity = {flags: {...flags}, message}; }};
      }
      get items() { return this._items; }
      set items(value) { this._items = value; }
      get disabled() { return this.attributes.has('disabled'); }
      get multiple() { return this.attributes.has('multiple'); }
      getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
      hasAttribute(name) { return this.attributes.has(name); }
      contains() { return false; }
      sfWord(key) { return this.words[key]; }
      ${methods}
    }
    this.Host = Host;
  `, context);
  return new context.Host(attributes, words);
}

const pdf = (name) => new File(['%PDF'], name, {type: 'application/pdf', lastModified: 1});

test('FU-9: a chosen file goes with the form under its name, a sent one as its stored id', () => {
  const h = host({name: 'docs', multiple: ''});
  h.items = [
    {id: 'a', name: 'Акт.pdf', state: 'ready', file: pdf('Акт.pdf')},
    {id: 'b', name: 'Счёт.pdf', state: 'done', value: 'srv-7', href: '/f/7'},
    {id: 'c', name: 'Скан.pdf', state: 'error'},
  ];
  const data = h.sfFormValue();
  const entries = [...data.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.name]);
  assert.deepEqual(entries, [['docs', 'Акт.pdf'], ['docs', 'srv-7']]);
  const value = JSON.parse(JSON.stringify(h.value));
  assert.equal(value.length, 2);
  assert.deepEqual(value[1], {value: 'srv-7', label: 'Счёт.pdf', mime: '', href: '/f/7'});
  assert.equal(host({}).sfFormValue(), null, 'no name, nothing submitted');
});

test('FU-9: required, a file still going and a failed file keep the form from submitting', () => {
  const empty = host({name: 'docs', required: ''});
  empty.sfSyncValidity();
  assert.deepEqual({...empty.validity.flags}, {valueMissing: true});
  assert.equal(empty.validity.message, 'Добавьте файл');
  const going = host({name: 'docs', required: ''});
  going.items = [{id: 'a', name: 'a.pdf', state: 'process', progress: 30}];
  going.sfSyncValidity();
  assert.equal(going.validity.message, 'Дождитесь, пока файлы загрузятся');
  const failed = host({name: 'docs'});
  failed.items = [{id: 'a', name: 'a.pdf', state: 'error'}];
  failed.sfSyncValidity();
  assert.equal(failed.validity.message, 'Уберите или повторите файлы с ошибкой');
  const ready = host({name: 'docs', required: ''});
  ready.items = [{id: 'a', name: 'a.pdf', state: 'ready', file: pdf('a.pdf')}];
  ready.sfSyncValidity();
  assert.deepEqual({...ready.validity.flags}, {});
});

test('FU-9: stored files in the sf-input-image shape are listed as done rows', () => {
  const h = host({name: 'docs'});
  h.value = [{value: '42', label: 'Договор.pdf', mime: 'application/pdf', size: 2516582, href: '/files/42'}, {href: '/files/%D0%A3%D1%81%D1%82%D0%B0%D0%B2.pdf'}];
  assert.equal(h.items.length, 2);
  assert.equal(h.items[0].state, 'done');
  assert.equal(h.items[0].name, 'Договор.pdf');
  assert.equal(h.items[1].name, 'Устав.pdf');
  assert.deepEqual([...h.sfFormValue().entries()].map(([, value]) => value), ['42']);
});

test('FU-9: the element is a form control by its manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/smart/file-upload/component.json', import.meta.url), 'utf8'));
  assert.equal(manifest.form.submits, 'value');
  assert.equal(manifest.form.required, 'required');
  assert.ok(manifest.settings.name && manifest.settings.required);
  assert.match(source, /class SfFileUpload extends FormField\(FileUploadElement\)/u);
});
