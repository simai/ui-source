import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {language, registeredWord} from '../src/core/js/page-language.js';

// Group build 9: the four word keys fix/languages-g1 removed (sf-change
// to-text, sf-input-image quoted and chosen, sf-input-color and
// sf-theme-generator decimal) are dated aliases until 2027-01-01: a word a
// product registered under an old key is still said in the old phrase, and
// noted once in SF.deprecations, while none is registered under the new key.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('registeredWord reads what a product registered, never the shipped words', () => {
  language.forget();
  language.use('ru');
  assert.equal(registeredWord('sf-change', 'to-text', null), undefined);
  language.register('sf-change', 'ru', {'to-text': 'на'});
  assert.equal(registeredWord('sf-change', 'to-text', null), 'на');
  assert.equal(registeredWord('sf-change', 'change-text', null), undefined);
  language.register('sf-change', 'en', {'to-text': 'to'});
  language.use('zz');
  assert.equal(registeredWord('sf-change', 'to-text', null), 'to', 'the chain ends in English');
  language.forget();
});

test('each removed key is read as a dated alias where its word was said', () => {
  const change = read('src/smart/change/index.js');
  assert.match(change, /registeredWord\(this\.localName, 'to-text', this\)/u);
  assert.match(change, /from: 'to-text', to: 'change-text', since: '2026-11-16', remove_after: '2027-01-01'/u);
  const image = read('src/smart/input-image/index.js');
  assert.match(image, /registeredWord\(this\.localName, 'quoted', this\)/u);
  assert.match(image, /registeredWord\(this\.localName, 'chosen', this\)/u);
  for (const path of ['src/smart/input-color/index.js', 'src/smart/theme-generator/index.js']) {
    assert.match(read(path), /registeredWord\(this\.localName, ["']decimal["'], this\)/u, path);
  }
});

test('the journal dates the four keys to 2027-01-01', () => {
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'option-word-keys-removed-languages-g1');
  assert.ok(record);
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map((item) => `${item.component}|${item.from}`),
    ['sf-change|to-text', 'sf-input-image|quoted', 'sf-input-image|chosen', 'sf-input-color|decimal', 'sf-theme-generator|decimal']);
  for (const item of record.items) assert.match(`SF.language.register('${item.component}', 'ru', {'${item.from}': 'x'})`, new RegExp(item.match, 'u'));
});
