import { breakpointMedia } from '../../../core/js/breakpoints.js';

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
//   - room (owner decision C93 item 1): while the trail does not fit on one
//     line, one more crumb goes behind «…». The first crumb goes last of the
//     ancestors, and the tail is never hidden: the parent and the current page
//     (or, in a trail of parents only, the parent). At its narrowest a trail
//     reads «… › parent › current» (C93 item 2).
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

// How many crumbs room can hide at most: everything but the tail.
export function maxFitHidden(count, tail = 2) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const kept = Math.max(1, Math.floor(Number(tail) || 0));

  return Math.max(0, total - kept);
}

// The crumbs hidden when room hides `hidden` of them.
export function fitRange(count, hidden, tail = 2) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const kept = Math.max(1, Math.floor(Number(tail) || 0));
  const max = maxFitHidden(total, kept);
  const wanted = Math.min(Math.floor(Number(hidden) || 0), max);

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
  const next = hidden + 1;

  return next <= maxFitHidden(count, tail) ? next : null;
}

// Whether the shown crumbs take more than one line: two crumbs on different
// rows, or one crumb whose words wrapped (it is taller than the row). Hidden
// entries (display: none) take no part.
export function trailWraps(entries = []) {
  const boxes = [];

  for (const entry of entries) {
    if (!entry || entry.hidden) continue;
    const box = entry.getBoundingClientRect?.();
    if (!box || (box.width === 0 && box.height === 0)) continue;
    boxes.push(box);
  }

  if (boxes.length === 0) return false;

  const lowest = Math.min(...boxes.map((box) => box.height));
  const firstTop = boxes[0].top;

  return boxes.some(
    (box) => box.top - firstTop >= lowest / 2 || box.height - lowest > lowest / 2,
  );
}

// Where a measure starts. On the phone ladder (below 60rem) the trail is one
// line «… › parent › page» from the start (owner decision C93 item 2); on a
// wider screen it starts whole and folds only when it has no room.
export function startFit(count, { tail = 2, phone = false } = {}) {
  return phone ? maxFitHidden(count, tail) : 0;
}

// Whether the page is on the phone ladder (the ladders switch at lg).
export function onPhoneLadder(view = globalThis) {
  const query = breakpointMedia('lg', { view });
  return query ? !query.matches : false;
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
