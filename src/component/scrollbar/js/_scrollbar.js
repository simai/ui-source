import { pageText } from '../../../core/js/page-language.js';
import { noteDeprecated } from '../../../core/js/deprecations.js';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';

// sf-scrollbar is a wrapper around one scrolling area, .sf-scrollbar__viewport
// (owner decision C210, 2026-11-15). The bar itself is the one bar of the
// Framework, drawn by core over the room the native bar keeps
// (core/js/scrollbars.js, core/scss/_sf_css__scroll.scss); the component gives
// the area a keyboard stop and a name, says which edge has more (the edge
// fade, C91) and turns its data-mode words into the modifier classes of the
// one bar: always, thin, flush, square, hidden, in any combination
// (data-mode="thin flush"). The modes of C208 and before are dated aliases
// until 2027-01-01: overlay and standard are the default now, persistent is
// always (journal component-c210-scrollbar-modes).
const SCROLLBAR_TEXT = {en: LANG_WORDS.en, ru: LANG_WORDS.ru};
const ROOT_SELECTOR = '.sf-scrollbar';
const VIEWPORT_SELECTOR = '.sf-scrollbar__viewport';
export const MODES = Object.freeze(['always', 'thin', 'flush', 'square', 'hidden']);
const VALID_MODES = new Set(MODES);
// The modes that leave, and the words to write instead ('' -- the default).
export const RETIRED_MODES = Object.freeze({overlay: '', standard: '', persistent: 'always'});
const RETIRED_SINCE = '2026-11-15';
const RETIRED_UNTIL = '2027-01-01';
const VALID_AXES = new Set(['vertical', 'horizontal']);
const controllers = new WeakMap();

// The data-mode words, the retired ones read as their successors and noted
// once in SF.deprecations.
export function modesOf(root) {
  const canonical = root.getAttribute('data-mode');
  const legacy = root.getAttribute('data-sf-scrollbar');
  if (canonical === null && legacy !== null) {
    noteDeprecated({
      component: 'sf-scrollbar', kind: 'attribute', from: 'data-sf-scrollbar', to: 'data-mode',
      since: RETIRED_SINCE, remove_after: RETIRED_UNTIL,
    });
  }
  const words = String(canonical ?? legacy ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const modes = new Set();
  for (const word of words) {
    if (VALID_MODES.has(word)) {
      modes.add(word);
    } else if (word in RETIRED_MODES) {
      const to = RETIRED_MODES[word];
      noteDeprecated({
        component: 'sf-scrollbar', kind: 'value', attribute: 'data-mode', from: word, to: to || null,
        since: RETIRED_SINCE, remove_after: RETIRED_UNTIL,
      });
      if (to) modes.add(to);
    }
  }
  return modes;
}

function getAxis(root) {
  const value = String(
    root.getAttribute('data-axis') ||
    root.getAttribute('data-sf-scrollbar-axis') ||
    'vertical',
  )
    .trim()
    .toLowerCase();

  return VALID_AXES.has(value) ? value : 'vertical';
}

class ScrollbarController {
  constructor(root, viewport) {
    this.root = root;
    this.viewport = viewport;
    this.cleanup = [];
    this.applied = [];

    // The keyboard stop is the scrolling area: a focused region scrolls with
    // the arrow keys natively, the way every scrolling area in a browser
    // does, and one stop per area is enough. It needs a name to be a region;
    // an unnamed one is called by the component's word.
    if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = 0;
    if (!viewport.hasAttribute('aria-label') && !viewport.hasAttribute('aria-labelledby')) {
      const rootLabel = root.getAttribute('aria-label');
      viewport.setAttribute('aria-label', rootLabel || pageText(SCROLLBAR_TEXT, 'scroll', viewport, 'sf-scrollbar'));
    }
    if (!viewport.hasAttribute('role')) viewport.setAttribute('role', 'region');

    const onScroll = () => this.sync();
    viewport.addEventListener('scroll', onScroll, {passive: true});
    this.cleanup.push(() => viewport.removeEventListener('scroll', onScroll));
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.sync());
      this.resizeObserver.observe(viewport);
      Array.from(viewport.children).forEach((child) => this.resizeObserver.observe(child));
    }
    this.apply();
  }

  // The modes as the one bar's classes on the area.
  apply() {
    const modes = modesOf(this.root);
    const classes = [...modes].map((mode) => `scrollbar-${mode}`);
    this.applied.filter((name) => !classes.includes(name)).forEach((name) => this.viewport.classList.remove(name));
    classes.forEach((name) => this.viewport.classList.add(name));
    this.applied = classes;
    this.axis = getAxis(this.root);
    this.sync();
    globalThis.SF?.scrollbars?.refresh?.(this.viewport);
  }

  // Where the content goes on past the edge (owner decision C91, level 1):
  // the sheet fades that edge out, so an area says "there is more" without
  // its bar. start, end or both, in the logical direction.
  sync() {
    const vp = this.viewport;
    const horizontal = this.axis === 'horizontal';
    const size = horizontal ? vp.clientWidth : vp.clientHeight;
    const content = horizontal ? vp.scrollWidth : vp.scrollHeight;
    const max = Math.max(0, content - size);
    const overflow = max > 1;
    const raw = horizontal ? vp.scrollLeft : vp.scrollTop;
    const position = horizontal && getComputedStyle(vp).direction === 'rtl' ? -raw : raw;
    const before = overflow && position > 1;
    const after = overflow && position < max - 1;
    const more = before && after ? 'both' : before ? 'start' : after ? 'end' : '';
    this.root.dataset.sfScrollbarOverflow = String(overflow);
    if (more) {
      if (this.root.dataset.sfScrollbarMore !== more) this.root.dataset.sfScrollbarMore = more;
    } else if ('sfScrollbarMore' in this.root.dataset) {
      delete this.root.dataset.sfScrollbarMore;
    }
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.cleanup.forEach((remove) => remove());
    this.applied.forEach((name) => this.viewport.classList.remove(name));
    delete this.root.dataset.sfScrollbarOverflow;
    delete this.root.dataset.sfScrollbarMore;
    delete this.root.dataset.sfScrollbarReady;
  }
}

