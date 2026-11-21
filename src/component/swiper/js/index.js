import { pageLocale, pageText } from '../../../core/js/page-language';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';
// Every word this part says. A product adds a language with
// SF.language.register('sf-swiper', code, words); a ternary on «ru» allowed two
// and no more.
const SWIPER_TEXT = LANG_WORDS;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// A press becomes a drag after this many pixels; below it a press stays a
// click (a link, a button inside the slide). It is a gesture tolerance, not
// something drawn.
const DRAG_SLOP = 6;
// A drag pages when it travelled this part of one slide, or moved fast.
const DRAG_RATIO = 0.15;
const FLICK_SPEED = 0.4; // px per ms
// A scroll that has not moved for this long has come to rest (where the
// browser has no scrollend event). A gesture timing, not something drawn.
const SCROLL_REST = 120;
// A programmatic scroll that never arrives (the strip was hidden, the person
// took it over) gives up after its own speed and this much more.
const SCROLL_GIVE_UP = 700;
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .swiper-no-swiping';
const prefersReducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// Swiper's own message words: {{index}} and {{slidesLength}}.
const formatMessage = (template, index, length) => String(template)
  .replaceAll('{{index}}', String(index + 1))
  .replaceAll('{{slidesLength}}', String(length));
const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
// The engine owns the strip's accessibility (owner decision C245): hidden
// slides inert, an edge button really disabled, slide names counted again on
// update(), no autoplay under reduced motion. a11y: false (or
// {enabled: false}) leaves all four to the caller.
const a11yOn = (params) => params.a11y !== false && !(isPlainObject(params.a11y) && params.a11y.enabled === false);
// The <button> of a navigation element: the element itself, or the one button
// inside a host (an sf-button-icon around its .sf-icon-button).
const buttonOf = (element) => {
  if (!(element instanceof Element)) return null;
  if (element instanceof HTMLButtonElement) return element;
  const inner = element.querySelectorAll('button');
  return inner.length === 1 ? inner[0] : null;
};

function resolveElement(value, root) {
  if (value instanceof Element) return value;
  if (typeof value === 'string') return root.closest('body')?.querySelector(value) || document.querySelector(value);
  return null;
}

class SimaiSlider {
  constructor(root, options = {}) {
    if (!(root instanceof Element)) throw new TypeError('Slider root must be an Element');
    this.el = root;
    this.originalParams = { ...options };
    this.params = { ...options };
    this.events = new Map();
    this.activeIndex = 0;
    this.realIndex = 0;
    this.previousIndex = 0;
    this.destroyed = false;
    this.enabled = true;
    this.rtlTranslate = getComputedStyle(root).direction === 'rtl';
    this.wrapperEl = root.querySelector('.swiper-wrapper') || root.firstElementChild;
    // The track is the browser's own scroll with snap points (owner decision
    // 2026-11-21, carousel study): a finger, a trackpad's two fingers, the
    // momentum and the rubber band at an end are the browser's; the arrows,
    // the dots, the keys and the mouse drag move the scroll. cssMode false
    // (Swiper's name) keeps the former transform strip.
    this.css = options.cssMode !== false;
    this._target = null;
    this.navigation = {};
    this.pagination = {};
    this.autoplay = this.createAutoplay();
    this.attachControls();
    this.attachKeyboard();
    if (this.css) this.attachScrollTrack();
    else this.attachPointer();
    this.attachResize();
    root.swiper = this;
    root.classList.add('swiper-initialized', 'swiper-horizontal');
    if (this.css) root.classList.add('swiper-css-mode');
    this.update();
    this.slideTo(numeric(options.initialSlide, 0), 0, false);
    queueMicrotask(() => this.emit('init'));
  }

