// sf-contents: the table of contents of one page («Оглавление») -- its
// sections as in-page links, the current one marked while the page scrolls.
//
// One list, four views (the sheet's): a side column with the current
// section's bar, a compact button with the reading progress that opens the
// list, strokes at the edge with the names on hover and focus, and a sticky
// row of anchor tabs; auto is the column on a wide screen and the compact
// button below the collapse step, by a media rule, so the printed markup is
// right before this code arrives.
//
// The sections are the items a server gives (the JSON island, or the
// property), else links written inside the element, else the headings of the
// target in the levels range. The printed list is plain links: without the
// script the browser jumps to the section.
//
// The current section is the last one whose top is at or above the top of the
// scroll area -- the container's scroll-padding-top, where a page with a
// sticky header says how much of the top is covered -- asked by an
// IntersectionObserver over the sections and a frame-throttled scroll
// listener, which also gives the reading progress.
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, refresh and toggle are the actions and answer
// outcomes, change is the fact sf-contents-change, the words are the language
// files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderContentsTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The Framework's breakpoints (core/scss/vars/_sf_var__breakpoint.scss), as
// the sheet's media rules read them: compact below the step.
const STEPS = {sm: '32rem', md: '44rem', lg: '60rem', xl: '72rem'};
// A chosen section holds the answer while its scroll moves -- each scroll
// event extends the hold by this long, so a long smooth scroll keeps it and a
// section already in place lets it go at once -- and, once the scroll ended,
// while the section is in view and the person has not scrolled again: a
// section near the end of the page that cannot reach the top stays chosen.
const HOLD_MS = 300;
let sequence = 0;

const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});

const ContentsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    refresh() {
      this.collect();
      return applied();
    },
    toggle() {
      return this.isOpen ? this.closeList({restoreFocus: false}) : this.openList();
    },
  },
});

// The heading levels of a levels setting: "2-3", "2", "2,3".
export function parseLevels(value) {
  const text = String(value ?? '').trim();
  const range = text.match(/^([1-6])\s*-\s*([1-6])$/u);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
    return Array.from({length: to - from + 1}, (_, at) => from + at);
  }
  const list = text.split(/[\s,]+/u).map(Number).filter((level) => Number.isInteger(level) && level >= 1 && level <= 6);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : [2, 3];
}

// An id for a heading that has none: its words, lower case, joined by -.
export function slugOf(text) {
  return String(text ?? '').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'section';
}

// What a heading says, without what it hides from assistive technology (an
// anchor mark, a permalink glyph).
function headingText(element) {
  const copy = element.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"], .sf-sr-only-skip, script, style').forEach((node) => node.remove());
  return copy.textContent.replace(/\s+/gu, ' ').trim();
}

const isScrollable = (element) => {
  const style = getComputedStyle(element);
  return /(auto|scroll|overlay)/u.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
};

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

class SfContents extends ContentsElement {
  constructor() {
    super();
    this._id = `sf-contents-${++sequence}`;
    this.isOpen = false;
    this._sections = [];
    this._childItems = [];
    this._current = '';
    this._progress = 0;
    this._answered = false;
    this._hold = null;
    this._media = null;
    this._observer = null;
    this._scroller = null;
    this._frame = 0;
    this._revealCurrent = false;
    this._onMedia = () => this.syncCompact();
    this._onScroll = (event) => {
      if (this._hold && event?.type === 'scroll') {
        if (this._hold.settled || Date.now() > this._hold.until) this._hold = null;
        else this._hold.until = Date.now() + HOLD_MS;
      }
      this.scheduleSpy();
    };
    this._onScrollEnd = () => {
      if (this._hold) this._hold.settled = true;
      this.scheduleSpy();
    };
    this._onOutside = (event) => {
      if (!this.isOpen) return;
      const path = event.composedPath?.() ?? [];
      if (!path.includes(this)) this.closeList({restoreFocus: false});
    };
    this._onReady = () => this.collect();
  }

  // The read-only value current (component.json values).
  get current() {
    return this._current;
  }

