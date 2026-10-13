import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function buttonClasses(type) {
  if (type === 'primary') {
    return 'sf-button sf-button--default sf-button--primary sf-button--size-1/2';
  }

  return 'sf-button sf-button--default sf-button--on-surface sf-button--size-1/2';
}

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
                  class=${buttonClasses(context.type)}
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
              class="sf-icon-button sf-icon-button--variant-close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1/3"
              aria-label=${context.closeLabel || 'Close message'}
              data-close
              data-toast-close
            >
              <span
                class="sf-close sf-close--size-1/3 flex justify-center items-center"
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
