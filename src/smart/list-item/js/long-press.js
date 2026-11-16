// A long press under a finger (owner decision C148 (6), list item study
// prototypes/list-item-study.html #q-swipe): held 0.5 s on a row, it opens the
// same menu as the row's «⋯» and Shift+F10. No swipe: it is hidden and fights
// the platform's back gesture. The press time is the tooltip's long press
// (component tooltip, C59): times, not lengths -- the Framework has no delay
// tokens. A touch the browser takes for a scroll ends in pointercancel and
// opens nothing. The click the release sends afterwards is the press's, not a
// press of the row: swallowed() answers it once.
//
// Stateless module: sf-list-item and sf-list each carry a copy in their own
// bundle; every watch keeps its state in its own closure.
const LONG_PRESS_MS = 500;

export function watchLongPress(target, {accepts, press}) {
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
    }, LONG_PRESS_MS);
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
