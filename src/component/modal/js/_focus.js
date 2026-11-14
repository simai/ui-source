// The fields of a window (owner decision C159, 2026-11-14): a window that
// holds fields is one form -- a press on its scrim never closes it (6), it
// asks before its changes go (6), its main answer submits it and Enter in a
// one-line field presses that answer (9), its first field takes the focus
// (9), and on a phone a form of more than three fields takes the whole
// screen (2). Shared by sf-modal and the class modal, and by sf-drawer. They live here,
// beside the first focus that reads them, so the focus module stays one file
// with no imports (the unit tests load it as one module).
//
// A field is a native control a person types or picks in, or a Framework
// field element (sf-input*, sf-dropdown, sf-checkbox, sf-switch, sf-radio)
// whether it has drawn its control yet or not; a field element counts once,
// whatever it draws inside.

const NATIVE_FIELD = [
  'input:not([type="hidden"], [type="button"], [type="submit"], [type="reset"], [type="image"])',
  'select', 'textarea', '[contenteditable=""]', '[contenteditable="true"]',
].join(', ');
const FIELD_ELEMENTS = new Set(['sf-dropdown', 'sf-checkbox', 'sf-switch', 'sf-radio', 'sf-segmented']);
const isFieldElement = (node) => node.localName?.startsWith('sf-input') || FIELD_ELEMENTS.has(node.localName);
// One-line fields: Enter in them presses the main answer (9).
const ONE_LINE = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'password', 'number', 'date',
  'datetime-local', 'month', 'time', 'week']);

// The outermost field element a node stands in, under `root`.
function fieldElementOf(node, root) {
  let host = null;
  for (let at = node; at && at !== root; at = at.parentElement) {
    if (isFieldElement(at)) host = at;
  }
  return host;
}

// The window's fields in document order, each once.
function windowFields(root) {
  if (!root?.querySelectorAll) return [];
  const units = [];
  const seen = new Set();
  for (const node of root.querySelectorAll('*')) {
    if (!isFieldElement(node) && !node.matches(NATIVE_FIELD)) continue;
    if (node.closest('[hidden]')) continue;
    const unit = fieldElementOf(node, root) || node;
    if (seen.has(unit)) continue;
    seen.add(unit);
    units.push(unit);
  }
  return units;
}

function isOneLineField(node) {
  return node?.localName === 'input' && ONE_LINE.has((node.getAttribute('type') || '').toLowerCase());
}

// Makes the fields read-only while the window saves (9) and answers the undo:
// only what it changed goes back.
function holdFieldsReadOnly(fields) {
  const changed = [];
  for (const unit of fields) {
    if (unit.localName?.startsWith('sf-')) {
      if (!unit.hasAttribute('readonly')) { unit.setAttribute('readonly', ''); changed.push(() => unit.removeAttribute('readonly')); }
      continue;
    }
    if ('readOnly' in unit && !unit.readOnly && unit.localName !== 'select') {
      unit.readOnly = true;
      changed.push(() => { unit.readOnly = false; });
    } else if (unit.localName === 'select' && !unit.hasAttribute('aria-readonly')) {
      unit.setAttribute('aria-readonly', 'true');
      unit.inert = true;
      changed.push(() => { unit.removeAttribute('aria-readonly'); unit.inert = false; });
    }
  }
  return () => changed.forEach((undo) => undo());
}

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

