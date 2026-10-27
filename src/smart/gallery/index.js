import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { renderGalleryTemplate } from './js/templates/default';
import { normalizeSlideContent } from '../../component/slider/js/_slide-content';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-gallery from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8): its settings, values and actions are made by
// core/js/element-manifest.js, and the old names -- title, blur, sf-change,
// sf-open, sf-close and the readers getModal(), getInlineSlider(),
// getLightboxSlider() -- are dated rows of aliases.json.
const GalleryElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const applied = () => ({ outcome: 'applied' });

// What retires without a new name (aliases.json rows with `to: null`): kept
// until the date, and each call is noted with it.
function noteRetired(from) {
  noteDeprecated({ component: 'sf-gallery', tag: 'sf-gallery', kind: 'action', from, to: null,
    since: aliases.since, remove_after: aliases.remove_after });
}


function normalizeSlotNodes(content) {
  if (!content || content === null || typeof content === 'undefined') {
    return [];
  }

  return normalizeSlideContent(content).filter((node) => node instanceof Node);
}

const GALLERY_TRIGGER_SELECTOR = '[data-sf-gallery]';
let delegatedGallery = null;

const DELEGATED_MODAL_DEFAULTS = {
  width: 'calc(100vw - var(--sf-space-3) * 2)',
  height: 'calc(100dvh - var(--sf-space-6) * 2)',
  overlay: 'true',
  'show-header': 'false',
  'show-close': 'true',
  'body-class': 'sf-gallery-lightbox-body h-full',
  'content-class': 'sf-gallery-lightbox-modal-content h-full min-h-0',
  'surface-class': 'p-0 border-0 radius-square bg-transparent shadow-0',
  'surface-padding': '0',
};

const DELEGATED_MODAL_ATTRIBUTES = [
  'heading',
  'text',
  'overlay',
  'show-header',
  'show-close',
  'close-on-esc',
  'close-on-overlay',
  'preserve-scroll-gap',
  'position',
  'fullscreen',
  'width',
  'height',
  'backdrop-blur',
  'blur-type',
  'overlay-class',
  'close-class',
  'surface-class',
  'surface-padding',
  'panel-class',
  'header-class',
  'body-class',
  'content-class',
  'footer-class',
];

const DELEGATED_SLIDER_DEFAULTS = {
  arrows: 'true',
  dots: 'false',
  'lightbox-class': 'sf-gallery-lightbox-slider h-full',
};

const DELEGATED_SLIDER_ATTRIBUTES = [
  'arrows',
  'dots',
  'thumbs',
  'loop',
  'space-between',
  'speed',
  'button-type',
  'button-size',
  'dots-type',
  'dots-size',
  'thumbs-class',
  'thumb-class',
  'slide-class',
  'lightbox-class',
];

// A trigger's data-sf-modal-title and data-sf-modal-blur still configure the
// lightbox: heading and backdrop-blur are their names since standard 1.3.8.
const DELEGATED_MODAL_ATTRIBUTE_ALIASES = {
  title: 'heading',
  blur: 'backdrop-blur',
};

const DELEGATED_SLIDER_ATTRIBUTE_ALIASES = {
  class: 'lightbox-class',
  'root-class': 'lightbox-class',
};

const LIGHTBOX_BACKGROUND_CLOSE_IGNORE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'video',
  'audio',
  'iframe',
  'img',
  'picture',
  'svg',
  '[role="button"]',
  '[data-sf-gallery-open]',
  '[data-sf-modal-close]',
  'sf-button',
  'sf-icon-button',
  '.sf-slider-controls',
  '.sf-slider-arrows',
  '.sf-slider-dots',
  '.sf-slider-pagination',
  '.sf-slider-thumbnails',
  '.sf-gallery-external-caption',
].join(',');

function getDelegatedAttribute(trigger, items, attrNames) {
  for (const attrName of attrNames) {
    const directValue = trigger?.getAttribute?.(attrName);

    if (directValue !== null && typeof directValue !== 'undefined') {
      return directValue;
    }
  }

  for (const item of items) {
    for (const attrName of attrNames) {
      if (item.hasAttribute?.(attrName)) {
        return item.getAttribute(attrName);
      }
    }
  }

  return undefined;
}

