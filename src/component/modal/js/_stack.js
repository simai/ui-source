// Ordinary and Smart Modal are separate bundles. They share the one document
// layer stack of the core (layer-stack.js, standard 1.3.8 §19), with every
// other layer -- a drawer, a popover, a list -- not a list of their own: a
// modal opened from a drawer is above it, takes Escape and Tab while it is,
// and gives focus back into the drawer when it closes (simai/ui-source#36,
// #37). Registries, public instance APIs and rendering stay separate.
import { syncModalFocusGuards } from './_focus';
import { closeLayer, hasLayer, isTopLayer, landmarksAround, layerIndex, openLayers,
  openLayer, raiseLayer, returnLayerFocus, topLayer } from '../../../core/js/layer-stack';

// sf-modal's window is its modalRoot (its reader getModalRoot retires, standard
// 1.3.8 §16.13); the class Modal holds its markup in `template`.
const modalRoot = (modal) => (modal && 'modalRoot' in modal ? modal.modalRoot : modal?.getModalRoot?.()) || modal?.template || null;

// The highest modal open: what Modal.getTopModal() names. A drawer or a list
// may stand above it; isTopLayer answers whether it is the top of everything.
function getTopModalLayer() {
  return openLayers('modal').at(-1) || null;
}

function getModalLayerIndex(modal) {
  return layerIndex(modal);
}

// Focus guards stand around the panel of a modal only while it is the top
// layer; under a drawer or a list they would be tab stops of a layer below.
function syncGuards() {
  const top = topLayer();
  syncModalFocusGuards(top?.kind === 'modal' ? top.owner : null);
}

function updateModalLayers() {
  for (const owner of openLayers('modal')) owner.applyStackPosition(layerIndex(owner));
  syncGuards();
}

// A modal inside an overlay container covers that box, not the page, so the
// page stays scrollable while it is open.
const locksPage = (modal) => !modal.inContainer;

function addModalLayer(modal, owner) {
  if (hasLayer(modal)) return;
  openLayer(modal, {
    kind: 'modal',
    locksPage: locksPage(modal),
    trapsFocus: true,
    lockPage: () => {
      owner.lockPage(modal.preserveScrollGap);
      return () => owner.unlockPage();
    },
    returnTo: modal._lastActive ?? modal.lastActive ?? null,
    root: () => modalRoot(modal),
    focusIn: () => modal.focusFirst?.(),
    onEscape: (event) => Boolean(modal.onKeyDown?.(event)),
    onTab: (event) => modal.onKeyDown?.(event),
    // Called on every change of the stack, a drawer's or a list's too.
    place: ({index}) => {
      modal.applyStackPosition(index);
      syncGuards();
    },
  });
  syncGuards();
}

function removeModalLayer(modal) {
  if (!hasLayer(modal)) return;
  // The modal gives focus back itself, after its closing transition.
  closeLayer(modal, {restoreFocus: false});
  modal.applyStackPosition?.(-1);
  syncGuards();
}

function raiseModalLayer(modal) {
  raiseLayer(modal);
  syncGuards();
}

function captureModalFocusAncestors(node) {
  return landmarksAround(node);
}

function restoreModalLayerFocus(wasTop, lastActive, ancestors = []) {
  returnLayerFocus(wasTop, lastActive, ancestors);
}

function isTopModalLayer(modal) {
  return isTopLayer(modal);
}

export { getTopModalLayer, getModalLayerIndex, updateModalLayers, addModalLayer,
  removeModalLayer, raiseModalLayer, captureModalFocusAncestors, restoreModalLayerFocus,
  isTopModalLayer };