  // A list set by the page or read from the island collects again.
  get items() {
    return super.items;
  }

  set items(value) {
    super.items = value;
    if (this._isMounted) this.collect();
  }

  get compact() {
    if (this.layout === 'compact') return true;
    if (this.layout !== 'auto') return false;
    return this._media ? !this._media.matches : false;
  }

  // The links written inside the element are its items (the default slot):
  // read once, taken out, and drawn as the list.
  onConnected() {
    super.onConnected?.();
    const nodes = Array.from(this.children).filter((child) => !child.hasAttribute('slot') && !child.hasAttribute('data-sf-static')
      && child.localName !== 'script' && child.localName !== 'template');
    const links = nodes.flatMap((node) => (node.matches?.('a[href^="#"]') ? [node] : Array.from(node.querySelectorAll?.('a[href^="#"]') ?? [])));
    if (links.length) {
      this._childItems = links.map((link) => ({
        id: decodeURIComponent(link.getAttribute('href').slice(1)),
        text: link.textContent.replace(/\s+/gu, ' ').trim(),
        level: Number(link.dataset.level || link.getAttribute('aria-level')) || 2,
      })).filter((item) => item.id);
      nodes.forEach((node) => node.remove());
    }
    this.watchMedia();
    this.collect();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', this._onReady, {once: true});
  }

  onDisconnected() {
    this.stopSpy();
    this._media?.removeEventListener?.('change', this._onMedia);
    this._media = null;
    document.removeEventListener('DOMContentLoaded', this._onReady);
    document.removeEventListener('pointerdown', this._onOutside, true);
    this.isOpen = false;
    super.onDisconnected?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (oldValue === newValue || !this._isMounted) return;
    if (name === 'layout' || name === 'collapse') this.watchMedia();
    if (name === 'target' || name === 'levels') this.collect();
  }

  watchMedia() {
    this._media?.removeEventListener?.('change', this._onMedia);
    const step = STEPS[this.collapse];
    this._media = this.layout === 'auto' && step && typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia(`(min-width: ${step})`) : null;
    this._media?.addEventListener?.('change', this._onMedia);
    this.syncCompact();
  }

  // The window crossed the step: the host says so, and a list the column no
  // longer opens closes.
  syncCompact() {
    this.sfHostState('data-compact', this.compact);
    if (!this.compact && this.isOpen) this.closeList({restoreFocus: false});
    this.requestComponentUpdate('compact');
  }

  // The content the headings are collected from.
  targetElement() {
    const selector = this.target;
    if (selector) {
      try {
        const found = document.querySelector(selector);
        if (found) return found;
      } catch {
        globalThis.console?.warn?.(`[SIMAI Framework] sf-contents: target "${selector}" is not a selector`);
      }
      return null;
    }
    return document.querySelector('main') ?? document.body;
  }

  // The sections: the items, else the links written inside, else the
  // headings of the target. A heading without an id is given one.
  collect() {
    const given = (Array.isArray(this.items) && this.items.length ? this.items : this._childItems)
      .filter((item) => item && item.id)
      .map((item) => ({id: String(item.id), text: String(item.text ?? item.label ?? item.id), level: Number(item.level) || 2}));
    let sections;
    if (given.length) {
      sections = given.map((item) => ({...item, element: document.getElementById(item.id)}));
    } else {
      const root = this.targetElement();
      const levels = parseLevels(this.levels);
      const selector = levels.map((level) => `h${level}`).join(', ');
      const headings = root ? Array.from(root.querySelectorAll(selector)) : [];
      const taken = new Set();
      sections = headings
        .filter((heading) => !this.contains(heading) && !heading.closest('[hidden], sf-contents, [data-sf-contents-skip]'))
        .map((heading) => {
          const text = headingText(heading);
          if (!heading.id) {
            const base = slugOf(text);
            let id = base;
            for (let n = 2; document.getElementById(id) || taken.has(id); n += 1) id = `${base}-${n}`;
            heading.id = id;
          }
          taken.add(heading.id);
          return {id: heading.id, text, level: Number(heading.localName.slice(1)), element: heading};
        })
        .filter((section) => section.text);
    }
    this._sections = sections;
    this.startSpy();
    this.spy({emit: false});
    this.requestComponentUpdate('sections');
  }

