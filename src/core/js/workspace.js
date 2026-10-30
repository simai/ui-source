// The workspace layout's script (core.css .sf-workspace, docs/developer/
// workspace-layout.md). The sheet places the regions from the container's
// width; this keeps what a sheet cannot:
//
//   - the panel as a drawer (below the wide width, while it is open): a layer
//     of the one document stack (layer-stack.js), so Escape closes the top
//     layer only and focus goes back to what opened it; the other regions are
//     inert while it is open, so a press beside it (on the scrim) closes it
//     and Tab stays in it -- the contract sf-drawer keeps for a modal panel;
//   - the narrow view: when the region holding focus is hidden, focus goes to
//     the region shown -- back to the list, onto the row the host marks with
//     aria-current; on to main, onto its back control;
//   - the events sf-workspace-view {view} and sf-workspace-panel {open}.
//
// The state is the element's attributes: data-sf-workspace-view (list|main)
// and data-sf-workspace-panel (open). A host sets them, or calls
// SF.workspace(element).show(view) and .panel(open); both paths end in sync().
//
// sf-drawer is not used for the panel: it is a Smart element that draws its own
// panel in a fixed layer of the page, and the panel here is the host's own
// region, which must stay where it is in the DOM to be a column when the
// container is wide. The contract is sf-drawer's, kept with the same stack.
import {closeLayer, openLayer, tryFocus} from './layer-stack.js';

const VIEW = 'data-sf-workspace-view';
const PANEL = 'data-sf-workspace-panel';
const LIST_HIDDEN = '[data-sf-workspace-list="hidden"]';
const KEY = Symbol.for('sf.workspace');
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const CURRENT = '[aria-current]:not([aria-current="false"])';

const region = (element, name) => element.querySelector(`:scope > .sf-workspace-${name}`);

const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)]
  .filter((node) => node.getClientRects().length && !node.closest('[inert]'));

// The node itself when a person can focus it, else the first that can be
// inside it, else the node with a temporary tabindex.
function focusInto(node) {
  if (!node) return false;
  if (node.matches(FOCUSABLE) && tryFocus(node)) return true;
  const inside = focusables(node)[0];
  if (inside && tryFocus(inside)) return true;
  return tryFocus(node, true);
}

class Workspace {
  constructor(element) {
    this.element = element;
    this.view = this.readView();
    this.open = element.getAttribute(PANEL) === 'open';
    this.drawer = false;
    this.inerted = [];
    this.layout = null;
    // What opened the panel, where focus goes back when its drawer closes.
    this.opener = null;
    this.resize = typeof globalThis.ResizeObserver === 'function'
      ? new globalThis.ResizeObserver(() => this.sync())
      : null;
    this.resize?.observe(element);
    element.addEventListener('click', (event) => this.onClick(event));
  }

  readView() {
    return this.element.getAttribute(VIEW) === 'main' ? 'main' : 'list';
  }

  // narrow | split | wide, as the sheet's container queries said it on the regions.
  readLayout() {
    const probe = region(this.element, 'main') ?? this.element.firstElementChild;
    if (!probe) return 'wide';
    const value = globalThis.getComputedStyle(probe).getPropertyValue('--sf-workspace--layout').trim();
    return ['narrow', 'split', 'wide'].includes(value) ? value : 'wide';
  }

  show(view) {
    if (view !== 'list' && view !== 'main') throw new TypeError(`SF.workspace: show('list' | 'main'), not ${JSON.stringify(view)}`);
    this.element.setAttribute(VIEW, view);
    this.sync();
    return this;
  }

  panel(open = !this.open) {
    if (open) this.element.setAttribute(PANEL, 'open');
    else this.element.removeAttribute(PANEL);
    this.sync();
    return this;
  }

  emit(type, detail) {
    this.element.dispatchEvent(new CustomEvent(type, {bubbles: true, detail}));
  }

  sync() {
    const {element} = this;
    if (!element.isConnected) {
      this.closeDrawer(false);
      return;
    }
    const layout = this.readLayout();
    const view = this.readView();
    const open = element.getAttribute(PANEL) === 'open';
    const active = globalThis.document.activeElement;
    // The container narrowed: the region holding focus may have just been
    // hidden. Nothing else moves focus on a change of width.
    const narrowed = layout === 'narrow' && this.layout && this.layout !== 'narrow';
    this.layout = layout;
    if (view !== this.view) {
      this.view = view;
      if (layout === 'narrow') this.moveFocusForView(view, active);
      this.emit('sf-workspace-view', {view});
    } else if (narrowed && active && active !== globalThis.document.body) {
      this.moveFocusForView(view, active);
    }
    if (open && !this.open) this.opener = region(element, 'panel')?.contains(active) ? null : active;
    const drawer = open && layout !== 'wide';
    if (drawer && !this.drawer) this.openDrawer();
    // Closed: focus goes back to the opener. Still open, as a column now: it
    // stays where it is.
    else if (!drawer && this.drawer) this.closeDrawer(!open);
    if (open !== this.open) {
      this.open = open;
      this.emit('sf-workspace-panel', {open});
    }
  }

