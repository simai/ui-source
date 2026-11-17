// Smart entry for sf-editor-overlay, the editor canvas overlay. Library
// drags from sf-sortable land here through the shared drag session. A framed
// canvas (a same-origin iframe fed a flat node list) uses attachFrame and setNodes.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the overlay is defined over the class core/js/composition/manifest-host.mjs
// makes from it; it sends select, apply, insert, move and change by the
// vocabulary, the former -action and -edit following until 2026-12-01.
import { OVERLAY_EVENTS, OVERLAY_EVENTS_FORMER_TAG, OVERLAY_EVENTS_LEGACY, checkOverlayActions, checkOverlayNodes, defineCompositionOverlay, overlayNodes } from '../../core/js/composition/overlay.mjs';
import { manifestHost } from '../../core/js/composition/manifest-host.mjs';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.CompositionOverlay = Object.freeze({ OVERLAY_EVENTS, OVERLAY_EVENTS_FORMER_TAG, OVERLAY_EVENTS_LEGACY, checkOverlayActions, checkOverlayNodes, overlayNodes });
// The overlay's methods take their fields in order (setNodes(nodes, options));
// the runtime gives each the object form of §4.4 as well (setNodes({nodes,
// options}), setMessages({messages})).
const positional = ['attach', 'attach-frame', 'set-document', 'set-nodes', 'set-drop-filter', 'set-actions', 'set-messages', 'set-insertion-target', 'select', 'edit'];
// An editor page draws parameter forms: the composition editor words, no
// longer part of every page's core (localization study LC-1), are fetched
// once now, so SF.Composition.editorFieldMessages() answers in full.
globalThis.SF.Composition?.loadEditorWords?.();
defineCompositionOverlay(globalThis.customElements, {base: manifestHost(manifest, {lang: languageFiles, source: 'ru', aliases, positional})});
