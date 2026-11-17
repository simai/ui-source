import { EDITOR_WORDS_OWNER, catalogueWordKeys, editorFieldKeys, editorFieldMessages as messagesFrom, installEditorWords } from './editor-words-runtime.mjs';

// The words of the built-in editor manifests (simai/ui-source#65): every
// label_key, help_key and `<label_key>.<choice>` of a choice that is a stable
// segment, in English and Russian (the language files, below). A choice that is not a stable segment
// (`16/9`) is shown as it is, by the field kinds' localization rule.
//
// The words belong to the registry owner `sf-composition`, so a product adds a
// language or corrects one word the way it does for any component:
//
//   SF.language.register('sf-composition', 'de', {'sf.composition.content_figure.src': 'Bildadresse'});
//
// src/core/contracts/composition-editor-words.v1.json is generated from this
// file (scripts/generate-composition-contracts.mjs) for a host without
// JavaScript, which reads the same keys.
//
// This module is the words only (localization study LC-1, 2026-11-14): core
// does not carry it in core.min.js. It is the core-editor-words chunk that
// SF.Composition.loadEditorWords() fetches, and a bundle that imports it from
// source carries it itself. Nothing here runs at import: every call is pure,
// so a bundle that does not read the words drops them.

// The words themselves are core's language files (owner decision C282):
// src/core/js/lang/editor/<code>.json, keys sf.composition.<type>.<field>.
// English is built in; Russian and every other language are a language
// file's editor part (core/lang/<code>/editor.json, or the whole
// core/lang/<code>.js), registered for sf-composition, which the lookup reads
// first. The words are written there by hand; scripts/build-language-packs.mjs
// writes the module this file reads them through.
import EDITOR_WORDS from '../lang/editor/index.mjs';

// The catalogue's search words (sf.composition.catalogue.keywords.<type>, a
// comma list) ride in the same files but are not field words: the catalogue
// reads them (builtins.mjs), the words contract does not carry them.
export const KEYWORDS_PREFIX = 'sf.composition.catalogue.keywords.';
/** A language's field words: its editor file's words without the catalogue's search words. */
export const fieldWords = (table) => Object.freeze(Object.fromEntries(Object.entries(table ?? {}).filter(([key]) => !key.startsWith(KEYWORDS_PREFIX))));

export const EDITOR_FIELD_WORDS = /* @__PURE__ */ Object.freeze(Object.fromEntries(Object.entries(EDITOR_WORDS).map(([locale, table]) => [locale, fieldWords(table)])));

/** editorFieldMessages over these words, whether or not they are installed on the page. */
export function editorFieldMessages(manifests, options = {}) {
  return messagesFrom(manifests, { ...options, words: EDITOR_FIELD_WORDS });
}

export { EDITOR_WORDS_OWNER, catalogueWordKeys, editorFieldKeys, installEditorWords };

export default { EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER, catalogueWordKeys, editorFieldKeys, editorFieldMessages };
