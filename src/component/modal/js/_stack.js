// Ordinary and Smart Modal are separate bundles. Share only document-local
// coordination, not their registries, public instance APIs or rendering.
import { syncModalFocusGuards } from './_focus';
const STACK_KEY = Symbol.for('simai.modal.document-stack');

function state() {
  if (!document[STACK_KEY]) {
    Object.defineProperty(document, STACK_KEY, {
      value: { items: [], lockOwner: null },
      configurable: true,
    });
  }
  return document[STACK_KEY];
}

function getTopModalLayer() {
  return state().items.at(-1) || null;
}

function getModalLayerIndex(modal) {
  return state().items.indexOf(modal);
}

function updateModalLayers() {
  state().items.forEach((modal, index) => modal.applyStackPosition(index));
  syncModalFocusGuards(getTopModalLayer());
}

function addModalLayer(modal, owner) {
  const stack = state();
  if (stack.items.includes(modal)) return;
  if (!stack.items.length) {
    stack.lockOwner = owner;
    owner.lockPage(modal.preserveScrollGap);
  }
  stack.items.push(modal);
  updateModalLayers();
}

function removeModalLayer(modal) {
  const stack = state();
  const index = stack.items.indexOf(modal);
  if (index < 0) return;
  stack.items.splice(index, 1);
  if (!stack.items.length) {
    stack.lockOwner?.unlockPage();
    stack.lockOwner = null;
  }
  updateModalLayers();
}

function raiseModalLayer(modal) {
  const stack = state();
  const index = stack.items.indexOf(modal);
  if (index < 0) return;
  stack.items.splice(index, 1);
  stack.items.push(modal);
  updateModalLayers();
}

function captureModalFocusAncestors(node) {
  const ancestors = [];
  for (let parent = node?.parentElement; parent; parent = parent.parentElement) {
    if (parent.matches('main, section, article, [role="main"], [role="region"]')) {
      ancestors.push(parent);
    }
  }
  return ancestors;
}

function tryReturnFocus(node, temporaryTabIndex = false) {
  if (!node?.isConnected || typeof node.focus !== 'function' ||
      node.matches(':disabled') || node.closest('[inert], [hidden], [aria-hidden="true"]') ||
      !node.getClientRects().length ||
      node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'visible') {
    return false;
  }
  const addTabIndex = temporaryTabIndex && !node.hasAttribute('tabindex');
  let observer;
  const cleanup = () => {
    observer?.disconnect();
    node.removeEventListener('blur', cleanup);
    // Preserve synchronous author changes to the temporary attribute.
    if (addTabIndex && node.getAttribute('tabindex') === '-1') node.removeAttribute('tabindex');
  };
  if (addTabIndex) {
    node.setAttribute('tabindex', '-1');
    node.addEventListener('blur', cleanup, { once: true });
    observer = new node.ownerDocument.defaultView.MutationObserver(() => {
      if (!node.isConnected) cleanup();
    });
    observer.observe(node.ownerDocument.documentElement, { childList: true, subtree: true });
  }
  let focused = false;
  try {
    node.focus({ preventScroll: true });
    focused = node.ownerDocument.activeElement === node;
    return focused;
  } catch {
    return false;
  } finally {
    // Removing tabindex while a non-native target is focused blurs it in browsers.
    if (addTabIndex && !focused) cleanup();
  }
}

function restoreModalLayerFocus(wasTop, lastActive, ancestors = []) {
  if (!wasTop) return;
  const top = getTopModalLayer();
  const root = top?.getModalRoot?.() || top?.template;
  if ((!top || root?.contains(lastActive)) && tryReturnFocus(lastActive)) {
    return;
  }
  if (top) {
    top.focusFirst();
    return;
  }
  const candidates = new Set([...ancestors,
    ...document.querySelectorAll('main, [role="main"]'), document.body]);
  for (const candidate of candidates) {
    if (tryReturnFocus(candidate, true)) return;
  }
}

export { getTopModalLayer, getModalLayerIndex, updateModalLayers, addModalLayer,
  removeModalLayer, raiseModalLayer, captureModalFocusAncestors, restoreModalLayerFocus };