function destroyScrollbar(root) {
  const controller = controllers.get(root);

  if (!controller) return;

  controller.destroy();
  controllers.delete(root);
}

function initScrollbar(root) {
  if (!(root instanceof HTMLElement) || !root.matches(ROOT_SELECTOR)) return;

  const viewport = root.querySelector(`:scope > ${VIEWPORT_SELECTOR}`);
  const existing = controllers.get(root);

  if (existing && existing.viewport === viewport) {
    existing.apply();
    return;
  }
  if (existing) destroyScrollbar(root);

  root.dataset.sfScrollbarReady = 'true';
  if (!(viewport instanceof HTMLElement)) return;

  controllers.set(root, new ScrollbarController(root, viewport));
}

function initScrollbars(target = document) {
  if (target instanceof HTMLElement && target.matches(ROOT_SELECTOR)) {
    initScrollbar(target);
  }

  target.querySelectorAll?.(ROOT_SELECTOR).forEach(initScrollbar);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initScrollbars(document));
  } else {
    initScrollbars(document);
  }
}

if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === 'attributes' &&
        mutation.target instanceof HTMLElement &&
        mutation.target.matches(ROOT_SELECTOR)
      ) {
        initScrollbar(mutation.target);
        return;
      }

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches(ROOT_SELECTOR)) destroyScrollbar(node);
        node.querySelectorAll?.(ROOT_SELECTOR).forEach(destroyScrollbar);
      });

      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) initScrollbars(node);
      });
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      'data-mode',
      'data-axis',
      'data-sf-scrollbar',
      'data-sf-scrollbar-axis',
    ],
    childList: true,
    subtree: true,
  });
}

globalThis.SF = globalThis.SF || {};
globalThis.SF.Scrollbar = {
  destroy: destroyScrollbar,
  init: initScrollbars,
};
