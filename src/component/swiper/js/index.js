import { pageText } from '../../../core/js/page-language';
// Every word this part says. A product adds a language with
// SF.language.register('sf-swiper', code, words); a ternary on «ru» allowed two
// and no more.
const SWIPER_TEXT = {
  en: {
    goToSlide: 'Go to slide',
  },
  ru: {
    goToSlide: 'Перейти к слайду',
  },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// A press becomes a drag after this many pixels; below it a press stays a
// click (a link, a button inside the slide). It is a gesture tolerance, not
// something drawn.
const DRAG_SLOP = 6;
// A drag pages when it travelled this part of one slide, or moved fast.
const DRAG_RATIO = 0.15;
const FLICK_SPEED = 0.4; // px per ms
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .swiper-no-swiping';
const prefersReducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// Swiper's own message words: {{index}} and {{slidesLength}}.
const formatMessage = (template, index, length) => String(template)
  .replaceAll('{{index}}', String(index + 1))
  .replaceAll('{{slidesLength}}', String(length));
const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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
    this.navigation = {};
    this.pagination = {};
    this.autoplay = this.createAutoplay();
    this.attachControls();
    this.attachKeyboard();
    this.attachPointer();
    root.swiper = this;
    root.classList.add('swiper-initialized', 'swiper-horizontal');
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
      if (this.slides.length <= Math.ceil(this.perView())) return;
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

  perView() {
    return Math.max(1, numeric(this.params.slidesPerView, 1));
  }

  lastIndex() {
    return Math.max(0, this.slides.length - Math.ceil(this.perView()));
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
    const shift = gap && this.activeIndex
      ? `calc(${direction * this.activeIndex} * (100% + ${gap}px) / ${perView})`
      : `${direction * this.activeIndex * (100 / perView)}%`;
    this.wrapperEl.style.transform = dragX
      ? `translate3d(calc(${shift} + ${dragX}px), 0, 0)`
      : `translate3d(${shift}, 0, 0)`;
  }

  createAutoplay() {
    let timer = null;
    const settings = this.params.autoplay;
    const api = {
      running: false,
      start: () => {
        if (!settings || settings.enabled === false || api.running) return false;
        api.running = true;
        timer = window.setInterval(() => this.slideNext(), numeric(settings.delay, 5000));
        this.emit('autoplayStart');
        return true;
      },
      stop: () => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
        const wasRunning = api.running;
        api.running = false;
        if (wasRunning) this.emit('autoplayStop');
        return wasRunning;
      },
      pause: () => api.stop(),
      resume: () => api.start(),
    };
    return api;
  }

  get slides() {
    return [...(this.wrapperEl?.children || [])].filter(node => node.classList.contains('swiper-slide'));
  }

  selectedParams() {
    const points = Object.entries(this.originalParams.breakpoints || {})
      .map(([point, value]) => [Number(point), value])
      .filter(([point]) => Number.isFinite(point) && point <= window.innerWidth)
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
      if (slide.__sfAuthoredLabel === undefined) {
        slide.__sfAuthoredLabel = slide.getAttribute('aria-label') ?? '';
      }
      slide.setAttribute('aria-label', slide.__sfAuthoredLabel
        || formatMessage(a11y.slideLabelMessage || '{{index}} / {{slidesLength}}', index, slides.length));
      slide.style.flexBasis = gap && slidesPerView > 1
        ? `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`
        : `${100 / slidesPerView}%`;
    });
    this.activeIndex = clamp(this.activeIndex, 0, this.lastIndex());
    this.realIndex = this.activeIndex;
    this.renderPagination();
    this.sync();
    if (this.params.autoplay && !this.autoplay.running) this.autoplay.start();
    return this;
  }

  renderPagination() {
    const root = this.pagination.el;
    if (!root) return;
    const options = this.params.pagination || {};
    root.replaceChildren();
    this.slides.forEach((_, index) => {
      const bullet = document.createElement(options.bulletElement || 'span');
      bullet.className = options.bulletClass || 'swiper-pagination-bullet';
      if (bullet instanceof HTMLButtonElement) bullet.type = 'button';
      bullet.setAttribute('aria-label', `${pageText(SWIPER_TEXT, 'goToSlide', root, 'sf-swiper')} ${index + 1}`);
      if (options.clickable) bullet.addEventListener('click', () => this.slideTo(index));
      root.append(bullet);
    });
  }

  sync() {
    const slides = this.slides;
    const slidesPerView = this.perView();
    const lastVisibleIndex = this.activeIndex + Math.ceil(slidesPerView) - 1;
    slides.forEach((slide, index) => {
      const active = index === this.activeIndex;
      const visible = index >= this.activeIndex && index <= lastVisibleIndex;
      slide.classList.toggle('swiper-slide-active', active);
      slide.classList.toggle('swiper-slide-visible', visible);
      slide.setAttribute('aria-hidden', String(!visible));
    });
    if (this.wrapperEl) {
      this.place();
      this.wrapperEl.style.transitionDuration = `${numeric(this.params.speed, 300)}ms`;
    }
    const disabledClass = this.params.navigation?.disabledClass || 'swiper-button-disabled';
    const looping = Boolean(this.params.loop);
    this.navigation.prevEl?.classList.toggle(disabledClass, !looping && this.activeIndex === 0);
    this.navigation.nextEl?.classList.toggle(disabledClass, !looping && this.activeIndex === this.lastIndex());
    const activeClass = this.params.pagination?.bulletActiveClass || 'swiper-pagination-bullet-active';
    [...(this.pagination.el?.children || [])].forEach((bullet, index) => {
      bullet.classList.toggle(activeClass, index === this.activeIndex);
      if (index === this.activeIndex) bullet.setAttribute('aria-current', 'true');
      else bullet.removeAttribute('aria-current');
    });
    return this;
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
    if (this.wrapperEl) this.wrapperEl.style.transitionDuration = `${numeric(speed, 300)}ms`;
    this.sync();
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
    this.el.removeEventListener('pointerdown', this._pointerDown);
    this.el.removeEventListener('pointermove', this._pointerMove);
    this.el.removeEventListener('pointerup', this._pointerUp);
    this.el.removeEventListener('pointercancel', this._pointerUp);
    this.el.removeEventListener('dragstart', this._dragStart);
    this.el.classList.remove('swiper-touch', 'swiper-dragging');
    if (cleanStyles && this.wrapperEl) this.wrapperEl.removeAttribute('style');
    this.slides.forEach(slide => {
      slide.classList.remove('swiper-slide-active', 'swiper-slide-visible');
      slide.removeAttribute('aria-hidden');
      if (cleanStyles) slide.style.removeProperty('flex-basis');
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
