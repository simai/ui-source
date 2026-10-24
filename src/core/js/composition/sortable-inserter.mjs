// The insertion point of sf-sortable and the inserter it opens. A block editor
// asks for a "+" exactly where the next block goes -- between two rows, before
// the first, after the last -- that opens a searchable list of the kinds of
// thing that can go there (simai/ui-source#21; ui-mail redesign F4, 2026-10-22:
// "Добавить" always appended to the end, so every insert needed a later move).
// It is the same need in every editor built on a list -- mail, Docara studio,
// admin forms -- so it belongs to the list, not to each editor.
//
// The component reports the choice and creates nothing: the host hears
// sf-sortable-insert with the place and the kind, builds the item and puts it
// in the list, exactly as it applies sf-sortable-intent. The inserter is the
// Framework's standard menu (sf-context-menu, opened with openFor and its own
// local search), so its rows, its keys, its top layer and its Escape are the
// ones every other menu has; nothing here draws a second popover.
//
// It is opt-in: a list without inserter items gets a controller that draws
// nothing and listens to nothing, so every list written before is the list it
// was, its drag included. The drag module itself (sortable.mjs) is not changed:
// the element is extended here (withSortableInserter).
import { pageText } from '../page-language.js';
import { activeSortableSession } from './sortable.mjs';

export const SORTABLE_INSERT_EVENT = 'sf-sortable-insert';

const ITEM = '[data-sf-sortable-item]';

const MESSAGES = {
  ru: {
    point: 'Вставить: позиция {index} из {total}',
    menu: 'Вставить',
    search: 'Найти',
    empty: 'Ничего не найдено',
    inserted: 'Вставлено: {item}, позиция {index} в «{list}».',
    hint: 'Плюс — вставить после.',
  },
  en: {
    point: 'Insert: position {index} of {total}',
    menu: 'Insert',
    search: 'Find',
    empty: 'Nothing found',
    inserted: 'Inserted {item} at position {index} in “{list}”.',
    hint: 'Plus to insert after.',
  },
};

const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
const text = (key) => pageText(MESSAGES, key, undefined, 'sf-sortable');

function items(list) {
  return [...list.querySelectorAll(ITEM)].filter((item) => item.closest('sf-sortable') === list);
}

function listName(list) {
  return list.getAttribute('label') || list.getAttribute('aria-label') || list.getAttribute('group') || '';
}

// The same test the drag uses: two items side by side on one row make a grid,
// and a grid is read row by row.
function isWrapped(all) {
  for (let position = 1; position < all.length; position += 1) {
    const previous = all[position - 1].getBoundingClientRect();
    const current = all[position].getBoundingClientRect();
    if (current.top < previous.bottom - 1 && current.left >= previous.right - 1) return true;
  }
  return false;
}

/**
 * Where the place `index` is, in viewport coordinates: a line across the list
 * (axis "y", a vertical list), down it (axis "x", a horizontal one), or down the
 * side of one cell of a grid. `at` is the line's position on its axis -- the
 * middle of the gap between two items, so the point sits on the gap and not on
 * either item -- and `start`/`end` its extent across.
 */
export function insertionGeometry(list, all, index) {
  const box = list.getBoundingClientRect();
  const inner = {
    left: box.left + list.clientLeft, top: box.top + list.clientTop,
    width: list.clientWidth, height: list.clientHeight,
  };
  const horizontal = list.getAttribute('orientation') === 'horizontal';
  const before = all[index]?.getBoundingClientRect();
  const after = all[index - 1]?.getBoundingClientRect();
  if (!horizontal && isWrapped(all)) {
    const cell = before ?? after;
    if (!cell) return { axis: 'y', at: inner.top + inner.height / 2, start: inner.left, end: inner.left + inner.width };
    const sameRow = before && after && after.top < before.bottom - 1 && before.left >= after.right - 1;
    const at = before ? (sameRow ? (after.right + before.left) / 2 : before.left) : after.right;
    return { axis: 'x', at, start: cell.top, end: cell.bottom };
  }
  if (horizontal) {
    const at = before && after ? (after.right + before.left) / 2 : before ? before.left : after ? after.right : inner.left + inner.width / 2;
    return { axis: 'x', at, start: inner.top, end: inner.top + inner.height };
  }
  const at = before && after ? (after.bottom + before.top) / 2 : before ? before.top : after ? after.bottom : inner.top + inner.height / 2;
  return { axis: 'y', at, start: inner.left, end: inner.left + inner.width };
}

