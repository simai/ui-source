const FOCUSABLE_SELECTOR = [
  'a[href]', 'area[href]', 'button', 'input', 'select', 'textarea',
  'iframe', 'summary', 'audio[controls]', 'video[controls]',
  '[contenteditable]', '[tabindex]',
].join(',');

const GUARDS_KEY = Symbol.for('simai.modal.focus-guards');

function syncModalFocusGuards(modal) {
  const root = (modal && 'modalRoot' in modal ? modal.modalRoot : modal?.getModalRoot?.()) || modal?.template;
  const panel = root?.querySelector?.('[data-sf-modal-panel]');
  const previous = document[GUARDS_KEY];
  if (previous && previous.panel === panel && previous.before.isConnected && previous.after.isConnected) return;
  previous?.before.remove();
  previous?.after.remove();
  delete document[GUARDS_KEY];
  if (!panel?.parentNode) return;
  const guards = { panel, relaying: false };
  for (const edge of ['before', 'after']) {
    const guard = panel.ownerDocument.createElement('span');
    guard.tabIndex = 0;
    guard.className = 'sf-modal-focus-guard';
    guard.setAttribute('aria-hidden', 'true');
    guard.addEventListener('focus', () => {
      if (guards.relaying || !panel.isConnected || root.inert || root.getAttribute('aria-hidden') === 'true') return;
      const backward = edge === 'before';
      const stops = getModalTabStops(panel, backward);
      const destination = backward ? stops.at(-1) : stops[0];
      // A frame's child document owns the outgoing key event. If both edges are
      // frames, return to the meaningful dialog boundary; the next native Tab
      // enters the requested end of the document without inspecting its origin.
      if (!destination || destination.tagName === 'IFRAME') panel.focus({ preventScroll: true });
      else destination.focus({ preventScroll: true });
    });
    guards[edge] = guard;
  }
  panel.before(guards.before);
  panel.after(guards.after);
  document[GUARDS_KEY] = guards;
}

function sameRadioGroup(a, b) {
  return a?.tagName === 'INPUT' && b?.tagName === 'INPUT' &&
    a.type === 'radio' && b.type === 'radio' && !!a.name && a.name === b.name &&
    a.form === b.form && a.getRootNode() === b.getRootNode();
}

// Shared by ordinary and Smart Modal. Read the current DOM on each Tab so
// hidden, inert or disabled controls never become stale focus boundaries.
function getModalTabStops(panel, backward = false) {
  const view = panel.ownerDocument.defaultView;
  const candidates = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') &&
      !node.closest('[inert]') && node.getClientRects().length > 0 &&
      view.getComputedStyle(node).visibility === 'visible')
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  // Native radio groups contribute one sequential stop, not every input.
  // Do not rewrite checked/tabindex or intercept their native arrow-key handling.
  return candidates.filter(node => {
    if (!sameRadioGroup(node, node)) return true;
    const group = candidates.filter(candidate => sameRadioGroup(node, candidate));
    const selected = group.find(candidate => candidate.checked);
    return node === (selected || group.at(backward ? -1 : 0));
  });
}

function trapModalFocus(panel, event) {
  if (!panel) return;
  const nodes = getModalTabStops(panel, event.shiftKey);
  const active = panel.ownerDocument.activeElement;
  if (!nodes.length) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const boundary = event.shiftKey ? first : last;
  if (!panel.contains(active) || active === panel ||
      active === boundary || sameRadioGroup(active, boundary)) {
    const destination = event.shiftKey ? last : first;
    const guards = panel.ownerDocument[GUARDS_KEY];
    if (destination.tagName === 'IFRAME' && guards?.panel === panel) {
      // Let the trusted browser Tab action traverse the iframe itself. Calling
      // iframe.focus() cannot choose its last child in an opaque document.
      guards.relaying = true;
      try {
        (event.shiftKey ? guards.after : guards.before).focus({ preventScroll: true });
      } finally {
        guards.relaying = false;
      }
      return;
    }
    event.preventDefault();
    destination.focus();
  }
}

// The first focus of an opened window (decision C25): the element the page
// marked with the standard `autofocus` attribute, as a native <dialog> does --
// in a dangerous question, the safe answer («Отмена»), so a stray Enter or
// Space only closes the window. A marked element that is not focusable itself
// (sf-button, whose host is display: contents) hands the focus to its first
// tab stop. Without a mark, or with one that cannot take the focus, the panel
// takes it, as before. Answers the element that took it.
function focusModalInitial(panel) {
  if (!panel) return null;
  const marked = panel.querySelector('[autofocus]');
  if (marked && !marked.closest('[inert]')) {
    const target = marked.matches(FOCUSABLE_SELECTOR) && marked.tabIndex >= 0 && !marked.matches(':disabled')
      ? marked
      : getModalTabStops(marked)[0];
    if (target) {
      target.focus({ preventScroll: true });
      if (panel.ownerDocument.activeElement === target) return target;
    }
  }
  panel.focus();
  return panel;
}

export { getModalTabStops, trapModalFocus, syncModalFocusGuards, focusModalInitial };
