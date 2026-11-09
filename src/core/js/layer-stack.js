// The one document layer stack (standard simai.smart-component 1.3.8 §19).
//
// Everything that draws above the page -- a modal, a drawer, a popover, a
// dropdown list, a menu, a calendar, the toast area -- registers here when it
// opens and leaves when it closes. The stack answers three questions the
// components used to answer each for itself, from three lists and two z-index
// bases:
//
//   - which layer is on top: the one opened last. Only that layer acts on
//     Escape, an outside press and Tab; a layer below stands back
//     (simai/ui-source#36: Escape over a modal opened from a drawer closed the
//     drawer, because each kept its own stack and the drawer listened first);
//   - how high each layer is drawn: one z-index scale in opening order, read
//     from the tokens --sf-z-index-layer and --sf-z-index-layer-step
//     (simai/ui-source#37: a drawer opened from a modal was drawn under it,
//     at 90 + 2i against the modal's 9000 + 2i);
//   - where focus goes when a layer closes: back to what was active when it
//     opened; if that is gone or outside the new top layer, into the new top
//     layer; else the nearest landmark; else the body. A layer that closes
//     while another stands above it moves no focus.
//
// It also keeps what every layer did with a copy of its own: one listener for
// a press outside the top layer (onOutsidePress), one page lock (lockPageScroll,
// taken for a layer that locks the page and brings no lock of its own) and one
// list of what can take focus (FOCUSABLE). A popover, a menu and a context menu
// each bound a document listener for the outside press, and a drawer, a site
// header, a search window and a modal each wrote the page lock again, three of
// them without the modal's care for the page's own padding (reuse audit
// 2026-11-02, findings 1 and 2).
//
// Kept on a shared global, not in module scope: every Smart bundle carries its
// own copy of this module, and the modal's bundle has to see the drawer the
// drawer's bundle opened. Each document (an iframe too) has its own stack.
//
// A layer is any object: a custom element, or the root element of a component
// without one. One whose `isConnected` is false is passed over, so a layer
// removed without closing cannot hold every key on the page.

const STACK_KEY = Symbol.for('sf.layerStack');

// The scale's defaults, the same as core's tokens: 9000 is where the modal
// stack always started, so nothing a page draws below it changes place.
const LAYER_BASE = 9000;
const LAYER_STEP = 2;

const LANDMARKS = 'main, section, article, [role="main"], [role="region"]';

/**
 * What a person can move focus to: the one list a layer keeps Tab inside and
 * moves focus into. A hidden input is not a stop; an editable region is. Each
 * component kept a list of its own, and they had drifted apart.
 */
export const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The focusable nodes inside these roots that are drawn and not inert, in order. */
export function focusablesIn(...roots) {
  return roots.flatMap((root) => Array.from(root?.querySelectorAll?.(FOCUSABLE) ?? []))
    .filter((node) => node.getClientRects().length > 0 && !node.closest('[inert]'));
}

function stack() {
  const scope = globalThis;
  if (!scope[STACK_KEY]) {
    Object.defineProperty(scope, STACK_KEY, {
      value: {layers: [], bound: false, pressBound: false, lease: null, pressTop: new WeakMap()},
      configurable: true,
    });
  }
  return scope[STACK_KEY];
}

const isLive = (entry) => entry?.owner?.isConnected !== false;

// A toast does not take keys or presses: the window under it keeps them.
const takesInput = (entry) => entry.kind !== 'toast';

function find(owner) {
  return stack().layers.find((entry) => entry.owner === owner) || null;
}

function readToken(name, fallback) {
  const root = globalThis.document?.documentElement;
  if (!root || typeof globalThis.getComputedStyle !== 'function') return fallback;
  const value = parseInt(globalThis.getComputedStyle(root).getPropertyValue(name), 10);
  return Number.isFinite(value) ? value : fallback;
}

/** The z-index of the layer at a place in the stack, as a number. */
export function layerZIndexAt(index) {
  if (index < 0) return '';
  return readToken('--sf-z-index-layer', LAYER_BASE) + index * readToken('--sf-z-index-layer-step', LAYER_STEP);
}

// The class the modal's lock always added, kept so a page that reads it (and
// the modal's probes, which do) still sees a locked page.
const LOCK_CLASS = 'overflow-hidden';

