// Sortable drag-and-drop primitive. <sf-sortable> lists and registered
// external drop targets share one drag session. Pointer (mouse, pen, touch via
// handles), keyboard and screen-reader paths all end in the same intent event;
// the component never moves host DOM or data. The host applies the change.
import { followLanguage, language, pageText } from '../page-language.js';

// The request to move an item (simai.smart-vocabulary 1.1.5 §5 move): the
// name sf-sortable's component.json declares. The former sf-sortable-intent
// follows it with the same detail until 2026-12-01.
export const SORTABLE_MOVE_EVENT = 'sf-sortable-move';
export const SORTABLE_INTENT_EVENT = 'sf-sortable-intent';
export const SORTABLE_STATE_EVENT = 'sf-sortable-state';
// The host's word on a target list before an item goes there by the handle's
// menu, a drag or the keys (BV-7): cancelable; a host that refuses calls
// preventDefault() and may say why in detail.reason, which the menu shows on
// the disabled row.
export const SORTABLE_CHECK_EVENT = 'sf-sortable-check';

const ITEM = '[data-sf-sortable-item]';
const HANDLE = '[data-sf-sortable-handle]';
const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[contenteditable]:not([contenteditable="false"])';
const NAME = /^[a-z][a-z0-9-]{0,31}$/u;
// The controls inside an item, which leave the Tab order (BV-6), and the ones
// that keep their own arrows (a text field, a radio group, a list box).
const CONTROL = `${INTERACTIVE},[tabindex]`;
const OWN_ARROWS = 'input:not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]),select,textarea,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="spinbutton"],[role="listbox"],[role="radiogroup"]';
// An sf-list-item row keeps its list's one Tab stop and its arrows itself.
const OWN_ROVING = '[data-sf-list-roving]';
// What makes an item selectable (C146 (8)): a selection mark inside it, or a
// host-kept aria-selected. On such an item Space selects and Enter picks up (BV-8).
const SELECT_MARK = 'input[type="checkbox"],[role="checkbox"]';
const TAMED = 'data-sf-sortable-tabindex';
// The id of a list's instructions, which its items name in aria-describedby:
// a page-wide count, kept on a shared global because every bundle that
// carries this module has its own module scope. It used to be random base 36,
// and one id in about twenty-five held "h1".."h6", which the headers utility's
// rule (/(h1|h2|h3|h4|h5|h6)/, tested on every element's attributes) reads as a
// heading: the Loader asked for utility/headers on some loads and not on
// others, and the first-paint sheet lists moved from run to run.
const HELP_IDS = Symbol.for('simai.sf.sortable.help-ids');
function nextHelpId() {
  globalThis[HELP_IDS] = (globalThis[HELP_IDS] ?? 0) + 1;
  return `sf-sortable-help-${globalThis[HELP_IDS]}`;
}
const DRAG_THRESHOLD = 4;
const EDGE = 32;
// A row without a handle is taken by a finger only after a long press (owner
// C171 (2), 2026-11-14): a plain swipe over the list scrolls the page, as any
// list does. Moving further than the slop before the time is a scroll.
const LONG_PRESS = 500;
const LONG_PRESS_SLOP = 8;
/**
 * The drop line: one line two pixels thick for every place something lands --
 * a list's gap, a grid cell's side, a canvas seam of the editor overlay (owner
 * C171 (4), 2026-11-14: the overlay drew three). Its look is one rule,
 * .sf-sortable-indicator, in sf-sortable's sheet, which the overlay's rule
 * loads with it.
 */
export const SORTABLE_DROP_LINE = 2;
const LINE = SORTABLE_DROP_LINE;
const HALF = SORTABLE_DROP_LINE / 2;

const MESSAGES = {
  en: {
    instructions: 'Enter or Space to pick up, arrows to move, Enter or Space to drop, Escape to cancel.',
    'instructions-select': 'Space to select, Enter to pick up, arrows to move, Enter to drop, Escape to cancel.',
    refused: 'Not here',
    picked: 'Picked up {item}. Position {index} of {total} in “{list}”.',
    moved: 'Position {index} of {total} in “{list}”.',
    dropped: 'Dropped {item} at position {index} in “{list}”.',
    cancelled: 'Move cancelled.',
    target: 'Target: {target}.',
    roledescription: 'draggable',
  },
};

const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
// In the page's language through pageText, as every component's words are;
// <html lang> alone left SF.language.use() unheard (documentation trial).
const messages = () => Object.fromEntries(Object.keys(MESSAGES.en).map((key) => [key, pageText(MESSAGES, key, undefined, 'sf-sortable')]));
// Separate Smart bundles (sf-sortable, sf-composition-overlay) each carry a copy
// of this module; the drag session and external targets live on one global
// record so a library drag can land on the overlay. The key carries the record
// version, so bundles with another record shape never share it.
const shared = globalThis.__sfSortableSharedV1 || (globalThis.__sfSortableSharedV1 = { targets: new Set(), session: null });
const externalTargets = shared.targets;

/** The active drag session (read-only view), or null. */
export function activeSortableSession() {
  return shared.session ? Object.freeze({ item: shared.session.item, from: shared.session.from, group: shared.session.group, mode: shared.session.mode, input: shared.session.input }) : null;
}

/**
 * Registers a non-list drop target such as the editor overlay.
 * resolve(x, y, session) returns {descriptor, rect, label} or null;
 * drop(session, descriptor) performs the intent emission.
 */
export function registerSortableDropTarget(target) {
  if (!target || typeof target.resolve !== 'function' || typeof target.drop !== 'function') throw new TypeError('Drop target needs resolve and drop');
  externalTargets.add(target);
  return () => externalTargets.delete(target);
}

// What an item is called in the move menu and the live announcements.
//
// An item's text read as one run glued its parts: a board card said «Заказ
// № 1002 Кафе «Лето»5 070,00 ₽» (board study, 2026-11-17), the client and the
// amount being two blocks with nothing between them. Now, in order: the
// item's aria-label; the text of what aria-labelledby names; the part marked
// data-sf-sortable-label or slot="title" (the card's title); else its visible
// text with a comma between its blocks («Заказ № 1002, Кафе «Лето», 5 070,00
// ₽»). Text inside one line (a <b> in a word) stays together. Decorative
// parts (aria-hidden, hidden, tooltips, the list's live region, `skip`) are
// not read.
const LABEL_SKIP = '[aria-hidden="true"], [hidden], [role="tooltip"], .sf-sortable-live, template, script, style';
const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);
const FLOW_PARENTS = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);

function displayOf(element) {
  const view = element.ownerDocument?.defaultView;
  if (typeof view?.getComputedStyle === 'function') {
    try {
      return view.getComputedStyle(element).display || 'inline';
    } catch {
      // A node outside a document: by its tag below.
    }
  }
  return INLINE_TAGS.has(String(element.localName ?? '').toLowerCase()) ? 'inline' : 'block';
}

const tidy = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();

