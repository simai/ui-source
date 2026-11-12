// One way to tell a person something happened: SF.notify. Every component and
// every product used to raise its own toast where it stood -- over a card, in a
// corner of its own, for its own time -- so messages turned up anywhere and
// one on top of another (owner, 2026-10-13). Now there is one place for them.
//
// SF.notify({status, title, text, action, actions, duration, source, key}), or a
// string as the text, shows a toast in the page's notification area and says so
// with the `sf-notification` event on the document, which a notification centre
// (Larena's) records. The area lives in the top layer, at one edge of the
// window; at most four messages at a time and the rest waiting their turn; the
// same message shown again counts up instead of stacking twice; a timer pauses
// while the pointer or the focus is on its toast; an error is announced at
// once, the rest politely. The toast is the toast component, fetched the first
// time.
//
// The messages of a corner are a stack (owner decision C50, 2026-11-10): the
// newest in front, the two before it peeking out behind it by the area's gap
// (12; compact and phone 8), each a step narrower (5 %); the stack opens into
// the list on hover, focus and tap, and every timer in it stands while it is
// open; Escape closes the message in focus and moves the focus to the next.
// The list of earlier pairs, every message whole with a gap, is a setting:
// SF.notifications.configure({layout: 'list'}).
import {pageText} from './page-language';
import {closeLayer, openLayer} from './layer-stack';

const NOTIFY_TEXT = {
  en: {region: 'Notifications'},
  ru: {region: 'Уведомления'},
};

const STATUSES = new Set(['neutral', 'info', 'success', 'warning', 'error']);
const ICONS = {success: 'check_circle', info: 'info', warning: 'warning', error: 'error', neutral: ''};
// Long enough to read a sentence; an error stays a little longer. 0 keeps a
// message until it is closed.
const DURATIONS = {neutral: 5000, info: 5000, success: 5000, warning: 8000, error: 10000};
const PLACEMENTS = new Set(['top-start', 'top-end', 'bottom-start', 'bottom-end']);
const LAYOUTS = new Set(['stack', 'list']);
// The front message and the two before it show when the stack is closed (C50);
// a fourth waits hidden behind them and shows when it opens.
const STACK_LAYERS = 3;
const STACK_STEP = 0.05;

const state = {
  region: null,
  shown: [],
  waiting: [],
  history: [],
  max: 4,
  placement: 'bottom-end',
  layout: 'stack',
  counter: 0,
  // Why the stack is open: the pointer over it, the focus in it, a tap on it.
  hover: false,
  focus: false,
  pinned: false,
  open: false,
  // Where the focus came from, to go back to when the last message closes.
  returnFocus: null,
  frame: 0,
  resize: null,
};

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// The messages on view, newest first, without the ones leaving.
function onView() {
  return state.shown
    .map((entry) => entry.toast)
    .filter((toast) => toast?.isConnected && !toast.classList.contains('closing'))
    .reverse();
}

function timers(toast, reason, stand) {
  const api = globalThis.SF?.Toast;
  if (stand) api?.pause?.(toast, reason);
  else api?.resume?.(toast, reason);
}

function clearStack(toast) {
  for (const property of ['transform', 'clipPath', 'zIndex']) toast.style[property] = '';
  delete toast.dataset.stackLayer;
}

