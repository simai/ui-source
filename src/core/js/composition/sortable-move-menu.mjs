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
import { activeSortableSession, attachSortable, requestSortableMove, requestSortableTransfer, sortableItemLabel, sortableMoveTargets } from './sortable.mjs';
import { menuOpen } from '../menu-open.js';
import { standardMenu as placeStandardMenu } from '../overflow-row.js';

const ITEM = '[data-sf-sortable-item]';
const HANDLE = '[data-sf-sortable-handle]';

const MESSAGES = {
  en: {
    'move-menu': 'Move “{item}”',
    'move-up': 'Up',
    'move-down': 'Down',
    'move-first': 'To the top',
    'move-last': 'To the bottom',
    'move-to': 'Move to',
  },
};

const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));
const text = (key) => pageText(MESSAGES, key, undefined, 'sf-sortable');

function items(list) {
  return [...list.querySelectorAll(ITEM)].filter((item) => item.closest('sf-sortable') === list);
}

// The item's name, read as sortable.mjs reads it (blocks joined by commas).
const itemLabel = (item) => sortableItemLabel(item);

// The control a handle is: itself when it is a button, else the button inside
// it (sf-button-icon draws one), else the handle element.
function controlOf(handle) {
  if (handle.matches('button')) return handle;
  return handle.querySelector('button') || handle;
}

/**
 * The places a move menu offers for the item at `index` of `count`, and, when
 * the item can go to other lists (BV-7), «Move to» with a submenu of the
 * lists of its group: `targets` [{label, current, reason}] in the page's
 * order; the list it is in is checked and disabled, a list the host refused
 * is disabled with the host's reason as its caption (the menu reads it, C164
 * (4)). A row of the submenu is `to:<n>`, n the target's place in `targets`.
 */
export function moveMenuEntries(index, count, targets = []) {
  const last = count - 1;
  const entries = [
    { id: 'up', text: text('move-up'), icon: 'arrow_upward', disabled: index <= 0 },
    { id: 'down', text: text('move-down'), icon: 'arrow_downward', disabled: index >= last },
    { type: 'separator' },
    { id: 'first', text: text('move-first'), icon: 'vertical_align_top', disabled: index <= 0 },
    { id: 'last', text: text('move-last'), icon: 'vertical_align_bottom', disabled: index >= last },
  ];
  if (targets.some((target) => !target.current)) {
    entries.push({ type: 'separator' }, {
      id: 'to', text: text('move-to'), icon: 'arrow_forward',
      submenu: targets.map((target, at) => ({
        id: `to:${at}`, text: target.label,
        ...(target.current ? { checked: true } : {}),
        disabled: Boolean(target.current || target.reason),
        ...(!target.current && target.reason ? { caption: target.reason } : {}),
      })),
    });
  }
  return entries;
}

