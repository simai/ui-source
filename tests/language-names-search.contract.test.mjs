// sf-language 1.4.0 (research ui-control control/research/2026-11-14-language.md
// LG-5, LG-7, LG-8, LG-9; decision C32): shipped names, word-start search, the
// panel width of a search menu, the chosen row in view on opening.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import './support/russian-language-file.mjs';
import {englishName, matchesQuery, nameIn, nativeName, normalizeLanguages, searchWords, useNames} from '../src/smart/language/js/languages.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const data = JSON.parse(read('src/smart/language/data/names.json'));
useNames(data);

test('LG-7: the supported languages are named in themselves from shipped data, not by the browser alone', () => {
  const expected = {sah: 'Саха тыла', cv: 'Чӑваш чӗлхи', he: 'עברית', mn: 'Монгол', ru: 'Русский', de: 'Deutsch'};
  for (const [code, name] of Object.entries(expected)) assert.equal(nativeName(code), name, code);
  assert.equal(englishName('sah'), 'Yakut');
  assert.equal(nameIn('cv', 'ru'), 'чувашский');
  assert.equal(nameIn('cv', 'ru-RU'), 'чувашский');
  // The data names each in itself and in English; its Russian name is the ru
  // language file's word name-<code> (C282).
  const ruNames = JSON.parse(read('src/core/js/lang/language-names/ru.json')).runtime;
  for (const [code, names] of Object.entries(data.names)) {
    assert.ok(names.native && names.en && ruNames[`name-${code}`], `${code} has all three names`);
    assert.equal(names.ru, undefined, `${code}: no Russian in the data`);
  }
  assert.ok(Object.keys(data.names).length >= 50);
  // Owner decision C278: languages of CIS countries other than Russian are not named.
  for (const code of ['uk', 'be', 'uz', 'az', 'hy', 'ka', 'kk', 'tt', 'ky', 'tg', 'ba', 'tk']) {
    assert.equal(data.names[code], undefined, code);
    assert.equal(ruNames[`name-${code}`], undefined, code);
  }
  // No literal names in the code: they are data.
  assert.doesNotMatch(read('src/smart/language/js/languages.js'), /Саха тыла|саха тыла|Чӑваш|чӑваш/u);
});

test('LG-8: a query matches the start of a word, in any case and without accents', () => {
  const list = normalizeLanguages('ru en lt ro de pt-BR fr it', []);
  const words = (language) => searchWords(language.label, language.native, language.english, nameIn(language.code, 'ru'), language.code);
  const find = (query) => list.filter((language) => matchesQuery(words(language), query)).map((language) => language.code);
  assert.deepEqual(find('ру'), ['ru', 'ro']);
  assert.deepEqual(find('РУ'), ['ru', 'ro']);
  assert.deepEqual(find('en'), ['en']);
  assert.deepEqual(find('ит'), ['it']);
  assert.deepEqual(find('нем'), ['de']);
  assert.deepEqual(find('German'), ['de']);
  assert.deepEqual(find('francais'), ['fr']);
  assert.deepEqual(find('brazil port'), ['pt-BR']);
  assert.deepEqual(find('br'), ['pt-BR']);
  assert.deepEqual(find(''), list.map((language) => language.code));
  assert.deepEqual(find('zz'), []);
});

test('LG-8/LG-9: the menu search is remote and narrowed by the element; the search look is the C32 panel width', () => {
  const index = read('src/smart/language/index.js');
  const template = read('src/smart/language/js/templates/default.js');
  assert.match(index, /remote: true/u);
  assert.match(read('src/smart/language/js/languages.js'), /matchesQuery\(searchWords\(/u);
  assert.doesNotMatch(index, /keywords:/u);
  assert.match(template, /width="panel"/u, 'every menu is the C32 panel (C142 (3))');
  assert.match(template, /@sf-menu-context-search=/u);
  assert.match(template, /@sf-menu-context-closed=/u);
});

test('LG-5: opening brings the chosen row into view and keeps it there while the menu is placed', () => {
  const index = read('src/smart/language/index.js');
  assert.match(index, /revealChosen\(menu, true\)/u);
  assert.match(index, /followChosen\(menu\)/u);
  assert.match(index, /\[role="menuitemradio"\]\[aria-checked="true"\]/u);
});
