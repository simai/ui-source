import { tagSelector } from '../../../core/js/tag-aliases.js';
import { pageText } from '../../../core/js/page-language';
import { BREAKPOINTS } from '../../../core/js/breakpoints.js';

// The words a slider says about itself (SL-5), for the class block; sf-slider
// hands its own from lang/ through the root's attributes, which win. A product
// adds a language with SF.language.register('sf-slider', code, words).
const SLIDER_TEXT = {
  en: {
    label: 'Slides',
    carousel: 'carousel',
    slide: 'slide',
    position: '{n} of {count}',
    pause: 'Stop slides',
    play: 'Start slides',
    thumb: 'Go to slide {n}',
  },
  ru: {
    label: 'Слайды',
    carousel: 'карусель',
    slide: 'слайд',
    position: '{n} из {count}',
    pause: 'Остановить прокрутку',
    play: 'Запустить прокрутку',
    thumb: 'Перейти к слайду {n}',
  },
};

const SLIDER_SELECTOR = '.sf-slider';
// Up to seven slides are dots; from eight a counter «2 / 12» stands in their
// place (C143 (4), as sf-gallery counts pictures, C97).
const DOTS_LIMIT = 7;
// Cards (sf-slider--content: news, reviews, products) show the next card's
// edge (C143 (7)): 1.15 cards on a phone, 2.2 from the sm step up.
const PEEK_PER_VIEW = 1.15;
const PEEK_PER_VIEW_WIDE = 2.2;
const SLIDER_BOUND_FLAG = 'sfSliderBound';
const SLIDER_WAITING_FLAG = 'sfSliderWaiting';
const SWIPER_NESTED_OPTION_PREFIXES = [
  'a11y',
  'autoplay',
  'cardsEffect',
  'coverflowEffect',
  'creativeEffect',
  'cubeEffect',
  'fadeEffect',
  'flipEffect',
  'freeMode',
  'grid',
  'keyboard',
  'mousewheel',
  'scrollbar',
  'thumbs',
  'virtual',
];

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSlidesPerView(value, fallback = 1) {
  if (String(value || '').trim().toLowerCase() === 'auto') return 'auto';
  return toNumber(value, fallback);
}

function resolveCssLength(element, property, fallback = 0) {
  if (!(element instanceof HTMLElement)) return fallback;

  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'inline-size:0',
    `margin-inline-start:var(${property})`,
  ].join(';');
  element.append(probe);
  const value = Number.parseFloat(getComputedStyle(probe).marginInlineStart);
  probe.remove();
  return Number.isFinite(value) ? value : fallback;
}

function resolveCssDuration(element, property, fallback = 300) {
  if (!(element instanceof HTMLElement)) return fallback;

  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    `transition-duration:var(${property})`,
  ].join(';');
  element.append(probe);
  const value = getComputedStyle(probe).transitionDuration.trim();
  probe.remove();

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return value.endsWith('ms') ? parsed : parsed * 1000;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getOption(root, element, name) {
  return element?.dataset?.[name] ?? root?.dataset?.[name];
}

function lowerFirst(value = '') {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : '';
}

function parseDataValue(value) {
  const normalized = String(value ?? '').trim();

  if (normalized === '') return '';
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (normalized === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);

  if (
    (normalized.startsWith('{') && normalized.endsWith('}')) ||
    (normalized.startsWith('[') && normalized.endsWith(']'))
  ) {
    try {
      return JSON.parse(normalized);
    } catch (error) {
      console.warn('SF slider: invalid data-swiper-options JSON', error);
    }
  }

  return normalized;
}

function isPlainObject(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Element)
  );
}

