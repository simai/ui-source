// sf-file-upload's uploader (FU-11): the transfer methods of the Smart class,
// from `get uploader()` to `_trackStreams`, run over a stub host whose items
// setter does what the element's does (abort the gone, then pump), so a
// retry is measured to send the file again rather than reset a row to 0 %.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/smart/file-upload/index.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('  get uploader() {'), source.indexOf('  // The stream facts of §10.8'));
const helpers = source.slice(source.indexOf('// An entry\'s id, as the class component keys its events.'), source.indexOf('const itemProgress'));

function host() {
  const context = vm.createContext({
    AbortController,
    Promise,
    normalizeItemState: (item) => (['ready', 'process', 'done', 'error'].includes(item?.state) ? item.state : 'process'),
  });
  vm.runInContext(`
    const itemState = (item) => normalizeItemState(item);
    ${helpers}
    class Host {
      constructor() { this._items = []; this._uploads = new Map(); this._uploader = null; this.writes = []; }
      get items() { return this._items; }
      set items(value) { this._items = value; this.writes.push(value.map((item) => ({...item}))); this._abortGone(); this._pumpUploads(); }
      ${methods}
    }
    this.Host = Host;
  `, context);
  return new context.Host();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const file = (name) => ({name, size: 10, type: 'application/pdf', lastModified: 1});

test('FU-11: with an uploader a chosen file is sent, its share shown, and done carries the stored value', async () => {
  const h = host();
  let report;
  h.uploader = (sent, {onProgress}) => new Promise((resolve) => { report = {sent, onProgress, resolve}; });
  h.items = [{id: 'a', name: 'Акт.pdf', state: 'ready', file: file('Акт.pdf')}];
  await settle();
  assert.equal(h.items[0].state, 'process');
  assert.equal(h.items[0].progress, null, 'the share is not known before the first report');
  assert.equal(report.sent.name, 'Акт.pdf');
  report.onProgress(5, 10);
  assert.equal(h.items[0].progress, 50);
  report.resolve({value: 'srv-1', href: '/files/1'});
  await settle();
  assert.equal(h.items[0].state, 'done');
  assert.equal(h.items[0].value, 'srv-1');
  assert.equal(h.items[0].href, '/files/1');
});

test('FU-11: a failed transfer is an error with its message, and Retry sends the file again', async () => {
  const h = host();
  let calls = 0;
  h.uploader = () => {
    calls += 1;
    return calls === 1 ? Promise.reject(Object.assign(new Error('Нет связи'), {reason: 'network'})) : Promise.resolve('srv-2');
  };
  h.items = [{id: 'b', name: 'Выписка.pdf', state: 'ready', file: file('Выписка.pdf')}];
  await settle();
  await settle();
  assert.equal(h.items[0].state, 'error');
  assert.equal(h.items[0].errorMessage, 'Нет связи');
  assert.equal(h.items[0].reason, 'network');
  // What the class retry leaves: process, share unknown.
  h.items = [{...h.items[0], state: 'process', progress: null, errorMessage: undefined}];
  await settle();
  await settle();
  assert.equal(calls, 2, 'Retry sent the file again');
  assert.equal(h.items[0].state, 'done');
  assert.equal(h.items[0].value, 'srv-2');
});

test('FU-11: removing a file aborts its transfer', async () => {
  const h = host();
  let signal;
  h.uploader = (sent, options) => { signal = options.signal; return new Promise(() => {}); };
  h.items = [{id: 'c', name: 'Видео.mp4', state: 'ready', file: file('Видео.mp4')}];
  await settle();
  assert.equal(signal.aborted, false);
  h.items = [];
  assert.equal(signal.aborted, true);
});

test('FU-11: without an uploader nothing is sent and the class retry runs the bar without a number', async () => {
  const h = host();
  h.items = [{id: 'd', name: 'x.pdf', state: 'ready', file: file('x.pdf')}];
  await settle();
  assert.equal(h.items[0].state, 'ready');
  const ordinary = await readFile(new URL('../src/component/file-upload/js/_file_upload.js', import.meta.url), 'utf8');
  const retry = ordinary.slice(ordinary.indexOf('function retryFileUploadItem'), ordinary.indexOf('function acceptsFile'));
  assert.match(retry, /currentItem\.state = 'process';\s*currentItem\.progress = null;/u);
});