/** The text of `node` read as a person sees it: its blocks, joined by commas. */
export function sortableReadableText(node, { skip = '' } = {}) {
  const skipping = skip ? `${LABEL_SKIP}, ${skip}` : LABEL_SKIP;
  const runs = [''];
  const walk = (current, parentDisplay) => {
    for (const child of current.childNodes ?? []) {
      if (child.nodeType === 3) {
        runs[runs.length - 1] += child.nodeValue ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (typeof child.matches === 'function' && child.matches(skipping)) continue;
      const display = displayOf(child);
      if (display === 'none') continue;
      // A flex or grid item is a block of its own whatever its tag.
      // A box of its own (a block, an inline-block chip, a flex or grid
      // item whatever its tag) is a part; an inline element is in the line;
      // display: contents passes its parent's layout on to its children.
      const contents = display === 'contents';
      const apart = !contents && (display !== 'inline' || FLOW_PARENTS.has(parentDisplay));
      if (apart) runs.push('');
      walk(child, contents ? parentDisplay : display);
      if (apart) runs.push('');
    }
  };
  walk(node, node.nodeType === 1 ? displayOf(node) : 'block');
  return runs.map(tidy).filter(Boolean).join(', ');
}

/** What an item is called (see above); `skip` names more parts not to read. */
export function sortableItemLabel(item, { skip = '' } = {}) {
  const own = tidy(item.getAttribute?.('aria-label'));
  if (own) return own;
  const ids = tidy(item.getAttribute?.('aria-labelledby')).split(' ').filter(Boolean);
  const root = item.getRootNode?.();
  const named = ids.map((id) => root?.getElementById?.(id) ?? item.ownerDocument?.getElementById?.(id)).filter(Boolean);
  if (named.length) {
    const text = named.map((node) => tidy(node.getAttribute?.('aria-label')) || sortableReadableText(node, { skip })).filter(Boolean).join(', ');
    if (text) return text;
  }
  const title = item.querySelector?.('[data-sf-sortable-label], [slot="title"]');
  if (title) {
    const text = tidy(title.getAttribute?.('aria-label')) || sortableReadableText(title, { skip });
    if (text) return text;
  }
  return sortableReadableText(item, { skip });
}

const itemLabel = (item) => sortableItemLabel(item);

function listName(list) {
  return list.getAttribute('label') || list.getAttribute('aria-label') || list.getAttribute('group') || '';
}

function items(list) {
  return [...list.querySelectorAll(ITEM)].filter((item) => item.closest('sf-sortable') === list);
}

function accepts(list, group) {
  if (!list || list.getAttribute('mode') === 'copy') return false;
  const own = list.getAttribute('group');
  const extra = (list.getAttribute('accepts') || '').split(/\s+/u).filter(Boolean);
  return group === own || extra.includes(group);
}

/** The target list's name in a move request: its id, else its group. */
function nameOf(list) {
  return list.getAttribute('id') || list.group || list.getAttribute('group') || '';
}

/**
 * Asks the host whether `item` may go from `from` to `target` (BV-7): ''
 * when it may, else the reason (the host's detail.reason, or a plain «not
 * here»). A list never asks about itself.
 */
export function sortableRefusal(target, from, item) {
  if (!target || target === from) return '';
  const detail = { item: item?.getAttribute?.('data-sf-sortable-item') || '', from: from ? nameOf(from) : '', to: nameOf(target), reason: '' };
  const event = new globalThis.CustomEvent(SORTABLE_CHECK_EVENT, { bubbles: true, composed: true, cancelable: true, detail });
  if (target.dispatchEvent(event)) return '';
  return String(detail.reason || '').trim() || messages().refused;
}

/**
 * The lists an item of `list` can be sent to by the handle's menu (BV-7):
 * every list of the page that takes the list's group, the list itself among
 * them (current), in the page's order, each with the host's refusal if any.
 * A copy list or a list without a group sends nowhere.
 */
export function sortableMoveTargets(list, item) {
  const group = list?.group;
  if (!group || list.mode === 'copy') return [];
  return [...globalThis.document.querySelectorAll('sf-sortable')]
    .filter((other) => other === list || accepts(other, group))
    .map((other) => ({ list: other, label: listName(other) || nameOf(other), current: other === list, reason: other === list ? '' : sortableRefusal(other, list, item) }));
}

/**
 * A move to another list asked without dragging (the handle's «Move to»): the
 * request a drag between lists ends with -- to the end of the target -- and
 * its «dropped» words. False when the host refuses the target.
 */
export function requestSortableTransfer(list, item, target) {
  const id = item?.getAttribute?.('data-sf-sortable-item');
  if (!id || !target || target === list || !accepts(target, list.group) || sortableRefusal(target, list, item)) return false;
  const index = items(target).length;
  emitIntent(target, { item: id, from: nameOf(list), to: nameOf(target), index, mode: 'move' });
  list.announce?.(format(messages().dropped, { item: itemLabel(item), index: index + 1, list: listName(target) || nameOf(target) }));
  return true;
}

/** Whether an item is selectable: Space selects it rather than picking it up (BV-8). */
export function sortableSelectable(item) {
  return Boolean(item?.hasAttribute?.('aria-selected') || selectMarkOf(item));
}

function selectMarkOf(item) {
  if (!item?.querySelectorAll) return null;
  return [...item.querySelectorAll(SELECT_MARK)].find((mark) => mark.closest(ITEM) === item
    && !mark.disabled && mark.getAttribute('aria-disabled') !== 'true') || null;
}

/**
 * What a key does on a list's item outside a move (BV-6, the APG layout grid,
 * as a table's rows, C146 (8)): 'prev', 'next', 'first', 'last' go to another
 * item; 'in' to the item's next control, 'out' back towards the item. The
 * list's axis moves between items; the other axis, toward its end, goes into
 * the item. Logical: in a right-to-left page the arrows of the inline axis swap.
 */
export function sortableRovingStep(key, { orientation = 'vertical', rtl = false } = {}) {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  if (orientation === 'horizontal') {
    return { [back]: 'prev', [forward]: 'next', ArrowDown: 'in', ArrowUp: 'out' }[key] || null;
  }
  return { ArrowUp: 'prev', ArrowDown: 'next', [forward]: 'in', [back]: 'out' }[key] || null;
}

/**
 * What Space and Enter do on an item outside a move (BV-8, dispatcher's
 * decision 2026-11-17): Enter picks it up; Space selects a selectable item
 * (C146 (8): Space marks a record in every layout) and picks up only an item
 * that is not selectable. Anything else: null.
 */
export function sortableKeyAction(key, selectable) {
  if (key === 'Enter') return 'pick';
  if (key === ' ') return selectable ? 'select' : 'pick';
  return null;
}

// The controls of an item: every one leaves the Tab order (BV-6) -- its own
// tabindex kept in data-sf-sortable-tabindex, given back when the list goes --
// and the ones a person can reach are the arrows' stops, inner ones only (an
// sf-button-icon host around its own button is the button).
function controlsOf(item) {
  return [...item.querySelectorAll(CONTROL)].filter((control) => control.closest(ITEM) === item && !control.closest('.sf-sortable-live'));
}

function tame(control) {
  if (!control.hasAttribute(TAMED)) control.setAttribute(TAMED, control.getAttribute('tabindex') ?? '');
  if (control.getAttribute('tabindex') !== '-1') control.setAttribute('tabindex', '-1');
}

function untame(control) {
  const own = control.getAttribute(TAMED);
  control.removeAttribute(TAMED);
  if (own === null) return;
  if (own === '') control.removeAttribute('tabindex');
  else control.setAttribute('tabindex', own);
}

function reachable(control) {
  if (control.disabled || control.getAttribute('aria-disabled') === 'true' || control.closest('[hidden], [inert]')) return false;
  const own = control.getAttribute(TAMED);
  const natively = control.matches(INTERACTIVE);
  if (!natively && !(own !== null && own !== '' && Number(own) >= 0)) return false;
  return control.getClientRects().length > 0;
}

function stopsOf(item) {
  const all = controlsOf(item).filter(reachable);
  return all.filter((control) => !all.some((other) => other !== control && control.contains(other)));
}

function scrollContainer(element) {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const style = globalThis.getComputedStyle(node);
    if (/(auto|scroll)/u.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return globalThis.document.scrollingElement;
}

function indicator() {
  let line = globalThis.document.querySelector('.sf-sortable-indicator:not([data-sf-drop-line-owner])');
  if (!line) {
    line = globalThis.document.createElement('div');
    line.className = 'sf-sortable-indicator';
    line.setAttribute('aria-hidden', 'true');
    globalThis.document.body.append(line);
  }
  return line;
}

function showIndicator(rect) {
  const line = indicator();
  if (!rect) {
    line.hidden = true;
    return;
  }
  line.hidden = false;
  Object.assign(line.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
}

// The silhouette: while a pointer drags, the place the item would take opens in
// the list as an empty outline of its size, and the list moves to make room --
// a line two pixels thick said where, but not how the list would look, and the
// owner could not tell where a row would land before letting go (2026-10-13).
// The item itself leaves the flow while it is dragged; its copy follows the
// pointer. A list that wraps into a grid opens the place among its cells, in
// reading order (owner, 2026-10-14: the fields of a record view arranged in two
// columns moved with a line nobody could follow). Keyboard moves, external
// targets and a list written preview="line" keep the line.
function silhouetteFor(list) {
  return list.getAttribute('preview') !== 'line';
}

function placeholder(session) {
  if (session.placeholder) return session.placeholder;
  const box = session.sourceBox;
  const element = globalThis.document.createElement('div');
  element.className = 'sf-sortable-placeholder';
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, { inlineSize: `${box.width}px`, blockSize: `${box.height}px` });
  session.placeholder = element;
  return element;
}

// Where the outline goes, and the final index it stands for: counted among the
// items still in the flow -- not the dragged one -- so it is the index the item
// will have once it is moved.
function placeSilhouette(session, list, x, y) {
  const horizontal = list.getAttribute('orientation') === 'horizontal';
  const visible = items(list).filter((item) => item !== session.source);
  // A grid is read row by row; the outline is one of its cells. Whether the
  // list wraps is asked of the items left in the flow, the dragged one being
  // out of it, or remembered from when the drag began.
  const wrapped = !horizontal && (isWrapped(visible) || session.wrappedLists?.has(list));
  let index;
  if (wrapped) {
    index = wrappedIndexAt(visible, x, y);
  } else {
    const boxes = visible.map((item) => {
      const box = item.getBoundingClientRect();
      return horizontal ? { start: box.left, end: box.right } : { start: box.top, end: box.bottom };
    });
    index = sortableIndexAt(boxes, horizontal ? x : y);
  }
  const element = placeholder(session);
  const before = visible[index];
  if (before) {
    if (element.nextElementSibling !== before) before.before(element);
  } else if (visible.length) {
    const last = visible[visible.length - 1];
    if (last.nextElementSibling !== element) last.after(element);
  } else if (element.parentElement !== list) {
    list.append(element);
  }
  return index;
}

/** Index where an item would land in a list for a pointer position. */
export function sortableIndexAt(boxes, coordinate, exclude = -1) {
  let index = 0;
  for (let position = 0; position < boxes.length; position += 1) {
    if (position === exclude) continue;
    const box = boxes[position];
    if (coordinate > box.start + (box.end - box.start) / 2) index = position + 1;
  }
  return index;
}

/**
 * Whether the list flows in both axes -- two items standing side by side on one
 * row. A list like that is neither vertical nor horizontal, and asking only the
 * vertical axis cannot tell the left half of a row from the right half.
 */
function isWrapped(all) {
  for (let position = 1; position < all.length; position += 1) {
    const previous = all[position - 1].getBoundingClientRect();
    const current = all[position].getBoundingClientRect();
    if (current.top < previous.bottom - 1 && current.left >= previous.right - 1) return true;
  }
  return false;
}

/** Index where an item would land in a list that wraps, in reading order. */
function wrappedIndexAt(all, x, y) {
  let index = 0;
  for (let position = 0; position < all.length; position += 1) {
    const box = all[position].getBoundingClientRect();
    const past = y > box.bottom ? true : y < box.top ? false : x > box.left + box.width / 2;
    if (past) index = position + 1;
  }
  return index;
}

function listTarget(list, x, y) {
  const all = items(list);
  const horizontal = list.getAttribute('orientation') === 'horizontal';
  if (!horizontal && isWrapped(all)) {
    const index = wrappedIndexAt(all, x, y);
    return { list, index, rect: wrappedIndicatorRect(list, all, index) };
  }
  const boxes = all.map((item) => {
    const box = item.getBoundingClientRect();
    return horizontal ? { start: box.left, end: box.right } : { start: box.top, end: box.bottom };
  });
  const index = sortableIndexAt(boxes, horizontal ? x : y);
  return { list, index, rect: listIndicatorRect(list, all, index, horizontal) };
}

/**
 * A line down the side of the place the item would take, not across the whole
 * row: in a two-column list a full-width line cannot say which of the two halves
 * the item is about to land in.
 */
function wrappedIndicatorRect(list, all, index) {
  const box = list.getBoundingClientRect();
  const before = all[index];
  const after = all[index - 1];
  if (before) {
    const target = before.getBoundingClientRect();
    return { left: target.left - HALF, top: target.top, width: LINE, height: target.height };
  }
  if (after) {
    const target = after.getBoundingClientRect();
    return { left: target.right - HALF, top: target.top, width: LINE, height: target.height };
  }
  return { left: box.left, top: box.top, width: LINE, height: box.height };
}

function listIndicatorRect(list, all, index, horizontal) {
  const box = list.getBoundingClientRect();
  const before = all[index];
  const after = all[index - 1];
  if (horizontal) {
    const x = before ? before.getBoundingClientRect().left : after ? after.getBoundingClientRect().right : box.left;
    return { left: x - HALF, top: box.top, width: LINE, height: box.height };
  }
  const y = before ? before.getBoundingClientRect().top : after ? after.getBoundingClientRect().bottom : box.top;
  return { left: box.left, top: y - HALF, width: box.width, height: LINE };
}

/**
 * The copy that follows the pointer: whole, not see-through (owner C171 (3),
 * 2026-11-14: a 40 % copy -- the dimming of the item it was cloned from -- was
 * hard to read), standing over the page on the overlay shadow (C20). The clone
 * keeps its own look; a frame of the popup surface under it gives a row with
 * no fill of its own a body, with the item's own corners.
 */
function ghostOf(item, box) {
  const doc = globalThis.document;
  const copy = item.cloneNode(true);
  copy.removeAttribute('id');
  for (const element of copy.querySelectorAll('[id]')) element.removeAttribute('id');
  for (const name of ['data-sf-sortable-dragging', 'data-sf-sortable-lifted', 'data-sf-sortable-column-source', 'tabindex']) copy.removeAttribute(name);
  copy.classList.add('sf-sortable-ghost-item');
  Object.assign(copy.style, { margin: '0', inlineSize: '100%', boxSizing: 'border-box' });
  const ghost = doc.createElement('div');
  ghost.className = 'sf-sortable-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const style = globalThis.getComputedStyle(item);
  ghost.style.borderRadius = style.borderRadius;
  ghost.style.direction = style.direction;
  Object.assign(ghost.style, { width: `${box.width}px`, left: `${box.left}px`, top: `${box.top}px` });
  ghost.append(copy);
  doc.body.append(ghost);
  return ghost;
}

// A pointer drag ends with a click on what was under it (the handle, or a link
// in a row): that click is the drop, not a press, and the handle's menu or the
// link must not answer it. It comes in the same task as the pointerup.
function swallowNextClick() {
  const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  globalThis.addEventListener('click', swallow, { capture: true, once: true });
  globalThis.setTimeout(() => globalThis.removeEventListener('click', swallow, { capture: true }), 0);
}

// What a reader says an item is (SO-1): a row that is a plain box takes a role
// -- a button when nothing inside it is a control, a group when it holds one
// (a control inside a button is not reachable) -- and every item says it can be
// moved, in the page's language. A host's own role and description stay.
const GENERIC = new Set(['DIV', 'SPAN', 'SECTION', 'ARTICLE', 'P']);
// The description this module wrote is remembered on the item (a shared
// symbol: every bundle carries this module), so a later language -- the page's
// pack arriving after the list was drawn, SF.language.use(), a changed lang --
// replaces its own word and never a host's (VS-SITE-4: the board kept
// «draggable» on a Russian page when the pack came after the list).
const SAID_ROLE = Symbol.for('simai.sf.sortable.roledescription');
function describeItem(item) {
  if (!item.hasAttribute('role') && GENERIC.has(item.tagName)) {
    const holdsControl = item.querySelector(`${INTERACTIVE},${HANDLE},[tabindex]`);
    item.setAttribute('role', holdsControl ? 'group' : 'button');
  }
  const current = item.getAttribute('aria-roledescription');
  if (current !== null && current !== item[SAID_ROLE]) return;
  const word = messages().roledescription;
  if (current !== word) item.setAttribute('aria-roledescription', word);
  item[SAID_ROLE] = word;
}

/**
 * A move a host asks for without dragging (the handle's menu): the same request
 * and the same "dropped" words a drag ends with. index is the place the item
 * takes once moved, as a drag's is.
 */
export function requestSortableMove(list, item, index) {
  const all = items(list);
  const id = item?.getAttribute?.('data-sf-sortable-item');
  const from = all.indexOf(item);
  if (!id || from < 0 || index < 0 || index >= all.length || index === from) return false;
  const name = list.getAttribute('id') || list.group || list.getAttribute('group') || '';
  emitIntent(list, { item: id, from: name, to: name, index, mode: 'move' });
  list.announce?.(format(messages().dropped, { item: itemLabel(item), index: index + 1, list: listName(list) }));
  return true;
}

// An sf-sortable list sends the new name and its aliases.json sends the old
// one after it; a container the column mode attached to, or a list defined
// without its manifest, sends both here.
function emitIntent(target, detail) {
  const frozen = Object.freeze(detail);
  target.dispatchEvent(new globalThis.CustomEvent(SORTABLE_MOVE_EVENT, { bubbles: true, composed: true, detail: frozen }));
  if (!target.__sfAliases) target.dispatchEvent(new globalThis.CustomEvent(SORTABLE_INTENT_EVENT, { bubbles: true, composed: true, detail: frozen }));
}

// A keyboard move ends with the person's focus on the item they moved. The
// host applies the intent by redrawing its list, and a redraw that replaces
// the dragged element drops focus to the body: the keyboard user lost their
// place in the page and had to tab back from the top (consumer case
// ui-mail.sortable-editor-recipe, 2026-10-21). Two frames after the drop --
// the host has redrawn by then -- the item with the same id takes focus back,
// in whichever list it landed. A host that restores focus itself keeps it:
// focus is only moved when it fell to the body or out of the document.
function restoreFocusAfterDrop(ended) {
  const document_ = globalThis.document;
  const id = ended.item;
  if (!id || !document_) return;
  const place = () => {
    const active = document_.activeElement;
    if (active && active !== document_.body && document_.contains(active)) return;
    const scope = ended.list && document_.contains(ended.list) ? ended.list : document_;
    const item = scope.querySelector(`[data-sf-sortable-item="${globalThis.CSS?.escape ? globalThis.CSS.escape(id) : id}"]`);
    item?.focus?.({ preventScroll: false });
  };
  if (typeof globalThis.requestAnimationFrame !== 'function') { place(); return; }
  globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(place));
}

// A target list the host refused for the item being moved (BV-7), asked once
// per list in a drag or a keyboard move.
function refusedInSession(list) {
  const session = shared.session;
  if (!session || list === session.fromList) return '';
  session.refusals ??= new Map();
  if (!session.refusals.has(list)) session.refusals.set(list, sortableRefusal(list, session.fromList, session.source));
  return session.refusals.get(list);
}

function finish(list, reason) {
  if (!shared.session) return;
  const ended = shared.session;
  shared.session = null;
  ended.cleanup?.abort();
  if (ended.scrollFrame) globalThis.cancelAnimationFrame(ended.scrollFrame);
  ended.source?.removeAttribute('data-sf-sortable-dragging');
  ended.source?.removeAttribute('data-sf-sortable-lifted');
  ended.placeholder?.remove();
  ended.ghost?.remove();
  showIndicator(null);
  for (const target of externalTargets) target.leave?.();
  globalThis.document.documentElement.removeAttribute('data-sf-sortable-active');
  list.dispatchEvent(new globalThis.CustomEvent(SORTABLE_STATE_EVENT, { bubbles: true, composed: true, detail: Object.freeze({ state: reason, item: ended.item }) }));
  if (reason === 'dropped' && ended.input === 'keyboard') restoreFocusAfterDrop(ended);
}

// base: the class made from sf-sortable's component.json (manifest-host.mjs);
// without it the list is a plain element, as the overlay's bundle defines it.
export function defineSortable(registry = globalThis.customElements, { base = null } = {}) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-sortable');
  if (existing) return existing;

  class SfSortable extends (base || globalThis.HTMLElement) {
    constructor() {
      super();
      this.connection = null;
      this.live = null;
      this.instructions = null;
      this.currentItem = null;
    }

    connectedCallback() {
      super.connectedCallback?.();
      // Inside another element's printed first paint the list is a picture:
      // the element around it draws the live list (manifest-host.mjs
      // sfInPicture). It adds no live region beside the printed one and
      // takes no keys until then.
      if (this.sfInPicture?.()) return;
      if (this.connection) return;
      this.connection = new AbortController();
      const options = { signal: this.connection.signal };
      if (!this.live) {
        this.live = globalThis.document.createElement('div');
        this.live.className = 'sf-sortable-live';
        // Pick-up, move and drop are routine steps the person caused; polite
        // waits for the reader instead of cutting across what it was saying.
        this.live.setAttribute('aria-live', 'polite');
        this.instructions = globalThis.document.createElement('div');
        this.instructions.className = 'sf-sortable-live';
        this.instructions.id = nextHelpId();
      }
      this.append(this.live, this.instructions);
      this.writeInstructions();
      // The words are the page's language when they are read, not when the
      // list was drawn: the language file may arrive later (a Smart bundle
      // before core.js, a slow network), the page may choose another language
      // or change a lang. The instructions and the items' description follow.
      const offLanguage = language.onChange(() => this.refreshWords());
      // Followed through the instructions node: followLanguage keeps one
      // redraw per element, and the list itself may be a Smart element with
      // its own.
      const unwatch = followLanguage(this.instructions, () => this.refreshWords());
      this.connection.signal.addEventListener('abort', () => { offLanguage(); unwatch(); }, { once: true });
      this.addEventListener('pointerdown', (event) => this.onPointerDown(event), options);
      this.addEventListener('keydown', (event) => this.onKeyDown(event), options);
      this.addEventListener('focusin', (event) => {
        const item = event.target.closest?.(ITEM);
        this.prepareItem(item);
        // The item a person was on is the list's Tab stop (BV-6).
        if (item && item.closest('sf-sortable') === this && !item.matches(OWN_ROVING) && this.currentItem !== item) {
          this.currentItem = item;
          this.syncRoving();
        }
      }, options);
      for (const item of items(this)) this.prepareItem(item);
      this.syncRoving();
      // Items the host adds later become focusable and draggable as well.
      this.observer = new globalThis.MutationObserver(() => { this.ensureAccessibilityNodes(); for (const item of items(this)) this.prepareItem(item); this.syncRoving(); });
      this.observer.observe(this, { childList: true, subtree: true });
      this.setAttribute('data-sf-sortable', 'connected');
    }

    disconnectedCallback() {
      super.disconnectedCallback?.();
      this.observer?.disconnect();
      this.observer = null;
      this.connection?.abort();
      this.connection = null;
      for (const control of this.querySelectorAll(`[${TAMED}]`)) untame(control);
      if (shared.session?.fromList === this || shared.session?.list === this) finish(this, 'cancelled');
      this.setAttribute('data-sf-sortable', 'disposed');
    }

    prepareItem(item) {
      if (!item || item.closest('sf-sortable') !== this) return;
      // An sf-list-item row takes its own place in the list's one Tab stop.
      if (item.matches(OWN_ROVING)) {
        if (!item.hasAttribute('tabindex') && !item.matches(INTERACTIVE)) item.tabIndex = 0;
      } else {
        // The list is one Tab stop (BV-6): the arrows go between its items, and
        // the controls inside an item are reached from it with the arrows.
        if (!item.hasAttribute('tabindex')) item.tabIndex = -1;
        for (const control of controlsOf(item)) tame(control);
      }
      const described = (item.getAttribute('aria-describedby') || '').split(/\s+/u);
      if (this.instructions && !described.includes(this.instructions.id)) item.setAttribute('aria-describedby', [...described.filter(Boolean), this.instructions.id].join(' '));
      describeItem(item);
      // A row without a handle is the handle itself; a finger takes it by a long
      // press, so the page keeps scrolling over it (SO-3: touch-action none on
      // the whole row stopped that).
      item.toggleAttribute('data-sf-sortable-whole', !item.querySelector(HANDLE));
    }

    // The one item of the list that takes Tab (BV-6): the one a person was on
    // last, else the selected one, else the first. Every other item and every
    // control inside an item is -1.
    syncRoving() {
      const all = items(this).filter((item) => !item.matches(OWN_ROVING));
      if (!all.includes(this.currentItem)) {
        this.currentItem = all.find((item) => item.getAttribute('aria-selected') === 'true') || all[0] || null;
      }
      for (const item of all) {
        const want = item === this.currentItem ? '0' : '-1';
        if (item.getAttribute('tabindex') !== want) item.setAttribute('tabindex', want);
      }
      this.writeInstructions();
    }

    refreshWords() {
      if (!this.connection) return;
      this.writeInstructions();
      for (const item of items(this)) if (item.closest('sf-sortable') === this) describeItem(item);
    }

    // On a list of selectable items the instructions say Space selects (BV-8).
    // An extension of the element may add its own hint after these words
    // through updateInstructions(); they are kept when they already lead.
    writeInstructions() {
      if (!this.instructions) return;
      const words = messages();
      const text = items(this).some(sortableSelectable) ? words['instructions-select'] : words.instructions;
      const current = this.instructions.textContent;
      if (current === text || current.startsWith(`${text} `)) return;
      this.instructions.textContent = text;
      this.updateInstructions?.();
    }

    focusItem(item) {
      if (!item) return;
      this.currentItem = item;
      this.syncRoving();
      item.focus({ preventScroll: false });
    }

    // Keys outside a move on an item or a control in it (BV-6): the list's
    // axis goes between items, the other one in and out of the item's
    // controls; Escape on a control goes back to its item. A control with
    // arrows of its own (a field) keeps them.
    onRovingKey(event, item) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      if (item.matches(OWN_ROVING)) return false;
      const onItem = event.target === item;
      if (!onItem && (event.target.matches(OWN_ARROWS) || event.target.closest?.(ITEM) !== item)) return false;
      if (!onItem && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.focusItem(item);
        return true;
      }
      const step = sortableRovingStep(event.key, { orientation: this.getAttribute('orientation') === 'horizontal' ? 'horizontal' : 'vertical', rtl: globalThis.getComputedStyle(this).direction === 'rtl' });
      if (!step) return false;
      event.preventDefault();
      event.stopPropagation();
      const stops = stopsOf(item);
      const at = stops.indexOf(event.target);
      if (step === 'in') {
        const next = onItem ? stops[0] : stops[Math.min(stops.length - 1, at + 1)];
        next?.focus({ preventScroll: false });
        return true;
      }
      if (step === 'out') {
        if (!onItem) (at > 0 ? stops[at - 1] : item).focus({ preventScroll: false });
        return true;
      }
      if (!onItem) {
        this.focusItem(item);
        return true;
      }
      const all = items(this).filter((entry) => !entry.matches(OWN_ROVING));
      const index = all.indexOf(item);
      const target = { prev: all[index - 1], next: all[index + 1], first: all[0], last: all.at(-1) }[step];
      if (target && target !== item) this.focusItem(target);
      return true;
    }

    // The list keeps its live region and its instructions among its own
    // children, so a host that redraws the list with replaceChildren() takes
    // them out: announcements then went to a detached node, and items said
    // nothing (consumer case ui-mail.sortable-editor-recipe, 2026-10-21). The
    // component owns these two nodes and puts them back, with the same
    // instructions id the items point at through aria-describedby.
    ensureAccessibilityNodes() {
      if (!this.live || !this.instructions) return;
      if (this.live.parentNode === this && this.instructions.parentNode === this) return;
      this.append(this.live, this.instructions);
      this.writeInstructions();
    }

    announce(text) {
      this.ensureAccessibilityNodes();
      if (this.live) this.live.textContent = text;
    }

    get group() {
      const value = this.getAttribute('group') || '';
      return NAME.test(value) ? value : '';
    }

    get mode() {
      return this.getAttribute('mode') === 'copy' ? 'copy' : 'move';
    }

    begin(item, input) {
      const id = item.getAttribute('data-sf-sortable-item');
      if (!id || !this.group || shared.session) return false;
      const all = items(this);
      const sourceBox = item.getBoundingClientRect();
      shared.session = {
        sourceBox,
        item: id, from: this.getAttribute('id') || this.group, group: this.group, mode: this.mode, input,
        source: item, fromList: this, sourceIndex: all.indexOf(item), list: this.mode === 'copy' ? null : this,
        index: all.indexOf(item), external: null, cleanup: new AbortController(),
      };
      item.setAttribute('data-sf-sortable-dragging', '');
      globalThis.document.documentElement.setAttribute('data-sf-sortable-active', '');
      this.dispatchEvent(new globalThis.CustomEvent(SORTABLE_STATE_EVENT, { bubbles: true, composed: true, detail: Object.freeze({ state: 'picked', item: id }) }));
      return true;
    }

    // Pointer path ---------------------------------------------------------
    onPointerDown(event) {
      if (event.button !== 0 || shared.session) return;
      const item = event.target.closest?.(ITEM);
      if (!item || item.closest('sf-sortable') !== this) return;
      const handle = item.querySelector(HANDLE);
      if (handle && !handle.contains(event.target)) return;
      if (!handle && event.target.closest(INTERACTIVE) && event.target.closest(INTERACTIVE) !== item) return;
      const start = { x: event.clientX, y: event.clientY };
      const pointer = event.pointerId;
      let started = false;
      const pending = new AbortController();
      // A finger on a row without a handle: the drag waits for a long press.
      const longPress = !handle && event.pointerType === 'touch';
      let timer = 0;
      const lift = (at) => {
        if (!this.begin(item, at.pointerType || event.pointerType || 'mouse')) { pending.abort(); return false; }
        started = true;
        item.setPointerCapture?.(pointer);
        shared.session.ghost = this.ghost(item, at);
        // The item leaves the flow only once its copy is on screen; a copy
        // library (mode copy) keeps its item where it is.
        if (silhouetteFor(this) && this.mode !== 'copy') {
          shared.session.silhouette = true;
          // Asked before the item leaves the flow: with it gone, a grid of
          // two cells is one cell and does not look like a grid.
          shared.session.wrappedLists = new Set(isWrapped(items(this)) ? [this] : []);
          item.setAttribute('data-sf-sortable-lifted', '');
          this.retarget(at.clientX, at.clientY);
        }
        return true;
      };
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointer) return;
        if (!started) {
          const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
          if (longPress) {
            // The finger moved before the press was long: it scrolls the page.
            if (distance > LONG_PRESS_SLOP) pending.abort();
            return;
          }
          if (distance < DRAG_THRESHOLD) return;
          if (!lift(moveEvent)) return;
        }
        moveEvent.preventDefault();
        this.track(moveEvent.clientX, moveEvent.clientY);
      };
      const up = (upEvent) => {
        if (upEvent.pointerId !== pointer) return;
        pending.abort();
        if (started) { swallowNextClick(); this.drop(); }
      };
      const cancel = () => {
        pending.abort();
        if (started) finish(this, 'cancelled');
      };
      pending.signal.addEventListener('abort', () => globalThis.clearTimeout(timer));
      if (longPress) {
        timer = globalThis.setTimeout(() => {
          if (pending.signal.aborted || shared.session) return;
          if (!lift(event)) return;
          this.track(event.clientX, event.clientY);
          // From here the finger moves the row, not the page: a touchmove
          // the page does not scroll by, and no menu of the long press.
          const hold = (touchEvent) => { if (touchEvent.cancelable) touchEvent.preventDefault(); };
          globalThis.addEventListener('touchmove', hold, { signal: pending.signal, passive: false });
          globalThis.addEventListener('contextmenu', hold, { signal: pending.signal, capture: true });
        }, LONG_PRESS);
      }
      globalThis.addEventListener('pointermove', move, { signal: pending.signal, passive: false });
      globalThis.addEventListener('pointerup', up, { signal: pending.signal });
      globalThis.addEventListener('pointercancel', cancel, { signal: pending.signal });
      // Capture phase: cancel the drag before page-level Escape handlers run.
      globalThis.addEventListener('keydown', (keyEvent) => { if (keyEvent.key === 'Escape' && started) { keyEvent.preventDefault(); keyEvent.stopPropagation(); cancel(); } }, { signal: pending.signal, capture: true });
    }

    ghost(item, event) {
      const box = item.getBoundingClientRect();
      shared.session.offset = { x: event.clientX - box.left, y: event.clientY - box.top };
      return ghostOf(item, box);
    }

    track(x, y) {
      if (!shared.session) return;
      shared.session.pointer = { x, y };
      if (shared.session.ghost) Object.assign(shared.session.ghost.style, { left: `${x - shared.session.offset.x}px`, top: `${y - shared.session.offset.y}px` });
      this.retarget(x, y);
      this.startAutoScroll();
    }

    retarget(x, y) {
      const under = globalThis.document.elementFromPoint(x, y);
      const list = under?.closest?.('sf-sortable');
      for (const target of externalTargets) {
        const resolved = target.resolve(x, y, activeSortableSession());
        if (resolved) {
          shared.session.list = null;
          shared.session.external = { target, ...resolved };
          showIndicator(resolved.rect);
          return;
        }
      }
      shared.session.external = null;
      if (list && accepts(list, shared.session.group) && refusedInSession(list)) {
        shared.session.placeholder?.remove();
        shared.session.list = null;
        showIndicator(null);
        return;
      }
      if (list && accepts(list, shared.session.group)
          && shared.session.silhouette && silhouetteFor(list)) {
        shared.session.list = list;
        shared.session.index = placeSilhouette(shared.session, list, x, y);
        showIndicator(null);
        return;
      }
      shared.session.placeholder?.remove();
      if (list && accepts(list, shared.session.group)) {
        const resolved = listTarget(list, x, y);
        shared.session.list = list;
        // Store the final index: positions after the source shift by one.
        shared.session.index = list === shared.session.fromList && shared.session.mode === 'move' && resolved.index > shared.session.sourceIndex ? resolved.index - 1 : resolved.index;
        showIndicator(resolved.rect);
      } else {
        shared.session.list = null;
        showIndicator(null);
      }
    }

    // Scrolls the nearest scroll container every frame while the pointer
    // stays in its edge zone, including when the pointer is held still.
    startAutoScroll() {
      if (!shared.session || shared.session.scrollFrame) return;
      const step = () => {
        if (!shared.session?.pointer) return;
        shared.session.scrollFrame = 0;
        const { x, y } = shared.session.pointer;
        const container = scrollContainer(globalThis.document.elementFromPoint(x, y));
        if (!container) return;
        const box = container === globalThis.document.scrollingElement
          ? { top: 0, bottom: globalThis.innerHeight }
          : container.getBoundingClientRect();
        const max = container.scrollHeight - container.clientHeight;
        let delta = 0;
        if (y < box.top + EDGE && container.scrollTop > 0) delta = -Math.ceil((box.top + EDGE - y) / 4);
        else if (y > box.bottom - EDGE && container.scrollTop < max) delta = Math.ceil((y - box.bottom + EDGE) / 4);
        if (delta) {
          // Instant even under scroll-behavior: smooth, so every frame advances.
          container.scrollBy({ top: delta, behavior: 'instant' });
          this.retarget(x, y);
          shared.session.scrollFrame = globalThis.requestAnimationFrame(step);
        }
      };
      shared.session.scrollFrame = globalThis.requestAnimationFrame(step);
    }

    drop() {
      if (!shared.session) return;
      const current = shared.session;
      if (current.external) {
        current.external.target.drop(activeSortableSession(), current.external.descriptor);
        finish(this, 'dropped');
        return;
      }
      if (current.list) {
        const index = current.index;
        const unchanged = current.list === current.fromList && index === current.sourceIndex;
        if (!unchanged) {
          emitIntent(current.list, {
            item: current.item, from: current.from, to: current.list.getAttribute('id') || current.list.group,
            index, mode: current.mode,
          });
          current.list.announce?.(format(messages().dropped, { item: itemLabel(current.source), index: index + 1, list: listName(current.list) }));
          finish(this, 'dropped');
          return;
        }
      }
      finish(this, 'cancelled');
    }

    // Keyboard path --------------------------------------------------------
    keyboardTargets() {
      return [...globalThis.document.querySelectorAll('sf-sortable')].filter((list) => list === shared.session?.fromList ? shared.session.mode === 'move' : accepts(list, shared.session?.group) && !refusedInSession(list));
    }

    describeKeyboard(announce = true) {
      if (!shared.session) return;
      if (shared.session.external) {
        showIndicator(shared.session.external.rect);
        if (announce) this.announce(format(messages().target, { target: shared.session.external.label || '' }));
        return;
      }
      const list = shared.session.list;
      const full = items(list);
      const sameList = list === shared.session.fromList && shared.session.mode === 'move';
      const positions = full.length + (sameList ? 0 : 1);
      const physical = sameList && shared.session.index > shared.session.sourceIndex ? shared.session.index + 1 : shared.session.index;
      showIndicator(listIndicatorRect(list, full, Math.min(physical, full.length), list.getAttribute('orientation') === 'horizontal'));
      if (announce) this.announce(format(messages().moved, { index: shared.session.index + 1, total: positions, list: listName(list) }));
    }

    onKeyDown(event) {
      const item = event.target.closest?.(ITEM);
      if (!shared.session) {
        if (!item || item.closest('sf-sortable') !== this) return;
        if (this.onRovingKey(event, item) || event.target !== item) return;
        // Enter picks up; Space selects a selectable item and picks up any
        // other (BV-8). The host that keeps aria-selected answers Space itself.
        const action = event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ? null : sortableKeyAction(event.key, sortableSelectable(item));
        if (!action) return;
        if (action === 'select') {
          const mark = selectMarkOf(item);
          if (mark) {
            event.preventDefault();
            mark.click();
          }
          return;
        }
        event.preventDefault();
        if (!this.begin(item, 'keyboard')) return;
        // An abandoned keyboard move is cancelled when focus or a click leaves the list.
        const abandon = () => { if (shared.session?.fromList === this) { this.announce(messages().cancelled); finish(this, 'cancelled'); } };
        const cleanup = { signal: shared.session.cleanup.signal };
        this.addEventListener('focusout', (focusEvent) => {
          if (focusEvent.relatedTarget && this.contains(focusEvent.relatedTarget)) return;
          globalThis.setTimeout(() => { if (!this.contains(globalThis.document.activeElement)) abandon(); }, 0);
        }, cleanup);
        globalThis.document.addEventListener('pointerdown', (pointerEvent) => { if (!this.contains(pointerEvent.target)) abandon(); }, { ...cleanup, capture: true });
        if (shared.session.mode === 'copy') {
          const [first] = this.keyboardTargets();
          const external = [...externalTargets].flatMap((target) => (target.keyboardTargets?.(activeSortableSession()) || []).map((entry) => ({ target, ...entry })));
          if (first) {
            shared.session.list = first;
            shared.session.index = items(first).length;
          } else if (external.length) {
            shared.session.external = external[0];
          } else {
            finish(this, 'cancelled');
            return;
          }
        }
        if (shared.session.external) {
          this.describeKeyboard(false);
          this.announce(`${format(messages().picked, { item: itemLabel(item), index: 1, total: 1, list: '' }).split('.')[0]}. ${format(messages().target, { target: shared.session.external.label || '' })}`);
          return;
        }
        const all = items(shared.session.list);
        this.describeKeyboard(false);
        this.announce(format(messages().picked, { item: itemLabel(item), index: shared.session.index + 1, total: all.length, list: listName(shared.session.list) }));
        return;
      }
      if (shared.session.input !== 'keyboard' || shared.session.fromList !== this) return;
      const lists = this.keyboardTargets();
      const external = [...externalTargets].flatMap((target) => (target.keyboardTargets?.(activeSortableSession()) || []).map((entry) => ({ target, ...entry })));
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        this.announce(messages().cancelled);
        finish(this, 'cancelled');
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.drop();
        return;
      }
      const vertical = { ArrowUp: -1, ArrowDown: 1 }[event.key];
      const across = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (vertical === undefined && across === undefined) return;
      event.preventDefault();
      if (shared.session.external) {
        const position = external.findIndex((entry) => entry.target === shared.session.external.target && JSON.stringify(entry.descriptor) === JSON.stringify(shared.session.external.descriptor));
        const next = external[position + (vertical ?? across)];
        if (next) shared.session.external = next;
        else if ((vertical ?? across) < 0 && lists.length) {
          shared.session.external = null;
          shared.session.list = lists.at(-1);
          shared.session.index = items(shared.session.list).length - (shared.session.list === shared.session.fromList && shared.session.mode === 'move' ? 1 : 0);
        }
        this.describeKeyboard();
        return;
      }
      const list = shared.session.list;
      const count = items(list).length - (list === shared.session.fromList && shared.session.mode === 'move' ? 1 : 0);
      if (vertical !== undefined) {
        const next = shared.session.index + vertical;
        if (next >= 0 && next <= count) shared.session.index = next;
        else if (next > count && across === undefined && external.length && lists.indexOf(list) === lists.length - 1) shared.session.external = external[0];
      } else {
        const next = lists[lists.indexOf(list) + across];
        if (next) {
          shared.session.list = next;
          shared.session.index = Math.min(shared.session.index, items(next).length - (next === shared.session.fromList && shared.session.mode === 'move' ? 1 : 0));
        } else if (across > 0 && external.length) {
          shared.session.external = external[0];
        }
      }
      this.describeKeyboard();
    }
  }

  registry.define('sf-sortable', SfSortable);
  return SfSortable;
}