/**
 * The place nearest a pointer, and how far it is: across a vertical list only
 * the height counts, along a horizontal one only the width; a grid's place is
 * a side of a cell and counts only on that cell's row.
 */
export function nearestInsertion(list, all, x, y) {
  let best = null;
  for (let index = 0; index <= all.length; index += 1) {
    const place = insertionGeometry(list, all, index);
    const along = place.axis === 'y' ? y : x;
    const across = place.axis === 'y' ? x : y;
    if (across < place.start || across > place.end) continue;
    const distance = Math.abs(along - place.at);
    if (!best || distance < best.distance) best = { index, distance, place };
  }
  return best;
}

function toEntries(list) {
  return list.inserterItems.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    if (item.type === 'separator') return [{ type: 'separator' }];
    if (item.type === 'heading') return [{ type: 'heading', text: String(item.label ?? '') }];
    if (item.value === undefined || item.value === null) return [];
    return [{
      id: String(item.value), text: String(item.label ?? item.value),
      icon: item.icon || undefined, caption: item.caption || undefined,
      keywords: item.keywords || undefined, disabled: Boolean(item.disabled),
    }];
  });
}

/**
 * The controller one list owns. connect/disconnect follow the list; refresh
 * follows its inserter items; ensure follows a host redraw of its children.
 */
