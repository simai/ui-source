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

import {followDensity} from './density.js';

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

// ─── Rows of actions and tools (owner decision C155, 2026-11-14) ─────────────
// The one row engine of the Framework: the navigation rows above (sf-tabs,
// sf-contents, sf-menu) and the action and tool rows below (sf-header-page's
// actions, sf-input-rich's toolbar, .sf-button-group) share the measuring and
// the rule. What does not fit leaves for «Ещё»: from the end by default, by
// an author's priority where one is given (priority="1" is the most important,
// a bigger number leaves sooner, an item without one before every numbered
// item); the main action, a pressed or current item and priority="pin" never
// leave (C155 (3)). A toolbar's units are its groups: a group leaves whole and
// takes its separator with it (C155 (4)).

// An author's priority as the engine reads it: a whole number from 1, pin, or
// nothing (leaves first, the last first).
export function readPriority(value) {
  if (value === null || value === undefined) return {rank: Infinity, pin: false};
  const text = String(value).trim().toLowerCase();
  if (text === 'pin') return {rank: 0, pin: true};
  const number = Number(text);
  return Number.isFinite(number) && text !== '' ? {rank: number, pin: false} : {rank: Infinity, pin: false};
}

// The span of some units laid side by side: their widths, the row's gap
// between neighbours and, where two neighbours belong to different groups, a
// separator with the gap on each of its sides.
export function spanOfUnits(units, gap, separator, indices) {
  let span = 0;
  indices.forEach((at, n) => {
    if (n) {
      span += gap;
      if (separator && units[indices[n - 1]].group !== units[at].group) span += separator + gap;
    }
    span += units[at].width;
  });
  return span;
}

// Which units stay in a row that is room wide. units: [{width, rank, pin,
// group}] in the row's order; more: the width «Ещё» adds when it shows (its
// own width, the gap before it and, in a toolbar, its separator). Answers the
// indices that stay, in order, and the ones that left; every unit stays when
// all fit. The units that leave go by rank, the biggest first, and among equal
// ranks the last first; a pinned unit never leaves, even when the pinned ones
// alone do not fit (the row then clips, as a current tab is squeezed).
export function fitByPriority({units, gap = 0, separator = 0, room, more = 0}) {
  const all = units.map((_, at) => at);
  const whole = spanOfUnits(units, gap, separator, all);
  if (whole <= room + TOLERANCE) return {kept: all, out: [], span: whole, fits: true};
  const order = all.filter((at) => !units[at].pin)
    .sort((a, b) => (units[b].rank - units[a].rank) || (b - a));
  const kept = all.slice();
  const out = [];
  const used = () => spanOfUnits(units, gap, separator, kept) + (kept.length ? more : more - gap);
  while (order.length && used() > room + TOLERANCE) {
    const at = order.shift();
    kept.splice(kept.indexOf(at), 1);
    out.push(at);
  }
  const span = used();
  return {kept, out: out.sort((a, b) => a - b), span, fits: span <= room + TOLERANCE};
}

// The box an element draws: a Framework host with display: contents (sf-button,
// sf-button-icon) has none of its own, so its first drawn child's.
export function drawnBox(element) {
  let box = element;
  while (box && getComputedStyle(box).display === 'contents') box = box.firstElementChild;
  return box ? box.getBoundingClientRect() : {width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0};
}

// Every element's drawn width with all of them shown, in one task: the class
// that takes an element out of the row is lifted for the measure and put back
// before anything is painted (the row never draws all its items at once).
export function measureShown(elements, outClass) {
  const was = elements.map((element) => element.classList.contains(outClass));
  for (const element of elements) element.classList.remove(outClass);
  const widths = elements.map((element) => drawnBox(element).width);
  elements.forEach((element, at) => element.classList.toggle(outClass, was[at]));
  return widths;
}

