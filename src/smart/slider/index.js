import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import {
  bindSlider,
  refreshSlider,
  unbindSlider,
} from '../../component/slider/js/_slider';
import { renderSliderTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-slider from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8): its settings are attributes and properties made by
// core/js/element-manifest.js, the arrows' words are lang/<locale>.json (a
// product adds a language through SF.language.register("sf-slider", code,
// words)), and sf-slide-change and getSlider() are dated rows of aliases.json.
const SliderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const FORWARDED_SLIDER_DATA_ATTRIBUTES = new Set([
  'data-autoplay',
  'data-autoplay-delay',
  'data-autoplay-disable-on-interaction',
  'data-autoplay-pause-on-mouse-enter',
  'data-autoplay-reverse-direction',
  'data-autoplay-stop-on-last-slide',
  'data-centered-slides',
  'data-loop',
  'data-slides-per-view',
  'data-space-between',
  'data-speed',
]);



class SfSlider extends SliderElement {
  static get props() {
    return { ...super.props, rootClass: { default: '' } };
  }

  constructor() {
    super();
    this._boundRoot = null;
    this._boundSlider = null;
    this._sliderInitToken = 0;
  }

  get slides() {
    return this.getSlotContent('slide');
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
      slides: this.slides,
      previousLabel: this.sfWord('previous'),
      nextLabel: this.sfWord('next'),
    });
  }

  template() {
    return renderSliderTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    const cosmetic = ['class', 'root-class', 'style', 'root-style'];
    if ((this.getAttribute('template') || 'default') === 'default'
      && this._boundSlider && !this._boundSlider.destroyed
      && changedAttributes.length
      && changedAttributes.every(name => cosmetic.includes(name))) return 'dom';
    return 'lit';
  }

  updateDom() {
    const root = this._boundRoot;
    if (!root || root !== this.querySelector('.sf-slider')) return false;
    root.className = ['sf-slider', this.getRootClass()].filter(Boolean).join(' ');
    const style = this.getRootStyle();
    if (style) root.setAttribute('style', style);
    else root.removeAttribute('style');
    // Keep slides, focus and Swiper ownership; only recalculate their layout.
    refreshSlider(root);
    return true;
  }

  async waitForSliderControls(root) {
    const arrowHosts = () =>
      Array.from(
        root?.querySelectorAll?.(
          'sf-icon-button[root-class*="sf-slider-button-"]',
        ) || [],
      );

    if (!arrowHosts().length) {
      return;
    }

    if (arrowHosts().every((host) => host.querySelector('.sf-icon-button'))) {
      return;
    }

    await new Promise((resolve) => {
      const finish = () => {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve();
      };
      const observer = new MutationObserver(() => {
        if (arrowHosts().every((host) => host.querySelector('.sf-icon-button'))) {
          finish();
        }
      });
      const timeoutId = setTimeout(
        finish,
        Number(this.constructor.styleReadyTimeout) || 3000,
      );

      observer.observe(root, {childList: true, subtree: true});
    });
  }

  forwardSliderDataAttributes(root) {
    if (!root) return;

    Array.from(this.attributes || []).forEach(({ name, value }) => {
      if (
        name === 'data-swiper-options' ||
        name.startsWith('data-swiper-') ||
        FORWARDED_SLIDER_DATA_ATTRIBUTES.has(name)
      ) {
        root.setAttribute(name, value);
      }
    });
  }

  async afterRender(changedAttributes = []) {
    if (typeof changedAttributes === 'function') return super.afterRender(changedAttributes);
    const initToken = ++this._sliderInitToken;

    if (!this.isConnected || initToken !== this._sliderInitToken) {
      return;
    }

    if (this._boundRoot) {
      this.detachSliderEvents();
      unbindSlider(this._boundRoot);
      this._boundRoot = null;
      this._boundSlider = null;
    }

    this._boundRoot = this.querySelector('.sf-slider');
    if (!this._boundRoot) return;

    this.forwardSliderDataAttributes(this._boundRoot);
    await this.waitForSliderControls(this._boundRoot);
    if (!this.isConnected || initToken !== this._sliderInitToken) {
      return;
    }

    unbindSlider(this._boundRoot);
    this._boundSlider = bindSlider(this._boundRoot);
    this.attachSliderEvents();
  }

  onDisconnected() {
    this._sliderInitToken++;

    if (this._boundRoot) {
      this.detachSliderEvents();
      unbindSlider(this._boundRoot);
      this._boundRoot = null;
      this._boundSlider = null;
    }
  }

  attachSliderEvents() {
    if (!this._boundSlider?.on) return;
    this._boundSlider.on('slideChange', this._handleSlideChange);
  }

  detachSliderEvents() {
    if (!this._boundSlider?.off) return;
    this._boundSlider.off('slideChange', this._handleSlideChange);
  }

  _handleSlideChange = () => {
    const slider = this._boundSlider;
    if (!slider) return;

    // §8: the indexes only; sf-slide-change follows with the same detail.
    this.sfEmit('change', {
      activeIndex: slider.activeIndex,
      realIndex: slider.realIndex,
      previousIndex: slider.previousIndex,
    });
  };

  // §4.4: a reader retires; kept until the date and noted on each call.
  getSlider() {
    noteDeprecated({ component: 'sf-slider', tag: 'sf-slider', kind: 'action', from: 'getSlider', to: null,
      since: aliases.since, remove_after: aliases.remove_after });
    return this._boundSlider || null;
  }

  refresh() {
    if (!this._boundRoot) {
      this._boundRoot = this.querySelector('.sf-slider');
    }

    if (this._boundRoot) {
      this.detachSliderEvents();
      this.forwardSliderDataAttributes(this._boundRoot);
      this._boundSlider = refreshSlider(this._boundRoot);
      this.attachSliderEvents();
    }

    return { outcome: 'applied' };
  }

  slideNext() {
    if (!this._boundSlider?.slideNext) return { outcome: 'refused', reason: 'not-ready' };
    this._boundSlider.slideNext();
    return { outcome: 'applied' };
  }

  slidePrev() {
    if (!this._boundSlider?.slidePrev) return { outcome: 'refused', reason: 'not-ready' };
    this._boundSlider.slidePrev();
    return { outcome: 'applied' };
  }

  get state() {
    return {
      buttonType: this.buttonType,
      buttonSize: this.buttonSize,
      dots: this.dots,
      dotsType: this.dotsType,
      dotsSize: this.dotsSize,
      thumbs: this.thumbs,
      thumbsClass: this.thumbsClass,
      thumbClass: this.thumbClass,
      arrows: this.arrows,
      loop: this.loop,
      spaceBetween: this.spaceBetween,
      speed: this.speed,
      rootClass: this.getRootClass(),
      slideClass: this.slideClass,
    };
  }
}

SfSlider.define('sf-slider');