/** The target a `to:<n>` row stands for, or null. */
export function moveMenuTransfer(id, targets) {
  const match = /^to:(\d+)$/u.exec(String(id || ''));
  const target = match ? targets[Number(match[1])] : null;
  return target && !target.current && !target.reason ? target : null;
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
          if (current?.control && current.control !== current.item) current.control.setAttribute('aria-expanded', 'false');
        });
      },
    });
    return menu;
  }

  // control: the handle's control a press opened the menu from, or the item
  // itself for the menu key (Shift+F10, ContextMenu).
  async function open(item, control) {
    if (activeSortableSession()) return false;
    const all = items(list);
    const index = all.indexOf(item);
    if (index < 0) return false;
    const surface = await standardMenu();
    if (!surface) return false;
    if (surface.isOpen && current?.item === item) {
      surface.close();
      return false;
    }
    const targets = sortableMoveTargets(list, item);
    current = { item, control, targets, id: item.getAttribute('data-sf-sortable-item') };
    surface.setAttribute('aria-label', format(text('move-menu'), { item: itemLabel(item) }));
    surface.entries = moveMenuEntries(index, all.length, targets);
    // The item itself (the menu key) says nothing of a popup: it is not a button.
    if (control !== item) control.setAttribute('aria-expanded', 'true');
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
    const transfer = moveMenuTransfer(id, chosen.targets || []);
    if (transfer) requestSortableTransfer(list, chosen.item, transfer.list);
    // «Move to» itself, or a target that is not a choice, opens or does nothing.
    else if (id === 'to' || /^to:/u.test(String(id))) return;
    else if (index >= 0) requestSortableMove(list, chosen.item, moveMenuTarget(id, index, all.length));
    menu.close({ restoreFocus: false });
    const back = () => {
      const escape = globalThis.CSS?.escape ? globalThis.CSS.escape(chosen.id) : chosen.id;
      const selector = `[data-sf-sortable-item="${escape}"]`;
      // Sent to another list, the row is found there.
      const row = list.querySelector(selector) || (transfer ? globalThis.document.querySelector(selector) : null);
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
    open(item, controlOf(handle));
  }

  // The menu key on an item (Shift+F10, ContextMenu) opens the same menu, at
  // its handle when it has one: the way to «Move to» without a pointer.
  function onKeyDown(event) {
    if (event.defaultPrevented || activeSortableSession()) return;
    if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) return;
    const item = event.target.closest?.(ITEM);
    if (!item || item.closest('sf-sortable') !== list || event.target !== item) return;
    event.preventDefault();
    const handle = item.querySelector(HANDLE);
    open(item, handle ? controlOf(handle) : item);
  }

  return {
    connect() {
      if (wiring) return;
      wiring = new globalThis.AbortController();
      list.addEventListener('click', onClick, { signal: wiring.signal });
      list.addEventListener('keydown', onKeyDown, { signal: wiring.signal });
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

/**
 * The row mode of SF.Sortable.attach with the handle's menu (C171 (1)): a
 * press on a row's handle that did not become a drag opens the page's one menu
 * (SF.menu.open) with «Выше · Ниже · В начало · В конец», and a choice asks
 * the move through the controller -- the same intent and words a drag ends
 * with; focus comes back to the moved row's handle. The column mode, or rows
 * without a handle selector, are the controller alone.
 */
export function attachSortableWithMenu(container, options = {}) {
  const detach = attachSortable(container, options);
  if (options.orientation !== 'vertical' || !detach.handle || options.moveMenu === false) return detach;
  const wiring = new globalThis.AbortController();
  const handleFor = (target) => {
    const handle = target.closest?.(detach.handle);
    const item = handle?.closest(options.items);
    return handle && item && container.contains(item) ? { handle, item } : null;
  };
  // Handles say they open a menu, those the host draws later as well.
  const prepare = () => {
    for (const handle of container.querySelectorAll(detach.handle)) {
      const control = controlOf(handle);
      if (!control.hasAttribute('aria-haspopup')) control.setAttribute('aria-haspopup', 'menu');
      if (!control.hasAttribute('aria-expanded')) control.setAttribute('aria-expanded', 'false');
    }
  };
  prepare();
  const observer = new globalThis.MutationObserver(prepare);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', async (event) => {
    const found = handleFor(event.target);
    if (!found || activeSortableSession()) return;
    event.preventDefault();
    const peers = detach.members(found.item);
    const index = peers.indexOf(found.item);
    if (index < 0 || peers.length < 2) return;
    const control = controlOf(found.handle);
    control.setAttribute('aria-expanded', 'true');
    const choice = await menuOpen({
      anchor: control,
      entries: moveMenuEntries(index, peers.length),
      label: format(text('move-menu'), { item: detach.labelOf(found.item) }),
    });
    if (control.isConnected) control.setAttribute('aria-expanded', 'false');
    const id = choice?.id;
    if (!id) return;
    // Asked of the item where it stands now: the list may have changed while
    // the menu was open.
    const now = detach.members(found.item);
    const from = now.indexOf(found.item);
    if (from >= 0) detach.move(found.item, moveMenuTarget(id, from, now.length));
  }, { signal: wiring.signal });
  const detachAll = () => {
    wiring.abort();
    observer.disconnect();
    detach();
  };
  detachAll.move = detach.move;
  return detachAll;
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

export default { attachSortableWithMenu, createSortableMoveMenu, moveMenuEntries, moveMenuRegistry, moveMenuTarget, moveMenuTransfer, withSortableMoveMenu };