export function createSortableInserter(list) {
  let connected = false;
  let active = false;
  let wiring = null;
  let control = null;
  let button = null;
  let menu = null;
  let menuIndex = 0;
  // The place the point stands at, and why it is shown: a pointer near a gap,
  // a focused row (its place after it), the point's own focus or its menu.
  let point = 0;
  let hover = null;
  let rowFocus = null;

  const document_ = () => globalThis.document;
  const count = () => items(list).length;
  const clamp = (index) => Math.max(0, Math.min(count(), index));

  function build() {
    control = document_().createElement('div');
    control.className = 'sf-sortable-insert';
    control.setAttribute('data-sf-sortable-insert', '');
    // A native icon button of the Framework's smallest rung: its height, its
    // glyph and its padding are the ladder's (1/3), and its look is the quiet
    // surface one a row action has, so it reads the same on any canvas.
    button = document_().createElement('button');
    button.type = 'button';
    button.className = 'sf-icon-button sf-icon-button--icon sf-icon-button--surface sf-icon-button--on-surface sf-icon-button--size-1/3 sf-sortable-insert-button';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    const glyph = document_().createElement('i');
    glyph.className = 'sf-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = 'add';
    button.append(glyph);
    control.append(button);
  }

  // The point after the last item in the document, so it is the list's last tab
  // stop: Tab from the last row reaches it and Tab from it leaves the list, and
  // nothing is trapped. A host that appends its redrawn items after the
  // component's own nodes would otherwise put the point in front of them.
  function ensure() {
    if (!active || !control) return;
    const last = items(list).at(-1);
    const misplaced = control.parentNode !== list
      || Boolean(last && (control.compareDocumentPosition(last) & globalThis.Node.DOCUMENT_POSITION_FOLLOWING));
    if (misplaced) {
      const focused = document_().activeElement === button;
      list.append(control);
      // Moving a focused node drops its focus; the person keeps their place.
      if (focused) button.focus({ preventScroll: true });
    }
    // The rows moved under it: the place is measured again.
    place();
  }

  function shownReason() {
    if (activeSortableSession()) return null;
    if (menu?.isOpen) return 'menu';
    if (document_().activeElement === button) return 'focus';
    if (hover !== null) return 'hover';
    if (rowFocus !== null) return 'row';
    return null;
  }

  function place() {
    if (!active || !control) return;
    const reason = shownReason();
    if (reason === 'hover') point = hover;
    else if (reason === 'row') point = rowFocus;
    point = clamp(point);
    const all = items(list);
    const geometry = insertionGeometry(list, all, point);
    const box = list.getBoundingClientRect();
    const originX = box.left + list.clientLeft - list.scrollLeft;
    const originY = box.top + list.clientTop - list.scrollTop;
    control.dataset.axis = geometry.axis;
    if (geometry.axis === 'y') {
      Object.assign(control.style, { left: `${geometry.start - originX}px`, top: `${geometry.at - originY}px`, width: `${geometry.end - geometry.start}px`, height: '0px' });
    } else {
      Object.assign(control.style, { left: `${geometry.at - originX}px`, top: `${geometry.start - originY}px`, width: '0px', height: `${geometry.end - geometry.start}px` });
    }
    control.toggleAttribute('data-shown', Boolean(reason));
    control.dataset.index = String(point);
    button.setAttribute('aria-label', format(text('point'), { index: point + 1, total: all.length + 1 }));
  }

  // Pointer: the point comes to the gap the pointer is near, within half the
  // point's own height of it -- near enough to mean the gap, not the row.
  function onPointerMove(event) {
    if (event.buttons || activeSortableSession() || menu?.isOpen) return;
    if (control.contains(event.target)) return;
    const zone = Math.max(button.offsetHeight, button.offsetWidth) / 2;
    const nearest = nearestInsertion(list, items(list), event.clientX, event.clientY);
    const next = nearest && nearest.distance <= zone ? nearest.index : null;
    if (next === hover) return;
    hover = next;
    place();
  }

  function onPointerLeave() {
    if (hover === null) return;
    hover = null;
    place();
  }

  // A focused row shows the place after it: the place its "+" key opens, and
  // the one a tap on a touch screen, which has no hover, can reach.
  function onFocusIn(event) {
    const item = event.target.closest?.(ITEM);
    if (event.target === button) {
      place();
      return;
    }
    rowFocus = item && item.closest('sf-sortable') === list ? items(list).indexOf(item) + 1 : null;
    place();
  }

  function onFocusOut() {
    globalThis.setTimeout(() => {
      if (!connected) return;
      if (!list.contains(document_().activeElement)) rowFocus = null;
      place();
    }, 0);
  }

  // The point's own keys: the arrows of the list's direction walk the places,
  // Home and End go to the first and the last, and each step is said. Enter
  // and Space are the button's own.
  function onButtonKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const horizontal = list.getAttribute('orientation') === 'horizontal';
    const rtl = globalThis.getComputedStyle(list).direction === 'rtl';
    const steps = horizontal
      ? { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -1, ArrowDown: 1 }
      : { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 };
    let next = null;
    if (event.key in steps) next = point + steps[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count();
    if (next === null) return;
    event.preventDefault();
    hover = null;
    rowFocus = null;
    point = clamp(next);
    place();
    list.announce?.(format(text('point'), { index: point + 1, total: count() + 1 }));
  }

  function onButtonClick(event) {
    event.preventDefault();
    if (menu?.isOpen) {
      menu.close();
      return;
    }
    open(point);
  }

  async function standardMenu() {
    if (menu?.isConnected) return menu;
    const registry = globalThis.customElements;
    if (!registry.get('sf-context-menu')) {
      globalThis.SF?.Loader?.ensurePlugin?.('cl-context-menu');
      await Promise.race([registry.whenDefined('sf-context-menu'), new Promise((done) => { globalThis.setTimeout(done, 3000); })]);
    }
    if (!registry.get('sf-context-menu')) return null;
    menu = document_().createElement('sf-context-menu');
    menu.setAttribute('popup', '');
    menu.addEventListener('sf-context-menu-select', onSelect);
    menu.addEventListener('sf-context-menu-close', () => { button?.setAttribute('aria-expanded', 'false'); place(); });
    // Enter in the search takes the first row it left: whoever typed the name
    // of what they want has chosen it. The menu's own Enter is a row's.
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.target !== menu.searchField?.()) return;
      event.preventDefault();
      menu.syncMenuItems?.();
      menu.availableMenuItems?.()[0]?.click();
    });
    (list.closest('dialog[open]') || document_().body).append(menu);
    return menu;
  }

  /** Opens the inserter for the place `index` (0 before the first item). */
  async function open(index) {
    if (!active || activeSortableSession()) return false;
    point = clamp(index);
    hover = null;
    place();
    const surface = await standardMenu();
    if (!surface || !active) return false;
    menuIndex = point;
    surface.setAttribute('aria-label', listName(list) ? `${text('menu')}: ${listName(list)}` : text('menu'));
    surface.search = { placeholder: text('search'), empty: text('empty') };
    surface.entries = toEntries(list);
    const opened = await surface.openFor(button, { side: 'block-end', align: 'start', focus: 'first' });
    place();
    return opened;
  }

  // A choice is the host's to apply: it hears the place and the kind, and a
  // refusal (preventDefault) leaves the inserter open for another choice. The
  // menu is closed here rather than by itself, so a host that moved focus to
  // the item it just inserted keeps it there.
  function onSelect(event) {
    event.preventDefault();
    const entry = event.detail?.entry;
    if (!entry || entry.id === undefined || entry.id === null) return;
    const index = menuIndex;
    const accepted = list.dispatchEvent(new globalThis.CustomEvent(SORTABLE_INSERT_EVENT, {
      bubbles: true, composed: true, cancelable: true,
      detail: Object.freeze({ index, item: entry.id, to: list.getAttribute('id') || list.getAttribute('group') || '' }),
    }));
    if (!accepted) return;
    list.announce?.(format(text('inserted'), { item: entry.text ?? entry.id, index: index + 1, list: listName(list) }));
    // The next insert goes after this one, so a run of choices builds in order.
    point = index + 1;
    const focusMoved = !menu.contains(document_().activeElement);
    menu.close({ restoreFocus: !focusMoved });
  }

  function onItemKeyDown(event, item) {
    if (!active || event.key !== '+' || event.altKey || event.ctrlKey || event.metaKey) return false;
    event.preventDefault();
    open(items(list).indexOf(item) + 1);
    return true;
  }

  function onSortableState() {
    hover = null;
    place();
  }

  function mount() {
    if (!control) build();
    wiring = new globalThis.AbortController();
    const options = { signal: wiring.signal };
    list.setAttribute('data-sf-sortable-inserter', '');
    list.addEventListener('pointermove', onPointerMove, options);
    list.addEventListener('pointerleave', onPointerLeave, options);
    list.addEventListener('focusin', onFocusIn, options);
    list.addEventListener('focusout', onFocusOut, options);
    list.addEventListener('sf-sortable-state', onSortableState, options);
    button.addEventListener('keydown', onButtonKeyDown, options);
    button.addEventListener('click', onButtonClick, options);
    // The icon button's look and the glyph's font are component stylesheets:
    // asked for here, and named as relations of the rule, so a page without
    // them still gets them.
    globalThis.SF?.Loader?.ensurePlugin?.('icon-buttons');
    globalThis.SF?.Loader?.ensurePlugin?.('icons');
    active = true;
    ensure();
    place();
  }

  function unmount() {
    active = false;
    wiring?.abort();
    wiring = null;
    menu?.close?.({ restoreFocus: false });
    control?.remove();
    list.removeAttribute('data-sf-sortable-inserter');
    hover = null;
    rowFocus = null;
  }

  function refresh() {
    const wanted = connected && list.inserterItems.length > 0;
    if (wanted && !active) mount();
    else if (!wanted && active) unmount();
    else if (wanted && menu?.isOpen) menu.entries = toEntries(list);
    list.updateInstructions?.();
  }

  return {
    connect() { connected = true; refresh(); },
    disconnect() {
      connected = false;
      if (active) unmount();
      menu?.remove();
      menu = null;
    },
    refresh,
    ensure,
    open,
    onItemKeyDown,
    instructions: () => (active ? text('hint') : ''),
    get active() { return active; },
    get index() { return point; },
  };
}

