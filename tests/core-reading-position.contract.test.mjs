import assert from 'node:assert/strict';
import test from 'node:test';

import ReadingPosition, {readingPosition, watchEdge, NEAR_END, NEAR_START} from '../src/core/js/reading-position.js';

// The reading position of a scrolling column (core/js/reading-position.js,
// SF.readingPosition; duplication audit 2026-11-03, A-6): the rule sf-list-feed
// keeps a person's place by, taken from ui-pro's sf-message-log.

const scroller = ({height = 1000, top = 0, client = 200} = {}) => {
  const element = {
    scrollHeight: height, scrollTop: top, clientHeight: client, scrolled: [],
    scrollTo(options) { element.scrolled.push(options); element.scrollTop = options.top - element.clientHeight; },
  };
  return element;
};
// Frames are run by the test, one at a time: the module's own fallback is a
// 16 ms timer per frame, and a fixed 60 ms wait for two chained frames lost the
// race whenever a loaded machine ran the first frame late (the second was then
// still pending when the wait ended).
const frameQueue = [];
const manualFrames = () => {
  globalThis.requestAnimationFrame = (callback) => frameQueue.push(callback);
  return () => { delete globalThis.requestAnimationFrame; frameQueue.length = 0; };
};
const frame = () => { for (const callback of frameQueue.splice(0)) callback(); };

test('at the end within NEAR_END, at the start within NEAR_START; a column not drawn is at its end', () => {
  assert.equal(NEAR_END, 96);
  assert.equal(NEAR_START, 240);
  const element = scroller({height: 1000, top: 705, client: 200});
  const position = readingPosition(element);
  assert.equal(position.atEnd(), true, '95px from the end');
  element.scrollTop = 704;
  assert.equal(position.atEnd(), false, '96px from the end');
  element.scrollTop = 239;
  assert.equal(position.atStart(), true);
  element.scrollTop = 240;
  assert.equal(position.atStart(), false);
  assert.equal(readingPosition(null).atEnd(), true);
  assert.equal(readingPosition(null).atStart(), false);
});

test('keep: history added above leaves what is read the same distance from the end', () => {
  const element = scroller({height: 1000, top: 300});
  const position = readingPosition(element);
  const answer = position.keep(() => { element.scrollHeight = 1600; return 'added'; });
  assert.equal(answer, 'added');
  assert.equal(element.scrollTop, 900);
  assert.equal(element.scrollHeight - element.scrollTop, 700);
});

test('check reports the start once it is in reach, never while settling', () => {
  const restore = manualFrames();
  try {
    let asked = 0;
    const element = scroller({height: 1000, top: 100});
    const position = readingPosition(element, {onStart: () => { asked += 1; }});
    assert.equal(position.check(), true);
    assert.equal(asked, 1);
    position.hold();
    assert.equal(position.settling, true);
    assert.equal(position.check(), false);
    position.release();
    element.scrollTop = 500;
    assert.equal(position.check(), false, 'not in reach');
    assert.equal(asked, 1);
    // toEnd with settle holds the start until the frame after the jump.
    element.scrollTop = 0;
    let after = false;
    position.toEnd({instant: true, settle: true, then: () => { after = true; }});
    assert.equal(position.check(), false, 'settling');
    frame();
    assert.equal(after, true, 'the jump and then run in the next frame');
    assert.equal(position.settling, true, 'still settling in the frame of the jump');
    assert.equal(position.check(), false);
    frame();
    assert.equal(position.settling, false, 'released the frame after');
    assert.deepEqual(element.scrolled.at(-1), {top: 1000, behavior: 'instant'});
  } finally {
    restore();
  }
});

test('watchEdge observes the sentinel with the margin and answers the way to stop', () => {
  const made = [];
  globalThis.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.watched = []; this.stopped = false; made.push(this); }
    observe(node) { this.watched.push(node); }
    disconnect() { this.stopped = true; }
  };
  try {
    let reached = 0;
    const sentinel = {};
    const stop = watchEdge(sentinel, () => { reached += 1; }, {margin: '120px'});
    assert.equal(made.length, 1);
    assert.deepEqual(made[0].options, {root: null, rootMargin: '120px'});
    assert.deepEqual(made[0].watched, [sentinel]);
    made[0].callback([{isIntersecting: false}]);
    assert.equal(reached, 0);
    made[0].callback([{isIntersecting: true}]);
    assert.equal(reached, 1);
    stop();
    assert.equal(made[0].stopped, true);
    assert.equal(typeof watchEdge(null, () => {}), 'function', 'no sentinel: nothing to stop');
  } finally {
    delete globalThis.IntersectionObserver;
  }
});

test('published once as SF.readingPosition; a second copy reuses it', () => {
  assert.equal(globalThis.SF.readingPosition, ReadingPosition);
  assert.ok(Object.isFrozen(ReadingPosition));
  assert.deepEqual(Object.keys(ReadingPosition).sort(), ['EDGE_MARGIN', 'NEAR_END', 'NEAR_START', 'create', 'scrollerOf', 'watchEdge']);
});
