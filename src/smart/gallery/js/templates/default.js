import { html, nothing } from 'lit';
import './default.css';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ').trim();
}

function renderSliderNode(context, type = 'inline') {
  const isInline = type === 'inline';
  const sliderClass = isInline ? context.inlineClass : context.lightboxClass;
  const authoredSpaceBetween = context.component?.hasAttribute('space-between');
  const authoredSpeed = context.component?.hasAttribute('speed');

  return html`
    <sf-slider
      data-sf-gallery-slider=${type}
      class=${sliderClass}
      button-type=${context.buttonType}
      button-size=${context.buttonSize}
      dots=${String(context.dots)}
      dots-type=${context.dotsType}
      dots-size=${context.dotsSize}
      thumbs=${String(context.thumbs)}
      thumbs-class=${context.thumbsClass}
      thumb-class=${context.thumbClass}
      arrows=${String(context.arrows)}
      loop=${String(context.loop)}
      space-between=${authoredSpaceBetween ? String(context.spaceBetween) : nothing}
      speed=${authoredSpeed ? String(context.speed) : nothing}
      slide-class=${context.slideClass}
    ></sf-slider>
  `;
}

export function renderGalleryTemplate(context) {
  const showInline = context.inline || !context.lightbox;
  return html`
    <div class=${joinClasses('sf-gallery flex flex-col gap-1', context.rootClass)}>
      ${showInline
        ? html`
            <div class="sf-gallery-inline" data-sf-gallery-inline>
              ${renderSliderNode(context, 'inline')}
            </div>
          `
        : nothing}
      ${context.lightbox
        ? html`
            <sf-modal
              data-sf-gallery-modal
              modal-id=${context.modalId}
              heading=${context.heading}
              text=${context.text}
              ?open=${context.open}
              overlay=${String(context.overlay)}
              show-header=${String(context.showHeader)}
              show-close=${String(context.showClose)}
              show-footer="false"
              close-on-esc=${String(context.closeOnEsc)}
              close-on-overlay=${String(context.closeOnOverlay)}
              preserve-scroll-gap=${String(context.preserveScrollGap)}
              position=${context.position}
              fullscreen=${String(context.fullscreen)}
              width=${context.width}
              height=${context.height}
              backdrop-blur=${String(context.backdropBlur)}
              blur-type=${context.blurType}
              overlay-class=${context.overlayClass}
              close-class=${context.closeClass}
              surface-class=${context.surfaceClass}
              surface-padding=${context.surfacePadding}
              panel-class=${joinClasses('sf-gallery-lightbox-panel min-w-0 max-w-full', context.panelClass)}
              header-class=${context.headerClass}
              body-class=${context.bodyClass}
              content-class=${context.contentClass}
              footer-class=${context.footerClass}
            >
              <div
                slot="content"
                class="sf-gallery-lightbox-content flex flex-col gap-1 h-full"
              >
                ${renderSliderNode(context, 'lightbox')}
              </div>
            </sf-modal>
          `
        : nothing}
    </div>
  `;
}
