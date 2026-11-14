// The width a person changes by an edge, as one behaviour: a drag, the arrow
// keys (Shift: four steps; Home and End: the limits; PageUp and PageDown: four
// steps), a double click back to the default, a separator's role and value
// (the share of the way from min to max, 0-100, and its words), the resize
// cursor over the whole page while it lasts. An edge that folds (C158 (2))
// folds when dragged past min by half of min, and Enter folds it and gives
// the width back; an edge that does not fold takes Enter back to the
// default. Space does nothing (APG window splitter). What
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
//     reset(): back to the default (a double click; Enter on an edge that
//              does not fold)
//     fold(on, phase), folded(): an edge that folds (sf-resizer collapsible):
//              fold(true|false, 'move'|'end') folds or gives the width back,
//              folded() says which it is
//     direction(): +1 when a pointer (or ArrowRight) moving right widens,
//                  -1 otherwise; it holds the writing direction and the edge
//     step: pixels an arrow moves (default 16)
//     start(), end(): around a drag
//   } -- or null, when this handle does not resize now.
//   options.text(share, folded, handle): the words of the value
//                     (aria-valuetext), «27 %»; without it, none.
//
// Edges another component draws (options.handles) leave Enter and Escape to
// it: a table's column edge goes back to its header on either (C158 (5)).
const ACTIVE = 'data-sf-resizer-active';

// The value a screen reader hears is the share of the way from min to max,
// 0-100, as in the APG window splitter: 0 is the narrowest, or folded. It was
// the width in pixels, «256» (study RS-6, owner decision C158 (3)).
function share(session, width) {
  if (session.folded?.()) return 0;
  const {min, max} = session.limits();
  if (!(max > min)) return width >= max ? 100 : 0;
  return Math.round(Math.min(100, Math.max(0, ((width - min) / (max - min)) * 100)));
}

function setValue(handle, session, width = session.measure(), text = null) {
  const now = share(session, width);
  handle.setAttribute('aria-valuemin', '0');
  handle.setAttribute('aria-valuemax', '100');
  handle.setAttribute('aria-valuenow', String(now));
  const words = text?.(now, Boolean(session.folded?.()), handle);
  if (words) handle.setAttribute('aria-valuetext', words);
  else handle.removeAttribute('aria-valuetext');
}

function clamp(session, width) {
  const {min, max} = session.limits();
  return Math.round(Math.min(Math.max(min, max), Math.max(min, width)));
}

export function attachResizer(root, options = {}) {
  const handleOf = (target) => (options.handles ? target?.closest?.(options.handles) : root);
  const owns = (handle) => handle && (handle === root || root.contains(handle));
  const sessionOf = (handle) => (owns(handle) ? options.session?.(handle) ?? null : null);
  const text = options.text ?? null;
  const say = (handle, session, width) => setValue(handle, session, width, text);
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
    if (!commit) return;
    const folded = Boolean(current.session.folded?.());
    if (folded) {
      if (!current.wasFolded) current.session.fold(true, 'end');
    } else if (current.wasFolded || current.width !== Math.round(current.from)) current.session.commit?.(current.width);
  };

  const onPointerDown = (event) => {
    if (event.button > 0 || drag) return;
    const handle = handleOf(event.target);
    const session = sessionOf(handle);
    if (!session) return;
    event.preventDefault();
    event.stopPropagation();
    handle.focus?.({preventScroll: true});
    const foldable = typeof session.fold === 'function';
    const wasFolded = Boolean(session.folded?.());
    const from = wasFolded ? 0 : session.measure();
    const current = {handle, session, pointer: event.pointerId, x: event.clientX, from, width: Math.round(from), wasFolded};
    current.move = (next) => {
      if (next.pointerId !== current.pointer) return;
      const wanted = current.from + (next.clientX - current.x) * (session.direction?.() ?? 1);
      // Past min by half of min the edge folds; back over that line it
      // opens again at the width the pointer asks for (C158 (2)).
      if (foldable) {
        const {min} = session.limits();
        if (wanted < min / 2) {
          if (!session.folded()) {
            session.fold(true, 'move');
            current.width = 0;
            say(handle, session, 0);
          }
          return;
        }
        if (session.folded()) session.fold(false, 'move');
      }
      const width = clamp(session, wanted);
      if (width === current.width) return;
      current.width = session.apply(width, 'move') ?? width;
      say(handle, session, current.width);
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
    // Space does nothing (C158 (2)): it restored the default, which the APG
    // window splitter gives to no key; it does not scroll the page either.
    if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Enter' || event.key === 'Escape') {
      // An edge another component draws: its own (a column edge goes back to
      // its header).
      if (options.handles || event.key === 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      // Enter folds an edge that folds and gives the width back; one that
      // does not goes back to the default.
      if (typeof session.fold === 'function') {
        session.fold(!session.folded(), 'end');
        say(handle, session);
      } else session.reset?.();
      return;
    }
    const {min, max} = session.limits();
    const folded = Boolean(session.folded?.());
    const now = folded ? 0 : session.measure();
    // ArrowRight moves the edge to the right and ArrowLeft to the left, as a
    // pointer does: direction() already holds the writing direction and the
    // edge, so it is applied once. Flipped again for RTL here, the arrows of
    // an RTL page ran against the edge (study RS-5, 2026-11-14).
    const right = session.direction?.() ?? 1;
    const step = (session.step ?? 16) * (event.shiftKey ? 4 : 1);
    let next = null;
    if (event.key === 'ArrowRight') next = now + step * right;
    else if (event.key === 'ArrowLeft') next = now - step * right;
    else if (event.key === 'PageUp') next = now + step * 4;
    else if (event.key === 'PageDown') next = now - step * 4;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    // A key on a folded edge that widens opens it, at the width the key asks
    // for (an arrow: min); one that narrows leaves it folded.
    if (folded && next <= 0) return;
    if (folded) session.fold(false, 'move');
    const width = session.apply(clamp(session, next), 'end') ?? clamp(session, next);
    say(handle, session, width);
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
    if (session) say(handle, session);
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
