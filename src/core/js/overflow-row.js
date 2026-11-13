// One row of items that do not all fit, and a trailing «Ещё (n)» that holds
// the rest (owner decision C54): the items in their order up to the first
// that does not fit, each whole in the row or in «Ещё»; the items that must
// stay (the current one, the pinned ones) stay, the last kept others giving
// way to them; the room is taken with the width «Ещё (n)» will have with its
// own count. Only the arithmetic and the measuring are here -- the element
// keeps its markup, its classes and its menu entries.
//
// Taken out of sf-tabs (fix/tabs-overflow-more, C54 and its returns D1, D2)
// so a second row (sf-contents layout="bar", CT-05) lays out by the same
// rules instead of a copy of them. Every number is a width in CSS pixels,
// fractional; half a pixel is the tolerance, as the tabs measured it.

const TOLERANCE = 0.5;

// The items in their order up to the first that does not fit in available:
// their indices, or null when every item fits.
export function fitInOrder(widths, gap, available) {
  const kept = [];
  let used = 0;
  for (let at = 0; at < widths.length; at += 1) {
    const next = used + (kept.length ? gap : 0) + widths[at];
    if (next > available + TOLERANCE) break;
    kept.push(at);
    used = next;
  }
  return kept.length === widths.length ? null : kept;
}

// The width of some items laid side by side.
export function spanOf(widths, gap, indices) {
  return indices.reduce((sum, at, n) => sum + widths[at] + (n ? gap : 0), 0);
}

// The row beside «Ещё», in available: the items in order, then the items that
// must stay put back in -- the last kept items that need not stay give way to
// them, and when the must-stay items alone do not fit, they give way too, the
// last first, but never the current one.
export function chooseBeside({widths, gap = 0, available, must = [], current = -1}) {
  let chosen = fitInOrder(widths, gap, available) ?? widths.map((_, at) => at);
  const missing = must.filter((at) => !chosen.includes(at));
  if (!missing.length) return chosen;
  const next = [...chosen, ...missing];
  while (spanOf(widths, gap, next) > available + TOLERANCE) {
    const dropAt = next.slice().reverse().find((at) => !must.includes(at))
      ?? next.slice().reverse().find((at) => at !== current);
    if (dropAt === undefined) break;
    next.splice(next.indexOf(dropAt), 1);
  }
  chosen = next.sort((a, b) => a - b);
  return chosen;
}

// The row beside «Ещё (n)»: room is the row's room with the trigger standing
// as it is drawn now; extra(count) is how much wider (or narrower) the
// trigger will be with count in it. Of the rows that fit beside their own
// count, the one with the most items; when no count agrees with its row, the
// row that fits beside the widest. squeezed is the current item when it alone
// is left and still wider than the room (it alone may be shortened), else -1.
export function fitBesideMore({widths, gap = 0, room, must = [], current = -1, extra = null}) {
  let kept = null;
  if (typeof extra === 'function') {
    const besides = [];
    for (let count = 1; count < widths.length && !kept; count += 1) {
      const more = extra(count);
      besides.push(more);
      const chosen = chooseBeside({widths, gap, available: room - more, must, current});
      if (widths.length - chosen.length === count) kept = chosen;
    }
    if (!kept && besides.length) kept = chooseBeside({widths, gap, available: room - Math.max(...besides), must, current});
  }
  kept ??= chooseBeside({widths, gap, available: room, must, current});
  const squeezed = kept.length === 1 && kept[0] === current && spanOf(widths, gap, kept) > room + TOLERANCE ? current : -1;
  return {kept, squeezed};
}

// The content box of a row that clips and has no scrollbar, in fractional
// pixels: clientWidth is a whole pixel, and a row 383.6 px wide read as 383 or
// 384 laid out differently (C54 return).
export function rowRoom(list) {
  const style = getComputedStyle(list);
  const edges = ['borderInlineStartWidth', 'borderInlineEndWidth', 'paddingInlineStart', 'paddingInlineEnd'];
  return list.getBoundingClientRect().width - edges.reduce((sum, edge) => sum + (parseFloat(style[edge]) || 0), 0);
}

// A text measurer in an element's own face, or null without a canvas: the
// width «Ещё (7)» will have before its button draws it.
let measureCanvas = null;
export function textWidth(element) {
  const style = getComputedStyle(element);
  measureCanvas ??= globalThis.document?.createElement('canvas') ?? null;
  const context = measureCanvas?.getContext?.('2d');
  if (!context) return null;
  context.font = style.font;
  if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  return (text) => context.measureText(text).width;
}

// extra(count) for a trigger whose text box shows label(count) now.
export function triggerExtra(textBox, label) {
  const measure = textBox ? textWidth(textBox) : null;
  if (!measure) return null;
  const drawn = measure(textBox.textContent.trim());
  return (count) => measure(label(count)) - drawn;
}

// The standard menu «Ещё» opens: sf-menu-context, a relation fetched when
// first used (SF.Loader.ensure: asked for, waited for up to 3 s, never
// thrown), one per owner and field, on the body or in the open dialog.
export async function standardMenu(owner, field, select) {
  await globalThis.SF?.Loader?.ensure?.(['sf-menu-context']);
  if (owner[field]?.isConnected) return owner[field];
  const menu = document.createElement('sf-menu-context');
  menu.setAttribute('popup', '');
  menu.addEventListener('sf-menu-context-select', (event) => select?.(event.detail?.id, event));
  (owner.closest('dialog[open]') || document.body).append(menu);
  owner[field] = menu;
  return menu;
}
