// SF.ready: the Loader's readiness, for a script that runs after core.js
// (simai/ui-source#16).
//
// SF.Loader, SF.loadSmartBase and the other Loader names arrive with the
// Loader, which core.js imports as a chunk of its own: they are on window.SF
// at the window event sf-loader-init, not when core.js has run. A script that
// waited for that event itself waited for ever when it ran after the event
// had been sent. SF.ready is on window.SF as soon as core.js has run:
//
//   await SF.ready;                 // settles with window.SF at sf-loader-init
//   SF.ready.then((SF) => ...);     // the same, already settled once it was sent
//   SF.ready(fn);                   // fn() once the Loader is up and the
//                                   // document has been parsed (the old
//                                   // callback form, kept)
//
// A script that runs before core.js queues a function instead:
//   (window.SF_ON_READY ||= []).push((SF) => ...);
//
// Every bundle carries its own copy of this module (core, the core-system
// chunk, the sf-system component, a second core.js on the page): the first one
// to run puts SF.ready on the shared global, marked, and each later copy finds
// the mark and keeps it. The property has a setter that ignores what it is
// given, so an older bundle that still assigns SF.ready = ready cannot replace
// it either.

const MARK = Symbol.for('simai.sf.ready');

export function installReady(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return undefined;
  win.SF = win.SF || {};
  const SF = win.SF;
  if (SF.ready && SF.ready[MARK]) return SF.ready;

  const doc = win.document;
  let settled = false;
  let resolveLoader;
  const loaderReady = new Promise((resolve) => {
    resolveLoader = resolve;
  });
  const settle = () => {
    if (settled) return;
    settled = true;
    resolveLoader(win.SF);
  };

  const parsed = () => !doc || doc.readyState !== 'loading';
  let waiting = [];
  const flush = () => {
    if (!settled || !parsed() || !waiting.length) return;
    const run = waiting;
    waiting = [];
    run.forEach((handler) => handler());
  };

  function ready(handler) {
    if (typeof handler !== 'function') return;
    // Synchronously when both have happened, as the callback form always ran.
    if (settled && parsed()) {
      handler();
      return;
    }
    waiting.push(handler);
  }
  Object.defineProperty(ready, MARK, {value: true});
  ready.then = (onResolved, onRejected) => loaderReady.then(onResolved, onRejected);
  ready.catch = (onRejected) => loaderReady.catch(onRejected);
  ready.finally = (onFinally) => loaderReady.finally(onFinally);

  win.addEventListener('sf-loader-init', () => {
    settle();
    flush();
  }, {once: true});
  doc?.addEventListener('readystatechange', flush);
  // Installed after the Loader started (a bundle that did not find the mark,
  // say): the event has been sent, so the names are the evidence.
  if (SF.Loader && typeof SF.loadSmartBase === 'function') settle();

  Object.defineProperty(SF, 'ready', {
    configurable: false,
    enumerable: true,
    get: () => ready,
    set: () => {},
  });

  // Functions a script queued before core.js ran; later pushes chain at once.
  const queued = Array.isArray(win.SF_ON_READY) ? win.SF_ON_READY : [];
  const take = (fn) => {
    if (typeof fn === 'function') ready.then(fn);
  };
  win.SF_ON_READY = {push: (...fns) => { fns.forEach(take); return 0; }};
  queued.forEach(take);

  return ready;
}