/**
 * The default page lock (§19.1): the document stops scrolling, and the body
 * takes the scrollbar's width as padding so the page does not jump sideways
 * when the bar goes. Answers the function that gives it back.
 *
 * It was the modal's: it adds the gap to the padding the body already has, and
 * gives back only what it set -- a class or an overflow the page had before
 * stays, and a padding the page changed meanwhile is the page's. The overflow
 * is also written inline, as the drawer, the site header and the search window
 * wrote it, so the lock holds before the utility sheet with the class arrives.
 */
export function lockPageScroll({preserveScrollGap = true} = {}) {
  const doc = globalThis.document;
  const html = doc?.documentElement;
  const body = doc?.body;
  if (!html || !body) return () => {};
  const view = doc.defaultView || globalThis.window || globalThis;
  const gap = Math.max(0, (view.innerWidth || 0) - html.clientWidth);
  const kept = [html, body].map((node) => ({
    node,
    locked: node.classList.contains(LOCK_CLASS),
    overflow: node.style.getPropertyValue('overflow'),
    overflowPriority: node.style.getPropertyPriority('overflow'),
  }));
  for (const {node} of kept) {
    node.classList.add(LOCK_CLASS);
    node.style.setProperty('overflow', 'hidden');
  }
  const padding = {
    value: body.style.getPropertyValue('padding-inline-end'),
    priority: body.style.getPropertyPriority('padding-inline-end'),
    applied: null,
  };
  if (preserveScrollGap && gap > 0) {
    const current = parseFloat(view.getComputedStyle?.(body).paddingInlineEnd) || 0;
    body.style.setProperty('padding-inline-end', `${current + gap}px`, padding.priority);
    padding.applied = body.style.getPropertyValue('padding-inline-end');
  }
  return () => {
    for (const {node, locked, overflow, overflowPriority} of kept) {
      if (!locked) node.classList.remove(LOCK_CLASS);
      // Only the overflow this lock wrote: one the page set meanwhile stays.
      if (node.style.getPropertyValue('overflow') !== 'hidden' || node.style.getPropertyPriority('overflow')) continue;
      if (overflow) node.style.setProperty('overflow', overflow, overflowPriority);
      else node.style.removeProperty('overflow');
    }
    if (padding.applied === null ||
        body.style.getPropertyValue('padding-inline-end') !== padding.applied ||
        body.style.getPropertyPriority('padding-inline-end') !== padding.priority) return;
    if (padding.value) body.style.setProperty('padding-inline-end', padding.value, padding.priority);
    else body.style.removeProperty('padding-inline-end');
  };
}

// The page lock is one lease for the whole stack, taken by the first layer
// that locks the page and given back when no such layer is left -- whichever
// kind opened first and whichever closes last. A modal and a drawer held two
// locks before, and closing them out of order unlocked the page under an open
// window. A layer that brings no lockPage of its own takes the default one.
function syncPageLock() {
  const state = stack();
  const locker = state.layers.find((entry) => entry.locksPage && isLive(entry));
  if (locker && !state.lease) {
    const release = locker.lockPage
      ? locker.lockPage()
      : lockPageScroll({preserveScrollGap: locker.preserveScrollGap !== false});
    state.lease = typeof release === 'function' ? release : () => {};
  } else if (!locker && state.lease) {
    const release = state.lease;
    state.lease = null;
    release();
  }
}

function sync() {
  const state = stack();
  const top = topLayer();
  state.layers.forEach((entry, index) => {
    entry.place?.({index, zIndex: layerZIndexAt(index), top: entry === top});
  });
  syncPageLock();
}

/** The layer on top: the last opened that takes keys and presses. */
export function topLayer() {
  const {layers} = stack();
  for (let at = layers.length - 1; at >= 0; at -= 1) {
    if (isLive(layers[at]) && takesInput(layers[at])) return layers[at];
  }
  return null;
}

/** Whether this owner is the top layer. One that is not open is top only when nothing is. */
export function isTopLayer(owner) {
  const top = topLayer();
  return top ? top.owner === owner : !find(owner);
}

export function hasLayer(owner) {
  return Boolean(find(owner));
}

