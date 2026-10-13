import { html, nothing } from 'lit';
import { normalizeSlideContent } from '../../../../component/slider/js/_slide-content';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function normalizeOption(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getButtonOptions(type = 'primary') {
  const normalizedType = normalizeOption(type);
  const options = {
    primary: { type: 'default', scheme: 'primary' },
    secondary: { type: 'tonal', scheme: 'secondary' },
    dark: { type: 'default', scheme: 'on-surface' },
    light: { type: 'link', scheme: 'on-surface' },
  };

  return options[normalizedType] || options.primary;
}

function getDotsClasses(type = 'primary-dark', size = '2') {
  const normalizedType = normalizeOption(type);
  const typeClasses = {
    primary: ['sf-slider-dots--primary', 'sf-slider-dots--dark'],
    'primary-light': ['sf-slider-dots--primary', 'sf-slider-dots--light'],
    'primary-dark': ['sf-slider-dots--primary', 'sf-slider-dots--dark'],
    light: ['sf-slider-dots--clear', 'sf-slider-dots--light'],
    dark: ['sf-slider-dots--clear', 'sf-slider-dots--dark'],
    clear: ['sf-slider-dots--clear', 'sf-slider-dots--light'],
  };

  return joinClasses(
    'sf-slider-dots',
    typeClasses[normalizedType] || typeClasses['primary-dark'],
    'sf-slider-dots--framed',
    `sf-slider-dots--size-${size || '2'}`,
    'flex',
    'sf-slider-pagination',
  );
}

function normalizeSlides(slides) {
  if (!slides || slides === nothing) return [];
  return normalizeSlideContent(slides);
}

function renderDefaultSlides() {
  return [
    html`
      <div class="radius-surface bg-primary color-on-primary p-2">
        Slide 1
      </div>
    `,
    html`
      <div class="radius-surface bg-secondary color-on-secondary p-2">
        Slide 2
      </div>
    `,
    html`
      <div class="radius-surface bg-tertiary color-on-tertiary p-2">
        Slide 3
      </div>
    `,
  ];
}

function cloneSlide(slide) {
  if (slide instanceof Node) {
    return slide.cloneNode(true);
  }

  return slide;
}

function stripThumbnailStyles(node) {
  if (!(node instanceof Element)) return node;

  [node, ...node.querySelectorAll('*')].forEach((element) => {
    element.removeAttribute('class');
    element.removeAttribute('style');
  });

  return node;
}

function createThumbnailContent(slide) {
  const clone = cloneSlide(slide);
  if (!(clone instanceof Element)) return clone;

  const mediaSelector = 'img, picture, video';
  const media = clone.matches(mediaSelector)
    ? clone
    : clone.querySelector(mediaSelector);

  if (!media) return clone;

  return stripThumbnailStyles(media.cloneNode(true));
}

function renderSlides(context) {
  const slides = normalizeSlides(context.slides);
  const items = slides.length ? slides : renderDefaultSlides();

  return items.map(
    (slide) => html`
      <div class="swiper-slide">
        <div class=${joinClasses('sf-slider-slide', context.slideClass)}>
          ${slide}
        </div>
      </div>
    `,
  );
}

function renderThumbSlides(context) {
  const slides = normalizeSlides(context.slides);
  const items = slides.length
    ? slides.map(createThumbnailContent)
    : renderDefaultSlides();

  return items.map(
    (slide) => html`
      <div class="swiper-slide">
        <div class=${joinClasses('sf-slider-thumbnail', context.thumbClass)}>
          ${slide}
        </div>
      </div>
    `,
  );
}

function renderArrows(context) {
  if (!context.arrows) return '';

  const buttonOptions = getButtonOptions(context.buttonType);
  const buttonSize = context.buttonSize || '1';

  return html`
    <div class="sf-slider-arrows sf-slider-arrows--size-2">
      <sf-icon-button
        root-class="sf-slider-button-prev"
        icon="keyboard_arrow_left"
        size=${buttonSize}
        appearance=${buttonOptions.type}
        scheme=${buttonOptions.scheme}
        aria-label=${context.previousLabel}
      ></sf-icon-button>
      <sf-icon-button
        root-class="sf-slider-button-next"
        icon="keyboard_arrow_right"
        size=${buttonSize}
        appearance=${buttonOptions.type}
        scheme=${buttonOptions.scheme}
        aria-label=${context.nextLabel}
      ></sf-icon-button>
    </div>
  `;
}

export function renderSliderTemplate(context) {
  const rootClasses = joinClasses('sf-slider', context.rootClass);
  const authoredSpaceBetween = context.component?.hasAttribute('space-between');
  const authoredSpeed = context.component?.hasAttribute('speed');

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      data-loop=${String(!!context.loop)}
      data-space-between=${authoredSpaceBetween ? String(context.spaceBetween) : nothing}
      data-speed=${authoredSpeed ? String(context.speed) : nothing}
    >
      <div class="sf-slider-main swiper">
        <div class="swiper-wrapper">
          ${renderSlides(context)}
        </div>
      </div>

      ${context.thumbs
        ? html`
            <div class=${joinClasses('sf-slider-thumbnails swiper', context.thumbsClass)}>
              <div class="swiper-wrapper">
                ${renderThumbSlides(context)}
              </div>
            </div>
          `
        : nothing}

      ${context.arrows || context.dots
        ? html`
            <div class="sf-slider-controls">
              ${renderArrows(context)}
              ${context.dots
                ? html`<div class=${getDotsClasses(context.dotsType, context.dotsSize)}></div>`
                : ''}
            </div>
          `
        : ''}
    </div>
  `;
}