/**
 * sf-sortable's behaviour on any container, without the element: a table's
 * head row cannot hold a custom element around its cells, and its columns move
 * with every cell under them (owner, 2026-10-13); a table's body cannot hold
 * one around its rows either. The container keeps its markup; the controller
 * listens on it.
 *
 * options:
 *   items        selector of the movable children (required)
 *   orientation  'horizontal' (default: the column mode, columns of a head
 *                row) | 'vertical' (the row mode, rows of a list or a table
 *                body, view round 1 D1)
 *   handle       selector of an item's handle (row mode): when the item has
 *                one, a drag begins there only, and a press on it that does
 *                not become a drag opens the move menu (C171 (1)); without
 *                one the whole row is taken -- a mouse after 4 px, a finger
 *                after a long press, so a swipe still scrolls (C171 (2))
 *   keyboard     row mode: Space or Enter on a focused item picks it up,
 *                arrows move it, Space or Enter drops, Escape or Tab cancels,
 *                each step said in the live region -- sf-sortable's keys.
 *                Default true; false for rows whose keys are the host's (the
 *                handle's menu stays the keyboard path then)
 *   keyOf        (item) => string -- the item's id in the intent; default its
 *                data-sf-sortable-item, else data-key, else data-row-id
 *   canStart     (event, item) => boolean -- a press that may begin a drag
 *   groupOf      (item) => string -- an item moves among items of its group
 *   preview      'column' | 'line'; the column mode draws 'column' (an outline
 *                the size of the column), the row mode 'line' (the one 2 px
 *                drop line, C171 (4)) unless told otherwise
 *   extent       the element a column or a line spans (a table); default the
 *                container
 *   cellsOf      (item) => elements to mark as the moving item (its cells)
 *   label        the list's name for the announcement
 *   labelOf      (item) => string -- what the item is called in the
 *                announcements and the move menu; default its aria-label, a
 *                table row its cells' text joined by commas, anything else its
 *                visible text, the handle and hidden parts left out
 *   onIntent     ({item, from, index, group}) -- index among the group's items
 *                without the dragged one, the place it is to take
 * Returns detach(); detach.move(item, index) asks a move without dragging,
 * with the same intent and the same words (as requestSortableMove does for a
 * list).
 *
 * In the column mode keyboard reordering stays where a list is: a table's
 * column settings are an sf-sortable list with every key path. A click that
 * ends a drag is swallowed, so a heading that sorts on click does not sort on
 * a drop, and a handle does not open its menu.
 */
