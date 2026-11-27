// Device scope (study S-A, decision q-7097831f9f option 2, 2026-11-24; the
// Touch screens page, docs/foundation-touch-screens.md). Two separate facts,
// one word each, so no component measures them in a copy of its own:
//
//   layout   'phone' when the component's place is narrower than
//            PHONE_BELOW (600 px), else 'desktop'. It decides which items a
//            component shows: an item that carries `devices` is shown only in
//            the layouts it names, and hidden -- not disabled -- in the other.
//   pointer  'coarse' when the page has a touch pointer and no fine one,
//            else 'fine'. It decides gestures and what replaces hover (a
//            check box always shown, a hit area of 44).
//
// A tablet with a keyboard is a coarse pointer in a desktop layout; a narrow
// desktop window a fine pointer in a phone layout. The two words never stand
// for each other.
//
// The place is the nearest size container (an ancestor with a
// `container-type`), as a container query reads it; without one, the page.
// 600 is the width the View layouts already switch at (sf-view-board,
// sf-view-calendar, the view head); it is not a step of the size scale
// (C181 (2) pending), recorded on the page as a known gap.
//
// Marks: an author marks any item -- a setting, a menu item, a tab, a column
// -- with `devices: ['phone']` or `devices: ['desktop']`; a component marks
// its own items it knows are bound to a layout (markDevices). The author's
// mark wins: a component's mark fills only an item that has none.

/** Below this width (px) of its place a component draws its phone layout. */
export const PHONE_BELOW = 600;
/** The layouts an item may name in `devices`. */
export const LAYOUTS = Object.freeze(['phone', 'desktop']);
/** The coarse-pointer media query: a touch pointer and no fine one. */
export const COARSE_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';

const KNOWN = new Set(LAYOUTS);

/** The layout of a width: 'phone' below PHONE_BELOW, else 'desktop'. */
export function layoutOfWidth(width) {
  return Number.isFinite(width) && width > 0 && width < PHONE_BELOW ? 'phone' : 'desktop';
}

/**
 * The box whose width decides an element's layout: the element itself or its
 * nearest ancestor that is a size container, else null (the page).
 */
export function layoutPlace(element) {
  const view = element?.ownerDocument?.defaultView ?? globalThis;
  for (let node = element instanceof Element ? element : null; node; node = node.parentElement ?? node.getRootNode?.()?.host ?? null) {
    const type = view.getComputedStyle?.(node)?.containerType ?? '';
    if (type && type !== 'normal') return node;
  }
  return null;
}

function placeWidth(element) {
  const place = layoutPlace(element);
  if (place) return place.getBoundingClientRect().width;
  const doc = element?.ownerDocument ?? globalThis.document;
  return doc?.documentElement?.clientWidth || globalThis.innerWidth || 0;
}

/**
 * The layout an element is drawn in: 'phone' or 'desktop'. A number is read
 * as a width; a written word ('phone' | 'desktop') is taken as given, so a
 * host that knows its own layout says it.
 */
export function layoutOf(target) {
  if (KNOWN.has(target)) return target;
  if (typeof target === 'number') return layoutOfWidth(target);
  return layoutOfWidth(placeWidth(target));
}

/**
 * Follows an element's layout: calls back with the new word when it changes
 * (not at once). Returns stop(). Without ResizeObserver it follows the page.
 */
export function watchLayout(element, callback) {
  let last = layoutOf(element);
  const check = () => {
    const now = layoutOf(element);
    if (now === last) return;
    last = now;
    callback(now);
  };
  const place = layoutPlace(element);
  const view = element?.ownerDocument?.defaultView ?? globalThis;
  if (place && typeof view.ResizeObserver === 'function') {
    const observer = new view.ResizeObserver(check);
    observer.observe(place);
    return () => observer.disconnect();
  }
  view.addEventListener?.('resize', check);
  return () => view.removeEventListener?.('resize', check);
}

/** The page's pointer: 'coarse' (touch, no fine pointer) or 'fine'. */
export function pointerKind(view = globalThis) {
  return typeof view?.matchMedia === 'function' && view.matchMedia(COARSE_QUERY).matches ? 'coarse' : 'fine';
}