function deepMerge(target = {}, source = {}) {
  const result = { ...target };

  Object.entries(source || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function setSwiperDataOption(options, datasetKey, value) {
  if (!datasetKey.startsWith('swiper') || datasetKey === 'swiperOptions') {
    return;
  }

  const optionName = lowerFirst(datasetKey.slice('swiper'.length));
  if (!optionName) return;

  const nestedPrefix = SWIPER_NESTED_OPTION_PREFIXES.find((prefix) => {
    const rest = optionName.slice(prefix.length);
    return optionName === prefix ||
      (optionName.startsWith(prefix) && /^[A-Z]/.test(rest));
  });

  if (nestedPrefix && optionName !== nestedPrefix) {
    const nestedName = lowerFirst(optionName.slice(nestedPrefix.length));
    options[nestedPrefix] = {
      ...(isPlainObject(options[nestedPrefix]) ? options[nestedPrefix] : {}),
      [nestedName]: value,
    };
    return;
  }

  options[optionName] = value;
}

function collectSwiperDataOptions(...elements) {
  return elements.reduce((options, element) => {
    if (!element?.dataset) return options;

    if (element.dataset.swiperOptions) {
      const parsedOptions = parseDataValue(element.dataset.swiperOptions);
      if (isPlainObject(parsedOptions)) {
        options = deepMerge(options, parsedOptions);
      }
    }

    // Only the data-swiper-* attributes are options; the block's own words
    // (data-slide-label «{n} из {count}») are not JSON and stay unread here.
    Object.entries(element.dataset).forEach(([key, value]) => {
      if (!key.startsWith('swiper') || key === 'swiperOptions') return;
      setSwiperDataOption(options, key, parseDataValue(value));
    });

    return options;
  }, {});
}

function normalizeAutoplayOptions(options = {}) {
  if (options.autoplay === true) {
    options.autoplay = { enabled: true };
  } else if (isPlainObject(options.autoplay)) {
    options.autoplay = {
      enabled: true,
      ...options.autoplay,
    };
  }

  return options;
}

function createPaginationOptions(paginationEl, slidesCount) {
  if (!paginationEl) return undefined;

  // From eight slides the dots give way to a counter; the slides' own names
  // («2 из 12») and the live strip say it to a reader, so the counter is
  // only drawn.
  if (slidesCount > DOTS_LIMIT) {
    paginationEl.classList.add('sf-slider-dots--count');
    paginationEl.setAttribute('aria-hidden', 'true');
    return {
      el: paginationEl,
      type: 'fraction',
      currentClass: 'sf-slider-dots-current',
      totalClass: 'sf-slider-dots-total',
    };
  }
  paginationEl.classList.remove('sf-slider-dots--count');
  paginationEl.removeAttribute('aria-hidden');
  return {
    el: paginationEl,
    bulletActiveClass: 'active',
    bulletClass: 'sf-slider-dots-dot',
    bulletElement: 'button',
    clickable: true,
    // One Tab stop for all the dots; the arrow keys page (C143 (5)).
    keyboard: true,
  };
}

function isContentSlider(root) {
  return root.classList.contains('sf-slider--content');
}

// Cards peek (C143 (7)) unless the page chose how many are in view.
function hasAuthoredPerView(root, element) {
  return getOption(root, element, 'slidesPerView') !== undefined
    || [root, element].some((node) => node?.dataset?.swiperSlidesPerView !== undefined
      || /slidesPerView|breakpoints/.test(node?.dataset?.swiperOptions || ''));
}

function createNavigationOptions(prevEl, nextEl) {
  if (!prevEl && !nextEl) return undefined;

  return {
    disabledClass: 'swiper-button-disabled',
    hiddenClass: 'swiper-button-hidden',
    lockClass: 'swiper-button-lock',
    nextEl,
    prevEl,
  };
}

// The Framework's slider takes no `thumbs` option, so a thumbnail was a picture
// that did nothing. A thumbnail moves the main slider to its slide, and the one
// shown is marked.
// A thumbnail is a button (GL-2, SL-12): named by its picture's alt, else
// «Перейти к слайду 2»; the thumbnails are one Tab stop -- the current one --
// and ArrowLeft / ArrowRight (mirrored right to left), Home and End move the
// slide and the focus with it, as the dots do (C143 (5)); Enter and Space
// press it.
function thumbnailName(root, slide, index) {
  const alt = slide.querySelector('img[alt], [aria-label]');
  const own = alt?.getAttribute('alt') ?? alt?.getAttribute('aria-label');
  return own?.trim() || sliderWord(root, 'thumb').replaceAll('{n}', String(index + 1));
}

function linkThumbnails(root, slider, thumbs) {
  if (!slider || !thumbs?.slides?.length) return () => {};
  const slides = Array.from(thumbs.slides);
  const authored = slides.map((slide) => ({
    role: slide.getAttribute('role'),
    tabindex: slide.getAttribute('tabindex'),
    label: slide.getAttribute('aria-label'),
  }));
  // The page's own name, as the engine kept it before writing «1 / 6».
  const names = slides.map((slide, index) => (slide.__sfAuthoredLabel ?? authored[index].label)?.trim?.()
    || thumbnailName(root, slide, index));
  const name = () => slides.forEach((slide, index) => {
    slide.setAttribute('role', 'button');
    slide.setAttribute('aria-label', names[index]);
  });
  const mark = () => {
    slides.forEach((slide, index) => {
      const active = index === slider.activeIndex;
      slide.classList.toggle('swiper-slide-thumb-active', active);
      slide.tabIndex = active ? 0 : -1;
      if (active) slide.setAttribute('aria-current', 'true');
      else slide.removeAttribute('aria-current');
    });
  };
  const listeners = slides.map((slide, index) => {
    const listener = () => slider.slideTo(index);
    slide.addEventListener('click', listener);
    return [slide, listener];
  });
  const onKey = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const slide = event.target instanceof Element ? event.target.closest('.swiper-slide') : null;
    const at = slides.indexOf(slide);
    if (at < 0) return;
    const rtl = getComputedStyle(thumbs.el).direction === 'rtl';
    const last = slides.length - 1;
    let next;
    if (event.key === 'Enter' || event.key === ' ') next = at;
    else if (event.key === 'ArrowRight') next = at + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') next = at + (rtl ? 1 : -1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    // The thumbnails' own keys: the strip's keyboard option does not page twice.
    event.stopPropagation();
    if (slider.params?.loop) next = ((next % (last + 1)) + last + 1) % (last + 1);
    next = Math.min(Math.max(next, 0), last);
    slider.slideTo(next);
    mark();
    slides[next]?.focus?.();
  };
  // The thumbnails' engine names its slides again on every update.
  const onUpdate = () => { name(); mark(); };
  thumbs.el.addEventListener('keydown', onKey);
  thumbs.on?.('update', onUpdate);
  slider.on?.('slideChange', mark);
  name();
  mark();
  return () => {
    listeners.forEach(([slide, listener]) => slide.removeEventListener('click', listener));
    thumbs.el.removeEventListener('keydown', onKey);
    thumbs.off?.('update', onUpdate);
    slider.off?.('slideChange', mark);
    slides.forEach((slide, index) => {
      if (!slide.isConnected) return;
      [['role', authored[index].role], ['tabindex', authored[index].tabindex], ['aria-label', authored[index].label]]
        .forEach(([attr, value]) => (value === null ? slide.removeAttribute(attr) : slide.setAttribute(attr, value)));
      slide.removeAttribute('aria-current');
    });
  };
}

function getNavigationLabels(prevEl, nextEl) {
  return [[prevEl, 'prevSlideMessage'], [nextEl, 'nextSlideMessage']]
    .filter(([element]) => element instanceof Element)
    .map(([element, message]) => ({
      element,
      message,
      authored: element.getAttribute('aria-label'),
    }));
}

function applyNavigationLabelDefaults(options, labels) {
  if (options.a11y === false) return;
  const defaults = {};
  labels.forEach(({ message, authored }) => {
    if (authored?.trim()) defaults[message] = authored;
  });
  options.a11y = {
    ...defaults,
    ...(isPlainObject(options.a11y) ? options.a11y : {}),
  };
}

function createAutoplayOptions(root, element) {
  const autoplay = toBoolean(getOption(root, element, 'autoplay'), false);
  if (!autoplay) return undefined;

  return {
    enabled: true,
    delay: toNumber(getOption(root, element, 'autoplayDelay'), 3000),
    disableOnInteraction: toBoolean(
      getOption(root, element, 'autoplayDisableOnInteraction'),
      true,
    ),
    pauseOnMouseEnter: toBoolean(
      getOption(root, element, 'autoplayPauseOnMouseEnter'),
      false,
    ),
    reverseDirection: toBoolean(
      getOption(root, element, 'autoplayReverseDirection'),
      false,
    ),
    stopOnLastSlide: toBoolean(
      getOption(root, element, 'autoplayStopOnLastSlide'),
      false,
    ),
  };
}

function createBaseOptions(root, element, fallbackSlidesPerView = 1) {
  const peek = element instanceof Element && !element.classList.contains('sf-slider-thumbnails')
    && isContentSlider(root)
    && !hasAuthoredPerView(root, element);
  let options = {
    centeredSlides: toBoolean(getOption(root, element, 'centeredSlides'), false),
    loop: toBoolean(getOption(root, element, 'loop'), false),
    slidesPerView: toSlidesPerView(
      getOption(root, element, 'slidesPerView'),
      fallbackSlidesPerView,
    ),
    spaceBetween: toNumber(
      getOption(root, element, 'spaceBetween'),
      resolveCssLength(root, '--sf-slider--space-between', 0),
    ),
    speed: toNumber(
      getOption(root, element, 'speed'),
      resolveCssDuration(root, '--sf-slider--duration', 300),
    ),
    watchSlidesProgress: true,
  };
  if (peek) {
    options.slidesPerView = PEEK_PER_VIEW;
    // From the sm step of the Framework's ladder (rem, as the sheets write it).
    const from = Number.parseFloat(BREAKPOINTS.sm) * 16;
    options.breakpoints = { [from]: { slidesPerView: PEEK_PER_VIEW_WIDE } };
  }
  const autoplay = createAutoplayOptions(root, element);

  if (autoplay) {
    options.autoplay = autoplay;
  }

  options = deepMerge(options, collectSwiperDataOptions(root, element));

  if (prefersReducedMotion()) {
    options.speed = 0;
    delete options.autoplay;
  }

  return normalizeAutoplayOptions(options);
}

function createSlideInteractivityGuard(slider) {
  const authoredState = new Map();

  const sync = () => {
    const slides = Array.from(slider?.slides || []);
    slides.forEach((slide) => {
      if (!(slide instanceof HTMLElement)) return;
      if (!authoredState.has(slide)) {
        authoredState.set(slide, slide.hasAttribute('inert'));
      }

      const reachable = slide.classList.contains('swiper-slide-visible') ||
        slide.classList.contains('swiper-slide-active');
      if (!reachable) {
        slide.setAttribute('inert', '');
      } else if (!authoredState.get(slide)) {
        slide.removeAttribute('inert');
      }
    });
  };

  ['init', 'slideChange', 'transitionEnd', 'update', 'resize'].forEach((event) => {
    slider?.on?.(event, sync);
  });
  sync();

  return () => {
    ['init', 'slideChange', 'transitionEnd', 'update', 'resize'].forEach((event) => {
      slider?.off?.(event, sync);
    });
    authoredState.forEach((authored, slide) => {
      if (!slide.isConnected) return;
      if (authored) slide.setAttribute('inert', '');
      else slide.removeAttribute('inert');
    });
  };
}

// An arrow with nowhere to go is disabled, not only pale. Swiper marks it with
// swiper-button-disabled and the sheet takes pointer events away, but the
// button kept its tab stop and a keyboard press did nothing (docs pre-check
// 2026-11-10 SL-04). The native button is disabled with the mark; when the
// arrow that holds the focus is the one that stops, the focus moves to the
// other arrow, so it does not fall to the page.
function createArrowStateGuard(slider, prevEl, nextEl) {
  const arrows = [prevEl, nextEl].filter((arrow) => arrow instanceof HTMLElement);
  if (!arrows.length || typeof slider?.on !== 'function') return () => {};
  const buttonOf = (arrow) => (arrow.matches('button') ? arrow : arrow.querySelector('button'));
  const sync = () => {
    arrows.forEach((arrow) => {
      const button = buttonOf(arrow);
      if (!button) return;
      const off = arrow.classList.contains('swiper-button-disabled');
      if (off && !button.disabled && button === button.ownerDocument?.activeElement) {
        const other = arrows.map(buttonOf).find((candidate) => candidate && candidate !== button && !candidate.disabled);
        other?.focus?.();
      }
      if (button.disabled !== off) button.disabled = off;
    });
  };
  const events = ['afterInit', 'slideChange', 'reachBeginning', 'reachEnd', 'fromEdge', 'update', 'lock', 'unlock', 'navigationNext', 'navigationPrev'];
  events.forEach((name) => slider.on(name, sync));
  sync();
  return () => events.forEach((name) => slider.off?.(name, sync));
}

// Autoplay turns the slides only with a pause button the person can see
// (C143 (6), WCAG 2.2.2, as sf-carousel required): .sf-slider-rotation, a
// button or an sf-button-icon host whose button carries it. Without one the
// slider does not turn.
function findRotationButton(root) {
  const marked = root.querySelector('.sf-slider-rotation');
  if (!(marked instanceof HTMLElement)) return null;
  const button = marked.matches('button') ? marked : marked.querySelector('button');
  return button instanceof HTMLButtonElement ? button : null;
}

function isShown(element) {
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  return element.getClientRects().length > 0;
}

// The rotation is the person's: the pause button stops and starts it, and a
// keyboard focus inside the slider stops it until the button starts it again
// (APG carousel). The pointer over the slider and a hidden tab only hold it
// while they last. The button is named by what it does next (C12: no
// aria-pressed on a toggle whose name changes).
function createAutoplayGuard(root, slider, rotationButton) {
  if (!slider?.autoplay || !slider.params?.autoplay || prefersReducedMotion()) return () => {};

  const holds = new Set();
  let stopped = false;
  let applying = false;
  const host = rotationButton?.closest?.(tagSelector('sf-button-icon')) || null;
  const label = (key) => (key === 'pause' ? root.dataset.pauseLabel : root.dataset.playLabel) || sliderWord(root, key);

  const paint = () => {
    if (!rotationButton) return;
    const key = stopped ? 'play' : 'pause';
    rotationButton.removeAttribute('aria-pressed');
    if (host) {
      host.setAttribute('icon', stopped ? 'play_arrow' : 'pause');
      host.setAttribute('aria-label', label(key));
    } else {
      rotationButton.setAttribute('aria-label', label(key));
    }
    root.dataset.rotation = stopped ? 'stopped' : 'playing';
  };
  const apply = () => {
    const run = !stopped && holds.size === 0 && root.isConnected;
    if (run === slider.autoplay.running) return;
    applying = true;
    if (run) slider.autoplay.start();
    else slider.autoplay.stop();
    applying = false;
  };
  const stop = () => { stopped = true; paint(); apply(); };
  const start = () => { stopped = false; paint(); apply(); };
  const hold = (reason) => { holds.add(reason); apply(); };
  const release = (reason) => { holds.delete(reason); apply(); };

  // The engine stops by itself on a swipe (disableOnInteraction): that is the
  // person's stop too, and the button says so.
  const onEngineStop = () => { if (!applying) { stopped = true; paint(); } };
  const onRotation = (event) => {
    event.preventDefault();
    if (stopped) start();
    else stop();
  };
  const onFocusIn = (event) => {
    if (event.target === rotationButton) return;
    if (event.target instanceof Element && event.target.matches(':focus-visible')) stop();
  };
  const onPointerEnter = () => hold('pointer');
  const onPointerLeave = () => release('pointer');
  const onVisibilityChange = () => {
    if (document.hidden) hold('visibility');
    else release('visibility');
  };

  slider.on?.('autoplayStop', onEngineStop);
  rotationButton?.addEventListener('click', onRotation);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('pointerenter', onPointerEnter);
  root.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange();
  paint();

  return () => {
    slider.off?.('autoplayStop', onEngineStop);
    rotationButton?.removeEventListener('click', onRotation);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('pointerenter', onPointerEnter);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    delete root.dataset.rotation;
  };
}

// The block is a region the reader can find and leave, named and described as
// a carousel, its slides «слайд, 2 из 5» (SL-5, as the APG carousel and
// sf-carousel). A name or role the page wrote stays; unbinding puts back what
// was there before.
function sliderWord(root, key) {
  return pageText(SLIDER_TEXT, key, root, 'sf-slider');
}

function applyRegionSemantics(root) {
  const authored = {
    role: root.getAttribute('role'),
    roleDescription: root.getAttribute('aria-roledescription'),
    label: root.getAttribute('aria-label'),
  };
  if (!authored.role) root.setAttribute('role', 'region');
  if (!authored.roleDescription) root.setAttribute('aria-roledescription', sliderWord(root, 'carousel'));
  if (!authored.label && !root.hasAttribute('aria-labelledby')) {
    root.setAttribute('aria-label', root.dataset.label || sliderWord(root, 'label'));
  }
  return authored;
}

function restoreRegionSemantics(root, authored) {
  if (!authored) return;
  [['role', authored.role], ['aria-roledescription', authored.roleDescription], ['aria-label', authored.label]]
    .forEach(([name, value]) => {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    });
}

function slideMessages(root) {
  const position = root.dataset.slideLabel || sliderWord(root, 'position');
  return {
    itemRoleDescriptionMessage: root.dataset.slideRoledescription || sliderWord(root, 'slide'),
    slideLabelMessage: position.replaceAll('{n}', '{{index}}').replaceAll('{count}', '{{slidesLength}}'),
  };
}

// While autoplay turns the slides, the change is not announced; stopped, the
// new slide is announced politely (APG carousel).
function createLiveRegionGuard(slider, mainEl) {
  if (!(mainEl instanceof HTMLElement) || typeof slider?.on !== 'function') return () => {};
  const authored = mainEl.getAttribute('aria-live');
  const sync = () => mainEl.setAttribute('aria-live', slider.autoplay?.running ? 'off' : 'polite');
  const events = ['init', 'autoplayStart', 'autoplayStop'];
  events.forEach((name) => slider.on(name, sync));
  sync();
  return () => {
    events.forEach((name) => slider.off?.(name, sync));
    if (authored === null) mainEl.removeAttribute('aria-live');
    else mainEl.setAttribute('aria-live', authored);
  };
}

function getSlidesCount(element) {
  return element?.querySelectorAll?.('.swiper-wrapper > .swiper-slide')?.length || 0;
}

function hasPendingSmartArrowRender(root) {
  const arrowHosts = Array.from(
    root.querySelectorAll?.(`${tagSelector('sf-button-icon')}[root-class*="sf-slider-button-"]`) ||
      [],
  );

  if (!arrowHosts.length) return false;

  return arrowHosts.some((host) => !host.querySelector('.sf-icon-button'));
}

function waitForSliderReady(root) {
  if (root.dataset[SLIDER_WAITING_FLAG] === 'true') return null;

  root.dataset[SLIDER_WAITING_FLAG] = 'true';
  let attempts = 0;

  const retry = () => {
    if (!document.documentElement.contains(root)) {
      delete root.dataset[SLIDER_WAITING_FLAG];
      return;
    }

    if (
      typeof window.Swiper === 'function' &&
      !hasPendingSmartArrowRender(root)
    ) {
      delete root.dataset[SLIDER_WAITING_FLAG];
      bindSlider(root);
      return;
    }

    attempts += 1;
    if (attempts < 40) {
      window.setTimeout(retry, 50);
    } else {
      delete root.dataset[SLIDER_WAITING_FLAG];
    }
  };

  window.setTimeout(retry, 0);
  return null;
}

function bindSlider(root) {
  if (!(root instanceof HTMLElement)) return null;
  if (root.dataset[SLIDER_BOUND_FLAG] === 'true') return root._sfSlider;
  if (typeof window === 'undefined' || typeof window.Swiper !== 'function') {
    return waitForSliderReady(root);
  }

  const mainEl = root.querySelector('.sf-slider-main.swiper, .swiper');
  if (!(mainEl instanceof HTMLElement)) return null;

  if (hasPendingSmartArrowRender(root)) {
    return waitForSliderReady(root);
  }

  const prevEl = root.querySelector('.sf-slider-button-prev');
  const nextEl = root.querySelector('.sf-slider-button-next');
  const paginationEl = root.querySelector('.sf-slider-pagination');
  const thumbsEl = root.querySelector('.sf-slider-thumbnails.swiper');

  let thumbs = null;
  const thumbsCount = getSlidesCount(thumbsEl);
  if (thumbsEl instanceof HTMLElement && thumbsCount > 0) {
    thumbs = new window.Swiper(thumbsEl, {
      ...createBaseOptions(root, thumbsEl, Math.min(thumbsCount, 6)),
      loop: false,
      centeredSlides: false,
      spaceBetween: toNumber(
        getOption(root, thumbsEl, 'spaceBetween'),
        resolveCssLength(root, '--sf-slider-thumbnails--space-between', 0),
      ),
      slidesPerView: Math.min(thumbsCount, 6),
      slideToClickedSlide: false,
      // A thumbnail is pressed, not dragged: the strip is as wide as they are.
      allowTouchMove: false,
      // The thumbnails never turn by themselves; data-autoplay is the slides'.
      autoplay: false,
    });
  }

  const sliderOptions = {
    ...createBaseOptions(root, mainEl, 1),
  };
  const navigation = createNavigationOptions(prevEl, nextEl);
  const pagination = createPaginationOptions(paginationEl, getSlidesCount(mainEl));
  const rotationButton = findRotationButton(root);
  if (sliderOptions.autoplay && !(rotationButton && isShown(rotationButton))) {
    delete sliderOptions.autoplay;
  }
  // A pause button with nothing to pause (no autoplay, or reduced motion) is
  // not shown.
  const rotationHost = rotationButton?.closest?.(tagSelector('sf-button-icon')) || rotationButton;
  if (rotationHost && !sliderOptions.autoplay) {
    rotationHost.hidden = true;
    root._sfSliderRotationHidden = rotationHost;
  }

  if (navigation) {
    sliderOptions.navigation = navigation;
  }

  if (pagination) {
    sliderOptions.pagination = pagination;
  }

  if (thumbs) {
    sliderOptions.thumbs = { swiper: thumbs };
  }
  // The keys listen on the whole block: the arrows and the dots, where the
  // focus is, sit outside the strip (SL-3).
  if (sliderOptions.keyboard === true || sliderOptions.keyboard?.enabled) {
    sliderOptions.keyboard = {
      ...(isPlainObject(sliderOptions.keyboard) ? sliderOptions.keyboard : {}),
      enabled: true,
      el: root,
    };
  }
  const navigationLabels = getNavigationLabels(prevEl, nextEl);
  applyNavigationLabelDefaults(sliderOptions, navigationLabels);
  if (sliderOptions.a11y !== false) {
    sliderOptions.a11y = { ...slideMessages(root), ...sliderOptions.a11y };
  }
  root._sfSliderRegion = applyRegionSemantics(root);
  const slider = new window.Swiper(mainEl, sliderOptions);
  root._sfSliderCleanup = [
    createSlideInteractivityGuard(slider),
    createAutoplayGuard(root, slider, rotationButton),
    createArrowStateGuard(slider, prevEl, nextEl),
    linkThumbnails(root, slider, thumbs),
    createLiveRegionGuard(slider, mainEl),
  ];

  root._sfSliderNavigationLabels = navigationLabels.map(label => ({
    ...label,
    applied: label.element.getAttribute('aria-label'),
  }));

  root.dataset[SLIDER_BOUND_FLAG] = 'true';
  root._sfSlider = slider;
  root._sfSliderThumbs = thumbs;
  return slider;
}

function refreshSlider(root) {
  if (!(root instanceof HTMLElement)) return null;

  const slider = root._sfSlider || bindSlider(root);
  if (!slider) return null;

  root._sfSliderThumbs?.update?.();
  slider.update?.();
  slider.navigation?.update?.();
  slider.pagination?.update?.();

  if (typeof slider.activeIndex === 'number') {
    slider.slideTo?.(slider.activeIndex, 0, false);
  }

  return slider;
}

function unbindSlider(root) {
  if (!(root instanceof HTMLElement)) return;

  root._sfSliderCleanup?.forEach((cleanup) => cleanup());
  root._sfSlider?.destroy?.(true, true);
  root._sfSliderThumbs?.destroy?.(true, true);
  root._sfSliderNavigationLabels?.forEach(({ element, authored, applied }) => {
    // Do not undo a later author edit; restore only the value owned by Swiper.
    if (element.getAttribute('aria-label') !== applied) return;
    if (authored === null) element.removeAttribute('aria-label');
    else element.setAttribute('aria-label', authored);
  });
  if (root._sfSliderRotationHidden) root._sfSliderRotationHidden.hidden = false;
  delete root._sfSliderRotationHidden;
  restoreRegionSemantics(root, root._sfSliderRegion);
  delete root._sfSliderRegion;
  delete root._sfSliderNavigationLabels;
  delete root._sfSliderCleanup;
  delete root._sfSlider;
  delete root._sfSliderThumbs;
  delete root.dataset[SLIDER_BOUND_FLAG];
}

function initSliderTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(SLIDER_SELECTOR)) {
    bindSlider(target);
  }

  target.querySelectorAll?.(SLIDER_SELECTOR).forEach(bindSlider);
}

function initExistingSliders(scope = document) {
  initSliderTree(scope);
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Slider = window.SF.Slider || {};
  window.SF.Slider.bind = bindSlider;
  window.SF.Slider.refresh = refreshSlider;
  window.SF.Slider.unbind = unbindSlider;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingSliders());
} else {
  initExistingSliders();
}

const sliderObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initSliderTree(node);
    });
  });
});

sliderObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindSlider, initExistingSliders, refreshSlider, unbindSlider };
