// Sortable drag-and-drop primitive. <sf-sortable> lists and registered
// external drop targets share one drag session. Pointer (mouse, pen, touch via
// handles), keyboard and screen-reader paths all end in the same intent event;
// the component never moves host DOM or data. The host applies the change.
import { pageText } from '../page-language.js';

export const SORTABLE_INTENT_EVENT = 'sf-sortable-intent';
export const SORTABLE_STATE_EVENT = 'sf-sortable-state';

const ITEM = '[data-sf-sortable-item]';
const HANDLE = '[data-sf-sortable-handle]';
const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[contenteditable]:not([contenteditable="false"])';
const NAME = /^[a-z][a-z0-9-]{0,31}$/u;
const DRAG_THRESHOLD = 4;
const EDGE = 32;

const MESSAGES = {
  ru: {
    instructions: 'Пробел или Enter — взять, стрелки — переместить, Пробел или Enter — положить, Escape — отменить.',
    picked: 'Взято: {item}. Позиция {index} из {total} в «{list}».',
    moved: 'Позиция {index} из {total} в «{list}».',
    dropped: 'Положено: {item}, позиция {index} в «{list}».',
    cancelled: 'Перемещение отменено.',
    target: 'Цель: {target}.',
  },
  en: {
    instructions: 'Space or Enter to pick up, arrows to move, Space or Enter to drop, Escape to cancel.',
    picked: 'Picked up {item}. Position {index} of {total} in “{list}”.',
    moved: 'Position {index} of {total} in “{list}”.',
    dropped: 'Dropped {item} at position {index} in “{list}”.',
    cancelled: 'Move cancelled.',
    target: 'Target: {target}.',
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

// Visible text of an item without decorative (aria-hidden) parts.
function itemLabel(item) {
  if (item.getAttribute('aria-label')) return item.getAttribute('aria-label');
  const clone = item.cloneNode(true);
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent.replace(/\s+/gu, ' ').trim();
}

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

function scrollContainer(element) {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const style = globalThis.getComputedStyle(node);
    if (/(auto|scroll)/u.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return globalThis.document.scrollingElement;
}

function indicator() {
  let line = globalThis.document.querySelector('.sf-sortable-indicator');
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
    return { left: target.left - 1, top: target.top, width: 2, height: target.height };
  }
  if (after) {
    const target = after.getBoundingClientRect();
    return { left: target.right - 1, top: target.top, width: 2, height: target.height };
  }
  return { left: box.left, top: box.top, width: 2, height: box.height };
}

function listIndicatorRect(list, all, index, horizontal) {
  const box = list.getBoundingClientRect();
  const before = all[index];
  const after = all[index - 1];
  if (horizontal) {
    const x = before ? before.getBoundingClientRect().left : after ? after.getBoundingClientRect().right : box.left;
    return { left: x - 1, top: box.top, width: 2, height: box.height };
  }
  const y = before ? before.getBoundingClientRect().top : after ? after.getBoundingClientRect().bottom : box.top;
  return { left: box.left, top: y - 1, width: box.width, height: 2 };
}

function emitIntent(target, detail) {
  target.dispatchEvent(new globalThis.CustomEvent(SORTABLE_INTENT_EVENT, { bubbles: true, composed: true, detail: Object.freeze(detail) }));
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
}

export function defineSortable(registry = globalThis.customElements) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-sortable');
  if (existing) return existing;

  class SfSortable extends globalThis.HTMLElement {
    constructor() {
      super();
      this.connection = null;
      this.live = null;
      this.instructions = null;
    }

    connectedCallback() {
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
        this.instructions.id = `sf-sortable-help-${Math.random().toString(36).slice(2, 10)}`;
      }
      this.instructions.textContent = messages().instructions;
      this.append(this.live, this.instructions);
      this.addEventListener('pointerdown', (event) => this.onPointerDown(event), options);
      this.addEventListener('keydown', (event) => this.onKeyDown(event), options);
      this.addEventListener('focusin', (event) => this.prepareItem(event.target.closest?.(ITEM)), options);
      for (const item of items(this)) this.prepareItem(item);
      // Items the host adds later become focusable and draggable as well.
      this.observer = new globalThis.MutationObserver(() => { for (const item of items(this)) this.prepareItem(item); });
      this.observer.observe(this, { childList: true, subtree: true });
      this.setAttribute('data-sf-sortable', 'connected');
    }

    disconnectedCallback() {
      this.observer?.disconnect();
      this.observer = null;
      this.connection?.abort();
      this.connection = null;
      if (shared.session?.fromList === this || shared.session?.list === this) finish(this, 'cancelled');
      this.setAttribute('data-sf-sortable', 'disposed');
    }

    prepareItem(item) {
      if (!item || item.closest('sf-sortable') !== this) return;
      if (!item.hasAttribute('tabindex') && !item.matches(INTERACTIVE)) item.tabIndex = 0;
      const described = (item.getAttribute('aria-describedby') || '').split(/\s+/u);
      if (this.instructions && !described.includes(this.instructions.id)) item.setAttribute('aria-describedby', [...described.filter(Boolean), this.instructions.id].join(' '));
      if (!item.querySelector(HANDLE)) item.style.touchAction = 'none';
    }

    announce(text) {
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
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointer) return;
        if (!started) {
          if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < DRAG_THRESHOLD) return;
          if (!this.begin(item, moveEvent.pointerType || 'mouse')) { pending.abort(); return; }
          started = true;
          item.setPointerCapture?.(pointer);
          shared.session.ghost = this.ghost(item, moveEvent);
          // The item leaves the flow only once its copy is on screen; a copy
          // library (mode copy) keeps its item where it is.
          if (silhouetteFor(this) && this.mode !== 'copy') {
            shared.session.silhouette = true;
            // Asked before the item leaves the flow: with it gone, a grid of
            // two cells is one cell and does not look like a grid.
            shared.session.wrappedLists = new Set(isWrapped(items(this)) ? [this] : []);
            item.setAttribute('data-sf-sortable-lifted', '');
            this.retarget(moveEvent.clientX, moveEvent.clientY);
          }
        }
        moveEvent.preventDefault();
        this.track(moveEvent.clientX, moveEvent.clientY);
      };
      const up = (upEvent) => {
        if (upEvent.pointerId !== pointer) return;
        pending.abort();
        if (started) this.drop();
      };
      const cancel = () => {
        pending.abort();
        if (started) finish(this, 'cancelled');
      };
      globalThis.addEventListener('pointermove', move, { signal: pending.signal, passive: false });
      globalThis.addEventListener('pointerup', up, { signal: pending.signal });
      globalThis.addEventListener('pointercancel', cancel, { signal: pending.signal });
      // Capture phase: cancel the drag before page-level Escape handlers run.
      globalThis.addEventListener('keydown', (keyEvent) => { if (keyEvent.key === 'Escape' && started) { keyEvent.preventDefault(); keyEvent.stopPropagation(); cancel(); } }, { signal: pending.signal, capture: true });
    }

    ghost(item, event) {
      const box = item.getBoundingClientRect();
      const ghost = item.cloneNode(true);
      ghost.removeAttribute('id');
      for (const element of ghost.querySelectorAll('[id]')) element.removeAttribute('id');
      ghost.classList.add('sf-sortable-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      Object.assign(ghost.style, { width: `${box.width}px`, left: `${box.left}px`, top: `${box.top}px` });
      shared.session.offset = { x: event.clientX - box.left, y: event.clientY - box.top };
      globalThis.document.body.append(ghost);
      return ghost;
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
      return [...globalThis.document.querySelectorAll('sf-sortable')].filter((list) => list === shared.session?.fromList ? shared.session.mode === 'move' : accepts(list, shared.session?.group));
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
        if (!item || item.closest('sf-sortable') !== this || event.target !== item) return;
        if (event.key !== ' ' && event.key !== 'Enter') return;
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
 * sf-sortable's pointer behaviour on any container, without the element: a
 * table's head row cannot hold a custom element around its cells, and its
 * columns move with every cell under them (owner, 2026-10-13). The container
 * keeps its markup; the controller listens on it.
 *
 * options:
 *   items        selector of the movable children (required)
 *   canStart     (event, item) => boolean -- a press that may begin a drag
 *   groupOf      (item) => string -- an item moves among items of its group
 *   preview      'column' (default) | 'line'
 *   extent       the element a column spans (a table); default the container
 *   cellsOf      (item) => elements to mark as the moving column (its cells)
 *   label        the list's name for the announcement
 *   onIntent     ({item, from, index, group}) -- index among the group's items
 *                without the dragged one, the place it is to take
 * Returns detach().
 *
 * Keyboard reordering stays where a list is: a table's column settings are an
 * sf-sortable list with every key path. A click that ends a drag is swallowed,
 * so a heading that sorts on click does not sort on a drop.
 */
export function attachSortable(container, options = {}) {
  if (!(container instanceof globalThis.Element) || typeof options.items !== 'string') {
    throw new TypeError('attachSortable needs a container and an items selector');
  }
  const doc = globalThis.document;
  const preview = options.preview === 'line' ? 'line' : 'column';
  const groupOf = typeof options.groupOf === 'function' ? options.groupOf : () => '';
  const canStart = typeof options.canStart === 'function' ? options.canStart : () => true;
  const cellsOf = typeof options.cellsOf === 'function' ? options.cellsOf : (item) => [item];
  const extentOf = () => options.extent?.isConnected ? options.extent : container;
  const live = doc.createElement('div');
  live.className = 'sf-sortable-live';
  live.setAttribute('aria-live', 'polite');
  doc.body.append(live);
  const abort = new AbortController();
  let session = null;

  const members = (group) => [...container.querySelectorAll(options.items)].filter((item) => groupOf(item) === group);
  const outline = () => {
    if (session.outline) return session.outline;
    const box = doc.createElement('div');
    box.className = preview === 'column' ? 'sf-sortable-column-outline' : 'sf-sortable-indicator';
    box.setAttribute('aria-hidden', 'true');
    doc.body.append(box);
    session.outline = box;
    return box;
  };

  const place = (x) => {
    const peers = members(session.group).filter((item) => item !== session.item);
    const boxes = peers.map((item) => item.getBoundingClientRect());
    let index = boxes.length;
    for (let at = 0; at < boxes.length; at += 1) {
      if (x < boxes[at].left + boxes[at].width / 2) { index = at; break; }
    }
    session.index = index;
    const extent = extentOf().getBoundingClientRect();
    const width = session.width;
    const before = boxes[index];
    const after = boxes[index - 1];
    let left;
    if (preview === 'column') {
      // The outline stands where the column will be. Moving towards the start
      // it takes the place of the column it goes before (that one moves on);
      // moving towards the end it ends where the column it goes after ends.
      if (index > session.originalIndex && after) left = after.right - width;
      else left = before ? before.left : (after ? after.right - width : extent.left);
    } else {
      left = (before ? before.left : after ? after.right : extent.left) - 1;
    }
    Object.assign(outline().style, {
      left: `${left}px`, top: `${extent.top}px`,
      width: preview === 'column' ? `${width}px` : '2px', height: `${extent.height}px`,
    });
  };

  const autoScroll = (x) => {
    for (let node = container.parentElement; node; node = node.parentElement) {
      const style = globalThis.getComputedStyle(node);
      if (!/(auto|scroll)/u.test(style.overflowX) || node.scrollWidth <= node.clientWidth) continue;
      const box = node.getBoundingClientRect();
      if (x < box.left + EDGE) node.scrollBy({left: -Math.ceil((box.left + EDGE - x) / 4), behavior: 'instant'});
      else if (x > box.right - EDGE) node.scrollBy({left: Math.ceil((x - box.right + EDGE) / 4), behavior: 'instant'});
      return;
    }
  };

  const end = (dropped) => {
    const ended = session;
    session = null;
    if (!ended) return;
    ended.pending.abort();
    ended.ghost?.remove();
    ended.outline?.remove();
    for (const cell of ended.cells) cell.removeAttribute('data-sf-sortable-column-source');
    doc.documentElement.removeAttribute('data-sf-sortable-active');
    if (!ended.started) return;
    // The click a drop ends with is not a click on the heading. It comes in the
    // same task as the pointerup, so the guard is gone by the next one and a
    // later click is a click again.
    const swallow = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    container.addEventListener('click', swallow, {capture: true, once: true});
    globalThis.setTimeout(() => container.removeEventListener('click', swallow, {capture: true}), 0);
    if (!dropped) {
      live.textContent = messages().cancelled;
      return;
    }
    if (ended.index === undefined || ended.index === ended.originalIndex) return;
    const id = ended.item.getAttribute('data-sf-sortable-item') || ended.item.dataset.key || '';
    live.textContent = format(messages().dropped, {item: itemLabel(ended.item), index: ended.index + 1, list: options.label || ''});
    options.onIntent?.({item: id, from: ended.group, index: ended.index, group: ended.group});
  };

  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || session || shared.session) return;
    const item = event.target.closest?.(options.items);
    if (!item || !container.contains(item) || !canStart(event, item)) return;
    const group = groupOf(item);
    const peers = members(group);
    if (peers.length < 2) return;
    const start = {x: event.clientX, y: event.clientY};
    const pending = new AbortController();
    const box = item.getBoundingClientRect();
    session = {item, group, pending, started: false, cells: [], width: box.width, originalIndex: peers.indexOf(item)};
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId || !session) return;
      if (!session.started) {
        if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < DRAG_THRESHOLD) return;
        session.started = true;
        doc.documentElement.setAttribute('data-sf-sortable-active', '');
        const ghost = item.cloneNode(true);
        ghost.removeAttribute('id');
        for (const element of ghost.querySelectorAll('[id]')) element.removeAttribute('id');
        ghost.classList.add('sf-sortable-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        Object.assign(ghost.style, {width: `${box.width}px`, height: `${box.height}px`, left: `${box.left}px`, top: `${box.top}px`});
        doc.body.append(ghost);
        session.ghost = ghost;
        session.offset = {x: start.x - box.left, y: start.y - box.top};
        session.cells = cellsOf(item).filter(Boolean);
        for (const cell of session.cells) cell.setAttribute('data-sf-sortable-column-source', '');
      }
      moveEvent.preventDefault();
      Object.assign(session.ghost.style, {left: `${moveEvent.clientX - session.offset.x}px`, top: `${moveEvent.clientY - session.offset.y}px`});
      autoScroll(moveEvent.clientX);
      place(moveEvent.clientX);
    };
    globalThis.addEventListener('pointermove', move, {signal: pending.signal, passive: false});
    globalThis.addEventListener('pointerup', (upEvent) => { if (upEvent.pointerId === event.pointerId) end(true); }, {signal: pending.signal});
    globalThis.addEventListener('pointercancel', () => end(false), {signal: pending.signal});
    globalThis.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Escape' && session?.started) { keyEvent.preventDefault(); keyEvent.stopPropagation(); end(false); }
    }, {signal: pending.signal, capture: true});
  }, {signal: abort.signal});

  return () => {
    end(false);
    abort.abort();
    live.remove();
  };
}

export default { activeSortableSession, attachSortable, defineSortable, registerSortableDropTarget, sortableIndexAt };
