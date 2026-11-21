import { tagSelector } from '../../../core/js/tag-aliases.js';
import { pageText } from '../../../core/js/page-language';
import { BREAKPOINTS } from '../../../core/js/breakpoints.js';
// The words a slider says about itself (SL-5), for the class block: lang/,
// English built in, the other languages from a language file (C282);
// sf-slider hands its own from its lang/ through the root's attributes, which
// win. A product adds a language with SF.language.register('sf-slider', code, words).
import SLIDER_TEXT from '../lang/index.mjs';

const SLIDER_SELECTOR = '.sf-slider';
// Up to seven slides are dots; from eight a counter «2 / 12» stands in their
// place (C143 (4), as sf-gallery counts pictures, C97).
const DOTS_LIMIT = 7;
// Cards (sf-slider--content: news, reviews, products) show the next card's
// edge (C143 (7)): 1.15 cards on a phone, 2.2 from the sm step up.
const PEEK_PER_VIEW = 1.15;
const PEEK_PER_VIEW_WIDE = 2.2;
// The parts of a slider block. sf-carousel, the slider's former name until
// 2027-01-01, binds through the same code with its own class names and keeps
// its look (owner decision C247): one path, one set of keys, names and words.
const SLIDER_PARTS = {
  main: '.sf-slider-main.swiper, .swiper',
  prev: '.sf-slider-button-prev',
  next: '.sf-slider-button-next',
  pagination: '.sf-slider-pagination',
  thumbs: '.sf-slider-thumbnails.swiper',
  rotation: '.sf-slider-rotation',
  bulletClass: 'sf-slider-dots-dot',
  bulletActiveClass: 'active',
  // From eight slides a counter stands in the dots' place.
  counter: true,
  // The motion: the slider's own duration token.
  speed: undefined,
  delay: 3000,
  stopped: 'stopped',
  // While the slides turn by themselves the dots are the timed position
  // (sf-slider-dots--timed, owner decision 2026-11-21).
  timed: true,
};
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

