import { html, nothing } from 'lit';
import { normalizeSlideContent } from '../../../../component/slider/js/_slide-content';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function normalizeOption(value = '') {
  return String(value || '').trim().toLowerCase();
}

// Paging is no main action (decision C116, SL-11): the arrows are icon
// buttons, and by default the soft grey ones; primary stays a choice.
function getButtonOptions(type = 'secondary') {
  const normalizedType = normalizeOption(type);
  const options = {
    primary: { type: 'default', scheme: 'primary' },
    // The soft grey arrows (decision C116, BS-2): secondary is no colour of a
    // button any more; the button-type keeps its name.
    secondary: { type: 'tonal', scheme: 'on-surface' },
    dark: { type: 'default', scheme: 'on-surface' },
    // ghost, not its former name link: a link here was counted as the page's
    // own use in SF.deprecations (pair ui-a0370c0c99fb acceptance, F3).
    light: { type: 'ghost', scheme: 'on-surface' },
  };

  return options[normalizedType] || options.secondary;
}

// The dots' plate by its colour role (sf-slider 1.2.0, docs precheck Q4). The
// former words are dated aliases until 2027-01-01 (the shim rewrites them on
// the host); they stay here for a value handed to the template directly.
function getDotsClasses(type = 'primary-container', size = '2', place = '') {
  const normalizedType = normalizeOption(type);
  // The dots' place when the page chose no plate (C143 (2), (3)): over a
  // picture a popup plate with its shadow, under cards no plate at all.
  if (place) {
    return joinClasses(
      'sf-slider-dots',
      `sf-slider-dots--${place}`,
      `sf-slider-dots--size-${size || '2'}`,
      'flex',
      'sf-slider-pagination',
    );
  }
  const typeClasses = {
    'primary-container': ['sf-slider-dots--primary', 'sf-slider-dots--dark'],
    primary: ['sf-slider-dots--primary', 'sf-slider-dots--light'],
    'surface-container': ['sf-slider-dots--clear', 'sf-slider-dots--light'],
    'surface-inverse': ['sf-slider-dots--clear', 'sf-slider-dots--dark'],
    'primary-light': ['sf-slider-dots--primary', 'sf-slider-dots--light'],
    'primary-dark': ['sf-slider-dots--primary', 'sf-slider-dots--dark'],
    light: ['sf-slider-dots--clear', 'sf-slider-dots--light'],
    dark: ['sf-slider-dots--clear', 'sf-slider-dots--dark'],
    clear: ['sf-slider-dots--clear', 'sf-slider-dots--light'],
  };

  return joinClasses(
    'sf-slider-dots',
    typeClasses[normalizedType] || typeClasses['primary-container'],
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

// Over a picture the quiet arrows stand on popup plates with the overlay
// shadow (C143 (2)): a ghost button on the plate, so its hover tints the plate
// and an arrow with nowhere to go dims its glyph and keeps its plate.
function isPlated(context) {
  return !context.content && normalizeOption(context.buttonType || 'secondary') === 'secondary';
}

function renderArrows(context) {
  if (!context.arrows) return '';

  const plated = isPlated(context);
  const buttonOptions = plated ? { type: 'ghost', scheme: 'on-surface' } : getButtonOptions(context.buttonType);
  const buttonSize = context.buttonSize || '1';
  // button-type light is the class look --light: ghost arrows on the light
  // circle (sf-slider 1.2.1, FW-B-3). The template wrote the ghost buttons
  // without the class, so their dark glyph lay on the picture, 1.28:1 on a
  // dark photo (RG-OT 9, C224: the Smart twin draws the class look).
  const light = !plated && normalizeOption(context.buttonType) === 'light';

  return html`
    <div class=${joinClasses('sf-slider-arrows sf-slider-arrows--size-2', plated && 'sf-slider-arrows--plate', light && 'sf-slider-arrows--light')}>
      <sf-button-icon
        root-class="sf-slider-button-prev"
        icon="keyboard_arrow_left"
        size=${buttonSize}
        appearance=${buttonOptions.type}
        scheme=${buttonOptions.scheme}
        aria-label=${context.previousLabel}
      ></sf-button-icon>
      <sf-button-icon
        root-class="sf-slider-button-next"
        icon="keyboard_arrow_right"
        size=${buttonSize}
        appearance=${buttonOptions.type}
        scheme=${buttonOptions.scheme}
        aria-label=${context.nextLabel}
      ></sf-button-icon>
    </div>
  `;
}

// The pause button (C143 (6)): drawn only when the page asks for autoplay,
// first in the Tab order; the slider turns only while it is shown. It stands
// in the bar under the slides, beside the position (owner decision
// 2026-11-21), so it is the soft grey button on the page, not a plate.
function renderRotation(context) {
  if (!context.autoplay) return nothing;
  return html`
    <div class="sf-slider-rotation-place">
      <sf-button-icon
        root-class="sf-slider-rotation sf-slider-button-rotation"
        icon="pause"
        size=${context.buttonSize || '1'}
        appearance="tonal"
        scheme="on-surface"
        aria-label=${context.pauseLabel}
      ></sf-button-icon>
    </div>
  `;
}

// The position stands under the slides in both places (owner decision
// 2026-11-21): bare dots, no plate over a picture any more.
function renderPosition(context) {
  if (!context.dots) return nothing;
  const authored = context.component?.hasAttribute?.('dots-type');
  const place = authored ? '' : 'bare';
  return html`<div class=${getDotsClasses(context.dotsType, context.dotsSize, place)}></div>`;
}

const RATIOS = new Set(['16/9', '4/3', '3/2', '1/1', '21/9', 'auto']);
// The position inside the picture and its ink (owner decision C398):
// indicator="inside" on a picture slider or a hero; the ink is measured from
// the picture unless the page writes light, dark or outline.
const INKS = new Set(['light', 'dark', 'outline']);

export function renderSliderTemplate(context) {
  context = {
    ...context,
    content: /(^|\s)sf-slider--content(\s|$)/.test(context.rootClass || ''),
  };
  const ratio = String(context.ratio || '16/9').replace(/\s+/g, '');
  const rootClasses = joinClasses('sf-slider', context.rootClass);
  const authoredSpaceBetween = context.component?.hasAttribute('space-between');
  const authoredSpeed = context.component?.hasAttribute('speed');

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      aria-roledescription=${context.regionRoleDescription || nothing}
      data-label=${context.regionLabel || nothing}
      data-slide-label=${context.slideLabel || nothing}
      data-slide-roledescription=${context.slideRoleDescription || nothing}
      data-ratio=${RATIOS.has(ratio) ? ratio : '16/9'}
      data-indicator=${normalizeOption(context.indicator) === 'inside' ? 'inside' : nothing}
      data-indicator-ink=${INKS.has(normalizeOption(context.indicatorInk)) ? normalizeOption(context.indicatorInk) : nothing}
      data-pause-label=${context.pauseLabel || nothing}
      data-play-label=${context.playLabel || nothing}
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

      ${context.arrows || context.dots || context.autoplay
        ? html`
            <div class="sf-slider-controls">
              ${renderRotation(context)}
              ${context.content
                ? html`${renderPosition(context)}${renderArrows(context)}`
                : html`${renderArrows(context)}${renderPosition(context)}`}
            </div>
          `
        : ''}
    </div>
  `;
}
