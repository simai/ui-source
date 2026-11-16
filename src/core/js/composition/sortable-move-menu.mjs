// The handle's menu of sf-sortable (owner C171 (1), 2026-11-14): a press on a
// row's handle -- a press that did not become a drag -- opens the standard
// menu «Выше · Ниже · В начало · В конец». A person who cannot drag, or who
// does not want to carry a row down a long list, moves it in one choice; the
// keyboard path on the row stays as it was. Nothing is moved here: the choice
// asks the host with the very request a drag ends with (sf-sortable-move) and
// is said with the same words.
//
// The menu is sf-menu-context, fetched on the first press (it is a lazy
// relation of the rule already, for the inserter), so its rows, keys, top layer
// and Escape are every menu's. Like the inserter, this is an extension of the
// drag element in the sf-sortable bundle only: the editor overlay's bundle
// carries the drag module and has handles of its own.
import { pageText } from '../page-language.js';
import { activeSortableSession, requestSortableMove } from './sortable.mjs';
import { standardMenu as placeStandardMenu } from '../overflow-row.js';

const ITEM = '[data-sf-sortable-item]';
const HANDLE = '[data-sf-sortable-handle]';

const MESSAGES = {
  ru: {
    'move-menu': 'Переместить «{item}»',
    'move-up': 'Выше',
    'move-down': 'Ниже',
    'move-first': 'В начало',
    'move-last': 'В конец',
  },
  en: {
    'move-menu': 'Move “{item}”',
    'move-up': 'Up',
    'move-down': 'Down',
    'move-first': 'To the top',
    'move-last': 'To the bottom',
  },
};

const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
const text = (key) => pageText(MESSAGES, key, undefined, 'sf-sortable');

function items(list) {
  return [...list.querySelectorAll(ITEM)].filter((item) => item.closest('sf-sortable') === list);
}

function itemLabel(item) {
  if (item.getAttribute('aria-label')) return item.getAttribute('aria-label');
  const clone = item.cloneNode(true);
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"], .sf-sortable-live')) hidden.remove();
  return clone.textContent.replace(/\s+/gu, ' ').trim();
}

// The control a handle is: itself when it is a button, else the button inside
// it (sf-button-icon draws one), else the handle element.
function controlOf(handle) {
  if (handle.matches('button')) return handle;
  return handle.querySelector('button') || handle;
}

/** The places a move menu offers for the item at `index` of `count`. */
export function moveMenuEntries(index, count) {
  const last = count - 1;
  return [
    { id: 'up', text: text('move-up'), icon: 'arrow_upward', disabled: index <= 0 },
    { id: 'down', text: text('move-down'), icon: 'arrow_downward', disabled: index >= last },
    { type: 'separator' },
    { id: 'first', text: text('move-first'), icon: 'vertical_align_top', disabled: index <= 0 },
    { id: 'last', text: text('move-last'), icon: 'vertical_align_bottom', disabled: index >= last },
  ];
}

/** The place an entry moves the item at `index` of `count` to. */
export function moveMenuTarget(id, index, count) {
  return { up: index - 1, down: index + 1, first: 0, last: count - 1 }[id] ?? index;
}

