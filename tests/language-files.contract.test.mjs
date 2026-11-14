import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { languageCoverage, languageFolders } from '../scripts/language-coverage.mjs';
import { language, localeText, pageWord } from '../src/core/js/page-language.js';
import { fileSizeUnits, formatFileSize } from '../src/core/js/format-file-size.js';

// Localization study control/research/2026-11-14-localization.md, the defects
// fixed without a question (LC-2, LC-3, LC-4, LC-5, LC-6, LC-7, LC-9), and
// owner decision C177 (2) ru + en built in, (4) a language may come in parts,
// what it lacks is said in English and is visible in the check.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const code = (path) => read(path).split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line)).join('\n');
const CYRILLIC = /[А-Яа-яЁё]/u;

test('LC-7: every language file holds every word in ru and en, every plural form, every {name}', () => {
  assert.ok(languageFolders().length > 90, 'the smart components, the legacy ones and core');
  for (const built of ['ru', 'en']) {
    const report = languageCoverage(built);
    assert.equal(report.share, 100, `${built}: ${JSON.stringify(report.folders.slice(0, 3))}`);
    assert.deepEqual(report.folders, [], built);
  }
});

test('C177 (4): a third language is reported with its share and the words it lacks', () => {
  const de = languageCoverage('de');
  assert.equal(de.built_in, false);
  assert.equal(de.share, 0);
  assert.ok(de.folders.every((folder) => folder.file === false && folder.missing.length === folder.words));
});

