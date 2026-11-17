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
//     rows: () => [elements],      the entries drawn now, in order (rows, and
//                                  the headings of a grouped list)
//     onMove: (range) => {},       the range moved: draw again (range {first, last})
//     key: (index) => id,          the entry's id: its measured height is kept
//                                  by it (FO2-4), so a tall row (a picture in
//                                  a feed) is tall in the spacers too
//     snap: (index) => index,      where a range starting at index must start
//                                  (a grouped list: its group's heading, FO2-1)
//     from: 200,                   the length from which the list is windowed;
//                                  Infinity never windows (a host's off, FO2-3)
//   });
//   win.slice(count)  -> null (draw every row) | {first, last, before, after}
//   win.sync()        after a drawing: measure the entries drawn, move the
//                     range if the entries in view came near its edge;
//                     answers whether it moved
//   win.reveal(index) put an entry in the range (a key that goes to it, Home, End)
//   win.start() / win.stop()   follow scrolling and resizing (any scroll box
//                     between the rows and the page, one listener per list)
//                     and the rows' box growing or shrinking
//
// The box the rows stand in must not be a scroll anchor (overflow-anchor:
// none): when the range moves, the browser's scroll anchoring keeps a drawn
// row in place by moving the scroll position, which moves the range again.
//
// What is in view is read against the window and the nearest box that
// scrolls the rows. Each drawn entry's height (from its top to the next
// one's, so the gaps count) is kept by its key; an entry not drawn yet is the
// average of those measured, and until one is measured the guess (FO2-4: the
// average alone threw the spacers off in a feed of pictures and the scroll
// jumped). Without a key the average stands for every entry. Nothing here
// draws, and nothing is kept outside the controller it returns, so every
// bundle may carry its own copy.
//
// The length from which a list is windowed (ROWS_WINDOW_FROM, 200) waits for
// the owner (q-fo2-find: from 200 as built, or every row in the document with
// content-visibility up to 1 000): it is this one constant and a list's from.

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
  key = null,
  snap = null,
} = {}) {
  let windowed = false;
  let count = 0;
  let height = 0;
  let range = null;
  let frame = 0;
  let abort = null;
  // The entry a key went to (reveal): the range stays around it until the page
  // scrolls -- the focus that follows scrolls the row into view. Without it,
  // the drawing after reveal measured the window still showing the old rows
  // and put the range back there, and the row the key went to was gone.
  let held = null;
  // The rows' box is watched for its size: rows that draw themselves after
  // the list measured them (a row's own element, a late font) change the row
  // height, and the spacers follow without waiting for a scroll.
  let observer = null;
  let observed = null;
  // Measured heights by entry key (FO2-4), and the sums of heights before
  // each entry, made again when a height or the length changed.
  const heights = new Map();
  let sums = null;
  let threshold = from;

  const rowHeight = () => height || guess;
  const keyOf = (index) => (typeof key === 'function' ? key(index) : undefined);
  const heightOf = (index) => {
    const id = keyOf(index);
    return id !== undefined && heights.has(id) ? heights.get(id) : rowHeight();
  };
  function offsets() {
    if (sums && sums.length === count + 1) return sums;
    sums = new Float64Array(count + 1);
    for (let index = 0; index < count; index += 1) sums[index + 1] = sums[index] + heightOf(index);
    return sums;
  }
  // The first entry whose bottom is below the place (px from the body's top).
  function indexAt(place) {
    const at = offsets();
    let low = 0;
    let high = count - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (at[middle + 1] > place) high = middle;
      else low = middle + 1;
    }
    return low;
  }
  const snapped = (next) => {
    if (typeof snap !== 'function') return next;
    const first = Math.max(0, Math.min(next.first, Math.floor(Number(snap(next.first)) || 0)));
    return {first, last: next.last};
  };

  function slice(total = 0) {
    const length = Math.max(0, Math.floor(Number(total) || 0));
    if (length !== count) sums = null;
    count = length;
    if (count < threshold) {
      windowed = false;
      range = null;
      return null;
    }
    windowed = true;
    range = clamp(snapped(clamp(range ?? {first: 0, last: initial - 1}, count)), count);
    const at = offsets();
    return {
      first: range.first,
      last: range.last,
      before: at[range.first],
      after: Math.max(0, at[count] - at[range.last + 1]),
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
    const first = indexAt(top - place.top);
    const last = Math.max(first, indexAt(bottom - place.top));
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
      const boxes = drawn.map((one) => one.getBoundingClientRect());
      const total = boxes[boxes.length - 1].bottom - boxes[0].top;
      const measured = total / drawn.length;
      if (measured > 0 && Math.abs(measured - height) > 0.5) {
        height = measured;
        sums = null;
        changed = true;
      }
      // Each entry by its key (FO2-4): from its top to the next one's, the
      // last its own height and the gap the others keep.
      const base = range?.first ?? 0;
      if (typeof key === 'function' && range && drawn.length === range.last - range.first + 1) {
        let gaps = 0;
        for (let index = 0; index < boxes.length - 1; index += 1) gaps += Math.max(0, boxes[index + 1].top - boxes[index].bottom);
        const gap = boxes.length > 1 ? gaps / (boxes.length - 1) : 0;
        boxes.forEach((box, index) => {
          const next = boxes[index + 1];
          const own = next ? next.top - box.top : box.height + gap;
          const id = keyOf(base + index);
          if (id === undefined || !(own > 0)) return;
          if (Math.abs((heights.get(id) ?? -1) - own) > 0.5) {
            heights.set(id, own);
            sums = null;
            changed = true;
          }
        });
      }
    }
    const view = seen();
    if (!view) return changed ? moved() : false;
    if (held !== null && (held < view.first || held > view.last)) return changed ? moved() : false;
    held = null;
    const now = range ?? {first: 0, last: initial - 1};
    const low = now.first > 0 ? now.first + margin / 2 : 0;
    const high = now.last < count - 1 ? now.last - margin / 2 : count - 1;
    if (view.first < low || view.last > high) {
      const next = clamp(snapped(clamp({first: view.first - margin, last: view.last + margin}, count)), count);
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
    held = at;
    const now = range ?? {first: 0, last: initial - 1};
    if (at >= now.first && at <= now.last) return false;
    const span = Math.max(initial, now.last - now.first + 1);
    const first = Math.max(0, Math.min(at - margin, count - span));
    range = clamp(snapped({first, last: first + span - 1}), count);
    return moved();
  }

  function schedule() {
    if (!windowed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }

  function watchSize() {
    const box = body?.();
    if (box === observed) return;
    observer?.disconnect();
    observed = box ?? null;
    const Observer = box?.ownerDocument?.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
    if (!box || typeof Observer !== 'function') return;
    observer ??= new Observer(schedule);
    observer.observe(box);
  }

  function start() {
    watchSize();
    if (abort) return;
    abort = new AbortController();
    const {signal} = abort;
    const onScroll = () => {
      held = null;
      schedule();
    };
    // Any scroll box between the rows and the page moves them: listened once,
    // in the capture phase, on the document.
    const doc = body?.()?.ownerDocument ?? globalThis.document;
    doc?.addEventListener('scroll', onScroll, {capture: true, passive: true, signal});
    doc?.defaultView?.addEventListener('resize', onScroll, {passive: true, signal});
  }

  function stop() {
    observer?.disconnect();
    observed = null;
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
    // The length from which the list is windowed; Infinity turns the window
    // off (sf-list rows-window="off", FO2-3).
    get from() {
      return threshold;
    },
    set from(value) {
      const next = Number(value);
      threshold = Number.isNaN(next) ? ROWS_WINDOW_FROM : Math.max(1, next);
    },
  };
}

export default rowsWindow;
