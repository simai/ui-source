// The rows of a long list drawn by the window a person can see (standard
// simai.smart-component §18.4, gate 17: a component with many entries draws
// the ones in view; Framework order FO-2 of the view set study, ui-control
// control/research/2026-11-17-view-round-1/framework-orders.md). sf-view-table
// had the only copy (windowSlice / syncWindow); this is that copy made one
// helper for every list -- sf-list draws by it, the set's table calls it.
//
// The component keeps drawing its own rows: the helper says which ones, and
// how tall the two spacers are that stand for the rest above and below, so
// the scroll bar, the scroll position and the page's height are those of the
// whole list.
//
//   const win = rowsWindow({
//     body: () => element,         the box the rows (and the spacers) stand in
//     rows: () => [elements],      the rows drawn now, in order
//     onMove: (range) => {},       the range moved: draw again (range {first, last})
//   });
//   win.slice(count)  -> null (draw every row) | {first, last, before, after}
//   win.sync()        after a drawing: measure a row, move the range if the
//                     rows in view came near its edge; answers whether it moved
//   win.reveal(index) put a row in the range (a key that goes to it, Home, End)
//   win.start() / win.stop()   follow scrolling and resizing (any scroll box
//                     between the rows and the page, one listener per list)
//
// What is in view is read against the window and the nearest box that
// scrolls the rows. A row's height is the average of the rows drawn, so a
// row of two lines among rows of one does not throw the spacers off; until a
// row is drawn it is the guess. Nothing here draws, and nothing is kept
// outside the controller it returns, so every bundle may carry its own copy.

import {scrollerOf} from './reading-position.js';

// A list shorter than this draws every row: below it the window saves less
// than it costs (the table's threshold).
export const ROWS_WINDOW_FROM = 200;
// The first range, before anything is measured, and the rows kept beyond the
// visible ones on each side, so a key or a quick scroll finds rows drawn.
export const ROWS_WINDOW_INITIAL = 60;
export const ROWS_WINDOW_MARGIN = 20;

const clamp = ({first = 0, last = 0} = {}, count = 0) => {
  const lastIndex = Math.max(0, count - 1);
  const from = Math.min(Math.max(0, Math.floor(first)), lastIndex);
  const to = Math.min(Math.max(from, Math.floor(last)), lastIndex);
  return {first: from, last: to};
};

export function rowsWindow({
  body,
  rows,
  onMove = null,
  from = ROWS_WINDOW_FROM,
  initial = ROWS_WINDOW_INITIAL,
  margin = ROWS_WINDOW_MARGIN,
  guess = 40,
  clip = null,
} = {}) {
  let windowed = false;
  let count = 0;
  let height = 0;
  let range = null;
  let frame = 0;
  let abort = null;

  const rowHeight = () => height || guess;

  function slice(total = 0) {
    count = Math.max(0, Math.floor(Number(total) || 0));
    if (count < from) {
      windowed = false;
      range = null;
      return null;
    }
    windowed = true;
    range = clamp(range ?? {first: 0, last: initial - 1}, count);
    return {
      first: range.first,
      last: range.last,
      before: range.first * rowHeight(),
      after: Math.max(0, count - 1 - range.last) * rowHeight(),
    };
  }

  // Which rows a person can see: the body's place against the window and the
  // box that scrolls it, in row heights. null when nothing can be read.
  function seen() {
    const box = body?.();
    if (!box || !count) return null;
    const place = box.getBoundingClientRect();
    const view = box.ownerDocument?.defaultView ?? globalThis;
    let top = 0;
    let bottom = view.innerHeight || box.ownerDocument?.documentElement?.clientHeight || 0;
    const scroller = typeof clip === 'function' ? clip() : scrollerOf(box);
    if (scroller) {
      const edge = scroller.getBoundingClientRect();
      top = Math.max(top, edge.top);
      bottom = Math.min(bottom, edge.bottom);
    }
    const step = rowHeight();
    const lastIndex = count - 1;
    const first = Math.min(lastIndex, Math.max(0, Math.floor((top - place.top) / step)));
    const last = Math.min(lastIndex, Math.max(first, Math.ceil((bottom - place.top) / step)));
    return {first, last};
  }

  function moved() {
    if (typeof onMove === 'function') onMove({...range});
    return true;
  }

  function sync() {
    if (!windowed) return false;
    let changed = false;
    const drawn = rows?.() ?? [];
    if (drawn.length) {
      const first = drawn[0].getBoundingClientRect();
      const last = drawn[drawn.length - 1].getBoundingClientRect();
      const measured = (last.bottom - first.top) / drawn.length;
      if (measured > 0 && Math.abs(measured - height) > 0.5) {
        height = measured;
        changed = true;
      }
    }
    const view = seen();
    if (!view) return changed ? moved() : false;
    const now = range ?? {first: 0, last: initial - 1};
    const low = now.first > 0 ? now.first + margin / 2 : 0;
    const high = now.last < count - 1 ? now.last - margin / 2 : count - 1;
    if (view.first < low || view.last > high) {
      const next = clamp({first: view.first - margin, last: view.last + margin}, count);
      if (next.first !== now.first || next.last !== now.last) {
        range = next;
        changed = true;
      }
    }
    return changed ? moved() : false;
  }

  // A row reached by a key (Home, End, the next row past the drawn ones):
  // the range is put around it. Answers whether the range moved.
  function reveal(index) {
    if (!windowed) return false;
    const at = Math.min(Math.max(0, Math.floor(Number(index) || 0)), count - 1);
    const now = range ?? {first: 0, last: initial - 1};
    if (at >= now.first && at <= now.last) return false;
    const span = Math.max(initial, now.last - now.first + 1);
    const first = Math.max(0, Math.min(at - margin, count - span));
    range = clamp({first, last: first + span - 1}, count);
    return moved();
  }

  function start() {
    if (abort) return;
    abort = new AbortController();
    const {signal} = abort;
    const onScroll = () => {
      if (!windowed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };
    // Any scroll box between the rows and the page moves them: listened once,
    // in the capture phase, on the document.
    const doc = body?.()?.ownerDocument ?? globalThis.document;
    doc?.addEventListener('scroll', onScroll, {capture: true, passive: true, signal});
    doc?.defaultView?.addEventListener('resize', onScroll, {passive: true, signal});
  }

  function stop() {
    abort?.abort();
    abort = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    slice,
    sync,
    reveal,
    start,
    stop,
    get windowed() {
      return windowed;
    },
    get count() {
      return count;
    },
    get range() {
      return range ? {...range} : null;
    },
    get rowHeight() {
      return rowHeight();
    },
  };
}

export default rowsWindow;