// The first focus of an opened window (decisions C25, C39), by name
// (sf-modal initial-focus):
//
// - auto (the default): the element the page marked with the standard
//   `autofocus` attribute, as a native <dialog> does; else, in a question
//   window -- one whose answers hold a dangerous one (an sf-button with
//   status="danger", its drawn .sf-button--danger, or an sf-confirm) -- its
//   safe answer, «Отмена»; else, in a window with fields, its first field
//   (owner decision C159 (9), 2026-11-14, as WAI-ARIA's dialog pattern
//   advises); else the panel, as before. Only answers count: a red
//   sf-badge or an error message in the body does not make a window a question;
// - safe: the safe answer whenever there is one;
// - first: the first control of the window's content (the header's buttons,
//   the × among them, excluded);
// - panel: the panel itself.
//
// The safe answer is the declining answer of an sf-confirm in the window
// ([data-action="decline"]) or the page's own answer that closes the window
// ([data-sf-modal-close], the header's × excluded): a stray Enter or Space then
// only closes the question. An element that is not focusable itself
// (sf-button, whose host is display: contents) hands the focus to its first
// tab stop. Content drawn after the window opened -- an sf-button draws its
// <button> on its own schedule, an sf-confirm its answers, either perhaps
// while its script is still loading -- is waited for, frame by frame for up
// to two seconds, while the focus is still on the panel; anything the person
// does in between wins. Answers the element that took the focus.
const INITIAL_FOCUS = ['auto', 'safe', 'first', 'panel'];
// status="error" on an sf-button is danger's dated alias (C13).
const DANGER_SELECTOR = 'sf-button[status="danger"], sf-button[status="error"], .sf-button--danger, sf-confirm';
// The header's × is excluded: its button (.sf-modal-close-button) and, since
// sf-modal draws it as sf-button-close (C14), that element (.sf-modal-close).
const SAFE_SELECTOR = '[data-action="decline"], [data-sf-modal-close]:not(.sf-modal-close-button):not(.sf-modal-close)';

function takesFocus(node) {
  if (!node || node.closest('[inert]') || node.closest('[hidden]')) return null;
  if (node.matches(FOCUSABLE_SELECTOR) && node.tabIndex >= 0 && !node.matches(':disabled')) return node;
  return getModalTabStops(node)[0] || null;
}

function isDanger(node) {
  return node.matches('sf-button[status="danger"], sf-button[status="error"], .sf-button--danger') || Boolean(node.querySelector('.sf-button--danger'));
}

// The element that takes the safe answer's focus, or null while there is none
// (or it is not drawn yet).
function safeAnswer(panel) {
  for (const host of panel.querySelectorAll(SAFE_SELECTOR)) {
    if (host.closest('[inert], [hidden]') || isDanger(host)) continue;
    const target = takesFocus(host);
    if (target) return target;
  }
  return null;
}

function firstFocus(panel, mode) {
  if (mode === 'panel') return panel;
  if (mode === 'first') return getModalTabStops(panel).find((node) => !node.closest('.sf-modal-header-action')) || panel;
  if (mode === 'auto') {
    const marked = panel.querySelector('[autofocus]');
    if (marked && !marked.closest('[inert], [hidden]')) return takesFocus(marked) || panel;
    if (!panel.querySelector(DANGER_SELECTOR)) {
      const body = panel.querySelector('[data-sf-modal-body-scroll]') || panel;
      const field = windowFields(body)[0];
      return (field && takesFocus(field)) || panel;
    }
  }
  return safeAnswer(panel) || panel;
}

const WAIT_FOR_CONTENT_MS = 2000;

function focusModalInitial(panel, mode = 'auto') {
  if (!panel) return null;
  const name = INITIAL_FOCUS.includes(mode) ? mode : 'auto';
  const target = firstFocus(panel, name);
  target.focus({ preventScroll: true });
  const doc = panel.ownerDocument;
  if (doc.activeElement !== target && target !== panel) panel.focus({ preventScroll: true });
  if (target === panel && name !== 'panel') {
    const view = doc.defaultView;
    const until = (view?.performance?.now() ?? 0) + WAIT_FOR_CONTENT_MS;
    const retry = () => {
      if (doc.activeElement !== panel || !panel.isConnected) return;
      const late = firstFocus(panel, name);
      if (late !== panel) late.focus({ preventScroll: true });
      else if (view.performance.now() < until) view.requestAnimationFrame(retry);
    };
    view?.requestAnimationFrame(retry);
  }
  return doc.activeElement === target ? target : panel;
}

export {
  getModalTabStops, trapModalFocus, syncModalFocusGuards, focusModalInitial, INITIAL_FOCUS,
  windowFields, isFieldElement, isOneLineField, holdFieldsReadOnly,
};
