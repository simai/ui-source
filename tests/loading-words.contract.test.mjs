import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/* The modal's loading state said "Loading..." on every page, Russian ones too,
   after the spinner had taken the page's language (simai/ui-source#11
   follow-up). The words of a loading state, and of its failure, come from the
   component's dictionary through pageText; a template that writes them out in
   English is the defect coming back. */
const touched = [
  'src/smart/modal/index.js',
  'src/component/modal/js/_modal.js',
  'src/smart/spinner/index.js',
  'src/component/spinner/js/_spinner.js',
];

// A dictionary entry is `key: 'Words'`; anywhere else the words are written
// into the template. Comments are not templates.
const outsideDictionaries = (source) => source
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .split('\n')
  .filter((line) => !/^\s*\/\//u.test(line))
  .filter((line) => !/^\s*\w+\s*:\s*(['"`]).*\1,?\s*$/u.test(line))
  .filter((line) => !/^\s*(?:en|ru)\s*:\s*\{.*\},?\s*$/u.test(line))
  .filter((line) => !/^const \w+_TEXT = \{ en: \{.*\} \};$/u.test(line))
  .join('\n');

test('no loading state writes its words out in English', () => {
  const offenders = [];
  for (const path of touched) {
    const body = outsideDictionaries(read(path));
    for (const match of body.matchAll(/(['"`>])\s*(Loading(?:\.\.\.|…)?|Please wait|Failed to load(?: iframe)? content)\s*(['"`<])/gu)) {
      offenders.push(`${path}: ${match[2]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('both modals take the loading words from the page language, as a named status', () => {
  const smart = read('src/smart/modal/index.js');
  const ordinary = read('src/component/modal/js/_modal.js');
  assert.match(ordinary, /loading: ['"]Loading…['"]/u);
  assert.match(ordinary, /loading: ['"]Загрузка…['"]/u);
  assert.match(ordinary, /loadFailed: ['"]Не удалось загрузить содержимое['"]/u);
  assert.match(ordinary, /frameFailed: ['"]/u);
  // sf-modal's words are its language files (standard 1.3.8 §11).
  const en = JSON.parse(read('src/smart/modal/lang/en.json')).runtime;
  const ru = JSON.parse(read('src/smart/modal/lang/ru.json')).runtime;
  assert.equal(en.loading, 'Loading…');
  assert.equal(ru.loading, 'Загрузка…');
  assert.equal(ru['load-failed'], 'Не удалось загрузить содержимое');
  assert.ok(en['frame-failed'] && ru['frame-failed']);
  assert.match(smart, /const loading = this\.sfWord\("loading"\);/u);
  assert.match(smart, /role="status"\s+aria-label=\$\{loading\}/u);
  assert.match(smart, /this\.sfWord\("load-failed"\)/u);
  assert.match(smart, /this\.sfWord\("frame-failed"\)/u);
  assert.match(ordinary, /pageText\(UNTITLED, key, [^)]*'sf-modal'\)/u);
  assert.match(ordinary, /const words = modalText\('loading', this\.template\);/u);
  assert.match(ordinary, /setAttribute\('role', 'status'\)/u);
  assert.match(ordinary, /setAttribute\('aria-label', words\)/u);
  assert.match(ordinary, /text\.textContent = words;/u);
});

test('the spinner says the same English as the modals, with a true ellipsis', () => {
  // sf-spinner's word is its language file (standard 1.3.8 §11).
  assert.equal(JSON.parse(read('src/smart/spinner/lang/en.json')).runtime.label, 'Loading…');
  assert.equal(JSON.parse(read('src/smart/spinner/lang/ru.json')).runtime.label, 'Загрузка…');
  assert.match(read('src/component/spinner/js/_spinner.js'), /en: \{ label: 'Loading…' \}, ru: \{ label: 'Загрузка…' \}/u);
});

test('a load aborted by a newer one leaves the loading state to it', () => {
  // open() reloads what the constructor began to preload; the first load's
  // AbortError cancelled the second's loading state, so a modal opened during
  // the preload never showed it (found by the loading-language probe).
  const ordinary = read('src/component/modal/js/_modal.js');
  assert.match(ordinary, /if \(!this\._fetchController \|\| this\._fetchController === controller\) \{\s*this\._finishLoading\(\);/u);
  const smart = read('src/smart/modal/index.js');
  assert.match(smart, /const superseded = aborted && this\._fetchController && this\._fetchController !== controller;/u);
});