// Where every message of the stack stands. Heights are the boxes' own
// (offsetHeight ignores the transform); a message behind keeps its height and
// is clipped to the front one's, so its top edge alone shows.
function layout() {
  state.frame = 0;
  const area = state.region;
  if (!area) return;
  const toasts = onView();
  area.dataset.layout = state.layout;
  if (state.layout !== 'stack') {
    area.style.blockSize = '';
    area.removeAttribute('data-expanded');
    toasts.forEach((toast) => {
      clearStack(toast);
      timers(toast, 'stack', false);
      timers(toast, 'hidden', false);
    });
    return;
  }
  const open = state.open;
  area.toggleAttribute('data-expanded', open);
  const top = state.placement.startsWith('top');
  const gap = Number.parseFloat(globalThis.getComputedStyle(area).rowGap) || 0;
  const heights = toasts.map((toast) => toast.offsetHeight);
  const front = heights[0] ?? 0;
  let reach = 0;
  toasts.forEach((toast, at) => {
    const layer = Math.min(at, STACK_LAYERS - 1);
    const hidden = !open && at >= STACK_LAYERS;
    // How far the message moves away from the edge it stands on.
    let away = reach;
    let scale = 1;
    let clip = 0;
    if (open) reach += heights[at] + gap;
    else {
      away = front + gap * layer - heights[at];
      scale = 1 - STACK_STEP * layer;
      clip = Math.max(0, heights[at] - front);
    }
    // A message coming in starts outside the window's edge (C50): its own
    // height and the area's distance from that edge past where it will stand.
    if (toast.dataset.stackEntering !== undefined) away = -(heights[at] + edgeDistance(area, top));
    toast.style.transform = `translateY(${top ? away : -away}px) scale(${scale})`;
    toast.style.clipPath = clip ? (top ? `inset(${clip}px 0 0 0)` : `inset(0 0 ${clip}px 0)`) : '';
    toast.style.zIndex = String(toasts.length - at);
    if (hidden) toast.dataset.stackLayer = 'hidden';
    else if (!open && at > 0) toast.dataset.stackLayer = 'behind';
    else delete toast.dataset.stackLayer;
    timers(toast, 'stack', open);
    timers(toast, 'hidden', hidden);
  });
  const layers = Math.min(toasts.length, STACK_LAYERS);
  const size = open ? Math.max(0, reach - gap) : (toasts.length ? front + gap * (layers - 1) : 0);
  area.style.blockSize = `${size}px`;
}

// How far the area stands from the window edge it grows from.
function edgeDistance(area, top) {
  const box = area.getBoundingClientRect();
  return Math.max(0, top ? box.top : (globalThis.innerHeight || 0) - box.bottom);
}

function layoutSoon() {
  if (state.frame) return;
  state.frame = globalThis.requestAnimationFrame?.(layout) ?? setTimeout(layout, 16);
}

function setOpen() {
  const open = state.layout === 'stack' && onView().length > 0 && (state.hover || state.focus || state.pinned);
  if (open === state.open) return;
  state.open = open;
  layout();
}

// Escape closes the message in focus and hands the focus to the next one, or
// back to where it came from when none is left (C50).
function closeFocused(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const toasts = onView();
  const toast = document.activeElement?.closest?.('.sf-toast');
  const at = toasts.indexOf(toast);
  if (at === -1) return;
  event.preventDefault();
  globalThis.SF?.Toast?.dismiss?.(toast);
  const rest = onView();
  const next = rest[Math.min(at, rest.length - 1)];
  const target = next?.querySelector('[data-close], a[href], button:not(:disabled)');
  if (target) {
    target.focus();
    return;
  }
  const back = state.returnFocus;
  state.returnFocus = null;
  if (back?.isConnected && typeof back.focus === 'function') back.focus();
  else toast.querySelector(':focus')?.blur?.();
}

function toastApi() {
  return globalThis.SF?.Toast?.create ? globalThis.SF.Toast : null;
}

// The toast component, fetched once: its rule is the Loader's 'toast'.
function whenToast() {
  if (toastApi()) return Promise.resolve(toastApi());
  globalThis.SF?.Loader?.ensurePlugin?.('toast');
  return new Promise((resolve) => {
    const done = () => {
      globalThis.removeEventListener('Toast:ready', done);
      resolve(toastApi());
    };
    globalThis.addEventListener('Toast:ready', done);
    // A page without the Loader that includes the toast script by hand.
    const poll = (tries) => {
      if (toastApi()) return done();
      if (tries > 0) setTimeout(() => poll(tries - 1), 100);
    };
    poll(50);
  });
}

