// Smart entry for the inline text editor. The loader fetches this bundle when
// the page has an <sf-inline-editor> element; SF.Composition.startInlineEdit
// in Core delegates here once it is loaded.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the carrier is defined over the class core/js/composition/manifest-host.mjs
// makes from it; the edited element sends sf-inline-editor-input, -change and
// -cancel {id, content}, the former sf-inline-edit-* following until
// 2026-12-01.
import { INLINE_EVENTS, INLINE_EVENTS_LEGACY, defineInlineEditor, readInlineDom, renderInlineDom, startInlineEdit, textOffset } from '../../core/js/composition/inline-editor.mjs';
import { manifestHost } from '../../core/js/composition/manifest-host.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.InlineEditor = Object.freeze({ INLINE_EVENTS, INLINE_EVENTS_LEGACY, readInlineDom, renderInlineDom, startInlineEdit, textOffset });
defineInlineEditor(globalThis.customElements, {base: manifestHost(manifest, {lang: {en, ru}, source: 'ru', aliases})});
