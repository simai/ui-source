// Animate when scrolled into view (utility.animation 1.1.0; step 2 of the
// legacy-units plan, owner decision q-410df7e4b5). An element with the
// animation utility's classes and `animation-on-view` holds its animation at
// the first frame until it enters the viewport, then plays it once:
//
//   <div class="animation animation-from-bottom animation-on-view">...</div>
//
// Core marks such an element data-sf-on-view="waiting" -- the utility's sheet
// pauses the animation there, so the element keeps its from-state and never
// shows its end state first -- and sets "shown" once at least 15 % of it is in
// view (an element too tall to ever show 15 % starts as soon as it enters).
// "shown" stays, so an element moved in the document does not wait again.
//
// The waiting state exists only once core has marked the element: without
// JavaScript, without IntersectionObserver or for a person who asked for less
// motion (prefers-reduced-motion: reduce) nothing is marked and the element
// renders as the utility alone draws it. Turning reduced motion on shows every
// waiting element at once.
//
// One IntersectionObserver for the page, created on first use; an element is
// unobserved once shown. Markup added later is found by a MutationObserver of
// its own: the Loader's scan is debounced and runs after the element may
// already have painted, while a mutation callback marks it before the first
// frame (the same reason effects.js watches its declarations itself).

export const ON_VIEW_CLASS = 'animation-on-view';
export const ON_VIEW_STATE = 'data-sf-on-view';
export const ON_VIEW_THRESHOLD = 0.15;

const FRESH = `.${ON_VIEW_CLASS}:not([${ON_VIEW_STATE}])`;
const WAITING = `[${ON_VIEW_STATE}="waiting"]`;

// Whether an entry counts as seen: 15 % of the element in view, or any part of
// an element so tall that 15 % of it is more than the viewport.
export function onViewSeen(entry, viewportHeight = 0) {
  if (!entry?.isIntersecting) return false;
  if (entry.intersectionRatio >= ON_VIEW_THRESHOLD) return true;
  const height = entry.boundingClientRect?.height ?? 0;
  const root = entry.rootBounds?.height || viewportHeight;
  return root > 0 && height * ON_VIEW_THRESHOLD >= root;
}

export function installOnView(win = globalThis) {
  const doc = win?.document;
  if (!doc?.documentElement) return null;
  if (win.__sfOnView?.document === doc) return win.__sfOnView;
  const Sight = win.IntersectionObserver;
  const Changes = win.MutationObserver;
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let sight = null;
  let waiting = 0;

  const show = (element) => {
    if (element.getAttribute(ON_VIEW_STATE) !== 'waiting') return;
    sight?.unobserve(element);
    element.setAttribute(ON_VIEW_STATE, 'shown');
    waiting = Math.max(0, waiting - 1);
  };
  const observer = () => {
    if (!sight) {
      sight = new Sight((entries) => {
        for (const entry of entries) if (onViewSeen(entry, win.innerHeight)) show(entry.target);
      }, {threshold: [0, ON_VIEW_THRESHOLD]});
    }
    return sight;
  };
  const mark = (element) => {
    if (typeof Sight !== 'function' || motion?.matches) return;
    element.setAttribute(ON_VIEW_STATE, 'waiting');
    waiting += 1;
    observer().observe(element);
  };
  const scan = (root) => {
    if (root?.nodeType !== 1 && root?.nodeType !== 9) return;
    if (root.nodeType === 1 && root.matches(FRESH)) mark(root);
    for (const element of root.querySelectorAll?.(FRESH) ?? []) mark(element);
  };
  const forget = (root) => {
    if (root?.nodeType !== 1 || root.isConnected) return;
    const gone = root.matches(WAITING) ? [root] : [];
    gone.push(...(root.querySelectorAll?.(WAITING) ?? []));
    for (const element of gone) {
      sight?.unobserve(element);
      element.removeAttribute(ON_VIEW_STATE);
      waiting = Math.max(0, waiting - 1);
    }
  };
  const showAll = () => {
    for (const element of doc.querySelectorAll(WAITING)) show(element);
  };

  scan(doc);
  const changes = typeof Changes === 'function' ? new Changes((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) scan(node);
      if (waiting) for (const node of record.removedNodes) forget(node);
    }
  }) : null;
  changes?.observe(doc.documentElement, {childList: true, subtree: true});
  const onMotion = () => { if (motion.matches) showAll(); };
  motion?.addEventListener?.('change', onMotion);

  const handle = Object.freeze({
    document: doc,
    scan,
    get waiting() { return waiting; },
    stop() {
      changes?.disconnect();
      sight?.disconnect();
      motion?.removeEventListener?.('change', onMotion);
      if (win.__sfOnView === handle) delete win.__sfOnView;
    },
  });
  Object.defineProperty(win, '__sfOnView', {value: handle, configurable: true, enumerable: false, writable: true});
  return handle;
}

if (typeof window !== 'undefined') installOnView(window);
