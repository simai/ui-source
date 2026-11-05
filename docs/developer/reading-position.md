# The reading position of a column: `SF.readingPosition`

A feed, a log, a conversation or a long list must keep a person's place while
its content changes under them (duplication audit 2026-11-03, A-6). ui-pro's
`sf-message-log` did it for the chat, `sf-chat-threads` and the ui-chat pilot
wrote their own end-of-list loading. One rule now, in core
(`core/js/reading-position.js`, published as `SF.readingPosition` once
`core.js` has run). `sf-list-feed` and `sf-list` are built on it.

The helper owns no content and fetches nothing: it measures one scroller (the
box with overflow a person scrolls) and says when an edge is reached. Each
column gets its own controller; the module keeps no state of its own, so the
copy every bundle carries cannot disagree with another.

## A controller per scroller

```js
import {readingPosition} from '../../core/js/reading-position.js';
// or, in a page script: const {create: readingPosition} = window.SF.readingPosition;

const position = readingPosition(scroller, {onStart: () => askForEarlier()});
scroller.addEventListener('scroll', () => position.check());

// Earlier history above: what is read does not move.
position.keep(() => column.prepend(fragment));

// A new entry at the end: follow it only when the reader was there.
const follow = position.atEnd();
column.append(node);
if (follow) position.toEnd();

// A column replaced: open at its end; the one frame it spends at its start
// does not ask for an earlier page.
position.toEnd({instant: true, settle: true});
```

- `atEnd()` -- the end is within `nearEnd` (96 px, about two lines and an
  entry's action row). A column not drawn yet is at its end.
- `atStart()` -- the start is within `nearStart` (240 px: the earlier page is
  usually there by the time the reader scrolls into it).
- `keep(mutate)` -- measures the distance from the end, runs `mutate`, restores
  it.
- `toEnd({instant, settle, then})` -- in the next frame, smoothly unless
  `instant` or `prefers-reduced-motion: reduce`; `then` runs after the jump;
  `settle` holds the start reports until the frame after.
- `hold()`, `release()`, `settling` -- hold the start reports by hand.
- `check()` -- call it on scroll: `onStart` runs when the start is in reach and
  the position is not settling. The caller says whether a request is already
  out; the helper asks every time it is called in reach.
- `element` -- the scroller, settable when the box is drawn anew.

## An edge in reach: `watchEdge`

```js
import {scrollerOf, watchEdge} from '../../core/js/reading-position.js';

const stop = watchEdge(sentinel, () => askForMore(), {root: scrollerOf(sentinel), margin: '200px'});
// ... later
stop();
```

An `IntersectionObserver` on a sentinel at the edge, never a scroll handler.
`root` is the scroller. The default `null` is the viewport: it still sees the
clipping of every scroller around the sentinel, but its margin stops at the
scroller's clipped edge, so inside a scrolling box nothing is asked ahead and
an edge a pixel short of the box is never reported. `scrollerOf(node)` answers
the nearest ancestor whose block overflow is `auto` or `scroll` (null for the
page): pass it as `root` and the list does not have to know who scrolls it. A
watch that starts on an edge already in reach reports it
at once; a browser without `IntersectionObserver` gets a no-op and the list's
own «Show more» button.

## Constants

`NEAR_END` 96, `NEAR_START` 240, `EDGE_MARGIN` `'200px'`.
