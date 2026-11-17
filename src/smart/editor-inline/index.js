// Smart entry for the inline text editor. The loader fetches this bundle when
// the page has an <sf-editor-inline> element; SF.Composition.startInlineEdit
// in Core delegates here once it is loaded.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the carrier is defined over the class core/js/composition/manifest-host.mjs
// makes from it; the edited element sends sf-inline-editor-input, -change and
// -cancel {id, content}, the former sf-inline-edit-* following until
// 2026-12-01.
import { INLINE_ENTER_MODES, INLINE_EVENTS, INLINE_EVENTS_FORMER_TAG, INLINE_EVENTS_LEGACY, INLINE_TOOLBAR_MODES, defineInlineEditor, linkProblem, readInlineDom, renderInlineDom, startInlineEdit, textOffset, useInlineEditorWords } from '../../core/js/composition/inline-editor.mjs';
import { manifestHost } from '../../core/js/composition/manifest-host.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

// The words the module does not carry itself (the link window's hint and
// reasons, «Ещё», the new-block label; owner decision C172) are the
// language files'.
useInlineEditorWords(languageFiles);
globalThis.SF = globalThis.SF || {};
globalThis.SF.InlineEditor = Object.freeze({ INLINE_ENTER_MODES, INLINE_EVENTS, INLINE_EVENTS_FORMER_TAG, INLINE_EVENTS_LEGACY, INLINE_TOOLBAR_MODES, linkProblem, readInlineDom, renderInlineDom, startInlineEdit, textOffset });
// edit(element, options) takes its fields in order; the runtime gives it the
// object form of §4.4 as well: edit({element, options}).
// An editor page draws parameter forms: the composition editor words, no
// longer part of every page's core (localization study LC-1), are fetched
// once now, so SF.Composition.editorFieldMessages() answers in full.
globalThis.SF.Composition?.loadEditorWords?.();
defineInlineEditor(globalThis.customElements, {base: manifestHost(manifest, {lang: languageFiles, source: 'ru', aliases, positional: ['edit']})});
