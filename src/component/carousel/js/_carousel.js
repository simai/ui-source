import { noteDeprecated } from '../../../core/js/deprecations.js';
import { bindSlider, unbindSlider } from '../../slider/js/_slider.js';

// One slider (decision C143 (1), owner 2026-11-14): sf-slider took this
// block's region name and its mandatory pause button. .sf-carousel keeps
// working as an old name until 2027-01-01 and is noted once in
// SF.deprecations (journal class-sf-carousel-to-sf-slider).
const DEPRECATED = { since: '2026-11-14', remove_after: '2027-01-01' };

const CAROUSEL_SELECTOR = '.sf-carousel';

// Until it is removed the carousel runs through the slider's code (owner
// decision C247, component.carousel 1.4.0): the region and its slides are
// named in the page's language («карусель», «слайд», «1 из 3»), the dots are
// one Tab stop paged by ArrowLeft / ArrowRight, Home and End, an arrow with
// nowhere to go is a disabled button, the pause button changes its glyph with
// its name and is hidden when nothing turns (RG-OT 10-13). Its own classes
// and look (the glass switches, its dots) stay until the date.
const CAROUSEL_PARTS = {
  main: '.sf-carousel-slider.swiper, .swiper',
  prev: '.sf-carousel-switch--left, .sf-carousel-switch--prev',
  next: '.sf-carousel-switch--right, .sf-carousel-switch--next',
  pagination: '.sf-carousel-pagination',
  thumbs: '',
  rotation: '.sf-carousel-rotation',
  bulletClass: 'sf-carousel-pagination-item',
  bulletActiveClass: 'sf-carousel-pagination-item--active',
  // The carousel always drew dots; it keeps them.
  counter: false,
  // Its former motion: 450 ms unless data-speed says otherwise.
  speed: 450,
  delay: 5000,
  // Its former word for a stopped rotation (data-rotation="paused").
  stopped: 'paused',
  // Its own dots keep their look: no timed position.
  timed: false,
};

function emitChange(root) {
  const slider = root._sfCarousel;
  if (!slider) return;
  root.dispatchEvent(new CustomEvent('sf:carousel-change', {
    bubbles: true,
    detail: { index: slider.realIndex ?? slider.activeIndex ?? 0, playing: Boolean(slider.autoplay?.running) },
  }));
}

function bindCarousel(root) {
  if (!(root instanceof HTMLElement)) return null;
  if (root._sfCarousel) return root._sfCarousel;
  if (!root.querySelector(CAROUSEL_PARTS.main)) return null;
  noteDeprecated({ component: 'sf-carousel', kind: 'class', from: 'sf-carousel', to: 'sf-slider', ...DEPRECATED });
  const slider = bindSlider(root, CAROUSEL_PARTS);
  if (!slider) {
    // The engine is still loading: the slider adapter binds when it arrives.
    const wait = window.setInterval(() => {
      if (!root.isConnected || root._sfCarousel) { window.clearInterval(wait); return; }
      if (root._sfSlider) { window.clearInterval(wait); adopt(root, root._sfSlider); }
    }, 50);
    window.setTimeout(() => window.clearInterval(wait), 2500);
    return null;
  }
  return adopt(root, slider);
}

function adopt(root, slider) {
  root._sfCarousel = slider;
  const onChange = () => emitChange(root);
  ['slideChange', 'autoplayStart', 'autoplayStop'].forEach((name) => slider.on?.(name, onChange));
  root._sfCarouselChange = onChange;
  emitChange(root);
  return slider;
}

function pauseCarousel(root, reason = 'api') {
  if (!root?._sfCarousel || !root._sfSliderRotation) return false;
  root._sfSliderRotation.stop();
  root.dataset.pauseReason = reason;
  return true;
}

function playCarousel(root, reason = 'api') {
  if (!root?._sfCarousel || !root._sfSliderRotation) return false;
  root._sfSliderRotation.start();
  delete root.dataset.pauseReason;
  root.dataset.playReason = reason;
  return true;
}

function unbindCarousel(root) {
  if (!(root instanceof HTMLElement)) return;
  const slider = root._sfCarousel;
  if (slider && root._sfCarouselChange) {
    ['slideChange', 'autoplayStart', 'autoplayStop'].forEach((name) => slider.off?.(name, root._sfCarouselChange));
  }
  unbindSlider(root);
  delete root._sfCarousel;
  delete root._sfCarouselChange;
  delete root.dataset.pauseReason;
  delete root.dataset.playReason;
}

function refreshCarousel(root) {
  const slider = root?._sfCarousel || bindCarousel(root);
  slider?.update?.();
  return slider || null;
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
