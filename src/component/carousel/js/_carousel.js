const CAROUSEL_SELECTOR = '.sf-carousel';
const BOUND_FLAG = 'sfCarouselBound';
const WAITING_FLAG = 'sfCarouselWaiting';

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function getCarouselParts(root) {
  return {
    main: root.querySelector('.sf-carousel-slider.swiper, .swiper'),
    next: root.querySelector('.sf-carousel-switch--right, .sf-carousel-switch--next'),
    previous: root.querySelector('.sf-carousel-switch--left, .sf-carousel-switch--prev'),
    pagination: root.querySelector('.sf-carousel-pagination'),
    rotation: root.querySelector('.sf-carousel-rotation'),
  };
}

function setOptionalAttribute(element, name, value) {
  const normalized = String(value || '').trim();
  if (normalized) element.setAttribute(name, normalized);
  else element.removeAttribute(name);
}

function rememberSlideState(slide) {
  if (slide._sfCarouselAuthoredState) return;
  slide._sfCarouselAuthoredState = {
    ariaHidden: slide.getAttribute('aria-hidden'),
    ariaLabel: slide.getAttribute('aria-label'),
    role: slide.getAttribute('role'),
    roleDescription: slide.getAttribute('aria-roledescription'),
    inert: slide.hasAttribute('inert'),
  };
}

function restoreSlideState(slide) {
  const state = slide._sfCarouselAuthoredState;
  if (!state) return;
  const values = {
    'aria-hidden': state.ariaHidden,
    'aria-label': state.ariaLabel,
    role: state.role,
    'aria-roledescription': state.roleDescription,
  };
  Object.entries(values).forEach(([name, value]) => {
    if (value === null) slide.removeAttribute(name);
    else slide.setAttribute(name, value);
  });
  slide.toggleAttribute('inert', state.inert);
  delete slide._sfCarouselAuthoredState;
}

function formatSlideLabel(root, index, count) {
  const template = String(root.dataset.slideLabel || '').trim();
  if (!template) return `${index + 1} / ${count}`;
  return template
    .replaceAll('{{index}}', String(index + 1))
    .replaceAll('{{count}}', String(count));
}

function syncCarouselState(root) {
  const slider = root._sfCarousel;
  const { main, rotation } = getCarouselParts(root);
  if (!slider || !main) return;

  const slides = [...main.querySelectorAll('.swiper-wrapper > .swiper-slide')];
  const current = slider.activeIndex ?? 0;
  slides.forEach((slide, index) => {
    rememberSlideState(slide);
    const active = index === current || slide.classList.contains('swiper-slide-active');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    if (!slide._sfCarouselAuthoredState.ariaLabel) {
      slide.setAttribute('aria-label', formatSlideLabel(root, index, slides.length));
    }
    slide.setAttribute('aria-hidden', String(!active));
    slide.toggleAttribute('inert', !active);
  });

  const playing = Boolean(slider.autoplay?.running);
  root.dataset.rotation = playing ? 'playing' : 'paused';
  main.setAttribute('aria-live', playing ? 'off' : 'polite');
  if (rotation) {
    rotation.setAttribute('aria-pressed', String(!playing));
    setOptionalAttribute(
      rotation,
      'aria-label',
      playing ? root.dataset.pauseLabel : root.dataset.playLabel,
    );
  }

  root.dispatchEvent(new CustomEvent('sf:carousel-change', {
    bubbles: true,
    detail: { index: slider.realIndex ?? current, playing },
  }));
}

function pauseCarousel(root, reason = 'api') {
  const slider = root?._sfCarousel;
  if (!slider) return false;
  slider.autoplay?.stop?.();
  root.dataset.pauseReason = reason;
  syncCarouselState(root);
  return true;
}

function playCarousel(root, reason = 'api') {
  const slider = root?._sfCarousel;
  if (!slider || !root._sfCarouselAutoplayAllowed) return false;
  slider.autoplay?.start?.();
  delete root.dataset.pauseReason;
  root.dataset.playReason = reason;
  syncCarouselState(root);
  return true;
}

function bindCarouselEvents(root) {
  const { rotation } = getCarouselParts(root);
  const onFocusIn = () => pauseCarousel(root, 'focus');
  const onMouseEnter = () => {
    root._sfCarouselWasPlaying = Boolean(root._sfCarousel?.autoplay?.running);
    if (root._sfCarouselWasPlaying) pauseCarousel(root, 'hover');
  };
  const onMouseLeave = () => {
    if (root._sfCarouselWasPlaying && !root.matches(':focus-within')) {
      playCarousel(root, 'hover-end');
    }
    root._sfCarouselWasPlaying = false;
  };
  const onRotation = () => {
    if (root._sfCarousel?.autoplay?.running) pauseCarousel(root, 'user');
    else playCarousel(root, 'user');
  };
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('mouseenter', onMouseEnter);
  root.addEventListener('mouseleave', onMouseLeave);
  rotation?.addEventListener('click', onRotation);
  root._sfCarouselEvents = { onFocusIn, onMouseEnter, onMouseLeave, onRotation, rotation };
}

function unbindCarouselEvents(root) {
  const events = root._sfCarouselEvents;
  if (!events) return;
  root.removeEventListener('focusin', events.onFocusIn);
  root.removeEventListener('mouseenter', events.onMouseEnter);
  root.removeEventListener('mouseleave', events.onMouseLeave);
  events.rotation?.removeEventListener('click', events.onRotation);
  delete root._sfCarouselEvents;
}