function applyDelegatedAttribute(gallery, attrName, value, fallback) {
  const nextValue = typeof value !== 'undefined' ? value : fallback;

  if (typeof nextValue === 'undefined' || nextValue === null) {
    gallery.removeAttribute(attrName);
    return;
  }

  gallery.setAttribute(attrName, String(nextValue));
}

function applyDelegatedNamespaceOptions({
  gallery,
  trigger,
  items,
  namespace,
  attributes,
  defaults = {},
  aliases = {},
}) {
  attributes.forEach((attrName) => {
    const sourceNames = [
      attrName,
      ...Object.entries(aliases)
        .filter(([, targetName]) => targetName === attrName)
        .map(([sourceName]) => sourceName),
    ];
    const value = getDelegatedAttribute(
      trigger,
      items,
      sourceNames.flatMap((sourceName) => [
        `data-sf-${namespace}-${sourceName}`,
        `data-sf-gallery-${sourceName}`,
      ]),
    );

    applyDelegatedAttribute(gallery, attrName, value, defaults[attrName]);
  });
}

function getGalleryGroupValue(element) {
  return String(element?.getAttribute?.('data-sf-gallery') || '').trim();
}

function isUsableGalleryHref(value) {
  const normalized = String(value || '').trim();
  return normalized && normalized !== '#';
}

function getGalleryItemSource(element) {
  const image = element.matches?.('img')
    ? element
    : element.querySelector?.('img');
  const dataSource =
    element.getAttribute?.('data-sf-src') ||
    element.getAttribute?.('data-src') ||
    element.getAttribute?.('href') ||
    element.getAttribute?.('src');

  if (isUsableGalleryHref(dataSource)) {
    return dataSource;
  }

  return image?.currentSrc || image?.src || '';
}

function getGalleryItemCaption(element) {
  const image = element.matches?.('img')
    ? element
    : element.querySelector?.('img');
  const figure = element.closest?.('figure');
  const figcaption = figure?.querySelector?.('figcaption');

  return (
    element.getAttribute?.('data-caption') ||
    element.getAttribute?.('title') ||
    image?.getAttribute?.('alt') ||
    figcaption?.textContent?.trim?.() ||
    ''
  );
}

function createDelegatedGallerySlide(element) {
  const source = getGalleryItemSource(element);
  if (!source) {
    return null;
  }

  const caption = getGalleryItemCaption(element);
  const figure = document.createElement('figure');
  const image = document.createElement('img');

  figure.className = 'sf-gallery-external-slide flex flex-col gap-1 m-0';
  image.src = source;
  image.alt = caption;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.className = 'sf-gallery-external-image';
  figure.append(image);

  if (caption) {
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'sf-gallery-external-caption color-white';
    figcaption.textContent = caption;
    figure.append(figcaption);
  }

  return figure;
}

function getDelegatedGalleryItems(trigger) {
  const group = getGalleryGroupValue(trigger);
  if (!group) {
    return [trigger];
  }

  return Array.from(document.querySelectorAll(GALLERY_TRIGGER_SELECTOR)).filter(
    (item) => getGalleryGroupValue(item) === group,
  );
}

function getDelegatedGallery() {
  if (delegatedGallery?.isConnected) {
    return delegatedGallery;
  }

  delegatedGallery = document.createElement('sf-gallery');
  delegatedGallery.setAttribute('data-sf-gallery-delegated', '');
  delegatedGallery.setAttribute('inline', 'false');
  delegatedGallery.setAttribute('lightbox', 'true');
  document.body.append(delegatedGallery);

  return delegatedGallery;
}

function configureDelegatedGallery(gallery, trigger, items) {
  applyDelegatedNamespaceOptions({
    gallery,
    trigger,
    items,
    namespace: 'modal',
    attributes: DELEGATED_MODAL_ATTRIBUTES,
    defaults: DELEGATED_MODAL_DEFAULTS,
    aliases: DELEGATED_MODAL_ATTRIBUTE_ALIASES,
  });
  applyDelegatedNamespaceOptions({
    gallery,
    trigger,
    items,
    namespace: 'slider',
    attributes: DELEGATED_SLIDER_ATTRIBUTES,
    defaults: DELEGATED_SLIDER_DEFAULTS,
    aliases: DELEGATED_SLIDER_ATTRIBUTE_ALIASES,
  });
}

let galleryUid = 0;