/** Whether a layer of one of these kinds stands above this owner. */
export function hasLayerAbove(owner, kinds = ['modal', 'panel']) {
  const {layers} = stack();
  const at = layers.findIndex((entry) => entry.owner === owner);
  if (at < 0) return false;
  return layers.slice(at + 1).some((entry) => isLive(entry) && kinds.includes(entry.kind));
}

/** The place of this owner in the stack, -1 when it is not open. */
export function layerIndex(owner) {
  return stack().layers.findIndex((entry) => entry.owner === owner);
}

/** This owner's z-index, '' when it is not open. */
export function layerZIndex(owner) {
  return layerZIndexAt(layerIndex(owner));
}

/** The open layers, bottom first; of one kind when `kind` is given. */
export function openLayers(kind = '') {
  return stack().layers.filter((entry) => !kind || entry.kind === kind).map((entry) => entry.owner);
}

/**
 * Registers a layer, or raises it to the top when it is already open.
 *
 * options:
 *   kind        'modal' | 'panel' | 'surface' | 'toast'
 *   locksPage   true to hold the page lock while open; lockPage() takes it and
 *               returns the function that gives it back, and without one the
 *               stack takes lockPageScroll({preserveScrollGap})
 *   preserveScrollGap  false to let the page widen when its scrollbar goes
 *   trapsFocus  true to keep Tab inside and to return focus on close
 *   root()      the element the layer draws, for focus and outside presses
 *   onEscape(event)  closes the layer and answers true when it took the press
 *   onTab(event)     keeps focus inside
 *   onOutsidePress(event)  a press began outside root() and the owner while
 *               this is the top layer; the layer decides what it closes
 *   focusIn()        moves focus inside
 *   place({index, zIndex, top})  draws the layer at its height
 *   returnTo    what was active at open (default: the active element now)
 */
export function openLayer(owner, options = {}) {
  if (!owner) return null;
  const state = stack();
  bindKeys();
  bindPresses();
  let entry = find(owner);
  if (entry) {
    state.layers.splice(state.layers.indexOf(entry), 1);
    Object.assign(entry, options);
  } else {
    const returnTo = options.returnTo !== undefined ? options.returnTo : globalThis.document?.activeElement ?? null;
    entry = {kind: 'surface', locksPage: false, trapsFocus: false, ...options, owner, returnTo,
      returnAncestors: landmarksAround(returnTo)};
  }
  state.layers.push(entry);
  sync();
  return entry;
}

/** Changes what a layer declares without moving it in the stack. */
export function updateLayer(owner, options = {}) {
  const entry = find(owner);
  if (!entry) return null;
  Object.assign(entry, options);
  sync();
  return entry;
}

/** Raises an open layer to the top. */
export function raiseLayer(owner) {
  const entry = find(owner);
  if (!entry) return;
  const {layers} = stack();
  layers.splice(layers.indexOf(entry), 1);
  layers.push(entry);
  sync();
}

/**
 * Removes a layer. Answers whether it was the top one. With `restoreFocus`
 * (the default) a top layer that traps focus gives focus back by §19.2.
 */
export function closeLayer(owner, {restoreFocus = true} = {}) {
  const entry = find(owner);
  if (!entry) return false;
  const wasTop = topLayer() === entry;
  const {layers} = stack();
  layers.splice(layers.indexOf(entry), 1);
  sync();
  if (restoreFocus && wasTop && entry.trapsFocus) {
    returnLayerFocus(true, entry.returnTo, entry.returnAncestors);
  }
  return wasTop;
}

/** The landmarks around a node, nearest first: where focus falls back to. */
export function landmarksAround(node) {
  const found = [];
  for (let parent = node?.parentElement; parent; parent = parent.parentElement) {
    if (parent.matches?.(LANDMARKS)) found.push(parent);
  }
  return found;
}

