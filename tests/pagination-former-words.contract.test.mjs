import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pagination's words became its language files' keys with standard 1.3.8
// (§11): total-label for totalLabel. A product that registered its own words
// under the old camelCase keys through SF.language.register lost them without
// a sign. The old keys are dated aliases until 2026-12-01 (change journal
// option-pagination-word-keys-camel-to-kebab): for each language the word
// registered under the new key wins, then one under the old key, then the
// shipped one, and the old key is noted once in SF.deprecations.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
const {language} = await import('../src/core/js/page-language.js');
const {clearDeprecations, listDeprecations} = await import('../src/core/js/deprecations.js');

const component = json('src/smart/pagination/component.json');
const en = json('src/smart/pagination/lang/en.json');
const ru = json('src/smart/pagination/lang/ru.json');
const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'option-pagination-word-keys-camel-to-kebab');
const camelKey = (key) => key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());

class FakeBase extends EventTarget {
  static get props() { return {}; }
  constructor() {
    super();
    this.localName = 'sf-pagination';
    this.attrs = new Map();
    this.code = 'en';
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  closest() { return {getAttribute: () => this.code}; }
  requestComponentUpdate() {}
}

// The element as src/smart/pagination/index.js makes it: its component.json,
// its two language files and the former keys it declares.
const formerWords = {
  since: '2026-10-27',
  remove_after: '2026-12-01',
  words: Object.fromEntries(Object.keys(en.runtime).map((key) => [key, camelKey(key)])),
};
const Pagination = elementFromManifest(component, {base: FakeBase, lang: {en, ru}, source: 'ru', formerWords});
const make = (code) => Object.assign(new Pagination(), {code});

test('sf-pagination declares every word\'s camelCase key as its former key, until 2026-12-01', () => {
  const source = read('src/smart/pagination/index.js');
  assert.match(source, /formerWords: \{\n\s+since: "2026-10-27",\n\s+remove_after: "2026-12-01",\n\s+words: Object\.fromEntries\(Object\.keys\(en\.runtime\)\.map\(\(key\) => \[key, camelKey\(key\)\]\)\),/u);
  assert.ok(record, 'the change journal records the former keys');
  assert.equal(record.remove_after, '2026-12-01');
  assert.deepEqual(
    record.items.map(({from, to}) => [from, to]).sort(),
    Object.keys(en.runtime).map((key) => [camelKey(key), key]).sort(),
    'one journal item per word, its camelCase key to its key',
  );
  assert.deepEqual(Object.keys(ru.runtime).sort(), Object.keys(en.runtime).sort());
});

test('a word registered under its old key is said, and the old key is noted once', (t) => {
  t.after(() => { language.forget(); clearDeprecations(); });
  language.forget();
  clearDeprecations();
  language.register('sf-pagination', 'de', {totalLabel: 'Gesamt:', pageSizeLabel: 'Pro Seite:'});
  const element = make('de');
  assert.equal(element.sfWord('total-label'), 'Gesamt:');
  assert.equal(element.sfWord('total-label'), 'Gesamt:');
  assert.equal(element.sfWord('page-size-label'), 'Pro Seite:');
  assert.equal(element.sfWord('next-label'), 'Next page', 'a word not registered falls back as before');
  const notes = listDeprecations().filter((note) => note.kind === 'word');
  assert.deepEqual(notes.map(({component: owner, from, to, since, remove_after: removeAfter}) => ({owner, from, to, since, removeAfter})).sort((a, b) => a.from.localeCompare(b.from)), [
    {owner: 'sf-pagination', from: 'pageSizeLabel', to: 'page-size-label', since: '2026-10-27', removeAfter: '2026-12-01'},
    {owner: 'sf-pagination', from: 'totalLabel', to: 'total-label', since: '2026-10-27', removeAfter: '2026-12-01'},
  ], 'one record per old key, however often it is said');
  assert.equal(notes.find((note) => note.from === 'totalLabel').count, 2);
});

test('the old key wins over the shipped word of its language, the new key over the old', (t) => {
  t.after(() => { language.forget(); clearDeprecations(); });
  language.forget();
  clearDeprecations();
  language.register('sf-pagination', 'ru', {totalLabel: 'Итого:'});
  const element = make('ru');
  assert.equal(element.sfWord('total-label'), 'Итого:', 'a Russian word a product registered under totalLabel replaces the shipped «Всего:»');
  language.register('sf-pagination', 'ru', {'total-label': 'Всего записей:'});
  assert.equal(element.sfWord('total-label'), 'Всего записей:', 'the new key wins when both are registered');
  clearDeprecations();
  element.sfWord('total-label');
  assert.deepEqual(listDeprecations(), [], 'nothing is noted when the new key answers');
});

test('a page that registered nothing hears the shipped words and notes nothing', (t) => {
  t.after(() => { language.forget(); clearDeprecations(); });
  language.forget();
  clearDeprecations();
  assert.equal(make('ru').sfWord('total-label'), ru.runtime['total-label']);
  assert.equal(make('en').sfWord('total-label'), en.runtime['total-label']);
  assert.deepEqual(listDeprecations(), []);
});
