// Which crumbs of a trail are hidden behind «…» (R177 BC-06, BC-11).
//
// One answer for every runtime that collapses a trail: the ordinary script
// (breadcrumbs.js, the class markup a server prints) and sf-breadcrumbs, which
// imports this file into its own bundle. Before, each kept its own copy of the
// arithmetic and they drifted.
//
// A trail collapses for two reasons:
//
//   - a cap: max-items, when the page sets one (3 or more). It keeps the shape
//     it always had: floor((max - 1) / 2) crumbs at the start, the rest at the
//     end, «…» in between.
//   - room (owner decision C93 item 1): while the row has no room for its
//     crumbs (trailOverflows), one more crumb goes behind «…». The first crumb
//     goes last of the ancestors, and the tail is never hidden: the parent and
//     the current page (or, in a trail of parents only, the parent). At its
//     narrowest a trail reads «… › parent › current» (C93 item 2). Room is the
//     only reason on every ladder: a trail that fits the phone stays whole, and
//     no single crumb hides behind «…» (L1 of the C93 review). Past that
//     narrowest, a tail crumb cut below a few letters (cutBelowMin) folds too:
//     «… › current» (starvedFit).
//
// A range is {start, end}: the crumbs start .. end - 1 are hidden. null hides
// nothing.

// The crumbs a cap of max-items hides.
export function capRange(count, maxItems) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const max = Math.floor(Number(maxItems) || 0);

  if (max < 3 || total <= max) return null;

  const visible = max - 1;
  const leading = Math.floor(visible / 2);
  const trailing = visible - leading;

  if (total - leading - trailing <= 0) return null;

  return { start: leading, end: total - trailing };
}

// Room hides two crumbs at least: one crumb behind «…» saves next to no width
// and costs a tap (L1 of the C93 review). A trail that cannot spare two keeps
// every crumb and cuts its names instead.
export const MIN_FOLD = 2;

// How many crumbs room can hide at most: everything but the tail, or nothing
// when that is less than MIN_FOLD.
export function maxFitHidden(count, tail = 2) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const kept = Math.max(1, Math.floor(Number(tail) || 0));
  const max = total - kept;

  return max >= MIN_FOLD ? max : 0;
}

// The crumbs hidden when room hides `hidden` of them.
export function fitRange(count, hidden, tail = 2) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const kept = Math.max(1, Math.floor(Number(tail) || 0));
  const max = maxFitHidden(total, kept);
  const asked = Math.floor(Number(hidden) || 0);
  const wanted = Math.min(asked > 0 ? Math.max(asked, MIN_FOLD) : 0, max);

  if (wanted <= 0) return null;

  // While the first crumb can stay, the middle goes from its start.
  if (wanted <= total - 1 - kept) return { start: 1, end: 1 + wanted };

  // Then the first one goes too: «… › parent › current».
  return { start: 0, end: total - kept };
}

// The range shown: the cap's, until room asks for more than it hides.
export function collapseRange(count, { maxItems = 0, fit = 0, tail = 2 } = {}) {
  const cap = capRange(count, maxItems);
  const capped = cap ? cap.end - cap.start : 0;
  const wanted = Math.floor(Number(fit) || 0);

  if (wanted <= capped) return cap;

  return fitRange(count, wanted, tail) || cap;
}

// The next number of hidden crumbs to try when the trail does not fit, or
// null when nothing more can go.
export function nextFit(count, { maxItems = 0, fit = 0, tail = 2 } = {}) {
  const range = collapseRange(count, { maxItems, fit, tail });
  const hidden = range ? range.end - range.start : 0;
  const next = Math.max(hidden + 1, MIN_FOLD);

  return next <= maxFitHidden(count, tail) ? next : null;
}

// Whether a crumb's words are cut for want of room. An ancestor is cut at
// its own cap by design (--sf-breadcrumbs--label-max, C93 item 6), whatever
// the room; cut narrower than that cap, or a crumb with no cap cut at all
// (the page on the phone), means the row ran out of room.
export function cutByRoom(crumb, view = globalThis) {
  const container = crumb?.querySelector?.(':scope > .sf-breadcrumbs-item-container');
  if (!container) return false;
  const label = container.querySelector(':scope > span') || container;
  if (!(label.scrollWidth > label.clientWidth + 1)) return false;

  const cap = Number.parseFloat(view.getComputedStyle?.(container)?.maxInlineSize);
  if (!(cap > 0)) return true;
  return container.getBoundingClientRect().width < cap - 1;
}

