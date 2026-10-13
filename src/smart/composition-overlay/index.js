// Smart entry for sf-composition-overlay, the editor canvas overlay. Library
// drags from sf-sortable land here through the shared drag session.
import { OVERLAY_EVENTS, checkOverlayActions, defineCompositionOverlay, overlayNodes } from '../../core/js/composition/overlay.mjs';
import './scss/index.scss';

globalThis.SF = globalThis.SF || {};
globalThis.SF.CompositionOverlay = Object.freeze({ OVERLAY_EVENTS, checkOverlayActions, overlayNodes });
defineCompositionOverlay();