export function attachSortable(container, options = {}) {
  if (!(container instanceof globalThis.Element) || typeof options.items !== 'string') {
    throw new TypeError('attachSortable needs a container and an items selector');
  }
  const doc = globalThis.document;
  const vertical = options.orientation === 'vertical';
  const preview = options.preview === 'line' || options.preview === 'column' ? options.preview : (vertical ? 'line' : 'column');
  const groupOf = typeof options.groupOf === 'function' ? options.groupOf : () => '';
  const canStart = typeof options.canStart === 'function' ? options.canStart : () => true;
  const cellsOf = typeof options.cellsOf === 'function' ? options.cellsOf : (item) => [item];
  const keyOf = typeof options.keyOf === 'function'
    ? options.keyOf
    : (item) => item.getAttribute('data-sf-sortable-item') || item.dataset.key || item.dataset.rowId || '';
  const handleSelector = vertical && typeof options.handle === 'string' && options.handle ? options.handle : '';
  // A row read as one run of text said «ПереместитьЗадача вторая11.11.2026»:
  // the handle's own name (its tooltip, drawn in the cell on hover) and every
  // cell glued together.
  const labelOf = typeof options.labelOf === 'function' ? options.labelOf : (item) => {
    if (item.getAttribute('aria-label')) return item.getAttribute('aria-label');
    const skip = handleSelector;
    if (item.tagName === 'TR') return [...item.cells].map((cell) => sortableReadableText(cell, { skip })).filter(Boolean).join(', ');
    return sortableItemLabel(item, { skip });
  };
  const keyboard = vertical && options.keyboard !== false;
  const extentOf = () => options.extent?.isConnected ? options.extent : container;
  const live = doc.createElement('div');
  live.className = 'sf-sortable-live';
  live.setAttribute('aria-live', 'polite');
  doc.body.append(live);
  // The row mode's keys are said once, in a node the items name in
  // aria-describedby, as a list's are.
  let help = null;
  if (keyboard) {
    help = doc.createElement('div');
    help.className = 'sf-sortable-live';
    help.id = nextHelpId();
    help.textContent = messages().instructions;
    doc.body.append(help);
  }
  const abort = new AbortController();
  // The keys' words follow the page's language, as a list's do (VS-SITE-4).
  if (help) {
    const rewrite = () => {
      const text = messages().instructions;
      if (help.textContent !== text) help.textContent = text;
    };
    const offLanguage = language.onChange(rewrite);
    const unwatch = followLanguage(help, rewrite);
    abort.signal.addEventListener('abort', () => { offLanguage(); unwatch(); }, { once: true });
  }
  let session = null;

  const members = (group) => [...container.querySelectorAll(options.items)].filter((item) => groupOf(item) === group);
  const handleOf = (item) => (handleSelector ? item.querySelector(handleSelector) : null);
  const say = (text) => { live.textContent = text; };
  const outline = () => {
    if (session.outline) return session.outline;
    const box = doc.createElement('div');
    box.className = preview === 'column' ? 'sf-sortable-column-outline' : 'sf-sortable-indicator';
    box.setAttribute('aria-hidden', 'true');
    doc.body.append(box);
    session.outline = box;
    return box;
  };

  // Where the outline or the line stands for a place among the peers (the
  // items of the group without the moving one): along the row for columns,
  // down the extent for rows.
  const draw = (boxes, index) => {
    const extent = extentOf().getBoundingClientRect();
    const before = boxes[index];
    const after = boxes[index - 1];
    const startOf = (box) => (vertical ? box.top : box.left);
    const endOf = (box) => (vertical ? box.bottom : box.right);
    const origin = vertical ? extent.top : extent.left;
    let at;
    if (preview === 'column') {
      // The outline stands where the item will be. Moving towards the start
      // it takes the place of the item it goes before (that one moves on);
      // moving towards the end it ends where the item it goes after ends.
      const size = session.size;
      if (index > session.originalIndex && after) at = endOf(after) - size;
      else at = before ? startOf(before) : (after ? endOf(after) - size : origin);
    } else {
      at = (before ? startOf(before) : after ? endOf(after) : origin) - HALF;
    }
    const length = preview === 'column' ? session.size : LINE;
    Object.assign(outline().style, vertical
      ? {left: `${extent.left}px`, top: `${at}px`, width: `${extent.width}px`, height: `${length}px`}
      : {left: `${at}px`, top: `${extent.top}px`, width: `${length}px`, height: `${extent.height}px`});
  };

  const peerBoxes = () => members(session.group).filter((item) => item !== session.item).map((item) => item.getBoundingClientRect());

  const place = (x, y) => {
    const boxes = peerBoxes();
    const coordinate = vertical ? y : x;
    let index = boxes.length;
    for (let at = 0; at < boxes.length; at += 1) {
      const box = boxes[at];
      const middle = vertical ? box.top + box.height / 2 : box.left + box.width / 2;
      if (coordinate < middle) { index = at; break; }
    }
    session.index = index;
    draw(boxes, index);
  };

  const autoScroll = (x, y) => {
    if (!vertical) {
      for (let node = container.parentElement; node; node = node.parentElement) {
        const style = globalThis.getComputedStyle(node);
        if (!/(auto|scroll)/u.test(style.overflowX) || node.scrollWidth <= node.clientWidth) continue;
        const box = node.getBoundingClientRect();
        if (x < box.left + EDGE) node.scrollBy({left: -Math.ceil((box.left + EDGE - x) / 4), behavior: 'instant'});
        else if (x > box.right - EDGE) node.scrollBy({left: Math.ceil((x - box.right + EDGE) / 4), behavior: 'instant'});
        return;
      }
      return;
    }
    const node = scrollContainer(container);
    if (!node) return;
    const box = node === doc.scrollingElement ? {top: 0, bottom: globalThis.innerHeight} : node.getBoundingClientRect();
    if (y < box.top + EDGE) node.scrollBy({top: -Math.ceil((box.top + EDGE - y) / 4), behavior: 'instant'});
    else if (y > box.bottom - EDGE) node.scrollBy({top: Math.ceil((y - box.bottom + EDGE) / 4), behavior: 'instant'});
  };

  // The intent and its words: one path for a drop, a keyboard drop and the
  // handle's menu.
  const request = (item, index, group = groupOf(item)) => {
    const id = keyOf(item);
    say(format(messages().dropped, {item: labelOf(item), index: index + 1, list: options.label || ''}));
    options.onIntent?.({item: id, from: group, index, group});
  };

  // After a keyboard move or a menu choice the person's focus is back on the
  // item they moved (or its handle), once the host has redrawn.
  const refocus = (id, toHandle) => {
    const back = () => {
      const active = doc.activeElement;
      if (active && active !== doc.body && doc.contains(active) && !(toHandle && container.contains(active))) return;
      const item = [...container.querySelectorAll(options.items)].find((candidate) => keyOf(candidate) === id);
      if (!item) return;
      const handle = toHandle ? handleOf(item) : null;
      const control = handle ? (handle.matches('button') ? handle : handle.querySelector('button') || handle) : null;
      (control && (control.matches('button') || control.tabIndex >= 0) ? control : item).focus?.({preventScroll: false});
    };
    if (typeof globalThis.requestAnimationFrame !== 'function') back();
    else globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(back));
  };

  const end = (dropped) => {
    const ended = session;
    session = null;
    if (!ended) return;
    ended.pending.abort();
    globalThis.clearTimeout(ended.timer);
    ended.ghost?.remove();
    ended.outline?.remove();
    for (const cell of ended.cells) cell.removeAttribute('data-sf-sortable-column-source');
    doc.documentElement.removeAttribute('data-sf-sortable-active');
    if (!ended.started) return;
    // The row mode says when a drag begins and ends, as a list does; the
    // column mode stays quiet, as it always was.
    if (vertical) container.dispatchEvent(new globalThis.CustomEvent(SORTABLE_STATE_EVENT, {bubbles: true, composed: true, detail: Object.freeze({state: dropped && ended.index !== ended.originalIndex ? 'dropped' : 'cancelled', item: keyOf(ended.item)})}));
    if (ended.input !== 'keyboard') {
      // The click a drop ends with is not a click on the heading (or the
      // handle). It comes in the same task as the pointerup, so the guard is
      // gone by the next one and a later click is a click again.
      const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      container.addEventListener('click', swallow, {capture: true, once: true});
      globalThis.setTimeout(() => container.removeEventListener('click', swallow, {capture: true}), 0);
    }
    if (!dropped) {
      say(messages().cancelled);
      return;
    }
    if (ended.index === undefined || ended.index === ended.originalIndex) {
      if (ended.input === 'keyboard') say(messages().cancelled);
      return;
    }
    request(ended.item, ended.index, ended.group);
    if (ended.input === 'keyboard') refocus(keyOf(ended.item), false);
  };

  // A row is copied into a table of its own, cell widths kept: a bare row
  // outside its table loses its columns.
  const ghostFor = (item, box) => {
    if (item.tagName !== 'TR') return ghostOf(item, box);
    const ghost = ghostOf(item, box);
    const copy = ghost.firstElementChild;
    const table = doc.createElement('table');
    const body = doc.createElement('tbody');
    table.className = item.closest('table')?.className || '';
    Object.assign(table.style, {inlineSize: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', margin: '0'});
    [...copy.children].forEach((cell, at) => {
      const width = item.children[at]?.getBoundingClientRect().width;
      if (width) cell.style.inlineSize = `${width}px`;
    });
    copy.style.inlineSize = '';
    body.append(copy);
    table.append(body);
    ghost.append(table);
    return ghost;
  };

  const lift = (item, at, input) => {
    session.started = true;
    session.input = input;
    doc.documentElement.setAttribute('data-sf-sortable-active', '');
    session.cells = cellsOf(item).filter(Boolean);
    for (const cell of session.cells) cell.setAttribute('data-sf-sortable-column-source', '');
    if (vertical) container.dispatchEvent(new globalThis.CustomEvent(SORTABLE_STATE_EVENT, {bubbles: true, composed: true, detail: Object.freeze({state: 'picked', item: keyOf(item)})}));
    if (input === 'keyboard') return;
    const ghost = ghostFor(item, session.box);
    ghost.style.height = `${session.box.height}px`;
    session.ghost = ghost;
    session.offset = {x: at.x - session.box.left, y: at.y - session.box.top};
  };

  const follow = (x, y) => {
    Object.assign(session.ghost.style, {left: `${x - session.offset.x}px`, top: `${y - session.offset.y}px`});
    autoScroll(x, y);
    place(x, y);
  };

  const open = (item, extra = {}) => {
    const group = groupOf(item);
    const peers = members(group);
    if (peers.length < 2) return null;
    const box = item.getBoundingClientRect();
    session = {item, group, pending: new AbortController(), started: false, cells: [], box,
      size: vertical ? box.height : box.width, originalIndex: peers.indexOf(item), timer: 0, ...extra};
    return session;
  };

  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || session || shared.session) return;
    const item = event.target.closest?.(options.items);
    if (!item || !container.contains(item) || !canStart(event, item)) return;
    const handle = handleOf(item);
    if (handle && !handle.contains(event.target)) return;
    if (vertical && !handle) {
      const control = event.target.closest(INTERACTIVE);
      if (control && control !== item && item.contains(control)) return;
    }
    if (!open(item)) return;
    const start = {x: event.clientX, y: event.clientY};
    const {pending} = session;
    // A finger on a row without a handle: the drag waits for a long press, and
    // a move before it is the page's scroll (C171 (2)).
    const longPress = vertical && !handle && event.pointerType === 'touch';
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId || !session) return;
      if (!session.started) {
        const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
        if (longPress) {
          if (distance > LONG_PRESS_SLOP) end(false);
          return;
        }
        if (distance < DRAG_THRESHOLD) return;
        lift(item, start, moveEvent.pointerType || 'mouse');
      }
      moveEvent.preventDefault();
      follow(moveEvent.clientX, moveEvent.clientY);
    };
    if (longPress) {
      session.timer = globalThis.setTimeout(() => {
        if (!session || session.item !== item || session.started) return;
        lift(item, start, 'touch');
        follow(start.x, start.y);
        const hold = (touchEvent) => { if (touchEvent.cancelable) touchEvent.preventDefault(); };
        globalThis.addEventListener('touchmove', hold, {signal: pending.signal, passive: false});
        globalThis.addEventListener('contextmenu', hold, {signal: pending.signal, capture: true});
      }, LONG_PRESS);
    }
    globalThis.addEventListener('pointermove', move, {signal: pending.signal, passive: false});
    globalThis.addEventListener('pointerup', (upEvent) => { if (upEvent.pointerId === event.pointerId) end(true); }, {signal: pending.signal});
    globalThis.addEventListener('pointercancel', () => end(false), {signal: pending.signal});
    globalThis.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Escape' && session?.started) { keyEvent.preventDefault(); keyEvent.stopPropagation(); end(false); }
    }, {signal: pending.signal, capture: true});
  }, {signal: abort.signal});

  if (keyboard) {
    // Items name the keys when they take the focus (rows the host draws later
    // as well).
    container.addEventListener('focusin', (event) => {
      const item = event.target.closest?.(options.items);
      if (!item || !container.contains(item) || !help) return;
      const described = (item.getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean);
      if (!described.includes(help.id)) item.setAttribute('aria-describedby', [...described, help.id].join(' '));
    }, {signal: abort.signal});
    container.addEventListener('keydown', (event) => {
      if (!session) {
        const item = event.target.closest?.(options.items);
        if (!item || event.target !== item || !container.contains(item) || shared.session) return;
        // Enter picks up; Space picks up only a row that is not selectable --
        // on a selectable row (a selection mark, aria-selected) Space is the
        // selection's, left to the host (BV-8).
        if (event.defaultPrevented || sortableKeyAction(event.key, sortableSelectable(item)) !== 'pick') return;
        if (!open(item)) return;
        event.preventDefault();
        event.stopPropagation();
        session.index = session.originalIndex;
        lift(item, null, 'keyboard');
        const total = members(session.group).length;
        draw(peerBoxes(), session.index);
        say(format(messages().picked, {item: labelOf(item), index: session.index + 1, total, list: options.label || ''}));
        // Focus or a press leaving the list abandons the move.
        const {signal} = session.pending;
        container.addEventListener('focusout', (focusEvent) => {
          if (focusEvent.relatedTarget && container.contains(focusEvent.relatedTarget)) return;
          globalThis.setTimeout(() => { if (session?.input === 'keyboard' && !container.contains(doc.activeElement)) end(false); }, 0);
        }, {signal});
        doc.addEventListener('pointerdown', (pointerEvent) => { if (!container.contains(pointerEvent.target)) end(false); }, {signal, capture: true});
        return;
      }
      if (session.input !== 'keyboard') return;
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
        end(false);
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        end(true);
        return;
      }
      const step = {ArrowUp: -1, ArrowDown: 1}[event.key];
      if (step === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      const total = members(session.group).length;
      const next = session.index + step;
      if (next < 0 || next > total - 1) return;
      session.index = next;
      draw(peerBoxes(), next);
      say(format(messages().moved, {index: next + 1, total, list: options.label || ''}));
    }, {signal: abort.signal});
  }

  const detach = () => {
    end(false);
    abort.abort();
    live.remove();
    help?.remove();
  };
  // A move asked without dragging (the handle's menu): the same intent and
  // words; the focus comes back to the moved item's handle.
  detach.move = (item, index) => {
    if (!item || !container.contains(item)) return false;
    const peers = members(groupOf(item));
    const from = peers.indexOf(item);
    if (from < 0 || index < 0 || index >= peers.length || index === from) return false;
    request(item, index);
    refocus(keyOf(item), true);
    return true;
  };
  detach.members = (item) => members(groupOf(item));
  detach.handle = handleSelector;
  detach.labelOf = labelOf;
  return detach;
}

export default { SORTABLE_CHECK_EVENT, SORTABLE_DROP_LINE, SORTABLE_MOVE_EVENT, activeSortableSession, attachSortable, defineSortable, registerSortableDropTarget, requestSortableMove, requestSortableTransfer, sortableIndexAt, sortableKeyAction, sortableMoveTargets, sortableRefusal, sortableRovingStep, sortableSelectable };