// A row of actions or tools laid out by the rule above, in one task.
// row: the flex row; units: [{element, rank, pin, group}]; more: the «Ещё»
// element (inside the row, last); moreSeparator: a separator before it (a
// toolbar's), separators: [{element, after: group}] -- a separator standing
// after a group, shown only between two groups that keep something; outClass:
// the row's own class that takes an element out (display: none); room: the
// room the row has, when it is not the row's own content box (a row sized by
// its content). Answers {out: the indices that left, fits: whether what
// stays fits the room}.
export function layoutActionRow({row, units, more, moreSeparator = null, separators = [], outClass, room = null}) {
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap) || 0;
  const elements = units.map((unit) => unit.element);
  const extra = [more, moreSeparator, ...separators.map((one) => one.element)].filter(Boolean);
  const widths = measureShown([...elements, ...extra], outClass);
  const moreWidth = widths[elements.length];
  const separatorWidth = separators.length || moreSeparator ? Math.max(0, ...widths.slice(elements.length + 1)) : 0;
  const measured = units.map((unit, at) => ({...unit, width: widths[at]}));
  const {out, fits} = fitByPriority({
    units: measured,
    gap,
    separator: separatorWidth,
    room: room ?? rowRoom(row),
    more: moreWidth + gap + (moreSeparator ? separatorWidth + gap : 0),
  });
  const gone = new Set(out);
  elements.forEach((element, at) => element.classList.toggle(outClass, gone.has(at)));
  // A separator stands after its group only while that group and a group
  // after it both keep something: an emptied group leaves with its separator,
  // and none stands first or last.
  const keeps = (group) => units.some((unit, at) => unit.group === group && !gone.has(at));
  const groups = [...new Set(units.map((unit) => unit.group))];
  for (const {element, after} of separators) {
    const later = groups.slice(groups.indexOf(after) + 1);
    element.classList.toggle(outClass, !(keeps(after) && later.some(keeps)));
  }
  more?.classList.toggle(outClass, !out.length);
  moreSeparator?.classList.toggle(outClass, !out.length || gone.size === units.length);
  return {out, fits};
}

// ─── «Ещё» of an action or tool row ──────────────────────────────────────────

// Whether an action is the row's main one: a filled sf-button (no appearance,
// or default) -- one per row (C116, C161 (3)).
export function isMainAction(element) {
  if (!element?.matches?.('sf-button, .sf-button')) return false;
  const look = element.getAttribute('appearance') ?? element.getAttribute('variant');
  return look === null || look === '' || look === 'default' || look === 'filled';
}

// Whether a toggle in a row is on: a pressed sf-button or icon button, or a
// button saying aria-pressed="true".
export function isPressed(element) {
  if (!element) return false;
  const value = element.getAttribute('pressed');
  if (value !== null && value !== 'false') return true;
  return element.getAttribute('aria-pressed') === 'true' || element.querySelector?.(':scope > button[aria-pressed="true"]') != null;
}

// The control a row item is pressed through: its own button or link.
export function controlOf(element) {
  if (!element) return null;
  if (element.matches('button, a[href]')) return element;
  return element.querySelector(':scope > button, :scope > a[href], button, a[href]') || element;
}

// The menu row an action of a row becomes in «Ещё»: its words, its icon, and
// a check when it is a pressed toggle (C155 (6), (7)).
export function actionEntry(element, id) {
  const control = controlOf(element);
  const text = (element.getAttribute('text') || element.getAttribute('aria-label') || element.getAttribute('title')
    || control?.getAttribute('aria-label') || element.textContent || '').trim();
  const icon = element.getAttribute('icon-start') || element.getAttribute('icon') || element.getAttribute('icon-end')
    || control?.querySelector?.('.sf-icon')?.textContent.trim() || undefined;
  const entry = {id: String(id), text, icon: icon || undefined};
  const toggle = element.hasAttribute('pressed') || control?.hasAttribute?.('aria-pressed');
  if (toggle) {
    entry.kind = 'check';
    entry.checked = isPressed(element);
  }
  if (element.hasAttribute('disabled') || control?.disabled || control?.getAttribute?.('aria-disabled') === 'true') entry.disabled = true;
  return entry;
}

// The «Ещё» menu of a row: the standard sf-menu-context (standardMenu), named
// «Ещё», on the row's size and density, listing entries; toggled from anchor.
export async function openRowMenu(owner, {anchor, entries, select, label, size = '1'}) {
  if (!entries.length) return null;
  const menu = await standardMenu(owner, '_sfRowMoreMenu', (id, event) => owner._sfRowMoreSelect?.(id, event));
  owner._sfRowMoreSelect = select;
  if (label) menu.setAttribute('aria-label', label);
  menu.setAttribute('size', size);
  followDensity(menu, owner);
  menu.entries = entries;
  menu.toggleFor(anchor);
  return menu;
}
