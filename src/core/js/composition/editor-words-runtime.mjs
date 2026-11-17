import { localeText, pageLocale, refreshLanguage } from '../page-language.js';
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from './builtins.mjs';
import { CATALOGUE_GROUP_TABLE } from './catalogue.mjs';

// The editor words without the words (localization study LC-1, 2026-11-14).
//
// The words of the built-in editor manifests (editor-words.mjs, then ru + en,
// 8.7 KB gzip; English only since C282, Russian is a language file) were part of core.min.js, so every page paid for them though
// only a page that draws a parameters form reads them. Core now carries this
// module only: the keys a field reads, the lookup and a shared slot the words
// are installed into. The words themselves are a chunk of their own
// (core-editor-words), loaded by SF.Composition.loadEditorWords(), which the
// editors (sf-editor-inline, sf-editor-overlay) call when they are defined;
// a bundle that imports editor-words.mjs from source (the Pro editor) carries
// them inside itself.
//
// The slot is on the shared global: core, each smart component and each
// package are separate bundles, and each carries its own copy of this module.

export const EDITOR_WORDS_OWNER = 'sf-composition';

const EMPTY = Object.freeze({ en: Object.freeze({}), ru: Object.freeze({}) });

const STORE = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfCompositionEditorWords';
  if (!root[key]) root[key] = { words: null, loader: null, loading: null };
  return root[key];
})();

/** The words now installed, or empty tables while none are. */
export function editorWords() {
  return STORE.words || EMPTY;
}

/** Whether the editor words are on the page. */
export function editorWordsReady() {
  return Boolean(STORE.words);
}

/**
 * Install the words `{en: {...}, ...}` (English is built in, owner decision
 * C282; a bundle built before it brings `ru` too); the first install wins,
 * and the page's components are told, as for a registered language, so a
 * form drawn before the words arrived draws again.
 */
export function installEditorWords(words) {
  if (!STORE.words && words && typeof words.en === 'object') {
    STORE.words = words;
    refreshLanguage();
  }
  return editorWords();
}

/** Core names how the words chunk is fetched (core/js/index.js). */
export function setEditorWordsLoader(load) {
  if (typeof load === 'function' && !STORE.loader) STORE.loader = load;
}

/**
 * The words, once they are on the page: resolves at once when they already
 * are, else fetches the core-editor-words chunk once. Resolves to the empty
 * tables when there is nothing to fetch them with (core not on the page).
 */
export function loadEditorWords() {
  if (STORE.words) return Promise.resolve(STORE.words);
  if (!STORE.loader) return Promise.resolve(EMPTY);
  if (!STORE.loading) {
    STORE.loading = Promise.resolve()
      .then(STORE.loader)
      .then((module) => installEditorWords(module?.EDITOR_FIELD_WORDS ?? module?.default?.EDITOR_FIELD_WORDS))
      .catch((error) => {
        STORE.loading = null;
        globalThis.console?.warn?.('[SIMAI Framework] sf-composition: the editor words did not load', error);
        return EMPTY;
      });
  }
  return STORE.loading;
}

/**
 * `{en, ru}` that reads whatever is installed: SF.Composition.EDITOR_FIELD_WORDS
 * as it was. Empty until the words are on the page; the first read starts
 * loading them, and the page's components are told when they arrive.
 */
// A language not built in (C282): the words its language file registered for
// sf-composition.
const registeredWords = (locale) => globalThis.__sfPageLanguage?.registered?.get?.(EDITOR_WORDS_OWNER)?.get?.(locale) ?? {};
const readWords = (locale) => {
  if (!STORE.words) loadEditorWords();
  return editorWords()[locale] ?? registeredWords(locale);
};
export const EDITOR_FIELD_WORDS_LIVE = Object.freeze({
  get en() { return readWords('en'); },
  get ru() { return readWords('ru'); },
});

const STABLE_SEGMENT = /^[a-z][a-z0-9_]*$/u;

/** The keys of the catalogue's words: the fixed groups, and the built-in types and variants that name one. */
export function catalogueWordKeys() {
  const keys = Object.values(CATALOGUE_GROUP_TABLE).map(({ label_key: key }) => key);
  for (const manifest of BUILTIN_TYPE_MANIFESTS) {
    keys.push(...[manifest.catalogue?.label_key, manifest.catalogue?.help_key].filter(Boolean));
    for (const variant of manifest.variants || []) if (variant.label_key) keys.push(variant.label_key);
  }
  return [...new Set(keys)];
}

/** Every word key a field reads: its label, its help and its stable choices. */
export function editorFieldKeys(field) {
  if (!field || typeof field.label_key !== 'string') return [];
  const keys = [field.label_key];
  if (typeof field.help_key === 'string') keys.push(field.help_key);
  for (const choice of Array.isArray(field.choices) ? field.choices : []) {
    if (typeof choice === 'string' && STABLE_SEGMENT.test(choice)) keys.push(`${field.label_key}.${choice}`);
  }
  return keys;
}

/**
 * The `messages` renderFieldFallback and a host's form read, for one editor
 * manifest, a list of them, or every built-in one when none is given. The
 * language is `locale` when it is named, else the language of `node` (the
 * nearest [lang], SF.language.use(), <html lang>), else English. A word
 * registered for `sf-composition` wins over the shipped one; a key with no
 * word in any language is left out, so the host's own words or the key show.
 *
 * `words` are the tables to read; by default the installed ones. While none
 * are installed the call starts loading them (SF.Composition.loadEditorWords)
 * and answers with the registered words only; the components are told when
 * the words arrive, as for a registered language.
 */
export function editorFieldMessages(manifests, { node = null, locale, words } = {}) {
  const table = words || editorWords();
  if (!words && !STORE.words) loadEditorWords();
  const list = manifests === undefined ? BUILTIN_EDITOR_MANIFESTS : Array.isArray(manifests) ? manifests : [manifests];
  const language = locale || pageLocale(node);
  const messages = {};
  const read = (key) => localeText(table, key, language, EDITOR_WORDS_OWNER);
  // Without a manifest, the words of the built-in types' named places too
  // (a slot's label_key and empty_key; one block editor, 2026-11-03).
  // And the catalogue's words (2026-11-04): each group's name, and the name
  // of each built-in type and variant that gives a label_key.
  if (manifests === undefined) {
    for (const slot of BUILTIN_TYPE_MANIFESTS.flatMap((manifest) => Object.values(manifest.slots || {}))) {
      for (const key of [slot.label_key, slot.empty_key].filter(Boolean)) messages[key] = read(key);
    }
    for (const key of catalogueWordKeys()) messages[key] = read(key);
  }
  for (const manifest of list) {
    for (const field of manifest?.fields || []) {
      for (const key of editorFieldKeys(field)) {
        const word = read(key);
        if (word !== key) messages[key] = word;
      }
    }
  }
  return messages;
}