/** Focuses a node if a person could reach it; answers whether it took focus. */
export function tryFocus(node, temporaryTabIndex = false) {
  if (!node?.isConnected || typeof node.focus !== 'function' ||
      node.matches?.(':disabled') || node.closest?.('[inert], [hidden], [aria-hidden="true"]') ||
      !node.getClientRects?.().length ||
      node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'visible') {
    return false;
  }
  const addTabIndex = temporaryTabIndex && !node.hasAttribute('tabindex');
  let observer;
  const cleanup = () => {
    observer?.disconnect();
    node.removeEventListener('blur', cleanup);
    // Keep an author's own change to the temporary attribute.
    if (addTabIndex && node.getAttribute('tabindex') === '-1') node.removeAttribute('tabindex');
  };
  if (addTabIndex) {
    node.setAttribute('tabindex', '-1');
    node.addEventListener('blur', cleanup, {once: true});
    observer = new node.ownerDocument.defaultView.MutationObserver(() => {
      if (!node.isConnected) cleanup();
    });
    observer.observe(node.ownerDocument.documentElement, {childList: true, subtree: true});
  }
  let focused = false;
  try {
    node.focus({preventScroll: true});
    focused = node.ownerDocument.activeElement === node;
    return focused;
  } catch {
    return false;
  } finally {
    // Removing tabindex while a non-native target is focused blurs it.
    if (addTabIndex && !focused) cleanup();
  }
}

// The layer that owns focus now: the topmost one that traps it. A docked
// panel or an open list under the window does not.
function focusOwner() {
  const {layers} = stack();
  for (let at = layers.length - 1; at >= 0; at -= 1) {
    if (isLive(layers[at]) && layers[at].trapsFocus) return layers[at];
  }
  return null;
}

/**
 * Gives focus back after a layer closed (§19.2): to `target` when it is still
 * there and inside the layer that now owns focus (or nothing does); else into
 * that layer; else the nearest landmark; else the body. Nothing moves when the
 * closed layer was not the top one.
 */
export function returnLayerFocus(wasTop, target, ancestors = []) {
  if (!wasTop) return;
  const owner = focusOwner();
  const root = owner?.root?.();
  if ((!owner || root?.contains(target)) && tryFocus(target)) return;
  if (owner) {
    owner.focusIn?.();
    return;
  }
  const doc = globalThis.document;
  if (!doc) return;
  const candidates = new Set([...ancestors, ...doc.querySelectorAll('main, [role="main"]'), doc.body]);
  for (const candidate of candidates) {
    if (tryFocus(candidate, true)) return;
  }
}

