// Russian is a language file (owner decision C282, 2026-11-17): the bundles
// say English and a page that speaks Russian includes core/lang/ru.js before
// core. A test that reads Russian words outside a browser does what such a
// page does: it runs the language file, which registers its words in the
// shared registry (globalThis.__sfPageLanguage) beneath any words already
// registered. Imported first, before the module under test.
import {readFileSync} from 'node:fs';
import {registerLanguageFile} from '../../scripts/language-file-node.mjs';

/** Runs the language file again: after SF.language.forget(), which forgets its words too. */
export function loadRussian() {
  registerLanguageFile('ru');
}
if (!globalThis.__sfRussianLanguageFile) {
  loadRussian();
  globalThis.__sfRussianLanguageFile = true;
}

/** The words of the Russian language files, read as JSON (lang/ru.json). */
export function russianWords(folder) {
  return JSON.parse(readFileSync(new URL(`../../src/${folder}/ru.json`, import.meta.url), 'utf8')).runtime;
}