function region() {
  if (state.region?.isConnected) return state.region;
  const area = document.createElement('section');
  area.className = 'sf-notifications';
  area.dataset.placement = state.placement;
  area.setAttribute('aria-label', pageText(NOTIFY_TEXT, 'region', document.documentElement));
  if (typeof area.showPopover === 'function') area.setAttribute('popover', 'manual');
  area.addEventListener('sf-toast-close', (event) => {
    const entry = state.shown.find((item) => item.toast === event.target);
    if (entry) release(entry);
  });
  area.addEventListener('sf-toast-action', (event) => {
    const entry = state.shown.find((item) => item.toast === event.detail?.toast);
    if (!entry) return;
    const action = entry.actions.find((one) => one.id === event.detail?.action) ?? entry.actions[0];
    action?.onSelect?.(entry.record);
    globalThis.SF?.Toast?.dismiss?.(entry.toast);
  });
  // A mouse or a pen over the stack opens it; a touch has no hover, so a tap
  // on it opens it until a tap elsewhere (C50).
  area.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    state.hover = true;
    setOpen();
  });
  // The gaps of an open stack take no pointer (they would swallow the page's
  // clicks), so the pointer in one has left the area's messages but not the
  // area: the stack stays open while the pointer is inside the area's box and
  // closes when it leaves it. Closing on the gap itself moved the messages
  // under a resting pointer, which opened it again, over and over.
  let watching = null;
  const stopWatching = () => {
    if (watching) document.removeEventListener('pointermove', watching, true);
    watching = null;
  };
  const inside = (event) => {
    const box = area.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX < box.right && event.clientY >= box.top && event.clientY < box.bottom;
  };
  const leave = () => {
    stopWatching();
    state.hover = false;
    setOpen();
  };
  area.addEventListener('pointerover', stopWatching);
  area.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    stopWatching();
    if (!state.open || !inside(event)) {
      leave();
      return;
    }
    watching = (move) => {
      if (move.pointerType === 'touch' || inside(move)) return;
      leave();
    };
    document.addEventListener('pointermove', watching, true);
  });
  let touched = false;
  area.addEventListener('pointerdown', (event) => { touched = event.pointerType === 'touch'; });
  area.addEventListener('click', (event) => {
    if (!touched || event.target?.closest?.('a[href], button')) return;
    state.pinned = true;
    setOpen();
  });
  area.addEventListener('focusin', (event) => {
    if (!area.contains(event.relatedTarget)) state.returnFocus = event.relatedTarget ?? null;
    state.focus = true;
    setOpen();
  });
  area.addEventListener('focusout', (event) => {
    if (area.contains(event.relatedTarget)) return;
    state.focus = false;
    setOpen();
  });
  area.addEventListener('keydown', closeFocused);
  for (const politeness of ['polite', 'assertive']) {
    const live = document.createElement('div');
    live.className = 'sf-notifications-live sr-only';
    live.dataset.live = politeness;
    live.setAttribute('aria-live', politeness);
    live.setAttribute('aria-atomic', 'true');
    live.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    area.append(live);
  }
  document.addEventListener('pointerdown', (event) => {
    if (!state.pinned || area.contains(event.target)) return;
    state.pinned = false;
    setOpen();
  }, true);
  if (typeof ResizeObserver === 'function') state.resize = new ResizeObserver(layoutSoon);
  area.dataset.layout = state.layout;
  document.body.append(area);
  state.region = area;
  return area;
}

function showRegion() {
  const area = region();
  if (typeof area.showPopover === 'function' && !area.matches(':popover-open')) {
    try { area.showPopover(); } catch { /* not in a document yet */ }
  }
  // A layer of the one document stack (standard 1.3.8 §19.1), the kind that
  // takes no keys: Escape and Tab stay with the window under it. Its height
  // counts where the browser has no top layer.
  openLayer(area, {
    kind: 'toast',
    returnTo: null,
    place: ({zIndex}) => { area.style.zIndex = String(zIndex); },
  });
}

