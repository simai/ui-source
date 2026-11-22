// The one scrollbar (owner decision C210, 2026-11-15): every scrolling area of
// the page gets the same bar -- a strip of 14 (gap 4, thumb 6, 4 to the edge),
// shown while it scrolls, while the pointer is at its strip, while the focus
// is inside and once when it appears, hidden 1 s after the last of these.
//
// A native bar cannot fade or grow (Chrome repaints ::-webkit-scrollbar only
// on its own events), so core's sheet keeps the native bar as a transparent
// spacer that holds the room, and this script lays a drawn track and thumb
// over that room: a track per axis beside the area, the thumb max(--sf-scroll--thumb-min, the visible share of the
// content), a click on the track pages, the thumb drags. The look -- the
// thumb's size, its colours, the corners -- is the area's own values, read off
// it when the bar shows (core/scss/_sf_css__scroll.scss), so the modifiers and
// the place's roles reach the bar without a selector of their own.
//
// Cheap by design: no element is measured until it scrolls, the pointer
// reaches its strip, the focus enters it or an idle scan finds it overflowing;
// only the areas that overflow get a track, and only the ones shown once and
// the scrollbar-always ones are kept in step. One scroll listener (capture), one
// pointer listener, one focus pair, one IntersectionObserver for the first
// showing, one ResizeObserver and one MutationObserver for the whole page;
// reads and writes are batched in one animation frame. A touch screen and
// forced colours keep the system's bar: nothing is installed there.
//
// The page's own bar is not drawn: nothing a page paints reaches the window's
// scrollbar room (a fixed track there is clipped to the layout viewport), so
// core's sheet paints the native thumb of the root in the same look and
// colours, shown at rest (core/scss/_sf_css__scroll.scss).