  // The narrow view changed: focus left in the region now hidden goes to the
  // one shown.
  moveFocusForView(view, active) {
    const {element} = this;
    const doc = globalThis.document;
    const listSide = [region(element, 'list'), region(element, 'rail')].filter(Boolean);
    const main = region(element, 'main');
    const lost = !active || active === doc.body;
    if (view === 'list') {
      if (!lost && !main?.contains(active)) return;
      const list = region(element, 'list');
      if (!list || element.matches(LIST_HIDDEN)) return;
      focusInto(list.querySelector(CURRENT) ?? list);
      return;
    }
    if (!lost && !listSide.some((part) => part.contains(active))) return;
    const back = main?.querySelector('.sf-workspace-back');
    if (back && back.getClientRects().length && focusInto(back)) return;
    if (main) tryFocus(main, true);
  }

  openDrawer() {
    const panel = region(this.element, 'panel');
    if (!panel) return;
    this.drawer = true;
    const doc = globalThis.document;
    // A panel that turns into a drawer with focus inside it (the container
    // narrowed) gives focus back to what opened it, not to itself.
    const returnTo = panel.contains(doc.activeElement) ? this.opener : doc.activeElement;
    this.inerted = [...this.element.children].filter((child) => child !== panel && !child.inert);
    for (const child of this.inerted) child.inert = true;
    openLayer(panel, {
      kind: 'panel',
      trapsFocus: true,
      locksPage: false,
      returnTo,
      root: () => panel,
      focusIn: () => focusInto(panel),
      onEscape: () => {
        this.panel(false);
        return true;
      },
      onTab: (event) => this.keepTab(event, panel),
    });
    if (!panel.contains(doc.activeElement)) focusInto(panel);
  }

  closeDrawer(restoreFocus) {
    if (!this.drawer) return;
    this.drawer = false;
    for (const child of this.inerted) child.inert = false;
    this.inerted = [];
    const panel = region(this.element, 'panel');
    if (panel) closeLayer(panel, {restoreFocus});
  }

  keepTab(event, panel) {
    const inside = focusables(panel);
    if (!inside.length) {
      event.preventDefault();
      return;
    }
    const active = globalThis.document.activeElement;
    const first = inside[0];
    const last = inside[inside.length - 1];
    if (!panel.contains(active)) {
      event.preventDefault();
      tryFocus(event.shiftKey ? last : first);
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      tryFocus(last);
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      tryFocus(first);
    }
  }

  onClick(event) {
    if (event.defaultPrevented) return;
    const {element} = this;
    // A press on the scrim: the other regions are inert, so it lands on the
    // workspace itself.
    if (this.drawer && event.target === element) {
      this.panel(false);
      return;
    }
    const back = event.target instanceof Element ? event.target.closest('.sf-workspace-back') : null;
    if (back && back.closest('.sf-workspace') === element) this.show('list');
  }
}

/** The workspace's controller, made the first time it is asked for. */
export function workspace(element) {
  if (!(element instanceof Element) || !element.classList.contains('sf-workspace')) {
    throw new TypeError('SF.workspace: an element with the class sf-workspace');
  }
  if (!element[KEY]) {
    const own = new Workspace(element);
    element[KEY] = Object.freeze({
      element,
      show: (view) => {
        own.show(view);
        return element[KEY];
      },
      panel: (open) => {
        own.panel(open);
        return element[KEY];
      },
      get view() {
        return own.view;
      },
      get panelOpen() {
        return own.open;
      },
      get layout() {
        return own.readLayout();
      },
      sync: () => own.sync(),
    });
  }
  return element[KEY];
}

// The workspaces on the page when it is read, and any whose state a host
// changes later by attribute. A workspace added later is taken by its first
// attribute change, its first press, or SF.workspace(element).
function install(win) {
  const doc = win.document;
  const take = () => {
    for (const element of doc.querySelectorAll('.sf-workspace')) workspace(element).sync();
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', take, {once: true});
  else take();
  new win.MutationObserver((records) => {
    const seen = new Set();
    for (const {target} of records) {
      if (seen.has(target) || !target.classList?.contains('sf-workspace')) continue;
      seen.add(target);
      workspace(target).sync();
    }
  }).observe(doc.documentElement, {attributes: true, subtree: true, attributeFilter: [VIEW, PANEL]});
  // A press inside a workspace no one has asked for yet, taken on its way
  // down: the workspace's own listener, added now, still hears it on the way
  // up, so its back control works without a call.
  doc.addEventListener('click', (event) => {
    const element = event.target instanceof win.Element ? event.target.closest('.sf-workspace') : null;
    if (element && !element[KEY]) workspace(element).sync();
  }, true);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.SF = window.SF || {};
  if (!window.SF.workspace) {
    window.SF.workspace = workspace;
    install(window);
  }
}