function waitForCarouselReady(root) {
  if (root.dataset[WAITING_FLAG] === 'true') return null;
  root.dataset[WAITING_FLAG] = 'true';
  let attempts = 0;
  const retry = () => {
    if (!document.documentElement.contains(root)) return;
    if (typeof window.Swiper === 'function') {
      delete root.dataset[WAITING_FLAG];
      bindCarousel(root);
      return;
    }
    attempts += 1;
    if (attempts < 40) window.setTimeout(retry, 50);
    else delete root.dataset[WAITING_FLAG];
  };
  window.setTimeout(retry, 0);
  return null;
}

function bindCarousel(root) {
  if (!(root instanceof HTMLElement)) return null;
  if (root.dataset[BOUND_FLAG] === 'true') return root._sfCarousel;
  if (typeof window.Swiper !== 'function') return waitForCarouselReady(root);

  const { main, next, previous, pagination, rotation } = getCarouselParts(root);
  if (!(main instanceof HTMLElement)) return null;
  const autoplayRequested = normalizeBoolean(root.dataset.autoplay, false);
  const autoplayAllowed = autoplayRequested
    && rotation instanceof HTMLButtonElement
    && Boolean(root.dataset.playLabel?.trim())
    && Boolean(root.dataset.pauseLabel?.trim());
  root._sfCarouselAutoplayAllowed = autoplayAllowed;

  const label = root.getAttribute('aria-label') || root.dataset.label;
  root.setAttribute('role', label ? 'region' : 'group');
  root.setAttribute('aria-roledescription', 'carousel');
  if (label) root.setAttribute('aria-label', label);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const options = {
    a11y: {
      enabled: true,
      nextSlideMessage: next?.getAttribute('aria-label') || undefined,
      prevSlideMessage: previous?.getAttribute('aria-label') || undefined,
      paginationBulletMessage: root.dataset.slideLabel || '{{index}}',
    },
    loop: normalizeBoolean(root.dataset.loop, false),
    speed: reducedMotion ? 0 : normalizeNumber(root.dataset.speed, 450, 0, 2000),
  };
  if (next || previous) {
    options.navigation = { nextEl: next, prevEl: previous };
  }
  if (pagination) {
    options.pagination = {
      bulletActiveClass: 'sf-carousel-pagination-item--active',
      bulletClass: 'sf-carousel-pagination-item',
      bulletElement: 'button',
      clickable: true,
      el: pagination,
    };
  }
  if (autoplayAllowed && !reducedMotion) {
    options.autoplay = {
      delay: normalizeNumber(root.dataset.delay, 5000, 1000, 60000),
      disableOnInteraction: true,
      pauseOnMouseEnter: false,
    };
  }

  const slider = new window.Swiper(main, options);
  root._sfCarousel = slider;
  root.dataset[BOUND_FLAG] = 'true';
  bindCarouselEvents(root);
  ['init', 'slideChange', 'transitionEnd', 'autoplayStart', 'autoplayStop'].forEach((eventName) => {
    slider.on?.(eventName, () => syncCarouselState(root));
  });
  syncCarouselState(root);
  return slider;
}

function refreshCarousel(root) {
  const slider = root?._sfCarousel || bindCarousel(root);
  slider?.update?.();
  syncCarouselState(root);
  return slider || null;
}

function unbindCarousel(root) {
  if (!(root instanceof HTMLElement)) return;
  unbindCarouselEvents(root);
  root._sfCarousel?.destroy?.(true, true);
  root.querySelectorAll('.swiper-wrapper > .swiper-slide').forEach(restoreSlideState);
  delete root._sfCarousel;
  delete root._sfCarouselAutoplayAllowed;
  delete root._sfCarouselWasPlaying;
  delete root.dataset[BOUND_FLAG];
  delete root.dataset.pauseReason;
  delete root.dataset.playReason;
  delete root.dataset.rotation;
}

function initCarouselTree(target = document) {
  if (target instanceof Element && target.matches?.(CAROUSEL_SELECTOR)) bindCarousel(target);
  target.querySelectorAll?.(CAROUSEL_SELECTOR).forEach(bindCarousel);
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Carousel = {
    bind: bindCarousel,
    refresh: refreshCarousel,
    unbind: unbindCarousel,
    next: root => root?._sfCarousel?.slideNext?.(),
    previous: root => root?._sfCarousel?.slidePrev?.(),
    goTo: (root, index) => root?._sfCarousel?.slideTo?.(Number(index)),
    play: playCarousel,
    pause: pauseCarousel,
    getState: root => ({
      index: root?._sfCarousel?.realIndex ?? 0,
      playing: Boolean(root?._sfCarousel?.autoplay?.running),
    }),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCarouselTree(), { once: true });
} else {
  initCarouselTree();
}

new MutationObserver((mutations) => mutations.forEach((mutation) => {
  mutation.addedNodes.forEach((node) => {
    if (node instanceof Element) initCarouselTree(node);
  });
})).observe(document.documentElement, { childList: true, subtree: true });

export {
  bindCarousel,
  initCarouselTree,
  pauseCarousel,
  playCarousel,
  refreshCarousel,
  unbindCarousel,
};
