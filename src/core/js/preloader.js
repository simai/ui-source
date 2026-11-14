export const DEFAULT_PRELOADER = Object.freeze({
  width: 31.68,
  height: 48,
  distance: 6,
  cycle: 1800,
  rotateAt: 1458,
  rotationStep: 90,
  transition: 300,
  easing: 'cubic-bezier(0.3, 1.85, 0.55, 1)',
});

const MOTION_HANDLE = '__sfPreloaderMotion';

// What the server printed is the first paint (standard simai.smart-component
// 1.3.8 §5.4): static markup of a Smart element (`data-sf-static`) or a core
// skeleton shape (`data-sf-skeleton`). A page that carries either is not
// covered by the boot preloader; a bare page, with nothing to show until the
// Loader is ready, still is.
export const FIRST_PAINT_SELECTOR = '[data-sf-static], [data-sf-skeleton]';

export function pageHasFirstPaint(doc = globalThis.document) {
  return Boolean(doc?.querySelector?.(FIRST_PAINT_SELECTOR));
}

// A page that ships its modules preloaded (SF_PRELOADED, Docara's example
// frames) defines its Smart elements before core.js runs: they draw at once,
// and a boot preloader would only cover what is already drawn (input-choice
// first-paint audit 2026-11-11, item 1).
export function pageHasPreloadedModules(win = globalThis) {
  const modules = win?.SF_PRELOADED?.modules;
  return Boolean(modules && Object.keys(modules).length);
}

// Is a Smart element on the page drawn already? The style gate marks a drawn
// host data-sf-style-ready; a host drawn without the gate says so itself
// (isRendered).
export function pageHasRenderedSmart(doc = globalThis.document) {
  if (!doc?.querySelector) return false;
  if (doc.querySelector('[data-sf-style-ready]')) return true;
  const root = doc.body || doc.documentElement;
  if (!root || typeof doc.createTreeWalker !== 'function') return false;
  const walker = doc.createTreeWalker(root, 1);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.localName?.startsWith('sf-') && node.isRendered === true) return true;
  }
  return false;
}

// Content the boot preloader must never cover: the server's first paint, or
// Smart elements already drawn.
export function pageShowsContent(doc = globalThis.document) {
  return pageHasFirstPaint(doc) || pageHasRenderedSmart(doc);
}

// The boot preloader never covers a component already drawn, on any site
// (R216, 2026-11-13). Checked once is not enough: a preloader that is up
// when an element draws under it -- a cold load where the Smart elements
// come in after the delay, as in Docara's example frames -- covered the drawn
// example until sf-loader-ready, 0.5-0.9 s. While the preloader is up this
// watches for content and calls onContent once, at the first of:
//   - a host marked drawn by the style gate (data-sf-style-ready);
//   - a host drawn without the gate (sf-after-render, captured on the window:
//     the event is the element's own and need not bubble);
//   - a first paint added later (data-sf-static / data-sf-skeleton).
// Returns the stop function.
export const DRAWN_CONTENT_SELECTOR = `${FIRST_PAINT_SELECTOR}, [data-sf-style-ready]`;

