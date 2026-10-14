// The width a person changes by an edge, as one behaviour: a drag, the arrow
// keys (Shift: four steps; Home and End: the limits; PageUp and PageDown: four
// steps), Enter or Space and a double click back to the default, a separator's
// role and value, the resize cursor over the whole page while it lasts. What
// the width is the width of -- a panel, a table's column -- and where it is
// kept is the caller's (owner, 2026-10-14: the admin menu's columns and a
// table's columns are the same gesture).
//
// attach(root, options) -> detach()
//   options.handles   a selector: the handles are root's descendants matching
//                     it, found when used (a table redraws its headers);
//                     without it, root is the one handle.
//   options.session(handle) -> {
//     measure(): the width now, in pixels
//     limits(): {min, max} in pixels
//     apply(width, phase): writes it, returns the width written
//     commit(width): the width a drag or a key ended at
//     reset(): back to the default (Enter, Space, a double click)
//     direction(): +1 when a pointer moving right widens, -1 otherwise
//     step: pixels an arrow moves (default 16)
//     start(), end(): around a drag
//   } -- or null, when this handle does not resize now.
const ACTIVE = 'data-sf-resizer-active';

function setValue(handle, session, width = session.measure()) {
  const {min, max} = session.limits();
  handle.setAttribute('aria-valuemin', String(Math.round(min)));
  handle.setAttribute('aria-valuemax', String(Math.round(max)));
  if (width) handle.setAttribute('aria-valuenow', String(Math.round(width)));
}

function clamp(session, width) {
  const {min, max} = session.limits();
  return Math.round(Math.min(Math.max(min, max), Math.max(min, width)));
}

export function attachResizer(root, options = {}) {
  const handleOf = (target) => (options.handles ? target?.closest?.(options.handles) : root);
  const owns = (handle) => handle && (handle === root || root.contains(handle));
  const sessionOf = (handle) => (owns(handle) ? options.session?.(handle) ?? null : null);
  let drag = null;

  const finish = (commit) => {
    const current = drag;
    if (!current) return;
    drag = null;
    globalThis.removeEventListener('pointermove', current.move, true);
    globalThis.removeEventListener('pointerup', current.up, true);
    globalThis.removeEventListener('pointercancel', current.up, true);
    document.documentElement.removeAttribute(ACTIVE);
    delete current.handle.dataset.sfResizing;
    current.session.end?.();
    if (commit && current.width !== Math.round(current.from)) current.session.commit?.(current.width);
  };

  const onPointerDown = (event) => {
    if (event.button > 0 || drag) return;
    const handle = handleOf(event.target);
    const session = sessionOf(handle);
    if (!session) return;
    event.preventDefault();
    event.stopPropagation();
    handle.focus?.({preventScroll: true});
    const from = session.measure();
    const current = {handle, session, pointer: event.pointerId, x: event.clientX, from, width: Math.round(from)};
    current.move = (next) => {
      if (next.pointerId !== current.pointer) return;
      const width = clamp(session, current.from + (next.clientX - current.x) * (session.direction?.() ?? 1));
      if (width === current.width) return;
      current.width = session.apply(width, 'move') ?? width;
      setValue(handle, session, current.width);
    };
    current.up = (next) => {
      if (next.pointerId === current.pointer) finish(true);
    };
    drag = current;
    session.start?.();
    handle.dataset.sfResizing = '';
    document.documentElement.setAttribute(ACTIVE, '');
    globalThis.addEventListener('pointermove', current.move, true);
    globalThis.addEventListener('pointerup', current.up, true);
    globalThis.addEventListener('pointercancel', current.up, true);
  };

  const onKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const handle = handleOf(event.target);
    if (handle !== event.target) return;
    const session = sessionOf(handle);
    if (!session) return;
    const {min, max} = session.limits();
    const now = session.measure();
    const rtl = getComputedStyle(handle).direction === 'rtl';
    const sign = session.direction?.() ?? 1;
    const step = (session.step ?? 16) * (event.shiftKey ? 4 : 1);
    const right = (rtl ? -1 : 1) * sign;
    let next = null;
    if (event.key === 'ArrowRight') next = now + step * right;
    else if (event.key === 'ArrowLeft') next = now - step * right;
    else if (event.key === 'PageUp') next = now + step * 4;
    else if (event.key === 'PageDown') next = now - step * 4;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      session.reset?.();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    const width = session.apply(clamp(session, next), 'end') ?? clamp(session, next);
    setValue(handle, session, width);
    session.commit?.(width);
  };

  const onDoubleClick = (event) => {
    const handle = handleOf(event.target);
    const session = sessionOf(handle);
    if (!session) return;
    event.preventDefault();
    event.stopPropagation();
    session.reset?.();
  };

  // The value is read when the handle is reached, so a redrawn handle says it.
  const onFocusIn = (event) => {
    const handle = handleOf(event.target);
    const session = sessionOf(handle);
    if (session) setValue(handle, session);
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('dblclick', onDoubleClick);
  root.addEventListener('focusin', onFocusIn);
  if (!options.handles) {
    root.setAttribute('role', 'separator');
    root.setAttribute('aria-orientation', 'vertical');
  }
  return () => {
    finish(false);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('dblclick', onDoubleClick);
    root.removeEventListener('focusin', onFocusIn);
  };
}

export {setValue as setResizerValue};