function hideRegionWhenEmpty() {
  const area = state.region;
  if (!area || state.shown.length || state.waiting.length) return;
  if (typeof area.hidePopover === 'function' && area.matches(':popover-open')) area.hidePopover();
  closeLayer(area, {restoreFocus: false});
  // An empty area is no longer under the pointer, in focus or tapped open.
  state.hover = false;
  state.focus = false;
  state.pinned = false;
  state.open = false;
  layout();
}

function release(entry) {
  state.shown = state.shown.filter((item) => item !== entry);
  if (entry.toast) state.resize?.unobserve(entry.toast);
  const next = state.waiting.shift();
  if (next) display(next);
  else setTimeout(hideRegionWhenEmpty, 0);
  if (!onView().length) {
    state.open = false;
  }
  layout();
}

// The actions a message offers (C50): one light navigation action is a link at
// the end of its text; undo, retry, extend and two actions are buttons under
// the text (C35, C46). One message never mixes the two.
function actionsOf(options) {
  const list = Array.isArray(options.actions) ? options.actions : (options.action ? [options.action] : []);
  return list
    .filter((one) => one && String(one.label ?? '').trim())
    .slice(0, 2)
    .map((one, at) => ({...one, label: String(one.label).trim(), id: String(one.id ?? (at ? `action-${at + 1}` : 'action'))}));
}

// Every message is said through the area's live copy once, when it arrives,
// whatever slot it takes (M2: the fourth of a stack is hidden and was never in
// the tree while three were on view) -- one waiting its turn behind four too.
// An error is said at once, the rest politely. The copy is visually hidden and
// written after a frame, so a live region already in the tree changes and is
// read; messages arriving in the same frame are said together, none lost.
const pendingWords = new WeakMap();
function announce(entry) {
  if (entry.announced) return;
  entry.announced = true;
  const {record} = entry;
  const area = region();
  const live = area.querySelector(record.status === 'error' ? '.sf-notifications-live[data-live="assertive"]' : '.sf-notifications-live[data-live="polite"]');
  if (!live) return;
  const words = [record.title, record.text].filter(Boolean).join('. ');
  const pending = pendingWords.get(live);
  if (pending) {
    pending.push(words);
    return;
  }
  pendingWords.set(live, [words]);
  live.textContent = '';
  const write = () => {
    live.textContent = pendingWords.get(live).join(' ');
    pendingWords.delete(live);
  };
  if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(write);
  else setTimeout(write, 16);
}

// The toast's script can be there before its sheet: drawn meanwhile, a message
// stood unstyled in the middle of the window and jumped into its corner. The
// area waits hidden until the toast sheet is applied to it. An open popover is
// already position: fixed by the browser's own style, so the area is known
// placed by a value only the toast sheet gives it: it takes no pointer.
// The first message also waits for its parts (the icon, the close button,
// their utilities): the Loader found them only after its 100 ms watch, and the
// message changed height while it slid in, a 21 px step back. They are asked
// for at once and the message shows when every sheet and font is in, at most
// two seconds.
//
// Every message raised while a wait runs joins it (T1, C50 acceptance r3): two
// messages of one task found each other connected, so neither was the first;
// the second did not wait, showed the area unstyled and opaque, and the first
// jumped 408-434 px into place. A message is the first when it finds no
// settled message on view, and the area shows when the one wait ends.
function areaPlaced(area) {
  const style = globalThis.getComputedStyle(area);
  return style.position === 'fixed' && style.pointerEvents === 'none';
}

// A stylesheet link that will never give a sheet -- switched off, or answered
// with an error -- is not waited for: one broken link held the first message
// for the whole two seconds (C50 acceptance r3, N3).
const failedSheets = new WeakSet();
if (typeof document !== 'undefined') {
  document.addEventListener('error', (event) => {
    if (event.target?.localName === 'link') failedSheets.add(event.target);
  }, true);
}
function sheetPending(link) {
  if (link.sheet || link.disabled || failedSheets.has(link)) return false;
  const entry = globalThis.performance?.getEntriesByName?.(link.href, 'resource')?.at?.(-1);
  return !(entry?.responseStatus >= 400);
}