  // The element that scrolls the sections: the nearest scrolling ancestor of
  // the first one, else the window (null).
  scroller() {
    const first = this._sections.find((section) => section.element)?.element;
    for (let node = first?.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (isScrollable(node)) return node;
    }
    return null;
  }

  // How much of the top of the scroll area is covered: its scroll-padding-top.
  coveredTop() {
    const element = this._scroller ?? document.documentElement;
    const value = parseFloat(getComputedStyle(element).scrollPaddingTop);
    return Number.isFinite(value) ? value : 0;
  }

  startSpy() {
    this.stopSpy();
    this._scroller = this.scroller();
    const source = this._scroller ?? globalThis;
    source.addEventListener('scroll', this._onScroll, {passive: true});
    source.addEventListener('scrollend', this._onScrollEnd, {passive: true});
    globalThis.addEventListener('resize', this._onScroll, {passive: true});
    this._source = source;
    if (typeof globalThis.IntersectionObserver === 'function') {
      this._observer = new IntersectionObserver(() => this.scheduleSpy(), {
        root: this._scroller,
        rootMargin: `-${Math.round(this.coveredTop())}px 0px 0px 0px`,
        threshold: [0, 1],
      });
      this._sections.forEach((section) => section.element && this._observer.observe(section.element));
    }
  }

  stopSpy() {
    this._observer?.disconnect();
    this._observer = null;
    this._source?.removeEventListener('scroll', this._onScroll);
    this._source?.removeEventListener('scrollend', this._onScrollEnd);
    globalThis.removeEventListener('resize', this._onScroll);
    this._source = null;
    if (this._frame) globalThis.cancelAnimationFrame?.(this._frame);
    this._frame = 0;
  }

  scheduleSpy() {
    if (this._frame) return;
    const run = () => {
      this._frame = 0;
      this.spy();
    };
    this._frame = typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(run) : (Promise.resolve().then(run), 1);
  }

  // The current section and the reading progress, from the geometry now.
  spy({emit = true} = {}) {
    const sections = this._sections;
    const scroller = this._scroller;
    const area = scroller ? scroller.getBoundingClientRect() : {top: 0, bottom: globalThis.innerHeight || 0};
    const scrolling = scroller ?? document.scrollingElement ?? document.documentElement;
    const room = scrolling.scrollHeight - scrolling.clientHeight;
    // Nothing to scroll is nothing read yet: the printed line starts empty.
    const progress = room > 1 ? Math.min(1, Math.max(0, scrolling.scrollTop / room)) : 0;
    this.setProgress(progress);
    if (!sections.length) {
      this.setCurrent('', {emit});
      return;
    }
    const line = area.top + this.coveredTop();
    let id = sections[0].id;
    for (const section of sections) {
      if (!section.element) continue;
      const margin = parseFloat(getComputedStyle(section.element).scrollMarginTop) || 0;
      if (section.element.getBoundingClientRect().top - margin <= line + 1) id = section.id;
    }
    if (room > 1 && scrolling.scrollTop >= room - 2) {
      const shown = sections.filter((section) => section.element && section.element.getBoundingClientRect().top < area.bottom);
      if (shown.length) id = shown.at(-1).id;
    }
    const held = this._hold && sections.find((section) => section.id === this._hold.id);
    const inView = held?.element && held.element.getBoundingClientRect().top < area.bottom && held.element.getBoundingClientRect().bottom > area.top;
    if (held && (this._hold.settled ? inView : Date.now() < this._hold.until)) id = held.id;
    else this._hold = null;
    this.setCurrent(id, {emit});
  }

