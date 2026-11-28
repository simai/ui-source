// sf-settings 1.12.0 (group build 21 area B; Docara K-13 msg-b3676e09bb83470e84ed,
// decision C437): a panel of look="panel" in a page's window draws its close
// button, reset-label, the panel's public width and height, and the
// remembered values' public format with the head reader the docs print.
// Measured in a browser in tests/browser/settings-window.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import BundledPreferences from '../src/core/js/preferences.js';
import {PREPAINT_READER, STORAGE_PREFIX} from '../src/core/js/preferences.js';
import {rememberedKey, rememberedValues, valueMap} from '../src/smart/settings/js/settings.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/settings/component.json'));
const source = read('src/smart/settings/index.js');
const panel = read('src/smart/settings/js/templates/panel.js');
const css = read('src/smart/settings/scss/_smart__settings.scss');
const docs = read('src/smart/settings/docs.md');

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('(1) a panel in a page\'s window draws the close a popup draws, unless the window draws its own', () => {
  assert.match(source, /const SHELL = '\[data-sf-modal-panel\], \[data-sf-drawer-panel\], dialog';/u, 'found by the panel each window draws round its content');
  assert.match(source, /if \(shell\.localName === 'dialog'\) return false;/u, 'a <dialog> draws no close of its own');
  assert.match(source, /if \(typeof shell\.showHeader === 'boolean' && !shell\.showHeader\) return false;\n\s+return shell\.showClose !== false;/u, 'a window without its header, or without its close, draws none');
  assert.match(source, /shellClose: Boolean\(this\.shellCloses\(\)\)/u);
  assert.match(panel, /const close = context\.popup \|\| context\.shellClose/u);
  assert.match(source, /if \(this\._open\) this\.closePanel\(\{reason: 'close'\}\);\n\s+else this\.closeShell\(\);/u);
  // Asked first (cancellable, reason close), the window closes by its own close, closed after it agreed.
  const close = source.slice(source.indexOf('  closeShell() {'), source.indexOf('  // Whether the draft of apply="button"'));
  assert.ok(close.indexOf("this.sfEmit('close', {reason: 'close'") < close.indexOf("shell.close?.({reason: 'close'})"));
  assert.match(close, /result\.outcome !== 'applied'\) return;/u);
  assert.match(close, /this\.sfEmit\('closed', \{reason: 'close'\}\)/u);
  assert.match(manifest.settings['close-label'].summary, /stands in a page's window/u);
});

test('(2) no new placement: the side sheet is sf-drawer, shown in the docs', () => {
  assert.deepEqual(manifest.settings.look.values, ['drill', 'rows', 'panel']);
  assert.match(docs, /## Панель в окне и боковая шторка/u);
  assert.match(docs, /<sf-drawer id="reader-sheet" placement="inline-end" size="1\/2" show-close="false"/u);
  assert.match(docs, /решение C157 \(1\)/u);
});

test('(3) reset-label is the footer reset\'s text, the Framework word by default', () => {
  assert.deepEqual(manifest.settings['reset-label'], {type: 'string', 'default-from': 'runtime.reset', summary: manifest.settings['reset-label'].summary});
  assert.ok(manifest['x-words'].includes('reset-label'));
  assert.match(source, /reset: this\.resetLabel \|\| this\.sfWord\('reset'\)/u);
  assert.match(docs, /\| `reset-label` \| строка \| «Сбросить» \/ «Reset» \|/u);
});

test('(4) the panel\'s public width and height: the popup step and auto by default', () => {
  assert.match(css, /inline-size: var\(--sf-settings-panel-width, var\(--sf-popup-panel-width\)\);/u);
  assert.match(css, /block-size: var\(--sf-settings-panel-height, auto\);/u);
  for (const name of ['--sf-settings-panel-width', '--sf-settings-panel-height']) {
    assert.equal(manifest['css-variables'][name].type, 'length', name);
    assert.ok(manifest['css-variables'][name]['x-summary'], name);
    assert.ok(docs.includes(`| \`${name}\` |`), `${name} in the docs' table`);
  }
});

test('(5) the remembered values are a public format the head reader answers', () => {
  assert.equal(rememberedKey('reader'), 'sf-settings/reader');
  assert.equal(STORAGE_PREFIX + rememberedKey('reader'), 'sf-pref:sf-settings/reader');
  assert.equal(rememberedKey('  '), '');
  // What the element writes (SF.Preferences, the browser's copy) is what the reader answers.
  const storage = fakeStorage();
  const before = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {value: storage, configurable: true, writable: true});
  try {
    const items = [
      {id: 'size', type: 'choice', value: 'l', options: [{id: 'm'}, {id: 'l'}]},
      {id: 'dark', type: 'switch', value: true},
      {type: 'group', text: 'Вид', items: [{id: 'scale', type: 'range', value: 110, min: 80, max: 150}]},
    ];
    BundledPreferences.write(rememberedKey('reader'), valueMap(items));
    assert.equal(storage.map.has('sf-pref:sf-settings/reader'), true, 'the browser key');
    const expected = {size: 'l', dark: true, scale: 110};
    assert.deepEqual(rememberedValues('reader', storage), expected);
    const read = new Function(`${PREPAINT_READER}; return sfPreference;`)();
    const reader = (name) => read(rememberedKey(name));
    assert.deepEqual(reader('reader'), expected, 'the printed reader answers the same');
    assert.equal(reader('nothing'), null);
    storage.setItem('sf-pref:sf-settings/broken', '{not json');
    storage.setItem('sf-pref:sf-settings/list', '[1,2]');
    assert.equal(reader('broken'), null);
    assert.deepEqual(reader('list'), [1, 2], 'the core reader answers any kept value; the page checks its shape');
    assert.equal(rememberedValues('list', storage), null, 'the settings values are an object');
    assert.equal(rememberedValues('broken', storage), null);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {value: before, configurable: true, writable: true});
  }
  const refused = {getItem: () => { throw new Error('SecurityError'); }};
  assert.equal(rememberedValues('reader'), null, 'no storage given, nothing read');
  assert.equal(rememberedValues('reader', refused), null, 'a refused storage answers null');
  assert.match(source, /export const rememberKey = rememberedKey;/u, 'the element keeps the values under the same key');
  assert.ok(docs.includes(PREPAINT_READER), 'the docs print the core reader word for word');
  assert.ok(docs.includes("sfPreference('sf-settings/reader')"));
  assert.ok(/^[\x20-\x7e]+$/u.test(PREPAINT_READER) && !/=>|\blet\b|\bconst\b/u.test(PREPAINT_READER), 'ES5 ASCII, no module');
});

test('the version and the decision', () => {
  assert.equal(manifest.version, '1.12.0');
  assert.match(manifest['x-decisions'].at(-1), /^version 1\.12\.0 \(2026-11-28, group build 21 area B; Docara K-13 msg-b3676e09bb83470e84ed, decision C437\)/u);
});