function createPaginationOptions(paginationEl, slidesCount, parts = SLIDER_PARTS) {
  if (!paginationEl) return undefined;

  // From eight slides the dots give way to a counter; the slides' own names
  // («2 из 12») and the live strip say it to a reader, so the counter is
  // only drawn.
  if (parts.counter && slidesCount > DOTS_LIMIT) {
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
    bulletActiveClass: parts.bulletActiveClass,
    bulletClass: parts.bulletClass,
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
  // The shown thumbnail is scrolled into view inside its strip (DEV
  // msg-0bea9d3c): a strip longer than its place showed the first ones only.
  // Only the strip moves, never the page.
  const reveal = () => {
    const strip = thumbs.wrapperEl;
    const slide = slides[slider.activeIndex];
    if (!(strip instanceof HTMLElement) || !slide || strip.scrollWidth <= strip.clientWidth + 1) return;
    const box = strip.getBoundingClientRect();
    const own = slide.getBoundingClientRect();
    const inset = Number.parseFloat(getComputedStyle(strip).paddingInlineStart) || 0;
    let delta = 0;
    if (own.left < box.left + inset) delta = own.left - box.left - inset;
    else if (own.right > box.right - inset) delta = own.right - box.right + inset;
    if (Math.abs(delta) < 1) return;
    strip.scrollTo({left: strip.scrollLeft + delta, behavior: prefersReducedMotion() ? 'instant' : 'smooth'});
  };
  const mark = () => {
    slides.forEach((slide, index) => {
      const active = index === slider.activeIndex;
      slide.classList.toggle('swiper-slide-thumb-active', active);
      slide.tabIndex = active ? 0 : -1;
      if (active) slide.setAttribute('aria-current', 'true');
      else slide.removeAttribute('aria-current');
    });
    reveal();
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
    slides[next]?.focus?.({ preventScroll: true });
  };
  // The thumbnails' engine names its slides again on every update.
  const onUpdate = () => { name(); mark(); };
  thumbs.el.addEventListener('keydown', onKey);
  thumbs.on?.('update', onUpdate);
  // The thumbnails' engine lays its own first stop again on a resize.
  thumbs.on?.('resize', reveal);
  slider.on?.('slideChange', mark);
  name();
  mark();
  return () => {
    listeners.forEach(([slide, listener]) => slide.removeEventListener('click', listener));
    thumbs.el.removeEventListener('keydown', onKey);
    thumbs.off?.('update', onUpdate);
    thumbs.off?.('resize', reveal);
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

function createAutoplayOptions(root, element, parts = SLIDER_PARTS) {
  const autoplay = toBoolean(getOption(root, element, 'autoplay'), false);
  if (!autoplay) return undefined;

  return {
    enabled: true,
    // data-delay is the carousel's former word for the same delay.
    delay: toNumber(getOption(root, element, 'autoplayDelay') ?? getOption(root, element, 'delay'), parts.delay),
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

function createBaseOptions(root, element, fallbackSlidesPerView = 1, parts = SLIDER_PARTS) {
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
      parts.speed ?? resolveCssDuration(root, '--sf-slider--duration', 300),
    ),
    watchSlidesProgress: true,
  };
  if (peek) {
    options.slidesPerView = PEEK_PER_VIEW;
    // From the sm step of the Framework's ladder (rem, as the sheets write it),
    // read against the slider's own width, not the window's (C181 (2), RG-OT
    // 7): a 264 column on a wide screen shows 1.15 cards, not 2.2 cards of 113.
    const from = Number.parseFloat(BREAKPOINTS.sm) * 16;
    options.breakpoints = { [from]: { slidesPerView: PEEK_PER_VIEW_WIDE } };
    options.breakpointsBase = 'container';
  }
  const autoplay = createAutoplayOptions(root, element, parts);

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

// Hidden slides leave the Tab order and an edge arrow is a disabled button:
// the engine does both since swiper 1.2.0 (owner decision C245), so the
// slider, the carousel and any later strip get them from one place.

// Autoplay turns the slides only with a pause button the person can see
// (C143 (6), WCAG 2.2.2, as sf-carousel required): .sf-slider-rotation, a
// button or an sf-button-icon host whose button carries it. Without one the
// slider does not turn.
function findRotationButton(root, selector = '.sf-slider-rotation') {
  const marked = root.querySelector(selector);
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
// The glyph shows the action the name says (C12): «pause» while the slides
// turn, «play_arrow» when stopped. The Smart host takes it as its icon
// attribute; class markup (a button with an .sf-icon inside) had its name
// changed and kept the pause glyph (RG-OT 8, 13). A glyph the page drew in
// another way (a picture, its own word) is left alone.
const ROTATION_GLYPHS = ['pause', 'play_arrow'];
function paintRotationGlyph(button, stopped) {
  const glyph = button.querySelector('.sf-icon');
  if (!glyph || !ROTATION_GLYPHS.includes(glyph.textContent.trim())) return;
  const next = stopped ? 'play_arrow' : 'pause';
  if (glyph.textContent.trim() !== next) glyph.textContent = next;
}

function createAutoplayGuard(root, slider, rotationButton, words = {}) {
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
      paintRotationGlyph(rotationButton, stopped);
    }
    root.dataset.rotation = stopped ? (words.stopped || 'stopped') : 'playing';
  };
  // Stopped is the person's; a hold (the pointer over the slider, a hidden
  // tab) only pauses the turn and keeps its time, so the timed position
  // freezes with it and goes on from there (data-rotation-held).
  const apply = () => {
    const run = !stopped && root.isConnected;
    const held = run && holds.size > 0;
    applying = true;
    if (run && !slider.autoplay.running) slider.autoplay.start();
    else if (!run && slider.autoplay.running) slider.autoplay.stop();
    if (held) slider.autoplay.pause?.();
    else if (run) slider.autoplay.resume?.();
    applying = false;
    root.toggleAttribute('data-rotation-held', held && slider.autoplay.running);
  };
  const stop = () => { stopped = true; paint(); apply(); };
  const start = () => { stopped = false; paint(); apply(); };
  const hold = (reason) => { holds.add(reason); apply(); };
  const release = (reason) => { holds.delete(reason); apply(); };

  // The engine stops by itself on a swipe (disableOnInteraction): that is the
  // person's stop too, and the button says so.
  const onEngineStop = () => {
    if (applying) return;
    stopped = true;
    paint();
    root.removeAttribute('data-rotation-held');
  };
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
  // The page's own stop and start (SF.Carousel.pause / play) are the person's.
  root._sfSliderRotation = { start, stop };

  return () => {
    delete root._sfSliderRotation;
    slider.off?.('autoplayStop', onEngineStop);
    rotationButton?.removeEventListener('click', onRotation);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('pointerenter', onPointerEnter);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    delete root.dataset.rotation;
    root.removeAttribute('data-rotation-held');
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
    // {n} / {count}, or the former carousel words {{index}} / {{count}}.
    slideLabelMessage: position.replaceAll('{n}', '{{index}}').replaceAll('{{count}}', '{{slidesLength}}')
      .replaceAll('{count}', '{{slidesLength}}'),
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

// The position inside the picture (owner decision C398, 2026-11-21; carousel
// study #inside-r3, way B): a picture slider or a hero with
// data-indicator="inside" draws its bare dots (or «2 / 12») over the bottom of
// the picture, with no plate and no veil. The ink is the picture's: the strip
// of the shown picture behind the row is measured on a small canvas, and the
// row takes the light ink (--sf-on-surface-media) or the dark one
// (--sf-surface-media-active), whichever stands out more from that strip --
// for an even picture the switch falls at a relative luminance of about 0.2,
// where both give the same contrast, the weakest dot at 3.3:1 or more. A
// picture that cannot be measured (another site without CORS, a video, one
// still loading, a background image) and a strip no ink can hold at 3:1 (one
// half light, one half dark) take way A: light dots with a 1 px dark ring.
// It is measured again on every slide change, when a picture loads and when
// the block changes size; the ink changes over --sf-duration-normal (the
// sheet; at once under reduced motion). The page may set the ink:
// data-indicator-ink="light | dark | outline" (auto, the default, measures),
// or the public variable --sf-slider-indicator-ink, which wins over both.
const INK_SAMPLE_WIDTH = 48;
const INK_SAMPLE_HEIGHT = 12;
const INK_MIN_CONTRAST = 3;
const INK_WORDS = new Set(['light', 'dark', 'outline']);

function indicatorBar(root) {
  if (root.dataset.indicator !== 'inside' || isContentSlider(root)) return null;
  if (root.querySelector(':scope > .sf-slider-thumbnails')) return null;
  const bar = root.querySelector(':scope > .sf-slider-controls > .sf-slider-dots--bare');
  return bar instanceof HTMLElement ? bar : null;
}

function channel(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// A computed colour as sRGB 0..1 and its alpha: rgb(), rgba() or color(srgb).
function parseColour(value = '') {
  const numbers = (String(value).match(/-?[\d.]+(e-?\d+)?/gi) || []).map(Number);
  if (numbers.length < 3) return null;
  const unit = /^color\(/i.test(String(value).trim()) ? 1 : 255;
  return {
    rgb: numbers.slice(0, 3).map((n) => Math.min(1, Math.max(0, n / unit))),
    alpha: numbers.length > 3 ? Math.min(1, Math.max(0, numbers[3])) : 1,
  };
}

function readInk(root, property) {
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;color:var(${property})`;
  root.append(probe);
  const colour = parseColour(getComputedStyle(probe).color);
  probe.remove();
  return colour;
}

// The ink laid over a pixel: the colour the eye sees on that pixel.
function inkOver(ink, alpha, rgb) {
  return luminance(ink.rgb.map((value, i) => alpha * value + (1 - alpha) * rgb[i]));
}

// The source box of the picture behind a screen box, for object-fit fill,
// contain, cover, none and scale-down and a percentage object-position.
function sourceBox(img, box) {
  const frame = img.getBoundingClientRect();
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height || !frame.width || !frame.height) return null;
  const style = getComputedStyle(img);
  const fit = style.objectFit || 'fill';
  let scaleX = frame.width / width;
  let scaleY = frame.height / height;
  if (fit !== 'fill') {
    const cover = Math.max(scaleX, scaleY);
    const contain = Math.min(scaleX, scaleY);
    let scale = fit === 'cover' ? cover : fit === 'none' ? 1 : contain;
    if (fit === 'scale-down') scale = Math.min(1, contain);
    scaleX = scale;
    scaleY = scale;
  }
  const [posX, posY] = String(style.objectPosition || '50% 50%').split(/\s+/);
  const place = (token, room) => (String(token).endsWith('%') ? (Number.parseFloat(token) / 100) * room : Number.parseFloat(token) || 0);
  const left = frame.left + place(posX, frame.width - width * scaleX);
  const top = frame.top + place(posY, frame.height - height * scaleY);
  const x0 = Math.max(0, (box.left - left) / scaleX);
  const y0 = Math.max(0, (box.top - top) / scaleY);
  const x1 = Math.min(width, (box.right - left) / scaleX);
  const y1 = Math.min(height, (box.bottom - top) / scaleY);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
}

function covers(element, x, y) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

// The pixels behind the row: a picture's strip, or the opaque fill of the
// deepest box of the slide under it. null with a reason when they cannot be
// read.
function stripPixels(slide, box) {
  const x = (box.left + box.right) / 2;
  const y = (box.top + box.bottom) / 2;
  const under = [slide, ...slide.querySelectorAll('*')].filter((element) => covers(element, x, y));
  const media = under.filter((element) => element.matches('img, video, canvas, svg, iframe, object, embed')).pop();
  if (media) {
    if (!(media instanceof HTMLImageElement)) return {reason: 'media'};
    if (!media.complete || !media.naturalWidth) return {reason: 'loading', img: media};
    const source = sourceBox(media, box);
    if (!source) return {reason: 'outside'};
    try {
      const canvas = document.createElement('canvas');
      canvas.width = INK_SAMPLE_WIDTH;
      canvas.height = INK_SAMPLE_HEIGHT;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(media, source.x, source.y, source.width, source.height, 0, 0, INK_SAMPLE_WIDTH, INK_SAMPLE_HEIGHT);
      const data = context.getImageData(0, 0, INK_SAMPLE_WIDTH, INK_SAMPLE_HEIGHT).data;
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        pixels.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
      }
      return pixels.length ? {pixels, from: 'picture'} : {reason: 'transparent'};
    } catch (error) {
      // A picture from another site without CORS taints the canvas.
      return {reason: 'cross-origin'};
    }
  }
  for (const element of under.reverse()) {
    const style = getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== 'none') return {reason: 'background-image'};
    const fill = parseColour(style.backgroundColor);
    if (fill && fill.alpha >= 1) return {pixels: [fill.rgb], from: 'fill'};
  }
  return {reason: 'no-picture'};
}

function percentile(values, share) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

function measureInk(root, slider, bar) {
  const authored = String(root.dataset.indicatorInk || '').trim().toLowerCase();
  if (INK_WORDS.has(authored)) return {ink: authored, reason: 'author'};
  const slide = slider.slides?.[slider.activeIndex];
  if (!(slide instanceof HTMLElement)) return {ink: 'outline', reason: 'no-slide'};
  const box = bar.getBoundingClientRect();
  if (!box.width || !box.height) return {ink: 'outline', reason: 'hidden'};
  const strip = stripPixels(slide, box);
  if (!strip.pixels) return {ink: 'outline', reason: strip.reason, img: strip.img};
  const light = readInk(root, '--sf-slider-indicator--ink-light');
  const dark = readInk(root, '--sf-slider-indicator--ink-dark');
  if (!light || !dark) return {ink: 'outline', reason: 'no-ink'};
  // The weakest dot is a dot that is not the current one (its opacity).
  const dot = bar.querySelector('.sf-slider-dots-dot:not(.active)');
  const weak = dot ? Number.parseFloat(getComputedStyle(dot).opacity) || 1 : 1;
  const lums = strip.pixels.map(luminance);
  const score = (ink) => percentile(strip.pixels.map((rgb, i) => contrast(inkOver(ink, ink.alpha * weak, rgb), lums[i])), 0.1);
  const scores = {light: score(light), dark: score(dark)};
  const best = scores.dark > scores.light ? 'dark' : 'light';
  const mean = lums.reduce((sum, value) => sum + value, 0) / lums.length;
  return {
    ink: scores[best] >= INK_MIN_CONTRAST ? best : 'outline',
    reason: scores[best] >= INK_MIN_CONTRAST ? strip.from : 'low-contrast',
    luminance: Math.round(mean * 1000) / 1000,
    contrast: {light: Math.round(scores.light * 100) / 100, dark: Math.round(scores.dark * 100) / 100},
  };
}

function createIndicatorInk(root, slider) {
  const bar = indicatorBar(root);
  if (!bar || typeof slider?.on !== 'function') return () => {};
  let frame = 0;
  let waiting = null;
  const wait = (img) => {
    if (waiting === img) return;
    waiting?.removeEventListener('load', schedule);
    waiting = img || null;
    waiting?.addEventListener('load', schedule, {once: true});
  };
  const apply = () => {
    frame = 0;
    if (!root.isConnected) return;
    const result = measureInk(root, slider, bar);
    wait(result.img);
    delete result.img;
    if (root.dataset.ink !== result.ink) root.dataset.ink = result.ink;
    root._sfSliderInk = result;
  };
  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(apply);
  }
  const events = ['slideChange', 'resize', 'update'];
  events.forEach((name) => slider.on(name, schedule));
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(root);
  // At once (the first frame shows the ink), and again once the layout settles.
  apply();
  schedule();
  return () => {
    events.forEach((name) => slider.off?.(name, schedule));
    observer?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
    waiting?.removeEventListener('load', schedule);
    delete root.dataset.ink;
    delete root._sfSliderInk;
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

function bindSlider(root, parts) {
  if (!(root instanceof HTMLElement)) return null;
  if (root.dataset[SLIDER_BOUND_FLAG] === 'true') return root._sfSlider;
  if (parts) root._sfSliderParts = { ...SLIDER_PARTS, ...parts };
  parts = root._sfSliderParts || SLIDER_PARTS;
  if (typeof window === 'undefined' || typeof window.Swiper !== 'function') {
    return waitForSliderReady(root);
  }

  const mainEl = root.querySelector(parts.main);
  if (!(mainEl instanceof HTMLElement)) return null;

  if (hasPendingSmartArrowRender(root)) {
    return waitForSliderReady(root);
  }

  const prevEl = root.querySelector(parts.prev);
  const nextEl = root.querySelector(parts.next);
  const paginationEl = root.querySelector(parts.pagination);
  const thumbsEl = parts.thumbs ? root.querySelector(parts.thumbs) : null;

  let thumbs = null;
  const thumbsCount = getSlidesCount(thumbsEl);
  if (thumbsEl instanceof HTMLElement && thumbsCount > 0) {
    thumbs = new window.Swiper(thumbsEl, {
      ...createBaseOptions(root, thumbsEl, Math.min(thumbsCount, 6), parts),
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
    ...createBaseOptions(root, mainEl, 1, parts),
  };
  const navigation = createNavigationOptions(prevEl, nextEl);
  const pagination = createPaginationOptions(paginationEl, getSlidesCount(mainEl), parts);
  const rotationButton = findRotationButton(root, parts.rotation);
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
  // The timed position while the slides turn (sf-slider-dots--timed): the
  // current dot fills for the slide's time.
  const timed = Boolean(parts.timed && sliderOptions.autoplay && pagination && pagination.type !== 'fraction');
  paginationEl?.classList.toggle('sf-slider-dots--timed', timed);
  if (timed) paginationEl.style.setProperty('--sf-slider-dots--delay', `${toNumber(sliderOptions.autoplay.delay, parts.delay)}ms`);
  root._sfSliderTimed = timed ? paginationEl : null;
  // The keys listen on the whole block: the arrows and the dots, where the
  // focus is, sit outside the strip (SL-3). ArrowLeft / ArrowRight page while
  // the focus is in the slider unless the page turns them off
  // (data-swiper-keyboard="false"; on by default since sf-slider 2.0.0, the
  // carousel study 2026-11-21).
  const keyboardOff = sliderOptions.keyboard === false || (isPlainObject(sliderOptions.keyboard) && sliderOptions.keyboard.enabled === false);
  if (!keyboardOff) {
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
    createAutoplayGuard(root, slider, rotationButton, parts),
    linkThumbnails(root, slider, thumbs),
    createLiveRegionGuard(slider, mainEl),
    createIndicatorInk(root, slider),
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
  if (root._sfSliderTimed) {
    root._sfSliderTimed.classList.remove('sf-slider-dots--timed');
    root._sfSliderTimed.style.removeProperty('--sf-slider-dots--delay');
  }
  delete root._sfSliderTimed;
  delete root._sfSliderRotationHidden;
  restoreRegionSemantics(root, root._sfSliderRegion);
  delete root._sfSliderRegion;
  delete root._sfSliderNavigationLabels;
  delete root._sfSliderCleanup;
  delete root._sfSlider;
  delete root._sfSliderThumbs;
  delete root._sfSliderParts;
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