test('LC-2: a bundle imports only the runtime words of its language files', () => {
  for (const name of readdirSync(new URL('../src/smart/', import.meta.url))) {
    const file = `src/smart/${name}/index.js`;
    if (!existsSync(new URL(`../${file}`, import.meta.url))) continue;
    const source = read(file);
    for (const match of source.matchAll(/^import (\w+) from (['"])[^'"]*\/lang\/[a-z-]+\.json\2;$/gmu)) {
      assert.match(match[1], /File$/u, `${file}: ${match[0]}`);
      const name = match[1].replace(/File$/u, '');
      assert.match(source, new RegExp(`^const ${name} = \\{runtime: ${match[1]}\\.runtime\\};$`, 'mu'), `${file}: ${name} is the runtime words only`);
    }
  }
});

test('LC-4 and LC-5: the legacy components and the field renderers say nothing from code', () => {
  const files = [
    'src/component/modal/js/_modal.js', 'src/component/file-upload/js/_file_upload.js', 'src/component/toast/js/_toast.js',
    'src/component/quantity/js/_quantity.js', 'src/component/breadcrumbs/js/breadcrumbs.js', 'src/component/spinner/js/_spinner.js',
    'src/component/scrollbar/js/_scrollbar.js', 'src/component/swiper/js/index.js', 'src/component/country-code/js/_country_code.js',
    'src/component/admin-menu/js/_admin_menu.js', 'src/component/badges/js/_anchored-state.js', 'src/component/highlight/js/index.js',
    'src/smart/field-renderers/index.js', 'src/smart/field-renderers/registry.js', 'src/core/js/format-file-size.js',
  ];
  for (const file of files) assert.doesNotMatch(code(file), CYRILLIC, file);
  // download-file keeps the unit names a person may type («2 мб») as input it reads, not as words it says.
  assert.doesNotMatch(code('src/component/download-file/js/_download-file.js').replace(/const SIZE_UNIT_WORDS = \{[\s\S]*?\n\};/u, ''), CYRILLIC);
  for (const name of ['modal', 'file-upload', 'toast', 'quantity', 'breadcrumbs', 'spinner', 'scrollbar', 'swiper', 'download-file', 'country-code', 'admin-menu', 'badges', 'highlight']) {
    assert.ok(existsSync(new URL(`../src/component/${name}/lang/index.mjs`, import.meta.url)), name);
  }
});

test('LC-3: file-size units are language-file words; a product adds a language for sf-file-size', () => {
  assert.deepEqual(JSON.parse(read('src/core/js/lang/file-size/ru.json')).runtime, { b: 'Б', kb: 'КБ', mb: 'МБ', gb: 'ГБ' });
  assert.deepEqual(fileSizeUnits('ru-RU'), ['Б', 'КБ', 'МБ', 'ГБ']);
  assert.deepEqual(fileSizeUnits('de'), ['B', 'KB', 'MB', 'GB']);
  try {
    language.register('sf-file-size', 'kk', { b: 'Б', kb: 'КБ', mb: 'МБ', gb: 'ГБ' });
    assert.equal(formatFileSize(2048, { locale: 'kk' }).replace(/\s/gu, ' '), '2 КБ');
  } finally {
    language.forget();
  }
});

test('LC-6: a word said in English for want of one in the page language warns once per language', () => {
  const said = [];
  const warn = console.warn;
  console.warn = (...args) => said.push(args.join(' '));
  try {
    delete globalThis.__sfFallbackWarnings;
    delete globalThis.__sfMissingWords;
    const words = { en: { a: 'A', b: 'B' }, ru: { a: 'А', b: 'Б' } };
    assert.equal(localeText(words, 'a', 'de', 'sf-x'), 'A');
    assert.equal(localeText(words, 'b', 'de-AT', 'sf-x'), 'B');
    assert.equal(pageWord(words, 'a', { closest: () => ({ getAttribute: () => 'de' }) }, { component: 'sf-y' }), 'A');
    assert.equal(localeText(words, 'a', 'ru-RU', 'sf-x'), 'А', 'a built-in language says nothing');
    assert.equal(localeText(words, 'a', 'en-GB', 'sf-x'), 'A', 'English is not a fallback for English');
    assert.equal(localeText(words, 'a', 'fr', 'sf-x'), 'A');
    assert.equal(said.length, 2, said.join('\n'));
    assert.match(said[0], /language "de": some words are missing and shown in English \(first: sf-x "a"\)/u);
    assert.match(said[1], /language "fr"/u);
    assert.deepEqual(language.missing('de').sort(), ['sf-x|a', 'sf-x|b', 'sf-y|a']);
    language.register('sf-x', 'de', { a: 'Ä' });
    assert.equal(localeText(words, 'a', 'de', 'sf-x'), 'Ä', 'a registered word is no fallback');
  } finally {
    console.warn = warn;
    language.forget();
  }
});

test('LC-9: the words of C153 (3) and C159 (6) are runtime words of the field family and the modal', () => {
  const runtime = (name, lang) => JSON.parse(read(`src/smart/${name}/lang/${lang}.json`)).runtime;
  // Every field that shows its own errors (helpers/form-field.js ownInvalid) has its required word.
  const family = readdirSync(new URL('../src/smart/', import.meta.url)).filter((name) => existsSync(new URL(`../src/smart/${name}/index.js`, import.meta.url)) && /ownInvalid/u.test(read(`src/smart/${name}/index.js`)));
  assert.ok(family.length >= 10, family.join());
  for (const name of family) {
    for (const lang of ['ru', 'en']) assert.equal(typeof runtime(name, lang)['value-missing'], 'string', `${name} ${lang}`);
  }
  // sf-input reads every flag of its native control in words of its own.
  for (const key of ['value-missing', 'type-mismatch', 'type-mismatch-email', 'type-mismatch-url', 'pattern-mismatch', 'too-short', 'too-long', 'range-underflow', 'range-overflow', 'step-mismatch', 'bad-input']) {
    for (const lang of ['ru', 'en']) assert.equal(typeof runtime('input', lang)[key], 'string', `input ${lang} ${key}`);
  }
  assert.equal(runtime('modal', 'ru')['discard-heading'], 'Закрыть без сохранения?');
  assert.equal(runtime('modal', 'en')['discard-heading'], 'Close without saving?');
  for (const key of ['discard', 'keep-editing']) for (const lang of ['ru', 'en']) assert.equal(typeof runtime('modal', lang)[key], 'string');
  assert.match(read('src/smart/modal/index.js'), /this\.sfWord\("discard-heading"\)/u);
  assert.doesNotMatch(code('src/smart/modal/index.js'), /без сохранения|without saving/u, 'not in code');
});