/**
 * sf-sortable with an inserter: the drag element of sortable.mjs, extended.
 * It is an extension rather than an edit of that module because the
 * composition overlay's bundle carries sortable.mjs too (for the shared drag
 * session) and has no use for an inserter; extending it here keeps the
 * inserter in the sf-sortable bundle alone and the drag module as it was.
 */
export function withSortableInserter(Base) {
  return class SfSortable extends Base {
    static get observedAttributes() {
      return [...(super.observedAttributes ?? []), 'inserter-items'];
    }

    constructor() {
      super();
      this.inserterController = null;
      this._inserterHint = '';
      // Set before the element was defined, the value sat on the instance and
      // would hide the accessor; it is taken over here, as sf-context-menu
      // takes over its entries.
      if (Object.prototype.hasOwnProperty.call(this, 'inserterItems')) {
        const early = this.inserterItems;
        delete this.inserterItems;
        this._inserterItems = Array.isArray(early) ? early : null;
      }
    }

    // What the inserter offers: [{value, label, icon?, caption?, keywords?,
    // disabled?}], as a property or as JSON in the inserter-items attribute.
    // An empty list is no inserter, and the list is the list it was before.
    get inserterItems() {
      if (Array.isArray(this._inserterItems)) return this._inserterItems;
      const raw = this.getAttribute('inserter-items');
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    set inserterItems(value) {
      this._inserterItems = Array.isArray(value) ? value : null;
      this.inserterController?.refresh();
    }

    attributeChangedCallback(name, previous, next) {
      super.attributeChangedCallback?.(name, previous, next);
      if (name === 'inserter-items' && previous !== next) this.inserterController?.refresh();
    }

    connectedCallback() {
      super.connectedCallback();
      if (!this.inserterController) this.inserterController = createSortableInserter(this);
      this.inserterController.connect();
    }

    disconnectedCallback() {
      this.inserterController?.disconnect();
      super.disconnectedCallback();
    }

    // The instructions every item points at say the inserter's key while the
    // list has one. The drag module writes its own sentence; the hint follows it.
    updateInstructions() {
      if (!this.instructions) return;
      const current = this.instructions.textContent;
      const own = this._inserterHint && current.endsWith(` ${this._inserterHint}`)
        ? current.slice(0, -(this._inserterHint.length + 1))
        : current;
      const hint = this.inserterController?.instructions() || '';
      const next = hint ? `${own} ${hint}` : own;
      this._inserterHint = hint;
      // Written only when it changes: the list observes its own subtree, and a
      // write would wake the observer that called this.
      if (next !== current) this.instructions.textContent = next;
    }

    // A host redraw takes the component's nodes out with its own, or leaves the
    // insertion point in front of the items it appends: both come back.
    ensureAccessibilityNodes() {
      super.ensureAccessibilityNodes();
      this.updateInstructions();
      this.inserterController?.ensure();
    }

    // The inserter's key on a row ("+": insert after it) comes before the
    // drag's keys; anything else is the drag's.
    onKeyDown(event) {
      const item = event.target.closest?.(ITEM);
      if (!activeSortableSession() && item && item.closest('sf-sortable') === this && event.target === item
          && this.inserterController?.onItemKeyDown(event, item)) return;
      super.onKeyDown(event);
    }
  };
}

// The registry sf-sortable is defined in, through which it is defined with its
// inserter: defineSortable takes the registry it defines into.
export function inserterRegistry(registry = globalThis.customElements) {
  return {
    get: (name) => registry.get(name),
    define: (name, Base, options) => registry.define(name, withSortableInserter(Base), options),
  };
}

export default { SORTABLE_INSERT_EVENT, createSortableInserter, inserterRegistry, insertionGeometry, nearestInsertion, withSortableInserter };