export const HIDE_AFTER = 1000;
const ALWAYS = 'scrollbar-always';
const HIDDEN = 'scrollbar-hidden';
const SKIP_TAGS = new Set(['SELECT', 'INPUT', 'IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'CANVAS']);
const SCROLLS = new Set(['auto', 'scroll']);

// The thumb along a track of `track` px for a view of `client` px over
// `scroll` px of content scrolled to `position` px: its length (never under
// `min` nor over the track) and its offset from the track's start. Pure, so
// the arithmetic is tested on its own.
export function thumbFor({track, client, scroll, position, min = 0}) {
  const span = Math.max(0, scroll - client);
  const length = Math.min(track, Math.max(min, span ? (track * client) / scroll : track));
  const at = span ? Math.min(1, Math.max(0, position / span)) : 0;
  return {length, offset: (track - length) * at, at};
}

// How far the track keeps off the area's corners: the corner radius on each
// end of the bar's side, never more than a quarter of the run.
export function trackEnds({run, start = 0, end = 0}) {
  const cap = Math.max(0, run / 4);
  return {start: Math.min(cap, Math.max(0, start)), end: Math.min(cap, Math.max(0, end))};
}

// A click on the track pages by the view less a line (the keyboard's step),
// toward the pointer.
export function pageStep(client, line) {
  return Math.max(line, client - line);
}

const num = (value) => parseFloat(value) || 0;

function install(win) {
  const doc = win.document;
  const SF = (win.SF = win.SF || {});
  if (SF.scrollbars?.installed) return SF.scrollbars;
  const media = (query) => win.matchMedia?.(query).matches === true;
  const off = media('(pointer: coarse)') || media('(forced-colors: active)');
  const webkit = !!win.CSS?.supports?.('selector(::-webkit-scrollbar)');
  const reduced = () => media('(prefers-reduced-motion: reduce)');

  const states = new WeakMap();      // area -> state
  const ofTrack = new WeakMap();     // track -> state
  const styled = new WeakMap();      // element -> scroll area by its style
  const live = new Set();            // states that have tracks
  let hover = null;
  let frame = 0;
  const dirty = new Set();

  const api = {
    installed: true,
    // Shows the bar of `area` as a scroll would.
    show(area) {
      const state = stateOf(area);
      if (state) show(state);
    },
    // Reads `area` again (its modifiers, its place's values, its size): a
    // component calls it after it changes the area's classes.
    refresh(area) {
      if (!area) {
        live.forEach((state) => queue(state));
        return;
      }
      styled.delete(area);
      const state = states.get(area) || stateOf(area);
      if (!state) return;
      state.values = null;
      state.always = isAlways(state);
      if (state.always || state.on) show(state); else queue(state);
    },
    // The areas that have a bar now, for a probe.
    count: () => live.size,
  };
  SF.scrollbars = api;
  if (off) return api;

  function pageArea() {
    return doc.scrollingElement || doc.documentElement;
  }

  function isPage(el) {
    return el === pageArea() || el === doc.body || el === doc.documentElement;
  }

  // An area by its style: it scrolls on an axis (auto, scroll) and has a bar
  // to draw. Read once per element; whether it overflows is read live.
  function scrolls(el) {
    if (!el || el.nodeType !== 1 || ofTrack.has(el) || SKIP_TAGS.has(el.tagName)) return false;
    if (isPage(el)) return true;
    let known = styled.get(el);
    if (known === undefined) {
      const cs = win.getComputedStyle(el);
      known = (SCROLLS.has(cs.overflowY) || SCROLLS.has(cs.overflowX))
        && !el.classList.contains(HIDDEN)
        && cs.scrollbarWidth !== 'none';
      styled.set(el, known);
    }
    return known;
  }

  function overflows(el) {
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }

  function isAlways(state) {
    return state.area.classList.contains(ALWAYS);
  }

  function stateOf(el) {
    if (!el || isPage(el)) return null;
    const area = el;
    let state = states.get(area);
    if (state) return state;
    if (!scrolls(area)) return null;
    state = {area, tracks: null, timer: 0, on: false, held: false, values: null, hinted: false, always: false};
    state.always = isAlways(state);
    states.set(area, state);
    return state;
  }

  function makeTrack(state, axis) {
    const track = doc.createElement('div');
    track.className = `sf-scrollbar__track sf-scrollbar__track--${axis === 'y' ? 'vertical' : 'horizontal'}`;
    track.setAttribute('aria-hidden', 'true');
    track.style.left = '0px';
    track.style.top = '0px';
    const thumb = doc.createElement('div');
    thumb.className = 'sf-scrollbar__thumb';
    track.append(thumb);
    ofTrack.set(track, state);
    track.addEventListener('pointerdown', onTrackDown);
    return track;
  }

  // The tracks stand right after the area (an absolutely placed sibling
  // leaves the layout alone).
  function attach(state) {
    if (!state.tracks) state.tracks = {y: makeTrack(state, 'y'), x: makeTrack(state, 'x')};
    const {y, x} = state.tracks;
    const parent = state.area.parentNode;
    if (!parent) return false;
    if (y.parentNode !== parent || state.area.nextSibling !== y) state.area.after(y, x);
    live.add(state);
    return true;
  }

  function detach(state) {
    clearTimeout(state.timer);
    if (state.watched && sizes) {
      sizes.unobserve(state.area);
      for (const child of state.area.children) sizes.unobserve(child);
      state.watched = false;
    }
    if (state.tracks) {
      state.tracks.y.remove();
      state.tracks.x.remove();
    }
    live.delete(state);
    if (hover === state) hover = null;
  }

  // The area's values, read when the bar shows: the room is measured, the
  // rest are its custom properties, written onto the tracks as they are.
  function read(state) {
    const cs = win.getComputedStyle(state.area);
    const prop = (name) => cs.getPropertyValue(name).trim();
    const rtl = cs.direction === 'rtl';
    state.values = {
      bl: num(cs.borderLeftWidth), br: num(cs.borderRightWidth),
      bt: num(cs.borderTopWidth), bb: num(cs.borderBottomWidth),
      radius: {
        topRight: num(cs.borderTopRightRadius), bottomRight: num(cs.borderBottomRightRadius),
        topLeft: num(cs.borderTopLeftRadius), bottomLeft: num(cs.borderBottomLeftRadius),
      },
      rtl,
      style: {
        '--sf-scroll--gap': prop('--sf-scroll--gap-content') || '0px',
        '--sf-scroll--edge': prop('--sf-scroll--gap-edge') || '0px',
        '--sf-scroll--rest-at': prop('--sf-scroll--rest') || prop('--sf-scroll-thumb-size'),
        '--sf-scroll--min': prop('--sf-scroll--thumb-min') || '0px',
        '--sf-scroll--radius': prop('--sf-scroll-radius'),
        '--sf-scroll--rest-colour': prop('--sf-scroll-bg-thumb'),
        '--sf-scroll--held-colour': prop('--sf-scroll--thumb-held'),
        '--sf-scroll--track': prop('--sf-scroll-bg-track'),
        '--sf-scroll--strip': prop('--sf-scroll-bg-width'),
      },
      fresh: true,
    };
    return state.values;
  }

  // Measures the area and writes the tracks. Reads first, then writes.
  function measure(state) {
    const {area} = state;
    const values = state.values || read(state);
    const rect = area.getBoundingClientRect();
    const roomY = area.offsetWidth - area.clientWidth - values.bl - values.br;
    const roomX = area.offsetHeight - area.clientHeight - values.bt - values.bb;
    const leftSide = area.clientLeft - values.bl > 0.5;
    const client = {h: area.clientHeight, w: area.clientWidth};
    const overY = area.scrollHeight - client.h > 1 && (roomY > 0 || !webkit);
    const overX = area.scrollWidth - client.w > 1 && (roomX > 0 || !webkit);
    const origin = originOf(state);
    return {rect, roomY, roomX, leftSide, overY, overX, client, origin,
      top: area.scrollTop, left: area.scrollLeft, sh: area.scrollHeight, sw: area.scrollWidth};
  }

  function originOf(state) {
    const track = state.tracks.y;
    const r = track.getBoundingClientRect();
    return {x: r.left - num(track.style.left), y: r.top - num(track.style.top)};
  }

  function write(state, m) {
    const {y, x} = state.tracks;
    const values = state.values;
    const style = values.style;
    if (values.fresh) {
      values.fresh = false;
      for (const track of [y, x]) {
        for (const name in style) if (style[name]) track.style.setProperty(name, style[name]);
      }
    }
    const {bl, br, bt, bb, radius} = values;
    // The vertical bar.
    if (m.overY) {
      const side = m.leftSide ? 'left' : 'right';
      const ends = trackEnds({
        run: m.client.h,
        start: m.leftSide ? radius.topLeft : radius.topRight,
        end: m.overX ? 0 : (m.leftSide ? radius.bottomLeft : radius.bottomRight),
      });
      const run = Math.max(0, m.client.h - ends.start - ends.end);
      const room = webkit || m.roomY > 0 ? `${m.roomY}px` : style['--sf-scroll--strip'];
      const x0 = side === 'left' ? m.rect.left + bl : m.rect.right - br - m.roomY;
      y.style.left = `${x0 - m.origin.x}px`;
      y.style.top = `${m.rect.top + bt + ends.start - m.origin.y}px`;
      y.style.width = room;
      y.style.marginLeft = !webkit && m.roomY <= 0 && side === 'right' ? `calc(-1 * ${room})` : '';
      y.style.height = `${run}px`;
      y.style.setProperty('--sf-scroll--room', room);
      y.setAttribute('data-sf-scrollbar-side', side);
      thumb(y, 'y', run, m.client.h, m.sh, m.top);
      y.removeAttribute('data-sf-scrollbar-off');
    } else {
      y.setAttribute('data-sf-scrollbar-off', '');
    }
    // The horizontal bar.
    if (m.overX) {
      const ends = trackEnds({
        run: m.client.w,
        start: m.overY ? 0 : (values.rtl ? radius.bottomRight : radius.bottomLeft),
        end: m.overY ? 0 : (values.rtl ? radius.bottomLeft : radius.bottomRight),
      });
      const lead = m.overY && m.leftSide ? m.roomY : 0;
      const run = Math.max(0, m.client.w - ends.start - ends.end);
      const room = webkit || m.roomX > 0 ? `${m.roomX}px` : style['--sf-scroll--strip'];
      const startLeft = values.rtl ? ends.end : ends.start;
      x.style.left = `${m.rect.left + bl + lead + startLeft - m.origin.x}px`;
      x.style.top = `${m.rect.bottom - bb - Math.max(0, m.roomX) - m.origin.y}px`;
      x.style.marginTop = !webkit && m.roomX <= 0 ? `calc(-1 * ${room})` : '';
      x.style.width = `${run}px`;
      x.style.height = room;
      x.style.setProperty('--sf-scroll--room', room);
      // Physical position from the left: a right-to-left area counts its
      // scrollLeft from 0 down to minus the span.
      const span = Math.max(0, m.sw - m.client.w);
      const physical = values.rtl && m.left <= 0 ? span + m.left : m.left;
      thumb(x, 'x', run, m.client.w, m.sw, physical);
      x.removeAttribute('data-sf-scrollbar-off');
    } else {
      x.setAttribute('data-sf-scrollbar-off', '');
    }
  }

  function thumb(track, axis, run, client, scroll, position) {
    const knob = track.firstChild;
    const min = minLength(track);
    const {length, offset} = thumbFor({track: run, client, scroll, position, min});
    if (axis === 'y') {
      knob.style.height = `${length}px`;
      knob.style.transform = `translateY(${offset}px)`;
    } else {
      knob.style.width = `${length}px`;
      knob.style.transform = `translateX(${offset}px)`;
    }
  }

  // The shortest thumb, in px: a custom property may be any length, so the
  // track resolves it once per value.
  const minCache = new Map();
  function minLength(track) {
    const value = track.style.getPropertyValue('--sf-scroll--min');
    if (minCache.has(value)) return minCache.get(value);
    const probe = doc.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value || '0px'}`;
    track.append(probe);
    const px = probe.offsetWidth;
    probe.remove();
    minCache.set(value, px);
    return px;
  }

  function queue(state) {
    dirty.add(state);
    if (!frame) frame = win.requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    const work = [...dirty];
    dirty.clear();
    const measured = [];
    for (const state of work) {
      if (!state.area.isConnected) {
        detach(state);
        continue;
      }
      if (!state.tracks || !attach(state)) continue;
      measured.push([state, measure(state)]);
    }
    for (const [state, m] of measured) write(state, m);
  }

  function setOn(state, on) {
    if (!state.tracks) return;
    state.on = on;
    for (const track of [state.tracks.y, state.tracks.x]) {
      if (on) track.setAttribute('data-sf-scrollbar-on', '');
      else track.removeAttribute('data-sf-scrollbar-on');
    }
  }

  function show(state) {
    if (!state.on || !state.values) state.values = null;
    if (!attach(state)) return;
    // A shown track stays laid out after it fades (opacity only), so it keeps
    // in step with its area from then on: a text size raised while it rested
    // left the horizontal track at the old width, 2 px past a 390 px window
    // (GB17 Y5, DSA evidence 2026-11-22).
    watch(state);
    queue(state);
    setOn(state, true);
    schedule(state);
  }

  function busy(state) {
    if (state.held || hover === state) return true;
    const active = doc.activeElement;
    return !!active && active !== doc.body && state.area.contains(active);
  }

  function schedule(state) {
    clearTimeout(state.timer);
    state.always = isAlways(state);
    if (state.always) {
      watch(state);
      return;
    }
    state.timer = win.setTimeout(() => {
      if (busy(state)) schedule(state);
      else setOn(state, false);
    }, HIDE_AFTER);
  }

  // An area whose tracks have been laid out (shown once, or scrollbar-always)
  // is kept in step with its size and content; its values are read again, as
  // a window resize reads them (the text size moves the radius and the room).
  let sizes = null;
  function watch(state) {
    if (state.watched || typeof win.ResizeObserver === 'undefined') return;
    if (!sizes) {
      sizes = new win.ResizeObserver((entries) => {
        for (const entry of entries) {
          const owner = states.get(entry.target) || states.get(entry.target.parentElement);
          if (!owner) continue;
          owner.values = null;
          queue(owner);
        }
      });
    }
    state.watched = true;
    sizes.observe(state.area);
    for (const child of state.area.children) sizes.observe(child);
  }

  // Scrolling of any area (scroll does not bubble: capture).
  doc.addEventListener('scroll', (event) => {
    const state = event.target === doc ? null : stateOf(event.target);
    if (!state) return;
    if (state.on) queue(state);
    else show(state);
    schedule(state);
  }, {capture: true, passive: true});

  // The pointer at a strip: over the drawn track or over an area's own room.
  let pointer = null;
  let pointerFrame = 0;
  doc.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer = event;
    if (!pointerFrame) pointerFrame = win.requestAnimationFrame(atPointer);
  }, {passive: true});

  doc.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) setHover(null);
  }, {passive: true});

  function atPointer() {
    pointerFrame = 0;
    const event = pointer;
    if (!event) return;
    const target = event.target;
    let found = target && ofTrack.get(target.closest?.('.sf-scrollbar__track') || target);
    if (!found && target?.nodeType === 1 && !isPage(target) && scrolls(target)) {
      const state = stateOf(target);
      if (state && overflows(target) && inStrip(state, event)) found = state;
    }
    setHover(found || null);
  }

  function inStrip(state, event) {
    const area = state.area;
    const r = area.getBoundingClientRect();
    const cs = win.getComputedStyle(area);
    const bl = num(cs.borderLeftWidth);
    const br = num(cs.borderRightWidth);
    const bb = num(cs.borderBottomWidth);
    const roomY = area.offsetWidth - area.clientWidth - bl - br;
    const roomX = area.offsetHeight - area.clientHeight - num(cs.borderTopWidth) - bb;
    const left = area.clientLeft - bl > 0.5;
    const inY = roomY > 0 && (left
      ? event.clientX <= r.left + bl + roomY
      : event.clientX >= r.right - br - roomY);
    const inX = roomX > 0 && event.clientY >= r.bottom - bb - roomX;
    return inY || inX;
  }

  function setHover(state) {
    if (state === hover) return;
    const was = hover;
    hover = state;
    if (was) schedule(was);
    if (state) show(state);
  }

  // The focus inside an area keeps its bar shown.
  doc.addEventListener('focusin', (event) => {
    for (let el = event.target; el && el !== doc.body && el.nodeType === 1; el = el.parentElement) {
      if (isPage(el) || !scrolls(el) || !overflows(el)) continue;
      const state = stateOf(el);
      if (state) show(state);
      break;
    }
  });

  // Dragging the thumb, paging on the track.
  function onTrackDown(event) {
    const track = event.currentTarget;
    const state = ofTrack.get(track);
    if (!state || event.button !== 0) return;
    const vertical = track.classList.contains('sf-scrollbar__track--vertical');
    const knob = track.firstChild;
    const kr = knob.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    const at = vertical ? event.clientY : event.clientX;
    const from = vertical ? kr.top : kr.left;
    const to = vertical ? kr.bottom : kr.right;
    const area = state.area;
    event.preventDefault();
    if (at < from || at > to) {
      const client = vertical ? area.clientHeight : area.clientWidth;
      const step = pageStep(client, lineOf());
      const delta = (at < from ? -1 : 1) * step;
      area.scrollBy({[vertical ? 'top' : 'left']: delta, behavior: reduced() ? 'instant' : 'smooth'});
      show(state);
      return;
    }
    const room = Math.max(1, vertical ? tr.height - kr.height : tr.width - kr.width);
    const span = vertical ? area.scrollHeight - area.clientHeight : area.scrollWidth - area.clientWidth;
    const start = at;
    const begin = vertical ? area.scrollTop : area.scrollLeft;
    state.held = true;
    track.setPointerCapture?.(event.pointerId);
    track.setAttribute('data-sf-scrollbar-held', '');
    const move = (e) => {
      const value = begin + ((vertical ? e.clientY : e.clientX) - start) / room * span;
      if (vertical) area.scrollTop = value;
      else area.scrollLeft = value;
    };
    const end = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', end);
      track.removeEventListener('pointercancel', end);
      track.removeAttribute('data-sf-scrollbar-held');
      state.held = false;
      schedule(state);
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    show(state);
  }

  let line = 0;
  function lineOf() {
    if (!line) line = num(win.getComputedStyle(doc.documentElement).getPropertyValue('--sf-d0')) * num(win.getComputedStyle(doc.documentElement).fontSize) || 40;
    return line;
  }

  // Once when an area appears: a hint that there is more.
  const seen = typeof win.IntersectionObserver === 'function'
    ? new win.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
        seen.unobserve(entry.target);
        const state = stateOf(entry.target);
        if (!state || state.hinted || !overflows(entry.target)) continue;
        state.hinted = true;
        show(state);
      }
    }, {threshold: 0.6})
    : null;

  function found(el) {
    const state = stateOf(el);
    if (!state) return;
    if (state.always) show(state);
    else if (seen && !state.hinted && !state.observed) {
      state.observed = true;
      seen.observe(el);
    }
  }

  // The idle scan: the areas that overflow now, without measuring the rest.
  const pending = [];
  let scanning = false;
  const idle = win.requestIdleCallback
    ? (fn) => win.requestIdleCallback(fn, {timeout: 2000})
    : (fn) => win.setTimeout(() => fn({timeRemaining: () => 8, didTimeout: false}), 50);

  function scan(root) {
    if (root && root.nodeType === 1) pending.push(root);
    if (scanning) return;
    scanning = true;
    idle(step);
  }

  function step(deadline) {
    while (pending.length && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
      const root = pending.shift();
      if (!root.isConnected) continue;
      const walker = doc.createTreeWalker(root, 1);
      let n = 0;
      for (let el = walker.currentNode; el; el = walker.nextNode()) {
        if (!ofTrack.has(el) && !isPage(el) && overflows(el) && scrolls(el)) found(el);
        if (++n % 200 === 0 && deadline.timeRemaining() <= 1 && !deadline.didTimeout) {
          const next = walker.nextNode();
          if (next) pending.unshift(next);
          break;
        }
      }
    }
    if (pending.length) idle(step);
    else scanning = false;
  }

  // Content added later: scanned when idle; areas removed take their tracks.
  if (typeof win.MutationObserver === 'function') {
    new win.MutationObserver((records) => {
      let removed = false;
      for (const record of records) {
        if (record.removedNodes.length) removed = true;
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && !ofTrack.has(node)) scan(node);
        }
      }
      if (removed || live.size) {
        for (const state of live) {
          if (!state.area.isConnected) detach(state);
          else if (state.on || state.always) queue(state);
        }
      }
    }).observe(doc.documentElement, {childList: true, subtree: true});
  }

  win.addEventListener('resize', () => {
    for (const state of live) {
      state.values = null;
      if (state.on || state.always) queue(state);
    }
  }, {passive: true});

  const start = () => {
    if (doc.body) scan(doc.body);
  };
  if (doc.readyState === 'complete') start();
  else win.addEventListener('load', start, {once: true});

  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') install(window);

export {install as installScrollbars};