  on(name, listener) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(listener);
    return this;
  }

  off(name, listener) {
    this.events.get(name)?.delete(listener);
    return this;
  }

  emit(name, ...args) {
    for (const listener of this.events.get(name) || []) listener(this, ...args);
  }

  attachControls() {
    const navigation = this.params.navigation || {};
    this.navigation.prevEl = resolveElement(navigation.prevEl, this.el);
    this.navigation.nextEl = resolveElement(navigation.nextEl, this.el);
    this._previous = () => this.slidePrev();
    this._next = () => this.slideNext();
    this.navigation.prevEl?.addEventListener('click', this._previous);
    this.navigation.nextEl?.addEventListener('click', this._next);
    this.pagination.el = resolveElement(this.params.pagination?.el, this.el);
    this.pagination.render = () => this.renderPagination();
    this.pagination.update = () => this.sync();
  }

  // The keys listen on keyboard.el when the caller names one (sf-slider names
  // its whole block: the arrows and dots sit outside the strip, and a key
  // pressed on them moved nothing, SL-3), else on the strip. A key pressed in
  // a field inside a slide stays the field's.
  attachKeyboard() {
    this._keyboard = (event) => {
      const enabled = this.params.keyboard === true || this.params.keyboard?.enabled;
      if (!enabled || !this.enabled || this.destroyed) return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return;
      const rtl = this.isRtl();
      if (event.key === 'ArrowRight') rtl ? this.slidePrev() : this.slideNext();
      else if (event.key === 'ArrowLeft') rtl ? this.slideNext() : this.slidePrev();
      else return;
      event.preventDefault();
    };
    this.keyboardEl = resolveElement(this.params.keyboard?.el, this.el) || this.el;
    this.keyboardEl.addEventListener('keydown', this._keyboard);
  }

  isRtl() {
    return this.rtlTranslate || getComputedStyle(this.el).direction === 'rtl';
  }

  // Swipe and drag (SL-2): a finger, a pen or the mouse pulls the strip and
  // pages when let go past DRAG_RATIO of a slide or with a flick. The strip
  // takes horizontal moves only (touch-action: pan-y in the sheet, the
  // swiper-touch class): a vertical move scrolls the page and is never taken.
  // allowTouchMove false turns it off, simulateTouch false leaves the mouse
  // out (Swiper's names). A drag never ends in a click on a link under it.
  attachPointer() {
    this._drag = null;
    const allowed = () => this.params.allowTouchMove !== false && this.enabled && !this.destroyed;
    if (this.params.allowTouchMove !== false) this.el.classList.add('swiper-touch');
    this._pointerDown = (event) => {
      if (!allowed() || !event.isPrimary) return;
      if (event.pointerType === 'mouse' && (event.button !== 0 || this.params.simulateTouch === false)) return;
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return;
      // Nothing to page: every slide is in view. With a fractional count
      // (three slides at 2.2) there is one stop more than whole slides give,
      // and a drag reaches it as the button does (RG-OT 2).
      if (!this.params.loop && this.lastIndex() === 0) return;
      this._drag = {id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, dx: 0, state: 'pending'};
    };
    this._pointerMove = (event) => {
      const drag = this._drag;
      if (!drag || event.pointerId !== drag.id || drag.state === 'off') return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (drag.state === 'pending') {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) { drag.state = 'off'; return; }
        drag.state = 'drag';
        try { this.el.setPointerCapture(event.pointerId); } catch { /* the pointer is gone */ }
        this.el.classList.add('swiper-dragging');
        if (this.wrapperEl) this.wrapperEl.style.transitionDuration = '0ms';
        this.emit('touchStart');
      }
      event.preventDefault();
      const last = this.lastIndex();
      const rtl = this.isRtl();
      // Past an edge the strip gives a third of the move: there is nothing there.
      const forward = rtl ? dx > 0 : dx < 0;
      const atEdge = !this.params.loop && ((forward && this.activeIndex >= last) || (!forward && this.activeIndex <= 0));
      drag.dx = atEdge ? dx / 3 : dx;
      this.place(drag.dx);
      this.emit('sliderMove');
    };
    this._pointerUp = (event) => {
      const drag = this._drag;
      if (!drag || event.pointerId !== drag.id) return;
      this._drag = null;
      if (drag.state !== 'drag') return;
      this.el.classList.remove('swiper-dragging');
      try { this.el.releasePointerCapture(event.pointerId); } catch { /* released */ }
      const step = this.el.clientWidth / this.perView();
      const elapsed = Math.max(1, event.timeStamp - drag.t);
      const travelled = Math.abs(drag.dx);
      const pages = event.type !== 'pointercancel'
        && (travelled > step * DRAG_RATIO || (travelled > DRAG_SLOP * 2 && travelled / elapsed > FLICK_SPEED));
      // The click that follows the release belongs to the drag, not to a link.
      const swallow = (click) => { click.preventDefault(); click.stopPropagation(); };
      this.el.addEventListener('click', swallow, {capture: true, once: true});
      window.setTimeout(() => this.el.removeEventListener('click', swallow, {capture: true}), 0);
      const forward = this.isRtl() ? drag.dx > 0 : drag.dx < 0;
      const before = this.activeIndex;
      if (pages) this.slideTo(this.activeIndex + (forward ? 1 : -1));
      if (this.activeIndex === before) {
        if (this.wrapperEl) this.wrapperEl.style.transitionDuration = `${this.settleSpeed()}ms`;
        this.sync();
      } else if (this.params.autoplay?.disableOnInteraction) {
        this.autoplay.stop();
      }
      this.emit('touchEnd');
    };
    // A picture or a link would start the browser's own drag and steal the gesture.
    this._dragStart = (event) => { if (this.params.allowTouchMove !== false) event.preventDefault(); };
    this.el.addEventListener('pointerdown', this._pointerDown);
    this.el.addEventListener('pointermove', this._pointerMove);
    this.el.addEventListener('pointerup', this._pointerUp);
    this.el.addEventListener('pointercancel', this._pointerUp);
    this.el.addEventListener('dragstart', this._dragStart);
  }

  // The scroll track (cssMode, the default since 2.0.0). The browser moves
  // the strip for a finger, a pen, a trackpad and the wheel: a horizontal
  // move pages and snaps to a slide, a vertical one scrolls the page
  // (touch-action stays the browser's). The engine follows the scroll: the
  // slide nearest to it becomes the active one. The mouse has no scroll
  // gesture of its own, so a press and drag pulls the strip (simulateTouch
  // false leaves the mouse out); allowTouchMove false leaves the strip to the
  // buttons alone. A drag never ends in a click on a link under it.
  attachScrollTrack() {
    const track = this.wrapperEl;
    if (!track) return;
    const userMoves = this.params.allowTouchMove !== false;
    if (userMoves) this.el.classList.add('swiper-touch');
    if (userMoves && this.params.simulateTouch !== false) this.el.classList.add('swiper-mouse-drag');
    this._scrollFrame = 0;
    this._restTimer = 0;
    this._scroll = () => {
      if (this.destroyed) return;
      window.clearTimeout(this._restTimer);
      this._restTimer = window.setTimeout(() => this.scrollRest(), SCROLL_REST);
      if (this._scrollFrame) return;
      this._scrollFrame = window.requestAnimationFrame(() => {
        this._scrollFrame = 0;
        this.followScroll();
      });
    };
    this._scrollEnd = () => this.scrollRest();
    // A person's own scroll takes over from a programmatic one; a vertical
    // wheel scrolls the page and is not one.
    this._takeOver = (event) => {
      if (this._drag?.state === 'drag') return;
      if (event?.type === 'wheel' && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      this.releaseTarget();
      this._userScroll = true;
    };
    this._drag = null;
    const allowed = () => userMoves && this.params.simulateTouch !== false && this.enabled && !this.destroyed;
    this._pointerDown = (event) => {
      this._takeOver();
      if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary || !allowed()) return;
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return;
      if (!this.params.loop && this.lastIndex() === 0) return;
      this._drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp,
        from: this.activeIndex, start: this.scrollPosition(), dx: 0, state: 'pending',
      };
    };
    this._pointerMove = (event) => {
      const drag = this._drag;
      if (!drag || event.pointerId !== drag.id || drag.state === 'off') return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (drag.state === 'pending') {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) { drag.state = 'off'; return; }
        drag.state = 'drag';
        try { this.el.setPointerCapture(event.pointerId); } catch { /* the pointer is gone */ }
        this.el.classList.add('swiper-dragging');
        this.emit('touchStart');
      }
      event.preventDefault();
      drag.dx = dx;
      // The strip follows the pointer: content moves with it, mirrored right to left.
      this.setScrollPosition(drag.start - (this.isRtl() ? -dx : dx), 'instant');
      this.emit('sliderMove');
    };
    this._pointerUp = (event) => {
      const drag = this._drag;
      if (!drag || event.pointerId !== drag.id) return;
      this._drag = null;
      if (drag.state !== 'drag') return;
      try { this.el.releasePointerCapture(event.pointerId); } catch { /* released */ }
      const step = this.stepSize();
      const elapsed = Math.max(1, event.timeStamp - drag.t);
      const travelled = Math.abs(drag.dx);
      const pages = event.type !== 'pointercancel'
        && (travelled > step * DRAG_RATIO || (travelled > DRAG_SLOP * 2 && travelled / elapsed > FLICK_SPEED));
      const swallow = (click) => { click.preventDefault(); click.stopPropagation(); };
      this.el.addEventListener('click', swallow, {capture: true, once: true});
      window.setTimeout(() => this.el.removeEventListener('click', swallow, {capture: true}), 0);
      const forward = this.isRtl() ? drag.dx > 0 : drag.dx < 0;
      // The snap stays off until the strip arrives: turned on under a moving
      // strip it would jump to the nearest slide first.
      this._releaseDragging = true;
      const before = this.activeIndex;
      this.slideTo(pages ? drag.from + (forward ? 1 : -1) : drag.from);
      if (this.activeIndex !== before && this.params.autoplay?.disableOnInteraction) this.autoplay.stop();
      this.emit('touchEnd');
    };
    this._dragStart = (event) => { if (userMoves) event.preventDefault(); };
    track.addEventListener('scroll', this._scroll, {passive: true});
    track.addEventListener('scrollend', this._scrollEnd);
    track.addEventListener('wheel', this._takeOver, {passive: true});
    track.addEventListener('touchstart', this._takeOver, {passive: true});
    this.el.addEventListener('pointerdown', this._pointerDown);
    this.el.addEventListener('pointermove', this._pointerMove);
    this.el.addEventListener('pointerup', this._pointerUp);
    this.el.addEventListener('pointercancel', this._pointerUp);
    this.el.addEventListener('dragstart', this._dragStart);
  }

  // The scroll in the reading direction: 0 at the first slide, growing
  // towards the last, right to left too (there scrollLeft runs negative).
  scrollPosition() {
    const left = this.wrapperEl?.scrollLeft || 0;
    return this.isRtl() ? -left : left;
  }

  setScrollPosition(position, behavior = 'instant') {
    if (!this.wrapperEl) return;
    const value = clamp(position, 0, this.maxScroll());
    this.wrapperEl.scrollTo({left: this.isRtl() ? -value : value, behavior});
  }

  maxScroll() {
    const track = this.wrapperEl;
    return track ? Math.max(0, track.scrollWidth - track.clientWidth) : 0;
  }

  // Where slide i starts, measured from the first slide in the reading direction.
  slideStart(index) {
    const slides = this.slides;
    const first = slides[0];
    const slide = slides[index];
    if (!first || !slide) return 0;
    const a = first.getBoundingClientRect();
    const b = slide.getBoundingClientRect();
    return this.isRtl() ? a.right - b.right : b.left - a.left;
  }

  // The scroll at which slide i is the active one: its start, short of the end.
  stopPosition(index) {
    return Math.min(this.slideStart(index), this.maxScroll());
  }

  stepSize() {
    if (this.css && this.slides.length > 1) return Math.abs(this.slideStart(1)) || this.el.clientWidth / this.perView();
    return this.el.clientWidth / this.perView();
  }

  // The stop nearest to the scroll: the last one at the end of the strip.
  nearestStop() {
    const position = this.scrollPosition();
    const last = this.lastIndex();
    if (position >= this.maxScroll() - 1) return last;
    let best = 0;
    let distance = Infinity;
    for (let index = 0; index <= last; index += 1) {
      const gap = Math.abs(this.stopPosition(index) - position);
      if (gap < distance) { distance = gap; best = index; }
    }
    return best;
  }

  // Scroll to the active slide's stop; smooth unless the speed is 0, the
  // person asked for less motion, or the strip is placed without travelling.
  scrollToActive(speed = this.params.speed) {
    if (!this.wrapperEl) return;
    const target = this.stopPosition(this.activeIndex);
    if (Math.abs(target - this.scrollPosition()) < 1) {
      this.releaseTarget();
      this.arrive();
      return;
    }
    const smooth = numeric(speed, 300) > 0 && !prefersReducedMotion();
    this._target = this.activeIndex;
    window.clearTimeout(this._giveUp);
    this._giveUp = window.setTimeout(() => { this.releaseTarget(); this.arrive(); }, (smooth ? numeric(speed, 300) : 0) + SCROLL_GIVE_UP);
    this.setScrollPosition(target, smooth ? 'smooth' : 'instant');
    if (!smooth) {
      this.releaseTarget();
      this.arrive();
    }
  }

  releaseTarget() {
    this._target = null;
    window.clearTimeout(this._giveUp);
  }

  // The strip came to rest where it was sent: the snap comes back after a drag.
  arrive() {
    if (this._releaseDragging) {
      this._releaseDragging = false;
      this.el.classList.remove('swiper-dragging');
    }
    this.syncVisibility();
  }

  // While the strip scrolls, the slides in view are counted again; a scroll
  // the person made moves the active slide with it (a programmatic one keeps
  // the slide it was sent to).
  followScroll() {
    if (this.destroyed) return;
    this.syncVisibility();
    if (this._target !== null) {
      if (Math.abs(this.stopPosition(this._target) - this.scrollPosition()) < 1) {
        this.releaseTarget();
        this.arrive();
      }
      return;
    }
    if (this._drag?.state === 'drag') return;
    const next = this.nearestStop();
    if (next === this.activeIndex) return;
    this.previousIndex = this.activeIndex;
    this.activeIndex = next;
    this.realIndex = next;
    this.syncControls();
    this.emit('slideChange');
    if (this._userScroll && this.autoplay.running && this.params.autoplay?.disableOnInteraction !== false) this.autoplay.stop();
    else this.autoplay.restart?.();
  }

  scrollRest() {
    if (this.destroyed) return;
    window.clearTimeout(this._restTimer);
    if (this._target !== null) {
      this.releaseTarget();
      this.arrive();
    } else if (this._releaseDragging && !this._drag) {
      this.arrive();
    } else {
      this.followScroll();
    }
    const user = this._userScroll;
    this._userScroll = false;
    if (user) this.emit('transitionEnd');
  }

  perView() {
    return Math.max(1, numeric(this.params.slidesPerView, 1));
  }

  // With a part of the next slide in view (slidesPerView 2.2, C143 (7)) the
  // last stop lays the last slide whole at the end: one stop more than whole
  // slides would give, and that stop moves the strip only as far as it can go.
  lastIndex() {
    return Math.max(0, Math.ceil(this.slides.length - this.perView() - 1e-6));
  }

  // The strip's offset in slides: the active index, short of the end.
  offsetSlides() {
    return Math.min(this.activeIndex, Math.max(0, this.slides.length - this.perView()));
  }

  // Responsive settings (breakpoints) are read again when their width changes;
  // nothing listened before, so a slider kept the count of the width it was
  // started at. The width is the strip's own (breakpointsBase 'container', the
  // default since 1.2.0: a component follows the width of its place, C181
  // (2)); breakpointsBase 'window' keeps Swiper's window width.
  attachResize() {
    this._resizeFrame = 0;
    this._resize = () => {
      if (this._resizeFrame || this.destroyed) return;
      this._resizeFrame = window.requestAnimationFrame(() => {
        this._resizeFrame = 0;
        if (this.destroyed) return;
        const before = this.perView();
        const width = this.el.clientWidth;
        // The scroll track lays the active slide at its stop again when its
        // width changed (a height change, a phone's address bar, is not one).
        const moved = width !== this._width;
        this._width = width;
        if (!this.css || this.originalParams.breakpoints || moved) this.update();
        if (this.css && moved && !this._drag) this.scrollToActive(0);
        if (this.perView() !== before) this.emit('breakpoint');
        this.emit('resize');
      });
    };
    if (!this.originalParams.breakpoints && !this.css) return;
    if (this.breakpointsBase() === 'window' || typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', this._resize);
      return;
    }
    this._resizeObserver = new ResizeObserver(this._resize);
    this._resizeObserver.observe(this.el);
  }

  breakpointsBase() {
    return this.originalParams.breakpointsBase === 'window' ? 'window' : 'container';
  }

  // The width breakpoints are read against: the strip's own, or the window's.
  breakpointsWidth() {
    if (this.breakpointsBase() === 'window') return window.innerWidth;
    return this.el.getBoundingClientRect().width;
  }

  gap() {
    return Math.max(0, numeric(this.params.spaceBetween, 0));
  }

  settleSpeed() {
    return prefersReducedMotion() ? 0 : numeric(this.params.speed, 300);
  }

  // The strip's offset for the active slide, plus a drag. With spaceBetween
  // the slides stand that far apart (SL-8): each slide is (100% - gaps) / n
  // wide and one step is (100% + gap) / n.
  place(dragX = 0) {
    if (!this.wrapperEl) return;
    const perView = this.perView();
    const gap = this.gap();
    const direction = this.isRtl() ? 1 : -1;
    const offset = this.offsetSlides();
    const shift = gap && offset
      ? `calc(${direction * offset} * (100% + ${gap}px) / ${perView})`
      : `${direction * offset * (100 / perView)}%`;
    this.wrapperEl.style.transform = dragX
      ? `translate3d(calc(${shift} + ${dragX}px), 0, 0)`
      : `translate3d(${shift}, 0, 0)`;
  }

  // Autoplay turns a slide every delay. pause() holds the time left (a
  // pointer over the slider, a hidden tab) and resume() goes on from it, so a
  // timed indicator that froze with it stays true; stop() and start() are
  // the person's. At the last slide it goes back to the first
  // (stopOnLastSlide stops there), reverseDirection turns backwards.
  createAutoplay() {
    let timer = null;
    let startedAt = 0;
    let left = 0;
    const settings = this.params.autoplay;
    const delay = () => numeric(this.params.autoplay?.delay ?? settings?.delay, 5000);
    const clear = () => { if (timer !== null) window.clearTimeout(timer); timer = null; };
    const schedule = (ms) => {
      clear();
      startedAt = Date.now();
      left = ms;
      timer = window.setTimeout(turn, ms);
    };
    const turn = () => {
      timer = null;
      if (!api.running || api.paused || this.destroyed) return;
      const options = this.params.autoplay || {};
      const back = Boolean(options.reverseDirection);
      const last = this.lastIndex();
      const atEnd = back ? this.activeIndex <= 0 : this.activeIndex >= last;
      if (atEnd && !this.params.loop) {
        if (options.stopOnLastSlide) { api.stop(); return; }
        this.slideTo(back ? last : 0);
      } else if (back) this.slidePrev();
      else this.slideNext();
      if (api.running && !api.paused && timer === null) schedule(delay());
    };
    const api = {
      running: false,
      paused: false,
      start: () => {
        if (!settings || settings.enabled === false || api.running) return false;
        // Under reduced motion the slides do not turn by themselves (C245).
        if (a11yOn(this.params) && prefersReducedMotion()) return false;
        api.running = true;
        api.paused = false;
        schedule(delay());
        this.emit('autoplayStart');
        return true;
      },
      stop: () => {
        clear();
        const wasRunning = api.running;
        api.running = false;
        api.paused = false;
        if (wasRunning) this.emit('autoplayStop');
        return wasRunning;
      },
      pause: () => {
        if (!api.running || api.paused) return false;
        clear();
        left = Math.max(0, left - (Date.now() - startedAt));
        api.paused = true;
        this.emit('autoplayPause');
        return true;
      },
      resume: () => {
        if (!api.running || !api.paused) return false;
        api.paused = false;
        schedule(left);
        this.emit('autoplayResume');
        return true;
      },
      // A slide changed: its own full time starts (held, it waits whole).
      restart: () => {
        if (!api.running) return;
        if (api.paused) { left = delay(); return; }
        schedule(delay());
      },
    };
    return api;
  }

  get slides() {
    return [...(this.wrapperEl?.children || [])].filter(node => node.classList.contains('swiper-slide'));
  }

  selectedParams() {
    const width = this.breakpointsWidth();
    const points = Object.entries(this.originalParams.breakpoints || {})
      .map(([point, value]) => [Number(point), value])
      .filter(([point]) => Number.isFinite(point) && point <= width)
      .sort((a, b) => a[0] - b[0]);
    return points.length ? { ...this.originalParams, ...points.at(-1)[1] } : { ...this.originalParams };
  }

  update() {
    const slides = this.slides;
    const selected = this.selectedParams();
    this.params = selected;
    const slidesPerView = this.perView();
    const gap = this.gap();
    const a11y = isPlainObject(this.params.a11y) ? this.params.a11y : {};
    if (this.wrapperEl) {
      if (gap) this.wrapperEl.style.gap = `${gap}px`;
      else this.wrapperEl.style.removeProperty('gap');
    }
    slides.forEach((slide, index) => {
      slide.dataset.swiperSlideIndex = String(index);
      slide.setAttribute('role', a11y.slideRole || 'group');
      // «слайд» / «slide» when the caller gives the word (SL-5).
      if (a11y.itemRoleDescriptionMessage) slide.setAttribute('aria-roledescription', a11y.itemRoleDescriptionMessage);
      // A slide the page named keeps its name («Закат»); it used to be replaced
      // by «1 / 2» on every update, before the carousel could even remember it.
      // A name the engine wrote is counted again on every update (C245, RG-OT
      // 3): it is kept in data-swiper-slide-label, so a slide copied from
      // another («1 / 2» and its mark) is renamed «3 / 3», not taken as the
      // page's own name.
      const current = slide.getAttribute('aria-label');
      if (slide.__sfAuthoredLabel === undefined || (current !== null && current !== slide.__sfAuthoredLabel
        && current !== slide.dataset.swiperSlideLabel)) {
        slide.__sfAuthoredLabel = current !== null && current === slide.dataset.swiperSlideLabel ? '' : (current ?? '');
      }
      const label = slide.__sfAuthoredLabel
        || formatMessage(a11y.slideLabelMessage || '{{index}} / {{slidesLength}}', index, slides.length);
      if (slide.__sfAuthoredLabel) delete slide.dataset.swiperSlideLabel;
      else slide.dataset.swiperSlideLabel = label;
      slide.setAttribute('aria-label', label);
      slide.style.flexBasis = gap && slidesPerView > 1
        ? `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`
        : `${100 / slidesPerView}%`;
    });
    this.activeIndex = clamp(this.activeIndex, 0, this.lastIndex());
    this.realIndex = this.activeIndex;
    this.renderPagination();
    this.sync();
    if (this.css && this._target === null && !this._drag) this.scrollToActive(0);
    if (this.params.autoplay && !this.autoplay.running) this.autoplay.start();
    this.emit('update');
    return this;
  }

  // Pagination: bullets (a button per slide) or, with type 'fraction', the
  // words «2 / 12» (C143 (4): many slides are counted, not dotted). With
  // keyboard on, the bullets are one Tab stop: the current one takes the
  // focus, ArrowLeft / ArrowRight, Home and End move the slide and the focus
  // with it (C143 (5), the APG tabbed carousel's picker), mirrored right to
  // left.
  renderPagination() {
    const root = this.pagination.el;
    if (!root) return;
    const options = this.params.pagination || {};
    root.replaceChildren();
    root.removeEventListener('keydown', this._paginationKeys || (() => {}));
    if (options.type === 'fraction') {
      root.append(Object.assign(document.createElement('span'), {className: options.currentClass || 'swiper-pagination-current'}));
      root.append(document.createTextNode(' / '));
      root.append(Object.assign(document.createElement('span'), {className: options.totalClass || 'swiper-pagination-total'}));
      return;
    }
    this.slides.forEach((_, index) => {
      const bullet = document.createElement(options.bulletElement || 'span');
      bullet.className = options.bulletClass || 'swiper-pagination-bullet';
      if (bullet instanceof HTMLButtonElement) bullet.type = 'button';
      // The number has its place in the word ({n}): «Go to slide 3», «Folie 3
      // anzeigen» (C177 (9)). A word registered before 2026-11-14 has none; it is put after.
      const go = pageText(SWIPER_TEXT, 'goToSlide', root, 'sf-swiper');
      const number = new Intl.NumberFormat(pageLocale(root)).format(index + 1);
      bullet.setAttribute('aria-label', go.includes('{n}') ? go.replace('{n}', number) : `${go} ${number}`);
      if (options.clickable) bullet.addEventListener('click', () => this.slideTo(index));
      root.append(bullet);
    });
    if (options.keyboard) {
      this._paginationKeys = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !this.enabled) return;
        const rtl = this.isRtl();
        const last = this.slides.length - 1;
        const moves = {
          ArrowRight: rtl ? -1 : 1,
          ArrowLeft: rtl ? 1 : -1,
        };
        let next;
        if (event.key in moves) next = this.activeIndex + moves[event.key];
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = last;
        else return;
        event.preventDefault();
        // The picker's own keys: the strip's keyboard option does not page twice.
        event.stopPropagation();
        if (this.params.loop) next = ((next % (last + 1)) + last + 1) % (last + 1);
        this.slideTo(clamp(next, 0, last));
        root.children[this.activeIndex]?.focus?.();
      };
      root.addEventListener('keydown', this._paginationKeys);
    }
  }

  sync() {
    this.syncVisibility();
    if (this.wrapperEl && !this.css) {
      this.place();
      this.wrapperEl.style.transitionDuration = `${numeric(this.params.speed, 300)}ms`;
    }
    return this.syncControls();
  }

  // In view: every slide the window shows a part of. The transform strip
  // counts it from the offset (short of the end at the last stop) to offset +
  // slidesPerView; the scroll track measures it, as a finger may hold the
  // strip anywhere (a strip not laid out yet is counted as the transform's).
  syncVisibility() {
    const slides = this.slides;
    const a11y = a11yOn(this.params);
    const slidesPerView = this.perView();
    const offset = this.offsetSlides();
    const track = this.wrapperEl;
    const measured = this.css && track && track.clientWidth > 0;
    const position = measured ? this.scrollPosition() : 0;
    const width = measured ? track.clientWidth : 0;
    slides.forEach((slide, index) => {
      const active = index === this.activeIndex;
      let visible;
      if (measured) {
        const start = this.slideStart(index);
        const size = slide.getBoundingClientRect().width;
        visible = start + size > position + 1 && start < position + width - 1;
      } else {
        visible = index + 1 > offset + 1e-6 && index < offset + slidesPerView - 1e-6;
      }
      slide.classList.toggle('swiper-slide-active', active);
      slide.classList.toggle('swiper-slide-visible', visible);
      slide.setAttribute('aria-hidden', String(!visible));
      // A hidden slide's links and buttons leave the Tab order (C245); an
      // inert the page wrote stays.
      if (a11y) {
        if (slide.__sfAuthoredInert === undefined) slide.__sfAuthoredInert = slide.hasAttribute('inert');
        slide.toggleAttribute('inert', !visible || slide.__sfAuthoredInert);
      }
    });
  }

  // The arrows at an edge, the dots or the counter, after the active slide moved.
  syncControls() {
    const slides = this.slides;
    const a11y = a11yOn(this.params);
    const disabledClass = this.params.navigation?.disabledClass || 'swiper-button-disabled';
    const looping = Boolean(this.params.loop);
    const edges = [
      [this.navigation.prevEl, !looping && this.activeIndex === 0],
      [this.navigation.nextEl, !looping && this.activeIndex === this.lastIndex()],
    ];
    edges.forEach(([element, off]) => element?.classList.toggle(disabledClass, off));
    if (a11y) this.disableEdgeButtons(edges);
    const pagination = this.params.pagination || {};
    if (pagination.type === 'fraction' && this.pagination.el) {
      const current = this.pagination.el.querySelector(`.${pagination.currentClass || 'swiper-pagination-current'}`);
      const total = this.pagination.el.querySelector(`.${pagination.totalClass || 'swiper-pagination-total'}`);
      if (current) current.textContent = String(this.activeIndex + 1);
      if (total) total.textContent = String(slides.length);
      return this;
    }
    const activeClass = pagination.bulletActiveClass || 'swiper-pagination-bullet-active';
    [...(this.pagination.el?.children || [])].forEach((bullet, index) => {
      const active = index === this.activeIndex;
      bullet.classList.toggle(activeClass, active);
      if (active) bullet.setAttribute('aria-current', 'true');
      else bullet.removeAttribute('aria-current');
      if (pagination.keyboard) bullet.tabIndex = active ? 0 : -1;
    });
    return this;
  }

  // A button with nowhere to go is a disabled button (C245, RG-OT 1): out of
  // the Tab order, drawn by its own disabled look; the mark class stays for a
  // non-button arrow. When the focus is on the button that stops, it moves to
  // the other one, so it does not fall to the page.
  disableEdgeButtons(edges) {
    const buttons = edges.map(([element, off]) => {
      const button = buttonOf(element);
      // A button the page disabled stays disabled.
      if (button && button.__sfSwiperDisabled === undefined) button.__sfSwiperDisabled = button.disabled;
      return [button, off || Boolean(button?.__sfSwiperDisabled)];
    });
    buttons.forEach(([button, off], index) => {
      if (!button || button.disabled === off) return;
      if (off && button === button.ownerDocument?.activeElement) {
        const [other, otherOff] = buttons[1 - index];
        if (other && !otherOff) {
          other.disabled = false;
          other.focus?.();
        }
      }
      button.disabled = off;
    });
  }

  slideTo(index, speed = this.params.speed, runCallbacks = true) {
    const length = this.slides.length;
    if (!length || !this.enabled) return this;
    let next = Number(index) || 0;
    if (this.params.loop) next = ((next % length) + length) % length;
    else next = clamp(next, 0, this.lastIndex());
    const changed = next !== this.activeIndex;
    // The slide shown before the change (SL-7), as Swiper's previousIndex.
    if (changed) this.previousIndex = this.activeIndex;
    this.activeIndex = next;
    this.realIndex = next;
    if (this.css) {
      this.syncControls();
      this.scrollToActive(speed);
      if (changed) this.autoplay.restart();
      if (changed && runCallbacks) this.emit('slideChange');
      if (runCallbacks) queueMicrotask(() => this.emit('transitionEnd'));
      return this;
    }
    if (this.wrapperEl) this.wrapperEl.style.transitionDuration = `${numeric(speed, 300)}ms`;
    this.sync();
    if (changed) this.autoplay.restart();
    if (changed && runCallbacks) this.emit('slideChange');
    if (runCallbacks) queueMicrotask(() => this.emit('transitionEnd'));
    return this;
  }

  slideNext() { return this.slideTo(this.activeIndex + 1); }
  slidePrev() { return this.slideTo(this.activeIndex - 1); }
  changeLanguageDirection(direction) {
    this.rtlTranslate = direction === 'rtl';
    this.el.dir = direction;
    return this.sync();
  }
  enable() { this.enabled = true; return this; }
  disable() { this.enabled = false; return this; }

  destroy(deleteInstance = true, cleanStyles = true) {
    if (this.destroyed) return;
    this.autoplay.stop();
    this.navigation.prevEl?.removeEventListener('click', this._previous);
    this.navigation.nextEl?.removeEventListener('click', this._next);
    this.keyboardEl?.removeEventListener('keydown', this._keyboard);
    if (this._paginationKeys) this.pagination.el?.removeEventListener('keydown', this._paginationKeys);
    window.removeEventListener('resize', this._resize);
    this._resizeObserver?.disconnect();
    if (this._resizeFrame) window.cancelAnimationFrame(this._resizeFrame);
    this.el.removeEventListener('pointerdown', this._pointerDown);
    this.el.removeEventListener('pointermove', this._pointerMove);
    this.el.removeEventListener('pointerup', this._pointerUp);
    this.el.removeEventListener('pointercancel', this._pointerUp);
    this.el.removeEventListener('dragstart', this._dragStart);
    if (this.css && this.wrapperEl) {
      this.wrapperEl.removeEventListener('scroll', this._scroll);
      this.wrapperEl.removeEventListener('scrollend', this._scrollEnd);
      this.wrapperEl.removeEventListener('wheel', this._takeOver);
      this.wrapperEl.removeEventListener('touchstart', this._takeOver);
    }
    if (this._scrollFrame) window.cancelAnimationFrame(this._scrollFrame);
    window.clearTimeout(this._restTimer);
    window.clearTimeout(this._giveUp);
    this.el.classList.remove('swiper-touch', 'swiper-dragging', 'swiper-mouse-drag', 'swiper-css-mode');
    if (cleanStyles && this.wrapperEl) this.wrapperEl.removeAttribute('style');
    this.slides.forEach(slide => {
      slide.classList.remove('swiper-slide-active', 'swiper-slide-visible');
      slide.removeAttribute('aria-hidden');
      if (slide.__sfAuthoredInert !== undefined) slide.toggleAttribute('inert', slide.__sfAuthoredInert);
      delete slide.__sfAuthoredInert;
      if (cleanStyles) slide.style.removeProperty('flex-basis');
    });
    [this.navigation.prevEl, this.navigation.nextEl].map(buttonOf).forEach((button) => {
      if (!button || button.__sfSwiperDisabled === undefined) return;
      button.disabled = button.__sfSwiperDisabled;
      delete button.__sfSwiperDisabled;
    });
    this.el.classList.remove('swiper-initialized', 'swiper-horizontal');
    this.destroyed = true;
    if (deleteInstance) delete this.el.swiper;
    this.emit('destroy');
    this.events.clear();
  }
}

if (typeof window !== 'undefined') window.Swiper = SimaiSlider;
export default SimaiSlider;