let areaWait = null;
let areaWaitFirst = false;
function sheetApplied(area) {
  if (areaWait) {
    // A message joining the first wait has parts of its own (buttons, say):
    // the Loader is asked for them too, and the wait counts their sheets.
    if (areaWaitFirst) globalThis.SF?.Loader?.scanDom?.(area);
    return areaWait;
  }
  const settled = state.shown.some((entry) => entry.settled && entry.toast?.isConnected);
  if (settled && areaPlaced(area)) return Promise.resolve();
  areaWaitFirst = !settled;
  areaWait = waitForSheets(area, areaWaitFirst).finally(() => { areaWait = null; });
  return areaWait;
}

async function waitForSheets(area, first) {
  const fonts = globalThis.document?.fonts;
  if (first) globalThis.SF?.Loader?.scanDom?.(area);
  const sheetsIn = () => ![...document.querySelectorAll('link[rel="stylesheet"]')].some(sheetPending);
  const ready = () => areaPlaced(area) && (!fonts || fonts.status === 'loaded') && sheetsIn();
  // Laid out, the message asks for its fonts.
  void area.offsetHeight;
  area.style.visibility = 'hidden';
  const started = Date.now();
  // Ready three checks in a row: the sheets the scan asked for are linked a
  // frame after it. A later message finds its parts in: it waits only for
  // the sheet that places the area (it stood two frames at its place and then
  // waited for sheets of other parts of the page, out of sight but late).
  let calm = 0;
  while (Date.now() - started < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    void area.offsetHeight;
    calm = (first ? ready() : areaPlaced(area)) ? calm + 1 : 0;
    if (calm >= (first ? 3 : 1)) break;
  }
}

// The slot is taken at once and the toast drawn when its component is there:
// taken after the fetch, every message raised meanwhile found the area empty
// and all of them were shown, the same one twice.
async function display(entry) {
  state.shown.push(entry);
  const api = await whenToast();
  if (!api || !state.shown.includes(entry)) return;
  const {record, options, actions} = entry;
  const link = actions.length === 1 && (actions[0].href || actions[0].kind === 'link') ? actions[0] : null;
  const toast = api.create({
    status: record.status,
    icon: options.icon ?? ICONS[record.status],
    title: record.title,
    supportingText: record.text,
    link: link ? {text: link.label, href: link.href ?? '', action: link.id, target: link.target ?? ''} : null,
    actions: link ? [] : actions.map((one) => ({text: one.label, action: one.id})),
    closable: true,
    duration: options.duration,
    // Not a live region of its own: the area's live copy says every message
    // (announce), the one behind the stack too.
    role: '',
  });
  toast.dataset.sfNotification = record.id;
  if (entry.count > 1) toast.dataset.count = String(entry.count);
  entry.toast = toast;
  showRegion();
  // The newest at the edge the area grows from: nearest the edge it sits on.
  const area = region();
  const stack = state.layout === 'stack' && !reducedMotion();
  // In a stack the newest comes in from outside the edge and fades in; the
  // first frame stands it there, the next lets it move (no jump: every move
  // is a transition from where the message stood).
  // layout() reads every height, and that read commits the styles: the
  // message is laid at its start outside the edge with no transition, the
  // start committed, and only then let move (M1: it was committed at its
  // final place first and dipped 3.4 px back to it).
  if (stack) {
    toast.dataset.stackEntering = '';
    toast.style.transition = 'none';
  }
  // In a stack the newest is first in the focus order, then the older ones
  // (C50 call): its place is the transform's, so the document order is free.
  if (state.layout === 'stack' || state.placement.startsWith('top')) area.prepend(toast);
  else area.append(toast);
  state.resize?.observe(toast);
  await sheetApplied(area);
  if (!state.shown.includes(entry)) return;
  entry.settled = true;
  area.style.visibility = '';
  announce(entry);
  layout();
  if (stack) {
    void toast.offsetHeight;
    toast.style.transition = '';
    const settle = () => {
      delete toast.dataset.stackEntering;
      layout();
    };
    const frame = globalThis.requestAnimationFrame;
    if (frame) frame(() => frame(settle));
    else setTimeout(settle, 32);
  }
}