export function createSortableMoveMenu(list) {
  let wiring = null;
  let menu = null;
  let current = null;

  function prepare(only = null) {
    for (const item of only ? [only] : items(list)) {
      const handle = item.querySelector(HANDLE);
      if (!handle) continue;
      const control = controlOf(handle);
      if (!control.hasAttribute('aria-haspopup')) control.setAttribute('aria-haspopup', 'menu');
      if (!control.hasAttribute('aria-expanded')) control.setAttribute('aria-expanded', 'false');
    }
  }

  // The standard menu, placed by core's one helper (overflow-row.js
  // standardMenu, defect TL-8), held on the list.
  async function standardMenu() {
    menu = await placeStandardMenu(list, '_sfMoveMenu', null, {
      setup(surface) {
        surface.addEventListener('sf-menu-context-select', onSelect);
        surface.addEventListener('sf-menu-context-closed', () => {
          if (current?.control) current.control.setAttribute('aria-expanded', 'false');
        });
      },
    });
    return menu;
  }

  async function open(item, handle) {
    if (activeSortableSession()) return false;
    const all = items(list);
    const index = all.indexOf(item);
    if (index < 0) return false;
    const control = controlOf(handle);
    const surface = await standardMenu();
    if (!surface) return false;
    if (surface.isOpen && current?.item === item) {
      surface.close();
      return false;
    }
    current = { item, control, id: item.getAttribute('data-sf-sortable-item') };
    surface.setAttribute('aria-label', format(text('move-menu'), { item: itemLabel(item) }));
    surface.entries = moveMenuEntries(index, all.length);
    control.setAttribute('aria-expanded', 'true');
    await surface.openFor(control, { side: 'block-end', align: 'start', focus: 'first' });
    return true;
  }

  // The choice asks the host; focus comes back to the moved row's handle once
  // the host has redrawn the list, wherever the row now stands.
  function onSelect(event) {
    event.preventDefault();
    const id = event.detail?.entry?.id;
    const chosen = current;
    if (!chosen || !id) return;
    const all = items(list);
    const index = all.indexOf(chosen.item);
    if (index >= 0) requestSortableMove(list, chosen.item, moveMenuTarget(id, index, all.length));
    menu.close({ restoreFocus: false });
    const back = () => {
      const escape = globalThis.CSS?.escape ? globalThis.CSS.escape(chosen.id) : chosen.id;
      const row = list.querySelector(`[data-sf-sortable-item="${escape}"]`);
      const handle = row?.querySelector(HANDLE);
      const control = handle ? controlOf(handle) : null;
      // A handle that is a picture (a glyph, no control) gives focus to its row.
      const target = control && (control.matches('button') || control.tabIndex >= 0) ? control : row;
      target?.focus?.({ preventScroll: false });
    };
    if (typeof globalThis.requestAnimationFrame !== 'function') back();
    else globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(back));
  }

  // A click on a handle is a press that did not become a drag: the drag module
  // swallows the click a drop ends with.
  function onClick(event) {
    const handle = event.target.closest?.(HANDLE);
    const item = handle?.closest(ITEM);
    if (!handle || !item || item.closest('sf-sortable') !== list) return;
    event.preventDefault();
    open(item, handle);
  }

  return {
    connect() {
      if (wiring) return;
      wiring = new globalThis.AbortController();
      list.addEventListener('click', onClick, { signal: wiring.signal });
      prepare();
    },
    disconnect() {
      wiring?.abort();
      wiring = null;
      menu?.close?.({ restoreFocus: false });
      menu?.remove();
      menu = null;
    },
    prepare,
    open,
  };
}

/** sf-sortable with the handle's move menu: the drag element, extended. */
export function withSortableMoveMenu(Base) {
  return class SfSortable extends Base {
    connectedCallback() {
      super.connectedCallback();
      if (!this.moveMenuController) this.moveMenuController = createSortableMoveMenu(this);
      this.moveMenuController.connect();
    }

    disconnectedCallback() {
      this.moveMenuController?.disconnect();
      super.disconnectedCallback();
    }

    // Handles the host adds later say they open a menu as well.
    prepareItem(item) {
      super.prepareItem(item);
      if (item && item.closest('sf-sortable') === this) this.moveMenuController?.prepare(item);
    }
  };
}

// A registry that defines sf-sortable with the move menu, over another one
// (the inserter's): defineSortable takes the registry it defines into.
export function moveMenuRegistry(registry = globalThis.customElements) {
  return {
    get: (name) => registry.get(name),
    define: (name, Base, options) => registry.define(name, withSortableMoveMenu(Base), options),
  };
}

export default { createSortableMoveMenu, moveMenuEntries, moveMenuRegistry, moveMenuTarget, withSortableMoveMenu };
