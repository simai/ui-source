// One Tab stop for a row of controls, and the arrows between them (owner
// decision C184 (1)-(3), 2026-11-14; study control/research/2026-11-14-
// toolbar-menu-open.md, K-02). A toolbar is not a component of its own
// (C155 (8): no sf-toolbar): it is ordinary sf-button-icon groups, 4 apart
// inside a group and a separator between groups (C144), and this helper gives
// them the keyboard of the WAI-ARIA toolbar pattern:
//
// - the row is one Tab stop; Tab comes back to the control the person left
//   (memory, C184 (3)), or to the first one (memory: false);
// - the arrows of the row's orientation move between the controls, in the
//   row's direction (right-to-left reverses ← and →), Home and End go to the
//   ends, and the walk wraps;
// - a control that cannot be used now (aria-disabled) stays in the walk,
//   dimmed by its component, with its reason as a tooltip (C184 (2), as
//   C164 (4) does for a menu row); disabled: 'skip' leaves it out. A control
//   with the native disabled attribute cannot take the focus and is skipped;
// - a control inside «Ещё» (the C155 row engine marks the part that left the
//   row with .out or [hidden]) is not in the walk;
// - ↓ (↑) on a menu button of a horizontal row opens its menu, as the
//   pattern's menu button does.
//
// It is also the list's keyboard (C184 (5)): a list is one Tab stop and ↑ ↓
// move between its rows (orientation 'vertical').
//
// roving(container, options) -> {refresh, set, current, items, destroy}.
// The look stays with the components; this module holds no state of its own
// outside the controller it returns, so every bundle may carry its own copy.

const NATIVE_FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable=""], [contenteditable="true"]';
const OUT = '.out, [hidden], [data-sf-out], [inert]';

// The element that takes the focus for an item: the item itself when it can
// (a <button>, a row with a tabindex), else the control inside it -- an
// sf-button-icon host draws a <button> and is display: contents.
export function focusTarget(item) {
  if (!item) return null;
  if (item.matches?.(NATIVE_FOCUSABLE)) return item;
  return item.querySelector?.('button, a[href], [role="button"], [tabindex]') ?? item;
}

const isUnavailable = (target) => target.getAttribute?.('aria-disabled') === 'true';
const isDisabled = (target) => Boolean(target.disabled) || target.matches?.(':disabled');

export function roving(container, {
  items: itemsOf = 'button',
  orientation = 'horizontal',
  wrap = true,
  disabled = 'focusable',
  memory = true,
  out = OUT,
  onMove = null,
  observe = true,
} = {}) {
  let current = null;

  // Every item of the row, in order, as the targets that take the focus.
  const all = () => {
    const found = typeof itemsOf === 'function' ? itemsOf() : [...container.querySelectorAll(itemsOf)];
    const targets = [];
    for (const item of found) {
      const target = focusTarget(item);
      if (!target || !container.contains(target) || targets.includes(target)) continue;
      // Out of the row: a part inside it that left (into «Ещё») or is
      // hidden. The row itself being hidden for now does not count.
      const away = target.closest(out);
      if (away && away !== container && container.contains(away)) continue;
      targets.push(target);
    }
    return targets;
  };
  // The items the walk stops on.
  const items = () => all().filter((target) => !isDisabled(target) && (disabled === 'focusable' || !isUnavailable(target)));

  function set(element) {
    const target = focusTarget(element);
    const every = all();
    if (!target || !every.includes(target)) return;
    current = target;
    for (const other of every) {
      const next = other === target ? '0' : '-1';
      if (other.getAttribute('tabindex') !== next) other.setAttribute('tabindex', next);
    }
  }

  // After a drawing or a change of the row: the one Tab stop is the item
  // remembered, or the first one when it is gone (or the row forgets).
  function refresh() {
    const list = items();
    if (!list.length) {
      // Nothing to stop on: no item keeps a stop either (a disabled field's
      // toolbar is not a Tab stop).
      for (const other of all()) if (other.getAttribute('tabindex') !== '-1') other.setAttribute('tabindex', '-1');
      current = null;
      return;
    }
    set(current && list.includes(current) ? current : list[0]);
  }

  const vertical = orientation === 'vertical';
  const both = orientation === 'both';

  function onKeydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = items();
    const target = list.find((one) => one === event.target || one.contains(event.target));
    if (!target) return;
    // A field inside an item (a link's address) keeps its own keys.
    if (event.target !== target && event.target.matches?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
    const rtl = getComputedStyle(container).direction === 'rtl';
    const forward = vertical ? ['ArrowDown'] : both ? ['ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight'] : [rtl ? 'ArrowLeft' : 'ArrowRight'];
    const back = vertical ? ['ArrowUp'] : both ? ['ArrowUp', rtl ? 'ArrowRight' : 'ArrowLeft'] : [rtl ? 'ArrowRight' : 'ArrowLeft'];
    const at = list.indexOf(target);
    let next = null;
    if (!vertical && !both && (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      && target.getAttribute('aria-haspopup') === 'menu' && !isUnavailable(target)) {
      event.preventDefault();
      target.click();
      return;
    }
    if (forward.includes(event.key)) next = at + 1 < list.length ? list[at + 1] : wrap ? list[0] : null;
    else if (back.includes(event.key)) next = at > 0 ? list[at - 1] : wrap ? list[list.length - 1] : null;
    else if (event.key === 'Home') next = list[0];
    else if (event.key === 'End') next = list[list.length - 1];
    else return;
    event.preventDefault();
    if (!next || next === target) return;
    set(next);
    next.focus();
    onMove?.(next, event.key);
  }

  function onFocusIn(event) {
    const target = all().find((one) => one === event.target);
    if (!target || target === current) return;
    set(target);
    onMove?.(target, 'focus');
  }

  function onFocusOut(event) {
    if (memory || container.contains(event.relatedTarget)) return;
    const list = items();
    if (list.length) set(list[0]);
  }

  container.addEventListener('keydown', onKeydown);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);
  // Items drawn later -- a host that draws its <button> on its own schedule
  // (sf-button-icon), a row added -- join the walk with tabindex -1 at once:
  // the row stays one Tab stop whatever draws when.
  let queued = false;
  const watcher = observe && typeof MutationObserver === 'function'
    ? new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; refresh(); });
    })
    : null;
  watcher?.observe(container, {childList: true, subtree: true});
  refresh();

  return {
    refresh,
    set,
    items,
    get current() { return current; },
    destroy() {
      watcher?.disconnect();
      container.removeEventListener('keydown', onKeydown);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
    },
  };
}

export default roving;