// A cut name must still read: a crumb shown narrower than LABEL_MIN_EM of its
// own text size (three letters or so with the ellipsis, the least of a name
// one can tell apart) is no crumb at all (N1 of the nav-4b acceptance, after
// C93 item 6). Folded as far as room goes, such a crumb goes behind «…» too
// (starvedFit).
export const LABEL_MIN_EM = 3;

// Whether a crumb's words are cut to less than LABEL_MIN_EM for want of room.
export function cutBelowMin(crumb, view = globalThis) {
  const container = crumb?.querySelector?.(':scope > .sf-breadcrumbs-item-container');
  if (!container) return false;
  const label = container.querySelector(':scope > span') || container;
  if (!(label.scrollWidth > label.clientWidth + 1)) return false;

  const size = Number.parseFloat(view.getComputedStyle?.(label)?.fontSize);
  const least = LABEL_MIN_EM * (size > 0 ? size : 16);
  return container.getBoundingClientRect().width < least - 0.5;
}

// Whether a shown crumb of the trail is cut below the least that reads
// (cutBelowMin). Separators, «…» and the siblings button have no words to cut.
export function trailStarved(entries = [], view = globalThis) {
  return entries.some((entry) => {
    if (!entry || entry.hidden) return false;
    const crumbs = entry.matches?.('.sf-breadcrumbs-item')
      ? [entry]
      : Array.from(entry.querySelectorAll?.(':scope > .sf-breadcrumbs-item') || []);
    return crumbs.some(
      (crumb) =>
        !crumb.hidden &&
        !crumb.classList?.contains('sf-breadcrumbs-item--separator') &&
        !crumb.hasAttribute?.('aria-expanded') &&
        cutBelowMin(crumb, view),
    );
  });
}

// The last fold: room has hidden all it may (nextFit gave null) and a crumb of
// the tail is still cut below the least that reads. Then the parent goes too
// and the page stands alone after «…»: «… › current». Only a tail of two (the
// parent and the page) gives one up; a trail of parents keeps its parent.
// Returns the options to fold with ({tail, fit}), or null.
export function starvedFit(count, { tail = 2 } = {}) {
  const kept = Math.max(1, Math.floor(Number(tail) || 0));
  if (kept < 2) return null;

  const hidden = maxFitHidden(count, 1);
  return hidden > 0 ? { tail: 1, fit: hidden } : null;
}

// Whether the trail has no room for its crumbs (BC-06, C93 item 1). The row
// never wraps (L2: a line never starts with «›»), so room runs out in one of
// three ways: the row is wider than its box, a crumb is cut for want of room
// (cutByRoom), or a page that wraps the row anyway (its own CSS) put an
// entry below the first. A page name that wraps by words in the rest of the
// row is not a want of room (C93 item 6). Hidden entries take no part.
export function trailOverflows(row, entries = [], view = globalThis) {
  if (row && row.scrollWidth > row.clientWidth + 1) return true;

  const shown = entries.filter((entry) => {
    if (!entry || entry.hidden) return false;
    const box = entry.getBoundingClientRect?.();
    return Boolean(box) && !(box.width === 0 && box.height === 0);
  });
  if (shown.length === 0) return false;

  const boxes = shown.map((entry) => entry.getBoundingClientRect());
  const lowest = Math.min(...boxes.map((box) => box.height));
  if (boxes.some((box) => box.top - boxes[0].top >= lowest / 2)) return true;

  return shown.some((entry) => {
    const crumbs = entry.matches?.('.sf-breadcrumbs-item')
      ? [entry]
      : Array.from(entry.querySelectorAll?.(':scope > .sf-breadcrumbs-item') || []);
    return crumbs.some(
      (crumb) => !crumb.classList?.contains('sf-breadcrumbs-item--separator') && cutByRoom(crumb, view),
    );
  });
}

// The menu entries of crumbs (sf-menu-context entries): hidden crumbs behind
// «…» (C93 item 1) or a crumb's siblings (item 3). The id is the crumb's place
// in the list given, so a choice finds its crumb again.
export function menuEntries(crumbs = []) {
  return crumbs.map((crumb, index) => {
    const entry = { id: String(index), text: String(crumb?.label ?? '') };
    if (crumb?.href) entry.href = crumb.href;
    if (crumb?.icon) entry.icon = crumb.icon;
    if (crumb?.value) entry.value = String(crumb.value);
    if (crumb?.disabled) entry.disabled = true;
    if (crumb?.current) {
      entry.current = true;
      entry.checked = true;
    }
    return entry;
  });
}
