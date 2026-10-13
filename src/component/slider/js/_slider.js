const SLIDER_SELECTOR = '.sf-slider';
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

    Object.entries(element.dataset).forEach(([key, value]) => {
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

function createPaginationOptions(paginationEl) {
  if (!paginationEl) return undefined;

  return {
    el: paginationEl,
    bulletActiveClass: 'active',
    bulletClass: 'sf-slider-dots-dot',
    bulletElement: 'button',
    clickable: true,
  };
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
function linkThumbnails(slider, thumbs) {
  if (!slider || !thumbs?.slides?.length) return () => {};
  const mark = () => {
    thumbs.slides.forEach((slide, index) => {
      const active = index === slider.activeIndex;
      slide.classList.toggle('swiper-slide-thumb-active', active);
      if (active) slide.setAttribute('aria-current', 'true');
      else slide.removeAttribute('aria-current');
    });
  };
  const listeners = thumbs.slides.map((slide, index) => {
    const listener = () => slider.slideTo(index);
    slide.addEventListener('click', listener);
    return [slide, listener];
  });
  slider.on?.('slideChange', mark);
  mark();
  return () => {
    listeners.forEach(([slide, listener]) => slide.removeEventListener('click', listener));
    slider.off?.('slideChange', mark);
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

function createAutoplayGuard(root, slider) {
  if (!slider?.autoplay || prefersReducedMotion()) return () => {};

  const pauseReasons = new Set();
  let resumeOwned = false;

  const pause = (reason) => {
    pauseReasons.add(reason);
    if (!slider.autoplay.running) return;
    resumeOwned = true;
    slider.autoplay.stop();
  };
  const resume = (reason) => {
    pauseReasons.delete(reason);
    if (!resumeOwned || pauseReasons.size || !root.isConnected) return;
    resumeOwned = false;
    slider.autoplay.start();
  };
  const onFocusIn = () => pause('focus');
  const onFocusOut = (event) => {
    if (!root.contains(event.relatedTarget)) resume('focus');
  };
  const onVisibilityChange = () => {
    if (document.hidden) pause('visibility');
    else resume('visibility');
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  document.addEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange();

  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

function getSlidesCount(element) {
  return element?.querySelectorAll?.('.swiper-wrapper > .swiper-slide')?.length || 0;
}

function hasPendingSmartArrowRender(root) {
  const arrowHosts = Array.from(
    root.querySelectorAll?.('sf-icon-button[root-class*="sf-slider-button-"]') ||
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
    });
  }

  const sliderOptions = {
    ...createBaseOptions(root, mainEl, 1),
  };
  const navigation = createNavigationOptions(prevEl, nextEl);
  const pagination = createPaginationOptions(paginationEl);

  if (navigation) {
    sliderOptions.navigation = navigation;
  }

  if (pagination) {
    sliderOptions.pagination = pagination;
  }

  if (thumbs) {
    sliderOptions.thumbs = { swiper: thumbs };
  }
  const navigationLabels = getNavigationLabels(prevEl, nextEl);
  applyNavigationLabelDefaults(sliderOptions, navigationLabels);
  const slider = new window.Swiper(mainEl, sliderOptions);
  root._sfSliderCleanup = [
    createSlideInteractivityGuard(slider),
    createAutoplayGuard(root, slider),
    linkThumbnails(slider, thumbs),
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
