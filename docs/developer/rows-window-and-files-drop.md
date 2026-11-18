# Two core helpers for component sets: rows window and files drop

Framework orders FO-1 and FO-2 of the view set study (ui-control
`control/research/2026-11-17-view-round-1/framework-orders.md`, owner
decision C288: what is universal belongs to the Framework). Both are modules
a component imports (`src/core/js/…`), as `roving.js` is: they draw nothing
and keep no state outside the controller they return, so every bundle may
carry its own copy. They are not on `window.SF`.

## `rowsWindow` — the rows of a long list in view (`core/js/rows-window.js`)

Standard §18.4 gate 17: a component with many entries draws the ones a
person can see. `sf-list` draws by it (1.22.0); `sf-view-table`'s
`windowSlice` / `syncWindow` call it.

```js
import {rowsWindow} from '../../core/js/rows-window.js';

const win = rowsWindow({
  body: () => element,          // the box the rows and the two spacers stand in
  rows: () => [...drawnRows],   // the rows drawn now, in order
  onMove: (range) => redraw(),  // the range moved
  from: 200, initial: 60, margin: 20, guess: 40,
});
const slice = win.slice(count); // null: draw every row; else {first, last, before, after}
// draw rows first..last between a spacer of `before` px and one of `after` px
win.start();                    // follow scrolling (any scroll box) and resizing
win.sync();                     // after each drawing: measure, move when near the edge
win.reveal(index);              // Home, End, a row reached by a key
win.stop();
```

A list shorter than `from` draws every row. The row height is the average of
the rows drawn, so a row of two lines among rows of one does not throw the
spacers off. What is in view is read against the window and the nearest box
that scrolls the rows (`scrollerOf`, `core/js/reading-position.js`).

## `filesDrop` — files from the computer (`core/js/files-drop.js`)

One reading of `dataTransfer` for every element that takes files:
`sf-file-upload` (its host and its area), `sf-input-image`; the set's
`sf-view` keeps its `sf-view-files-drop` event and drops its own reading.

```js
import {filesDrop, filesDragWords} from '../../core/js/files-drop.js';

const drop = filesDrop(element, {
  onFiles: (files, event) => {},  // once per drop that carries files
  onOver: (over) => {},           // a file is held over the element, or no longer
  disabled: () => false,          // the cursor says no, no files are given
  mark: true,                     // data-sf-files-over on the element while over
});
drop.stop();
filesDragWords();                 // false on a touch screen with no fine pointer (C223)
```

Only a drag that carries files is taken: text or a row dragged across the
element passes on. Leaving for a child of the element is not leaving. A drop
that carries files is the element's even while it is disabled (the browser
would otherwise open the file in place of the page) and gives nothing. The
words about dragging belong on a screen that can drag: `filesDragWords()`
answers with the media query the file field's sheet hides them by
(`(pointer: coarse) and (not (any-pointer: fine))`, owner decision C223).
