// One way to tell a person something happened: SF.notify. Every component and
// every product used to raise its own toast where it stood -- over a card, in a
// corner of its own, for its own time -- so messages turned up anywhere and
// one on top of another (owner, 2026-10-13). Now there is one place for them.
//
// SF.notify({status, title, text, action, duration, source, key}) shows a toast
// in the page's notification area and says so with the `sf-notification` event
// on the document, which a notification centre (Larena's) records. The area
// lives in the top layer, at one edge of the window; messages stack with a gap,
// at most four at a time and the rest waiting their turn; the same message
// shown again counts up instead of stacking twice; a timer pauses while the
// pointer or the focus is on its toast; an error is announced at once, the rest
// politely. The toast is the toast component, fetched the first time.
import {pageText} from './page-language';

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

const state = {
  region: null,
  shown: [],
  waiting: [],
  history: [],
  max: 4,
  placement: 'bottom-end',
  counter: 0,
};

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
    entry.options.action?.onSelect?.(entry.record);
    globalThis.SF?.Toast?.dismiss?.(entry.toast);
  });
  document.body.append(area);
  state.region = area;
  return area;
}

function showRegion() {
  const area = region();
  if (typeof area.showPopover === 'function' && !area.matches(':popover-open')) {
    try { area.showPopover(); } catch { /* not in a document yet */ }
  }
}

function hideRegionWhenEmpty() {
  const area = state.region;
  if (!area || state.shown.length || state.waiting.length) return;
  if (typeof area.hidePopover === 'function' && area.matches(':popover-open')) area.hidePopover();
}

function release(entry) {
  state.shown = state.shown.filter((item) => item !== entry);
  const next = state.waiting.shift();
  if (next) display(next);
  else setTimeout(hideRegionWhenEmpty, 0);
}

// The slot is taken at once and the toast drawn when its component is there:
// taken after the fetch, every message raised meanwhile found the area empty
// and all of them were shown, the same one twice.
async function display(entry) {
  state.shown.push(entry);
  const api = await whenToast();
  if (!api || !state.shown.includes(entry)) return;
  const {record, options} = entry;
  const toast = api.create({
    status: record.status,
    icon: options.icon ?? ICONS[record.status],
    title: record.title,
    supportingText: record.text,
    actionText: options.action?.label ?? '',
    action: options.action ? (options.action.id ?? 'action') : '',
    closable: true,
    duration: options.duration,
    role: record.status === 'error' ? 'alert' : 'status',
  });
  toast.dataset.sfNotification = record.id;
  if (entry.count > 1) toast.dataset.count = String(entry.count);
  entry.toast = toast;
  showRegion();
  // The newest at the edge the area grows from: nearest the edge it sits on.
  const area = region();
  if (state.placement.startsWith('top')) area.prepend(toast);
  else area.append(toast);
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
 * `sf-notification` event. Returns {id, close()}; null when nothing was given.
 */
export function notify(options = {}) {
  if (typeof document === 'undefined') return null;
  const {status, title, text, duration} = normalise(options);
  if (!title && !text) return null;
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
    }
    return {id: repeated.record.id, close: () => close(repeated.record.id)};
  }

  const entry = {record, key, options: {...options, duration}, count: 1, toast: null};
  if (state.shown.length >= state.max) state.waiting.push(entry);
  else display(entry);
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

/** Where the area sits and how many messages it shows at once. */
export function configureNotifications({placement, max} = {}) {
  if (PLACEMENTS.has(placement)) {
    state.placement = placement;
    if (state.region) state.region.dataset.placement = placement;
  }
  if (Number.isInteger(max) && max > 0) state.max = max;
  return {placement: state.placement, max: state.max};
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