// One listener pair for the whole document, whichever bundle binds it first.
// The top layer is read when the press starts (window, capture -- before any
// component's listener) and acted on when it has passed through the page
// (window, bubble): a control inside that handled Escape keeps it, and a
// surface that closed itself on the way down does not hand the same press to
// the layer under it.
function bindKeys() {
  const state = stack();
  if (state.bound || typeof globalThis.addEventListener !== 'function') return;
  state.bound = true;
  globalThis.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') state.pressTop.set(event, topLayer());
  }, true);
  globalThis.addEventListener('keydown', (event) => {
    if ((event.key !== 'Escape' && event.key !== 'Tab') || event.defaultPrevented) return;
    const top = state.pressTop.has(event) ? state.pressTop.get(event) : topLayer();
    if (!top || top !== topLayer()) return;
    if (event.key === 'Escape') {
      if (top.onEscape?.(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    top.onTab?.(event);
  });
}

// Outside a layer: in the composed path of neither what it draws nor its
// owner, so a press inside a shadow root or a portal of its own is inside.
function pressedOutside(entry, event) {
  const path = event.composedPath?.() ?? [];
  const root = entry.root?.();
  return !path.includes(entry.owner) && !(root && path.includes(root));
}

// One pointerdown listener pair for the whole document, as for the keys: the
// top layer is read in capture, before any component sees the press, and acts
// in bubble, once the press has passed through the page. Only the top layer
// hears it, so a list over a popover closes and the popover stays, and a layer
// that opened or closed on the way down (a trigger's own press) does not hand
// the press to another. Each surface bound a document listener of its own
// before, and the first one bound acted whatever lay above it.
function bindPresses() {
  const state = stack();
  if (state.pressBound || typeof globalThis.addEventListener !== 'function') return;
  state.pressBound = true;
  globalThis.addEventListener('pointerdown', (event) => {
    state.pressTop.set(event, topLayer());
  }, true);
  globalThis.addEventListener('pointerdown', (event) => {
    const top = state.pressTop.has(event) ? state.pressTop.get(event) : topLayer();
    if (!top?.onOutsidePress || top !== topLayer() || !pressedOutside(top, event)) return;
    top.onOutsidePress(event);
  });
}

// A press outside the top layer, read in capture: what a layer below would
// call outside is ignored there.
export function isOutsideTopLayer(event) {
  const top = topLayer();
  const root = top?.root?.();
  if (!root) return false;
  const path = event.composedPath?.() ?? [];
  return !path.includes(root) && !path.includes(top.owner);
}

const THEMES = ['theme-dark', 'theme-light'];

/**
 * A layer drawn outside its host (a portal) keeps where it came from (§19.1):
 * the host's resolved lang and dir, the theme of its nearest themed ancestor,
 * and the computed values of the host's variables that differ from those
 * where the portal stands -- `variables` by name, `prefixes` by the start of
 * the name. It looks and speaks as if it stood where its host stands.
 *
 * With `area`, every custom property whose value at the host differs from the
 * portal's is carried as well (simai/ui-source#46 item 1): a block's retuned
 * role (--sf-primary), a part's public variable (--sf-button-background-color)
 * and a page's own name reach the layer's content. `except` names the layer's
 * own prefixes (--sf-modal-) that the area does not carry: its public names
 * still travel in `variables`, and the private ones an outer window sets on
 * its panel never reach a window opened from it. A name carried before and no
 * longer different is taken back, so a host moved to another area takes that
 * area's values.
 */
export function carryLayerOrigin(portal, host, {variables = [], prefixes = [], area = false, except = []} = {}) {
  if (!portal || !host?.isConnected) return;
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const nearest = host.closest('[lang]');
  const lang = nearest?.getAttribute('lang') ?? doc.documentElement.getAttribute('lang') ?? '';
  if (lang) portal.setAttribute('lang', lang);
  else portal.removeAttribute('lang');
  // Where the copy came from: the page itself, or a section that names its own
  // language. Only the first follows SF.language.use(), which the page language
  // does before it announces the change (simai/ui-source#55).
  if (!nearest || nearest === doc.documentElement) portal.dataset.sfLayerLang = 'page';
  else delete portal.dataset.sfLayerLang;
  const declared = host.closest('[dir]')?.getAttribute('dir');
  const dir = declared && declared !== 'auto' ? declared : view.getComputedStyle(host).direction;
  if (dir) portal.setAttribute('dir', dir);

  // The theme only when the host's differs from the portal's place: a page
  // that retunes tokens on html.theme-dark keeps them, as the class would
  // otherwise declare the core's values again on the portal.
  const parent = portal.parentElement;
  const theme = (node) => {
    const area = node?.closest?.(THEMES.map((name) => `.${name}`).join(', '));
    return area ? THEMES.find((name) => area.classList.contains(name)) : '';
  };
  const carried = portal.dataset.sfLayerTheme || '';
  const wanted = theme(host) !== theme(parent) ? theme(host) : '';
  if (carried && carried !== wanted) portal.classList.remove(carried);
  if (wanted) portal.classList.add(wanted);
  if (wanted) portal.dataset.sfLayerTheme = wanted;
  else delete portal.dataset.sfLayerTheme;

  const previous = (portal.dataset.sfLayerVariables || '').split(' ').filter(Boolean);
  if (!variables.length && !prefixes.length && !area) {
    for (const name of previous) portal.style.removeProperty(name);
    delete portal.dataset.sfLayerVariables;
    return;
  }
  const own = view.getComputedStyle(host);
  const names = new Set(variables);
  if (prefixes.length || area) {
    for (const name of own) {
      if (!name.startsWith('--')) continue;
      if (prefixes.some((prefix) => name.startsWith(prefix))) names.add(name);
      else if (area && !except.some((prefix) => name.startsWith(prefix))) names.add(name);
    }
  }
  // Compared with the portal as it stands without what was carried before,
  // its theme class already applied: what the theme gives it again is not
  // written twice.
  for (const name of previous) portal.style.removeProperty(name);
  const there = view.getComputedStyle(portal);
  const kept = [];
  for (const name of names) {
    const value = own.getPropertyValue(name).trim();
    if (value && value !== there.getPropertyValue(name).trim()) kept.push([name, value]);
  }
  for (const [name, value] of kept) portal.style.setProperty(name, value);
  if (kept.length) portal.dataset.sfLayerVariables = kept.map(([name]) => name).join(' ');
  else delete portal.dataset.sfLayerVariables;
}