export function watchForContent(onContent, {doc = globalThis.document, win = globalThis} = {}) {
  let stopped = false;
  let observer = null;
  const onRender = (event) => {
    if (event?.target?.localName?.startsWith?.('sf-')) found();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    win?.removeEventListener?.('sf-after-render', onRender, true);
  };
  const found = () => {
    if (stopped) return;
    stop();
    onContent();
  };
  const holds = (node) =>
    node?.nodeType === 1 &&
    Boolean(node.matches?.(DRAWN_CONTENT_SELECTOR) || node.querySelector?.(DRAWN_CONTENT_SELECTOR));
  win?.addEventListener?.('sf-after-render', onRender, true);
  const Observer = win?.MutationObserver;
  const root = doc?.documentElement;
  if (typeof Observer === 'function' && root) {
    observer = new Observer((records) => {
      for (const record of records) {
        if (record.type === 'attributes' ? record.target?.hasAttribute?.(record.attributeName) : Array.from(record.addedNodes || []).some(holds)) {
          found();
          return;
        }
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-sf-style-ready', 'data-sf-static', 'data-sf-skeleton'],
    });
  }
  return stop;
}

export function getPreloaderColor(root = document.documentElement) {
  const fallback = root?.classList?.contains('theme-dark')
    ? '#e3e2e7'
    : '#1a1b1f';
  return `var(--sf-on-surface, ${fallback})`;
}

export function getPreloaderBackground(root = document.documentElement) {
  const fallback = root?.classList?.contains('theme-dark')
    ? '#0f1115'
    : '#ffffff';
  return `var(--sf-color--surface-highest, var(--sf-surface-page, ${fallback}))`;
}

export function createPreloaderContent(preloader = {}) {
  const config = {...DEFAULT_PRELOADER, ...preloader};

  return `<svg data-sf-preloader-mark id="sv_li_1" xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 66 100" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M0 50.0013L49.812 0L66 16.2495L32.3722 50.0051L65.9938 83.7543L49.8097 100L0 50.0013Z" fill="${config.color}"/>
</svg>
<svg data-sf-preloader-mark id="sv_li_2" xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 66 100" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M66 50.0013L16.188 0L0 16.2495L33.6278 50.0051L0.00615692 83.7543L16.1903 100L66 50.0013Z" fill="${config.color}"/>
</svg>`;
}

export function stopPreloaderMotion(container) {
  container?.[MOTION_HANDLE]?.();
}

export function startPreloaderMotion(
  container,
  isActive = () => true,
  options = {},
) {
  if (!container) return () => {};

  stopPreloaderMotion(container);
  const config = {...DEFAULT_PRELOADER, ...options};
  const marks = Array.from(
    container.querySelectorAll('[data-sf-preloader-mark]'),
  );
  if (marks.length !== 2 || typeof marks[0].animate !== 'function') {
    return () => {};
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    container.style.transition = 'none';
    container.style.transform = 'rotate(0deg)';
    marks.forEach((mark) => {
      mark.style.transform = 'none';
    });
    const stop = () => {
      if (container[MOTION_HANDLE] === stop) {
        delete container[MOTION_HANDLE];
      }
    };
    container[MOTION_HANDLE] = stop;
    return stop;
  }

  container.style.transition = `${config.transition}ms transform ease-in-out`;
  let rotationAngle = 0;
  let rotationTimer = null;
  let stopped = false;

  const animations = marks.map((mark, index) => {
    const distance = index === 0 ? -config.distance : config.distance;
    return mark.animate(
      [
        {transform: 'translateX(0)', offset: 0, easing: config.easing},
        {
          transform: `translateX(${distance}px)`,
          offset: 0.36,
          easing: config.easing,
        },
        {
          transform: `translateX(${distance}px)`,
          offset: 0.48,
          easing: config.easing,
        },
        {transform: 'translateX(0)', offset: 0.84, easing: config.easing},
        {transform: 'translateX(0)', offset: 1},
      ],
      {
        duration: config.cycle,
        iterations: Number.POSITIVE_INFINITY,
      },
    );
  });

  const rotate = () => {
    if (stopped || !isActive()) return;
    rotationAngle += config.rotationStep;
    container.style.transform = `rotate(${rotationAngle}deg)`;
    rotationTimer = window.setTimeout(rotate, config.cycle);
  };
  rotationTimer = window.setTimeout(rotate, config.rotateAt);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(rotationTimer);
    animations.forEach((animation) => animation.cancel());
    container.style.transform = 'rotate(0deg)';
    marks.forEach((mark) => {
      mark.style.transform = 'none';
    });
    if (container[MOTION_HANDLE] === stop) {
      delete container[MOTION_HANDLE];
    }
  };

  container[MOTION_HANDLE] = stop;
  return stop;
}
