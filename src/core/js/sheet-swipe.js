// A finger closing a panel by pushing it toward its edge (owner decision C157
// (4) and (5), 2026-11-14): the bottom sheet -- sf-drawer placement="bottom"
// and every phone sheet drawn from core/scss/mix/_mix__sheet.scss -- follows
// a drag down and closes past a quarter of its height or on a quick flick; a
// side panel on a phone does the same toward its own edge. The panel follows
// the finger through a length in a custom property the owner's rule reads
// (translate), and settles back when the drag stops short.
//
//   const stop = trackSwipe(pointerdownEvent, {
//     surface,                      the box that moves
//     direction: 'down' | 'left' | 'right' | 'up',
//     variable: '--sf-sheet--drag', the property set on the surface
//     onEnd: ({dismiss, back}) => ...,
//   });
//
// dismiss: the drag passed the share or the speed toward the edge; back: it
// did so the other way (a sheet at rest may open further). A drag along the
// other axis is let go at once (a list scrolling inside a side panel), and a
// drag shorter than the slop is a press, not a swipe.

export const SWIPE_SHARE = 0.25;
export const SWIPE_SPEED = 0.5;
const SLOP = 4;

const AXES = {
  down: {axis: 'y', sign: 1},
  up: {axis: 'y', sign: -1},
  right: {axis: 'x', sign: 1},
  left: {axis: 'x', sign: -1},
};

// What a swipe must not start on: a control keeps its own presses, a field
// its text selection, a box that scrolls along the swipe's axis its scroll.
const KEEPS_PRESS = 'button, a[href], input, select, textarea, [contenteditable="true"], [role="slider"], [role="scrollbar"], [draggable="true"], sf-resizer';

export function startsOnControl(target) {
  return Boolean(target instanceof Element && target.closest(KEEPS_PRESS));
}

// Whether something between the target and the surface scrolls along this
// axis toward the swipe (a wide table in a side panel, a carousel).
export function scrollsAlong(target, surface, axis) {
  for (let node = target instanceof Element ? target : null; node && node !== surface; node = node.parentElement) {
    const style = getComputedStyle(node);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    if (!/(auto|scroll)/u.test(overflow)) continue;
    if (axis === 'x' ? node.scrollWidth > node.clientWidth + 1 : node.scrollHeight > node.clientHeight + 1) return true;
  }
  return false;
}

export function trackSwipe(event, {surface, direction = 'down', variable = '--sf-sheet--drag', onEnd, onMove} = {}) {
  const spec = AXES[direction] || AXES.down;
  if (!surface || !event) return () => {};
  const grip = event.currentTarget instanceof Element ? event.currentTarget : surface;
  const start = {x: event.clientX, y: event.clientY, t: event.timeStamp};
  const rect = surface.getBoundingClientRect();
  const size = (spec.axis === 'y' ? rect.height : rect.width) || 1;
  // The owner names the physical edge: a length along x is left-to-right
  // whatever the page's direction.
  const physical = spec.sign;
  let moved = false;
  let given = false;
  let delta = 0;
  const along = (e) => (spec.axis === 'y' ? e.clientY - start.y : e.clientX - start.x);
  const across = (e) => (spec.axis === 'y' ? e.clientX - start.x : e.clientY - start.y);
  const clear = () => {
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', end);
    grip.removeEventListener('pointercancel', end);
    surface.classList.remove('is-dragging');
    surface.style.removeProperty(variable);
  };
  const move = (e) => {
    if (given) return;
    const a = along(e);
    if (!moved) {
      if (Math.abs(a) < SLOP && Math.abs(across(e)) < SLOP) return;
      // Across the axis first: a scroll or a selection, not this swipe.
      if (Math.abs(across(e)) > Math.abs(a)) { given = true; clear(); return; }
      moved = true;
      surface.classList.add('is-dragging');
      // Captured only once it is a swipe: captured at the press, the click
      // of a tap went to the grip instead of what was tapped.
      try { grip.setPointerCapture?.(event.pointerId); } catch { /* a synthetic event has no pointer */ }
    }
    delta = a;
    // The panel follows toward its edge only; the other way it holds.
    const toward = Math.max(0, delta * physical);
    surface.style.setProperty(variable, `${toward * physical}px`);
    onMove?.(toward);
  };
  function end(e) {
    clear();
    if (given || !moved || e.type === 'pointercancel') return;
    // A drag that ends on the grip is not also a press of it.
    grip.addEventListener('click', (click) => click.stopImmediatePropagation(), {capture: true, once: true});
    const toward = delta * physical;
    const speed = toward / Math.max(1, e.timeStamp - start.t);
    const dismiss = toward > size * SWIPE_SHARE || speed > SWIPE_SPEED;
    const back = !dismiss && (-toward > size * SWIPE_SHARE || speed < -SWIPE_SPEED);
    onEnd?.({dismiss, back, distance: toward});
  }
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  return clear;
}

// The handle row of a sheet drawn by the mixin's ::before: a press within it
// -- from the sheet's top, the 1/2 control's height (the row the bar is
// centred in) -- starts the swipe.
export function handleRowHeight(surface) {
  const value = getComputedStyle(surface).getPropertyValue('--sf-ui-1/2--control-height').trim();
  const match = /^(-?\d*\.?\d+)(px|rem|em)?$/u.exec(value);
  if (!match) return 32;
  const unit = match[2] || 'px';
  const base = unit === 'px' ? 1 : parseFloat(getComputedStyle(unit === 'rem' ? document.documentElement : surface).fontSize) || 16;
  return Number(match[1]) * base;
}

export function inHandleRow(event, surface) {
  const top = surface.getBoundingClientRect().top;
  return event.clientY >= top && event.clientY - top <= handleRowHeight(surface);
}
