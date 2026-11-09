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
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.CompositionOverlay = Object.freeze({ OVERLAY_EVENTS, OVERLAY_EVENTS_FORMER_TAG, OVERLAY_EVENTS_LEGACY, checkOverlayActions, checkOverlayNodes, overlayNodes });
// The overlay's methods take their fields in order (setNodes(nodes, options));
// the runtime gives each the object form of §4.4 as well (setNodes({nodes,
// options}), setMessages({messages})).
const positional = ['attach', 'attach-frame', 'set-document', 'set-nodes', 'set-drop-filter', 'set-actions', 'set-messages', 'set-insertion-target', 'select', 'edit'];
defineCompositionOverlay(globalThis.customElements, {base: manifestHost(manifest, {lang: {en, ru}, source: 'ru', aliases, positional})});