/** Follows the page's pointer word; returns stop(). */
export function watchPointer(callback, view = globalThis) {
  const media = typeof view?.matchMedia === 'function' ? view.matchMedia(COARSE_QUERY) : null;
  if (!media) return () => {};
  const listener = () => callback(media.matches ? 'coarse' : 'fine');
  media.addEventListener?.('change', listener);
  return () => media.removeEventListener?.('change', listener);
}

/**
 * The layouts an item is scoped to, or null (every layout). Unknown words are
 * dropped; a list with no known word is no scope.
 */
export function devicesOf(item) {
  const list = Array.isArray(item?.devices) ? item.devices : typeof item?.devices === 'string' ? item.devices.split(/[\s,]+/u) : null;
  if (!list) return null;
  const known = [...new Set(list.filter((word) => KNOWN.has(word)))];
  return known.length ? known : null;
}

/** Whether an item is shown in a layout: unscoped, or scoped to it. */
export function inLayout(item, layout) {
  const scope = devicesOf(item);
  return !scope || scope.includes(KNOWN.has(layout) ? layout : 'desktop');
}

/**
 * The items shown in a layout, nested lists (`items`, and `options` when
 * `options: true`) filtered the same way. The items are not copied unless a
 * nested list changes.
 */
export function itemsInLayout(items, layout, {options = false} = {}) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (!inLayout(item, layout)) continue;
    if (!item || typeof item !== 'object') {
      out.push(item);
      continue;
    }
    let next = item;
    if (Array.isArray(item.items)) {
      const inner = itemsInLayout(item.items, layout, {options});
      if (inner.length !== item.items.length || inner.some((one, at) => one !== item.items[at])) next = {...next, items: inner};
    }
    if (options && Array.isArray(item.options)) {
      const inner = item.options.filter((option) => inLayout(option, layout));
      if (inner.length !== item.options.length) next = {...next, options: inner};
    }
    out.push(next);
  }
  return out;
}

/**
 * A component's own marks over an author's items: `marks` maps an item id to
 * its layouts (['desktop'] for a table-only setting). An item that carries
 * its own `devices` keeps it -- the author's mark wins; nested `items` are
 * marked the same way. Returns new items; the given ones are not changed.
 */
export function markDevices(items, marks = {}) {
  if (!Array.isArray(items)) return [];
  const table = marks instanceof Map ? marks : new Map(Object.entries(marks ?? {}));
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    let next = item;
    const own = Object.hasOwn(item, 'devices') && item.devices !== undefined && item.devices !== null;
    if (!own && item.id !== undefined && table.has(String(item.id))) next = {...next, devices: [...table.get(String(item.id))]};
    if (Array.isArray(item.items)) next = {...next, items: markDevices(item.items, table)};
    return next;
  });
}

const Device = Object.freeze({
  PHONE_BELOW,
  LAYOUTS,
  COARSE_QUERY,
  layoutOf,
  layoutOfWidth,
  layoutPlace,
  watchLayout,
  pointer: pointerKind,
  watchPointer,
  devicesOf,
  inLayout,
  itemsInLayout,
  markDevices,
});

// Core publishes the helper; a component bundle that carries its own copy
// reuses an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.device) globalThis.SF.device = Device;
}

// The page's layout word on <html> (data-sf-layout="phone" | "desktop"),
// written while core boots and followed on resize (DEV answer 3 on group
// build 20): static first-paint markup printed at one width carries its
// items' scope (data-sf-devices), and core.styles hides the other layout's
// items by this word until their element draws -- the signal's own width,
// PHONE_BELOW of the page, not a width rule of the sheets. One mark per
// page: a second copy of this module finds it and leaves it.
const LAYOUT_MARK = Symbol.for('sf.device.page-layout');

export function markPageLayout(doc = globalThis.document) {
  const root = doc?.documentElement;
  const view = doc?.defaultView;
  // One mark per page, kept on the document under a registry symbol: every
  // bundle carries its own copy of this module, the document is shared.
  if (!root || !view || doc[LAYOUT_MARK]) return;
  doc[LAYOUT_MARK] = true;
  const write = () => {
    const word = layoutOfWidth(root.clientWidth || view.innerWidth || 0);
    if (root.getAttribute('data-sf-layout') !== word) root.setAttribute('data-sf-layout', word);
  };
  write();
  view.addEventListener?.('resize', write, {passive: true});
}

export default Device;
