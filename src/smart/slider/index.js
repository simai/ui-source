import SfBaseElement from '../../core/js/smart-base';
import {
  bindSlider,
  refreshSlider,
  unbindSlider,
} from '../../component/slider/js/_slider';
import { renderSliderTemplate } from './js/templates/default';
import { pageText } from '../../core/js/page-language';

// The arrows were named in English on every page.
const SLIDER_TEXT = {
  en: { previous: 'Previous slide', next: 'Next slide' },
  ru: { previous: 'Предыдущий слайд', next: 'Следующий слайд' },
};

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



class SfSlider extends SfBaseElement {
  static get props() {
    return {
      buttonType: { default: 'primary' },
      buttonSize: { default: '1' },
      dots: { type: Boolean, default: true },
      dotsType: { default: 'primary-dark' },
      dotsSize: { default: '2' },
      thumbs: { type: Boolean, default: false },
      thumbsClass: { default: '' },
      thumbClass: { default: '' },
      arrows: { type: Boolean, default: true },
      loop: { type: Boolean, default: false },
      spaceBetween: { type: Number, default: 12 },
      speed: { type: Number, default: 450 },
      rootClass: { default: '' },
      slideClass: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
    this._boundSlider = null;
    this._sliderInitToken = 0;
  }

  get buttonType() {
    return this.getAttribute('button-type') || 'primary';
  }

  get buttonSize() {
    return this.getAttribute('button-size') || '1';
  }

  get dots() {
    return this.getBooleanAttr('dots', true);
  }

  get dotsType() {
    return this.getAttribute('dots-type') || 'primary-dark';
  }

  get dotsSize() {
    return this.getAttribute('dots-size') || '2';
  }

  get thumbs() {
    return this.getBooleanAttr('thumbs', false);
  }

  get thumbsClass() {
    return this.getAttribute('thumbs-class') || '';
  }

  get thumbClass() {
    return this.getAttribute('thumb-class') || '';
  }

  get arrows() {
    return this.getBooleanAttr('arrows', true);
  }

  get loop() {
    return this.getBooleanAttr('loop', false);
  }

  get spaceBetween() {
    return this.getNumberAttr('space-between', 12);
  }

  get speed() {
    return this.getNumberAttr('speed', 450);
  }

  get slideClass() {
    return this.getAttribute('slide-class') || '';
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
      previousLabel: pageText(SLIDER_TEXT, 'previous', this),
      nextLabel: pageText(SLIDER_TEXT, 'next', this),
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

    this.emitComponentEvent('slide-change', {
      activeIndex: slider.activeIndex,
      realIndex: slider.realIndex,
      previousIndex: slider.previousIndex,
    });
  };

  getSlider() {
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

    return this;
  }

  slideNext() {
    this._boundSlider?.slideNext?.();
    return this;
  }

  slidePrev() {
    this._boundSlider?.slidePrev?.();
    return this;
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