class SfGallery extends GalleryElement {
  static globalDelegationBound = false;

  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      rootClass: { default: '' },
    };
  }

  static bindGlobalDelegation() {
    if (SfGallery.globalDelegationBound) {
      return;
    }

    SfGallery.globalDelegationBound = true;
    document.addEventListener('click', SfGallery.handleDelegatedGalleryClick);
  }

  static handleDelegatedGalleryClick(event) {
    const trigger = event.target.closest?.(GALLERY_TRIGGER_SELECTOR);
    if (!trigger || trigger.closest('sf-gallery')) {
      return;
    }

    const items = getDelegatedGalleryItems(trigger);
    const slides = items.map(createDelegatedGallerySlide).filter(Boolean);
    if (!slides.length) {
      return;
    }

    const index = Math.max(items.indexOf(trigger), 0) + 1;
    event.preventDefault();

    const gallery = getDelegatedGallery();
    configureDelegatedGallery(gallery, trigger, items);
    gallery.setSlot('slide', ...slides);
    gallery.setAttribute('current', String(index));
    requestAnimationFrame(() => gallery.open(index));
  }

  constructor() {
    super();
    this._modalId = '';
    this._inlineSlider = null;
    this._lightboxSlider = null;
    this._modal = null;
    this._current = null;
    this._syncingCurrent = false;
    this._lightboxBackgroundPointerActive = false;
    this._pendingLightboxBackgroundClose = false;
    this._currentRenderMode = '';
    this._nestedDefinitionSyncQueued = false;
    this._handleGalleryClick = this._handleGalleryClick.bind(this);
    this._handleGalleryKeyDown = this._handleGalleryKeyDown.bind(this);
    this._handleInlineSlideChange = this._handleInlineSlideChange.bind(this);
    this._handleLightboxSlideChange =
      this._handleLightboxSlideChange.bind(this);
    this._handleLightboxBackgroundPointerDown =
      this._handleLightboxBackgroundPointerDown.bind(this);
    this._handleLightboxBackgroundPointerUp =
      this._handleLightboxBackgroundPointerUp.bind(this);
    this._handleLightboxBackgroundClick =
      this._handleLightboxBackgroundClick.bind(this);
    this._handleModalAfterOpen = this._handleModalAfterOpen.bind(this);
    this._handleModalAfterClose = this._handleModalAfterClose.bind(this);
    this._handleModalAfterRender = this._handleModalAfterRender.bind(this);
  }

  connectedCallback() {
    if (!this._modalId) {
      this._modalId =
        this.getAttribute('modal-id') ||
        this.id ||
        `sf-gallery-${++galleryUid}`;
    }

    super.connectedCallback();
    this.addEventListener('click', this._handleGalleryClick);
    this.addEventListener('keydown', this._handleGalleryKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleGalleryClick);
    this.removeEventListener('keydown', this._handleGalleryKeyDown);
    this._detachNestedListeners();
    super.disconnectedCallback();
  }

  get modalId() {
    return this.getAttribute('modal-id') || this._modalId || '';
  }

  get openState() {
    return this.getProp('open');
  }

  get slidesTotal() {
    const sliderTotal = this._getActiveSliderTotal();
    if (sliderTotal !== null) {
      return sliderTotal;
    }

    const slides = normalizeSlotNodes(this.getSlotContent('slide'));
    return slides.length || 0;
  }

  get current() {
    if (this._current !== null) {
      return this._normalizeCurrent(this._current);
    }

    const sliderIndex = this._getActiveSliderIndex();
    if (sliderIndex !== null) {
      return this._normalizeCurrent(sliderIndex + 1);
    }

    return this._getConfiguredCurrent();
  }

  // current is a value a page may also write (§4.3): the slide to show.
  set current(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('current');
    else this.setAttribute('current', String(value));
  }

  _getConfiguredCurrent() {
    return this._normalizeCurrent(this.getProp('current') || 1);
  }

  _normalizeCurrent(value) {
    const total = this.slidesTotal;
    const parsed = Number.parseInt(String(value || 1), 10);
    const safe = Number.isFinite(parsed) ? parsed : 1;

    if (!total) {
      return Math.max(safe, 1);
    }

    return Math.min(Math.max(safe, 1), total);
  }

  _setCurrent(index, source = 'api', options = {}) {
    const { emit = true, syncAttribute = false } = options;
    const next = this._normalizeCurrent(index);
    // The slide shown before this change: the gallery's own position, else the
    // configured one. Reading the slider here would read the new position on a
    // person's first swipe, which then sent no change at all.
    const previous = this._current !== null ? this._normalizeCurrent(this._current) : this._getConfiguredCurrent();

    if (next === previous && this._current === next) {
      return this;
    }

    this._current = next;

    // Keep the starting position for a pending nested Slider render, including
    // the Slider that originated this change (it must not be driven back).
    this._rememberSliderIndex(this._inlineSlider, next - 1);
    this._rememberSliderIndex(this._lightboxSlider, next - 1);

    if (syncAttribute) {
      this._syncingCurrent = true;
      this.setAttribute('current', String(next));
      this._syncingCurrent = false;
    }

    if (source !== 'inline') {
      this._syncSliderToIndex(this._inlineSlider, next - 1);
    }

    if (source !== 'lightbox') {
      this._syncSliderToIndex(this._lightboxSlider, next - 1);
    }

    if (emit && next !== previous) {
      // §8: data only; sf-change follows with the same detail until the date.
    this.sfEmit('change', {
        previous,
        current: next,
        total: this.slidesTotal,
        from: source,
      });
    }

    return this;
  }

  _getActiveSliderElement() {
    if (this.openState && this._lightboxSlider) {
      return this._lightboxSlider;
    }

    return this._inlineSlider || this._lightboxSlider || null;
  }

  _getSliderIndex(sliderElement) {
    const slider = sliderElement?._boundSlider || null;
    if (!slider) {
      return null;
    }

    const index =
      typeof slider.realIndex === 'number'
        ? slider.realIndex
        : slider.activeIndex;

    return Number.isFinite(index) ? index : null;
  }

  _getActiveSliderIndex() {
    return this._getSliderIndex(this._getActiveSliderElement());
  }

  _getSliderTotal(sliderElement) {
    const slider = sliderElement?._boundSlider || null;
    if (!slider) {
      return null;
    }

    const indexedSlides = new Set();
    slider.slides?.forEach?.((slide) => {
      const index = slide?.getAttribute?.('data-swiper-slide-index');

      if (index !== null && typeof index !== 'undefined') {
        indexedSlides.add(index);
      }
    });

    if (indexedSlides.size) {
      return indexedSlides.size;
    }

    const total =
      slider.slides?.length ??
      sliderElement?.querySelectorAll?.('.swiper-slide')?.length ??
      0;

    return total > 0 ? total : null;
  }

  _getActiveSliderTotal() {
    return this._getSliderTotal(this._getActiveSliderElement());
  }

  get state() {
    const props = this.getPropsContext();

    return {
      ...props,
      modalId: this.modalId,
      open: this.openState,
      current: this.current,
      rootClass: this.getRootClass(),
      slidesTotal: this.slidesTotal,
    };
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.state,
    });
  }

  template() {
    return renderGalleryTemplate(this.templateContext());
  }

  afterRender() {
    this._detachNestedListeners();
    this._bindNestedComponents();
    this._syncSliderSlots();
    this._attachNestedListeners();
    this._syncSlidersToCurrent();
    this._queueNestedDefinitionSync();
  }

  resolveUpdateMode(changedAttributes = []) {
    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((name) => name === 'current' || name === 'open')
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom(changedAttributes = []) {
    if (this.resolveUpdateMode(changedAttributes) !== 'dom') {
      return false;
    }

    const openChanged = changedAttributes.includes('open');
    const modalAction = this.openState ? 'open' : 'close';
    if (openChanged && typeof this._modal?.[modalAction] !== 'function') {
      return false;
    }

    if (changedAttributes.includes('current') && !this._syncingCurrent) {
      this._setCurrent(this.getProp('current'), 'api', { emit: false });
    }

    // Modal owns its transition. Re-rendering Gallery here would replace the
    // unchanged inline Slider during its pointer/keyboard event lifecycle.
    if (openChanged) {
      this._modal[modalAction]();
    }

    return true;
  }

  _bindNestedComponents() {
    this._inlineSlider = this.querySelector(
      '[data-sf-gallery-slider="inline"]',
    );
    this._modal = this.querySelector('[data-sf-gallery-modal]');
    this._lightboxSlider =
      this.querySelector('[data-sf-gallery-slider="lightbox"]') ||
      this._modal
        ?.modalRoot
        ?.querySelector?.('[data-sf-gallery-slider="lightbox"]');
  }

  _attachNestedListeners() {
    this._modal?.addEventListener?.(
      'sf-after-render',
      this._handleModalAfterRender,
    );
    this._inlineSlider?.addEventListener?.(
      'change',
      this._handleInlineSlideChange,
    );
    this._lightboxSlider?.addEventListener?.(
      'change',
      this._handleLightboxSlideChange,
    );
    this._lightboxSlider?.addEventListener?.(
      'pointerdown',
      this._handleLightboxBackgroundPointerDown,
      true,
    );
    this._lightboxSlider?.addEventListener?.(
      'pointerup',
      this._handleLightboxBackgroundPointerUp,
      true,
    );
    this._lightboxSlider?.addEventListener?.(
      'click',
      this._handleLightboxBackgroundClick,
      true,
    );
    this._modal?.addEventListener?.(
      'sf-modal-opened',
      this._handleModalAfterOpen,
    );
    this._modal?.addEventListener?.(
      'sf-modal-closed',
      this._handleModalAfterClose,
    );
  }

  _detachNestedListeners() {
    this._modal?.removeEventListener?.(
      'sf-after-render',
      this._handleModalAfterRender,
    );
    this._inlineSlider?.removeEventListener?.(
      'change',
      this._handleInlineSlideChange,
    );
    this._lightboxSlider?.removeEventListener?.(
      'change',
      this._handleLightboxSlideChange,
    );
    this._lightboxSlider?.removeEventListener?.(
      'pointerdown',
      this._handleLightboxBackgroundPointerDown,
      true,
    );
    this._lightboxSlider?.removeEventListener?.(
      'pointerup',
      this._handleLightboxBackgroundPointerUp,
      true,
    );
    this._lightboxSlider?.removeEventListener?.(
      'click',
      this._handleLightboxBackgroundClick,
      true,
    );
    this._modal?.removeEventListener?.(
      'sf-modal-opened',
      this._handleModalAfterOpen,
    );
    this._modal?.removeEventListener?.(
      'sf-modal-closed',
      this._handleModalAfterClose,
    );
  }

  _syncSliderSlots() {
    this._syncSliderSlot(this._inlineSlider, 'inline');
    this._syncSliderSlot(this._lightboxSlider, 'lightbox');
  }

  _syncSliderSlot(sliderElement, mode) {
    if (!sliderElement?.setSlot) {
      return;
    }

    const slides = this._buildSliderSlideNodes(mode);
    if (!slides.length) {
      return;
    }

    this._rememberSliderIndex(sliderElement, this.current - 1);
    sliderElement.setSlot('slide', ...slides);
  }
  _queueNestedDefinitionSync() {
    if (this._nestedDefinitionSyncQueued) {
      return;
    }

    const needsSliderUpgrade =
      (this._inlineSlider && !this._inlineSlider.setSlot) ||
      (this._lightboxSlider && !this._lightboxSlider.setSlot);
    const needsLightboxRender = this.getProp('lightbox') && !this._lightboxSlider;
    const needsModalUpgrade = this._modal && !this._modal.open;

    if (!needsSliderUpgrade && !needsModalUpgrade && !needsLightboxRender) {
      return;
    }

    this._nestedDefinitionSyncQueued = true;
    const waits = [];

    if (needsSliderUpgrade && window.customElements?.whenDefined) {
      waits.push(window.customElements.whenDefined('sf-slider'));
    }

    if (needsModalUpgrade && window.customElements?.whenDefined) {
      waits.push(window.customElements.whenDefined('sf-modal'));
    }

    Promise.allSettled(waits).then(() => {
      requestAnimationFrame(() => {
        this._nestedDefinitionSyncQueued = false;

        if (!this.isConnected) {
          return;
        }

        this._detachNestedListeners();
        this._bindNestedComponents();
        this._syncSliderSlots();
        this._attachNestedListeners();
        this._syncSlidersToCurrent();

        if (this.openState) {
          this._modal?.open?.();
        }
      });
    });
  }

  _buildSliderSlideNodes(mode = 'inline') {
    const slides = normalizeSlotNodes(this.getSlotContent('slide'));

    return slides.map((slide, index) => {
      const wrapper = document.createElement('div');
      wrapper.className =
        'sf-gallery-slide flex content-main-center items-cross-center w-full min-w-0';
      wrapper.setAttribute('data-sf-gallery-index', String(index + 1));

      if (mode === 'inline' && this.getProp('lightbox')) {
        wrapper.setAttribute('data-sf-gallery-open', String(index + 1));
        wrapper.setAttribute('role', 'button');
        wrapper.setAttribute('tabindex', '0');
      }

      const content = slide.cloneNode(true);
      this.copyRuntimeData(slide, content);
      wrapper.append(content);
      return wrapper;
    });
  }

  _syncSlidersToCurrent() {
    const index = Math.max(this.current - 1, 0);
    this._syncSliderToIndex(this._inlineSlider, index);
    this._syncSliderToIndex(this._lightboxSlider, index);
  }

  _refreshLightboxSlider() {
    if (!this._lightboxSlider) {
      this._bindNestedComponents();
    }

    this._lightboxSlider?.refresh?.();

    const root = this._lightboxSlider?.querySelector?.('.sf-slider');
    if (root) {
      window.SF?.Slider?.refresh?.(root);
    }
  }

  _rememberSliderIndex(sliderElement, index) {
    if (!sliderElement?.setAttribute) {
      return;
    }

    const value = String(index);
    if (sliderElement.getAttribute('data-swiper-initial-slide') !== value) {
      sliderElement.setAttribute('data-swiper-initial-slide', value);
    }
  }

  _syncSliderToIndex(sliderElement, index) {
    this._rememberSliderIndex(sliderElement, index);
    const slider = sliderElement?._boundSlider || null;
    if (!slider || typeof index !== 'number' || index < 0) {
      return;
    }

    const currentIndex =
      typeof slider.realIndex === 'number'
        ? slider.realIndex
        : slider.activeIndex;

    if (currentIndex === index) {
      return;
    }

    if (slider.params?.loop && typeof slider.slideToLoop === 'function') {
      slider.slideToLoop(index, 0);
      return;
    }

    if (typeof slider.slideTo === 'function') {
      slider.slideTo(index, 0);
    }
  }

  _handleGalleryClick(event) {
    const trigger = event.target.closest?.('[data-sf-gallery-open]');
    if (!trigger || !this.getProp('lightbox')) {
      return;
    }

    const index = Number.parseInt(
      trigger.getAttribute('data-sf-gallery-open') || '1',
      10,
    );
    this.open(index);
  }

  _handleGalleryKeyDown(event) {
    const trigger = event.target.closest?.('[data-sf-gallery-open]');
    if (!trigger || !this.getProp('lightbox')) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    const index = Number.parseInt(
      trigger.getAttribute('data-sf-gallery-open') || '1',
      10,
    );
    this.open(index);
  }

  // A nested slider's change is the gallery's business: it becomes the
  // gallery's own change and stops here (§7.4: a part's events stop at the
  // component that holds it).
  _handleInlineSlideChange(event) {
    if (event.target !== this._inlineSlider) return;
    event.stopPropagation();
    this._syncCurrentFromEvent(event, false);
  }

  _handleLightboxSlideChange(event) {
    if (event.target !== this._lightboxSlider) return;
    event.stopPropagation();
    this._syncCurrentFromEvent(event, true);
  }

  _isLightboxBackgroundTarget(target) {
    if (!this.openState || !this.getProp('closeOnOverlay')) {
      return false;
    }

    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest(LIGHTBOX_BACKGROUND_CLOSE_IGNORE_SELECTOR)) {
      return false;
    }

    const activeSlide = target.closest('.swiper-slide-active');
    const gallerySlide = target.closest('.sf-gallery-slide');
    return Boolean(activeSlide || gallerySlide);
  }

  _stopLightboxBackgroundEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  _requestLightboxBackgroundClose() {
    if (this._pendingLightboxBackgroundClose) {
      return;
    }

    this._pendingLightboxBackgroundClose = true;
    requestAnimationFrame(() => {
      this._pendingLightboxBackgroundClose = false;
      this._lightboxBackgroundPointerActive = false;
      if (!this.openState) {
        return;
      }

      this.close();
    });
  }

  _handleLightboxBackgroundPointerDown(event) {
    if (!this._isLightboxBackgroundTarget(event.target)) {
      this._lightboxBackgroundPointerActive = false;
      return;
    }

    this._lightboxBackgroundPointerActive = true;
    this._stopLightboxBackgroundEvent(event);
  }

  _handleLightboxBackgroundPointerUp(event) {
    if (
      !this._lightboxBackgroundPointerActive &&
      !this._isLightboxBackgroundTarget(event.target)
    ) {
      return;
    }

    this._stopLightboxBackgroundEvent(event);
    this._requestLightboxBackgroundClose();
  }

  _handleLightboxBackgroundClick(event) {
    if (!this._isLightboxBackgroundTarget(event.target)) {
      return;
    }

    this._stopLightboxBackgroundEvent(event);
    this._requestLightboxBackgroundClose();
  }

  _handleModalAfterRender(event) {
    if (event.target !== this._modal) {
      return;
    }

    const slider = this._modal?.modalRoot
      ?.querySelector?.('[data-sf-gallery-slider="lightbox"]');
    if (!slider || slider === this._lightboxSlider) {
      return;
    }

    this._detachNestedListeners();
    this._lightboxSlider = slider;
    this._attachNestedListeners();
    this._syncSliderSlot(slider, 'lightbox');
    this._syncSliderToIndex(slider, Math.max(this.current - 1, 0));
    this._queueNestedDefinitionSync();
  }

  _handleModalAfterOpen(event) {
    // Modal events bubble; ignore those of a modal nested in the lightbox.
    if (event?.target && event.target !== this._modal) return;
    const targetIndex = Math.max(this.current - 1, 0);

    if (!this.hasAttribute('open')) {
      this.setAttribute('open', '');
    }

    this._refreshLightboxSlider();
    this._syncSliderToIndex(this._lightboxSlider, targetIndex);
    requestAnimationFrame(() => {
      if (!this.openState) {
        return;
      }

      this._refreshLightboxSlider();
      this._syncSliderToIndex(this._lightboxSlider, targetIndex);
    });
    this.sfEmit('opened', {
      current: this.current,
      total: this.slidesTotal,
    });
  }

  _handleModalAfterClose(event) {
    if (event?.target && event.target !== this._modal) return;
    if (this.hasAttribute('open')) {
      this.removeAttribute('open');
    }
    this.sfEmit('closed', {
      current: this.current,
      total: this.slidesTotal,
    });
  }

  _syncCurrentFromEvent(event, fromLightbox = false) {
    const next =
      Number(event.detail?.realIndex ?? event.detail?.activeIndex ?? 0) + 1;
    if (!Number.isFinite(next) || this._syncingCurrent) {
      return;
    }

    this._syncingCurrent = true;
    this._setCurrent(next, fromLightbox ? 'lightbox' : 'inline');
    this._syncingCurrent = false;
  }

  // §4.4: readers retire; kept until the date and noted on each call.
  getModal() {
    noteRetired('getModal');
    return this._modal || null;
  }

  getInlineSlider() {
    noteRetired('getInlineSlider');
    return this._inlineSlider || null;
  }

  getLightboxSlider() {
    noteRetired('getLightboxSlider');
    return this._lightboxSlider || null;
  }

  // The actions (§4.4) answer outcomes. `index` comes as a number or as
  // {index}, the manifest's parameter object.
  open(index = null) {
    const at = index && typeof index === 'object' ? index.index : index;
    if (!this.getProp('lightbox')) return { outcome: 'refused', reason: 'no-lightbox' };
    if (at !== null && typeof at !== 'undefined') {
      this.goTo(at);
    }

    this.setAttribute('open', '');
    this._modal?.open?.();
    return applied();
  }

  close() {
    if (!this.openState) return { outcome: 'refused', reason: 'closed' };
    this.removeAttribute('open');
    this._modal?.close?.();
    return applied();
  }

  toggle(index = null) {
    if (this.openState) {
      return this.close();
    }

    return this.open(index);
  }

  goTo(index) {
    const at = index && typeof index === 'object' ? index.index : index;
    if (!Number.isFinite(Number.parseInt(String(at), 10))) return { outcome: 'refused', reason: 'invalid' };
    this._setCurrent(at, 'api', { syncAttribute: true });
    return applied();
  }

  next() {
    return this.goTo(this.current + 1);
  }

  prev() {
    return this.goTo(this.current - 1);
  }
}

SfGallery.define('sf-gallery');
SfGallery.bindGlobalDelegation();
