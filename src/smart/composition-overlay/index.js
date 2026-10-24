// Smart entry for sf-composition-overlay, the editor canvas overlay. Library
// drags from sf-sortable land here through the shared drag session. A framed
// canvas (a same-origin iframe fed a flat node list) uses attachFrame and setNodes.
import { OVERLAY_EVENTS, checkOverlayActions, checkOverlayNodes, defineCompositionOverlay, overlayNodes } from '../../core/js/composition/overlay.mjs';
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.CompositionOverlay = Object.freeze({ OVERLAY_EVENTS, checkOverlayActions, checkOverlayNodes, overlayNodes });
defineCompositionOverlay();
