// Smart entry for the inline text editor. The loader fetches this bundle when
// the page has an <sf-inline-editor> element; SF.Composition.startInlineEdit
// in Core delegates here once it is loaded.
import { INLINE_EVENTS, defineInlineEditor, readInlineDom, renderInlineDom, startInlineEdit, textOffset } from '../../core/js/composition/inline-editor.mjs';
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.InlineEditor = Object.freeze({ INLINE_EVENTS, readInlineDom, renderInlineDom, startInlineEdit, textOffset });
defineInlineEditor();