function normalise(options) {
  const status = STATUSES.has(options.status) ? options.status : 'neutral';
  const title = String(options.title ?? '').trim();
  const text = String(options.text ?? '').trim();
  const duration = Number.isFinite(Number(options.duration)) ? Math.max(0, Number(options.duration)) : DURATIONS[status];
  return {status, title, text, duration};
}

/**
 * Shows a message in the page's notification area and announces it with the
 * `sf-notification` event. A string is the message's text. Returns
 * {id, close()}; null, with a warning, when there is nothing to show.
 */
export function notify(input = {}) {
  if (typeof document === 'undefined') return null;
  const options = typeof input === 'string' ? {text: input} : (input ?? {});
  const {status, title, text, duration} = normalise(options);
  if (!title && !text) {
    // A refusal nobody can see cost a project a long search (external feedback,
    // 2026-10-30): the page is told why nothing appeared.
    console.warn('SF.notify: nothing to show; give a string or {title, text}.', input);
    return null;
  }
  state.counter += 1;
  const record = Object.freeze({
    id: `n${Date.now().toString(36)}${state.counter}`,
    status,
    title,
    text,
    source: String(options.source ?? ''),
    time: new Date().toISOString(),
  });
  const key = String(options.key ?? `${status}|${title}|${text}`);
  // Said to whoever records messages first: a notification centre keeps it
  // whether or not it is shown, and may take the showing over by cancelling.
  const announced = document.dispatchEvent(new CustomEvent('sf-notification', {
    bubbles: true,
    cancelable: true,
    detail: record,
  }));
  state.history = [record, ...state.history].slice(0, 50);
  const handle = {id: record.id, close: () => close(record.id)};
  if (!announced || options.silent) return handle;

  // The same message again counts up on the toast already shown.
  const repeated = [...state.shown, ...state.waiting].find((entry) => entry.key === key);
  if (repeated) {
    repeated.count = (repeated.count ?? 1) + 1;
    if (repeated.toast) {
      repeated.toast.dataset.count = String(repeated.count);
      globalThis.SF?.Toast?.unbind?.(repeated.toast);
      globalThis.SF?.Toast?.bind?.(repeated.toast);
      // Bound again, its timer starts over: an open stack stands it again.
      layout();
    }
    return {id: repeated.record.id, close: () => close(repeated.record.id)};
  }

  const entry = {record, key, options: {...options, duration}, actions: actionsOf(options), count: 1, toast: null};
  if (state.shown.length >= state.max) {
    state.waiting.push(entry);
    announce(entry);
  } else display(entry);
  return handle;
}

function close(id) {
  const waiting = state.waiting.findIndex((entry) => entry.record.id === id);
  if (waiting !== -1) {
    state.waiting.splice(waiting, 1);
    return true;
  }
  const entry = state.shown.find((item) => item.record.id === id);
  if (!entry) return false;
  if (!entry.toast) {
    release(entry);
    return true;
  }
  return globalThis.SF?.Toast?.dismiss?.(entry.toast) ?? false;
}

/**
 * Where the area sits, how many messages it shows at once and how they stand:
 * 'stack' (the default, C50) or 'list'.
 */
export function configureNotifications({placement, max, layout: arrangement} = {}) {
  if (PLACEMENTS.has(placement)) {
    state.placement = placement;
    if (state.region) state.region.dataset.placement = placement;
  }
  if (Number.isInteger(max) && max > 0) state.max = max;
  if (LAYOUTS.has(arrangement) && arrangement !== state.layout) {
    state.layout = arrangement;
    if (arrangement !== 'stack') state.open = false;
    else setOpen();
    layout();
  }
  return {placement: state.placement, max: state.max, layout: state.layout};
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  if (!window.SF.notify) {
    window.SF.notify = notify;
    window.SF.notifications = {
      configure: configureNotifications,
      close,
      // The last fifty messages of this page, newest first: a page without a
      // notification centre can still show what it said.
      history: () => state.history.slice(),
    };
  }
}
