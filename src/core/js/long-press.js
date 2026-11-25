// A long press under a finger (owner decision C148 (6), list item study
// prototypes/list-item-study.html #q-swipe): held 0.5 s on a row, it opens the
// same menu as the row's «⋯» and Shift+F10. No swipe: it is hidden and fights
// the platform's back gesture. The press time is the tooltip's long press
// (component tooltip, C59): times, not lengths -- the Framework has no delay
// tokens. A touch the browser takes for a scroll ends in pointercancel and
// opens nothing. The click the release sends afterwards is the press's, not a
// press of the row: swallowed() answers it once.
//
// A core helper since core.runtime 1.69.0 (study S-A, decision q-7097831f9f
// (4); docs/foundation-touch-screens.md): cards and boards share it with the
// list. On a surface with multiple selection a long press chooses the item
// (sf-list selection="many", C150 (9)); without selection it opens the item's
// «⋯» menu (C148 (6)). The caller's press() decides which.
//
// Stateless module: core publishes it as SF.longPress, and a component bundle
// that imports it carries a copy; every watch keeps its state in its own
// closure.
export const LONG_PRESS_MS = 500;

/**
 * Watches a held touch on `target`: press(event) after `ms` (500) when
 * accepts(event) took the pointerdown. Returns {swallowed(), stop()}:
 * swallowed() answers once, true, for the click that follows a fired press.
 */
export function watchLongPress(target, {accepts = () => true, press, ms = LONG_PRESS_MS} = {}) {
  let timer = 0;
  let pointer = null;
  let fired = false;

  const clear = () => {
    clearTimeout(timer);
    timer = 0;
    pointer = null;
  };

  const onDown = (event) => {
    fired = false;
    if (event.pointerType !== 'touch' || !event.isPrimary || !accepts(event)) return;
    clear();
    pointer = event.pointerId;
    timer = setTimeout(() => {
      timer = 0;
      press(event);
      // After the press: a click press() sends itself is not the release.
      fired = true;
    }, Number.isFinite(ms) && ms > 0 ? ms : LONG_PRESS_MS);
  };

  const onEnd = (event) => {
    if (pointer === event.pointerId) clear();
  };

  // The browser's own long-press menu (text selection, «copy») would cover
  // the row's menu.
  const onContextMenu = (event) => {
    if (pointer !== null || fired) event.preventDefault();
  };

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointerup', onEnd);
  target.addEventListener('pointercancel', onEnd);
  target.addEventListener('contextmenu', onContextMenu);

  return {
    swallowed() {
      if (!fired) return false;
      fired = false;
      return true;
    },
    stop() {
      clear();
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointerup', onEnd);
      target.removeEventListener('pointercancel', onEnd);
      target.removeEventListener('contextmenu', onContextMenu);
    },
  };
}

const LongPress = Object.freeze({ms: LONG_PRESS_MS, watch: watchLongPress});

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.longPress) globalThis.SF.longPress = LongPress;
}

export default LongPress;
