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
    this.destroyed = false;
    this.enabled = true;
    this.rtlTranslate = getComputedStyle(root).direction === 'rtl';
    this.wrapperEl = root.querySelector('.swiper-wrapper') || root.firstElementChild;
    this.navigation = {};
    this.pagination = {};
    this.autoplay = this.createAutoplay();
    this.attachControls();
    this.attachKeyboard();
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

  attachKeyboard() {
    this._keyboard = (event) => {
      const enabled = this.params.keyboard === true || this.params.keyboard?.enabled;
      if (!enabled || !this.enabled || this.destroyed) return;
      if (event.key === 'ArrowRight') this.rtlTranslate ? this.slidePrev() : this.slideNext();
      else if (event.key === 'ArrowLeft') this.rtlTranslate ? this.slideNext() : this.slidePrev();
      else return;
      event.preventDefault();
    };
    this.el.addEventListener('keydown', this._keyboard);
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
    const slidesPerView = Math.max(1, numeric(this.params.slidesPerView, 1));
    slides.forEach((slide, index) => {
      slide.dataset.swiperSlideIndex = String(index);
      slide.setAttribute('role', 'group');
      // A slide the page named keeps its name («Закат»); it used to be replaced
      // by «1 / 2» on every update, before the carousel could even remember it.
      if (slide.__sfAuthoredLabel === undefined) {
        slide.__sfAuthoredLabel = slide.getAttribute('aria-label') ?? '';
      }
      slide.setAttribute('aria-label', slide.__sfAuthoredLabel || `${index + 1} / ${slides.length}`);
      slide.style.flexBasis = `${100 / slidesPerView}%`;
    });
    this.activeIndex = clamp(this.activeIndex, 0, Math.max(0, slides.length - Math.ceil(slidesPerView)));
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
    const slidesPerView = Math.max(1, numeric(this.params.slidesPerView, 1));
    const lastVisibleIndex = this.activeIndex + Math.ceil(slidesPerView) - 1;
    slides.forEach((slide, index) => {
      const active = index === this.activeIndex;
      const visible = index >= this.activeIndex && index <= lastVisibleIndex;
      slide.classList.toggle('swiper-slide-active', active);
      slide.classList.toggle('swiper-slide-visible', visible);
      slide.setAttribute('aria-hidden', String(!visible));
    });
    if (this.wrapperEl) {
      const direction = this.rtlTranslate ? 1 : -1;
      this.wrapperEl.style.transform = `translate3d(${direction * this.activeIndex * (100 / slidesPerView)}%, 0, 0)`;
      this.wrapperEl.style.transitionDuration = `${numeric(this.params.speed, 300)}ms`;
    }
    const disabledClass = this.params.navigation?.disabledClass || 'swiper-button-disabled';
    const looping = Boolean(this.params.loop);
    this.navigation.prevEl?.classList.toggle(disabledClass, !looping && this.activeIndex === 0);
    this.navigation.nextEl?.classList.toggle(disabledClass, !looping && this.activeIndex === Math.max(0, slides.length - Math.ceil(slidesPerView)));
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
    else next = clamp(next, 0, Math.max(0, length - Math.ceil(Math.max(1, numeric(this.params.slidesPerView, 1)))));
    const changed = next !== this.activeIndex;
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
    this.el.removeEventListener('keydown', this._keyboard);
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
