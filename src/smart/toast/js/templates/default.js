import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The notice's action and close (owner decision C35): the action is an
// unsized (size 1) low button -- 32, compact and phone 28 -- whose label is
// the notice's text size, tonal primary, its plate starting at the text edge;
// the close a size-1 low icon button, 32 / 28 / 28, centred on the first line.
// The same classes as the class toast (component/toast/js/_toast.js).
const TOAST_ACTION_CLASSES = 'sf-button sf-button--tonal sf-button--primary sf-button--size-1 sf-button--height-low flex items-cross-center';
const TOAST_CLOSE_CLASSES = 'sf-icon-button sf-icon-button--close sf-icon-button--variant-close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center';

export function renderToastTemplate(context) {
  const rootClasses = joinClasses(
    'sf-toast',
    // The component normalises the legacy words, so the template sees only the
    // shared vocabulary.
    `sf-toast--${['neutral', 'info', 'success', 'warning', 'error'].includes(context.status ?? context.type)
      ? (context.status ?? context.type)
      : 'neutral'}`,
    'flex',
    'items-cross-start',
    context.rootClass,
  );

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role=${context.role || nothing}
      data-duration=${context.duration > 0 ? context.duration : nothing}
    >
      ${context.icon
        ? html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>`
        : nothing}

      <div class="sf-toast-container flex flex-col flex-1">
        <div class="sf-toast-wrap flex flex-col">
          ${context.title
            ? html`<div class="sf-toast-text">${context.title}</div>`
            : nothing}
          ${context.supportingText
            ? html`<div class="sf-toast-supporting-text">${context.supportingText}</div>`
            : nothing}
        </div>

        ${context.actionText
          ? html`
              <div class="sf-toast-bottom flex items-center">
                <button
                  type="button"
                  class=${TOAST_ACTION_CLASSES}
                  data-action=${context.action || 'action'}
                  data-toast-action=${context.action || 'action'}
                >
                  <span class="sf-button-text-container">${context.actionText}</span>
                </button>
              </div>
            `
          : nothing}
      </div>

      ${context.closable
        ? html`
            <button
              type="button"
              class=${TOAST_CLOSE_CLASSES}
              aria-label=${context.closeLabel || 'Close message'}
              data-close
              data-toast-close
            >
              <span
                class="sf-close sf-close--size-1 flex justify-center items-center"
                aria-hidden="true"
              >
                <span class="sf-close-icon"></span>
              </span>
            </button>
          `
        : nothing}
    </div>
  `;
}