  setProgress(progress) {
    if (Math.abs(progress - this._progress) < 0.001) return;
    this._progress = progress;
    // The line follows every frame without a redraw of the list.
    this.querySelector(':scope .sf-contents-progress-value')?.style.setProperty('--sf-contents--progress', String(progress));
  }

  setCurrent(id, {emit = true, hash = true} = {}) {
    const previous = this._current;
    const first = !this._answered;
    this._answered = true;
    if (id === previous) return;
    this._current = id;
    this._revealCurrent = true;
    this.requestComponentUpdate('current');
    if (first || !emit || !id) return;
    if (hash && this.hash && globalThis.location?.hash !== `#${id}`) {
      try {
        globalThis.history?.replaceState(globalThis.history.state, '', `#${encodeURIComponent(id)}`);
      } catch {
        // A sandboxed frame may refuse; the address is a convenience.
      }
    }
    this.sfEmit('change', {id, previous: previous || null});
  }

  // A link chosen: its section, smoothly unless the person asked for less
  // motion, focus there, the address and the answer at once.
  choose(event, id) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = this._sections.find((one) => one.id === id);
    const element = section?.element ?? document.getElementById(id);
    if (this.isOpen) this.closeList({restoreFocus: false});
    if (!element) return;
    event.preventDefault();
    this._hold = {id, until: Date.now() + HOLD_MS};
    // instant, not auto: auto is the page's scroll-behavior, which may be smooth.
    element.scrollIntoView({behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start'});
    if (!element.matches('a[href], button, input, select, textarea, [tabindex]')) element.setAttribute('tabindex', '-1');
    element.focus({preventScroll: true});
    this.setCurrent(id, {emit: true});
  }

  // The action toggle opens the compact view's list.
  openList() {
    if (this.isOpen) return applied();
    if (!this.compact) return refused('not-compact');
    this.isOpen = true;
    this.sfHostState('data-open', true);
    document.addEventListener('pointerdown', this._onOutside, true);
    this.requestComponentUpdate('open');
    return applied();
  }

  closeList({restoreFocus = true} = {}) {
    if (!this.isOpen) return refused('closed');
    this.isOpen = false;
    this.sfHostState('data-open', false);
    document.removeEventListener('pointerdown', this._onOutside, true);
    this.requestComponentUpdate('close');
    if (restoreFocus) this.toggleButton()?.focus({preventScroll: true});
    return applied();
  }

  toggleButton() {
    return this.querySelector(':scope .sf-contents-toggle button');
  }

  onKeydown(event) {
    if (event.key !== 'Escape' || !this.isOpen || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeList({restoreFocus: true});
  }

  // The compact button is what the host's focus() reaches in the compact
  // view (the host is display: contents and has no box).
  focusDelegate() {
    return this.compact ? this.toggleButton() : this.querySelector(':scope .sf-contents-link');
  }

  // The bar keeps the current tab in view by scrolling itself, never the page.
  afterRender(changed) {
    const result = super.afterRender?.(changed);
    if (this._revealCurrent && this.layout === 'bar') {
      this._revealCurrent = false;
      const list = this.querySelector(':scope .sf-contents-list');
      const link = list?.querySelector('[aria-current="location"]');
      if (list && link && list.scrollWidth > list.clientWidth) {
        const box = list.getBoundingClientRect();
        const at = link.getBoundingClientRect();
        let left = list.scrollLeft;
        if (at.left < box.left) left -= box.left - at.left;
        else if (at.right > box.right) left += at.right - box.right;
        if (left !== list.scrollLeft) list.scrollTo({left, behavior: reducedMotion() ? 'instant' : 'smooth'});
      }
    }
    return result;
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      layout: this.layout,
      collapse: this.collapse,
      size: this.size,
      sticky: this.sticky,
      open: this.isOpen,
      compact: this.compact,
      label: this.label,
      sections: this._sections.map(({id, text, level}) => ({id, text, level})),
      current: this._current,
      progress: this._progress,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderContentsTemplate(this.templateContext());
  }
}

SfContents.define('sf-contents');

export {SfContents};
