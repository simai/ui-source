import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The notice's action and close (owner decision C35): the action is an
// unsized (size 1) low button -- 32, compact and phone 28 -- whose label is
// the notice's text size, tonal surface (C110 variant E: tonal on-surface),
// its plate starting at the text edge;
// the close a size-1 low icon button, 32 / 28 / 28, centred on the first line.
// The same classes as the class toast (component/toast/js/_toast.js).
const TOAST_ACTION_CLASSES = 'sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center';
const TOAST_CLOSE_CLASSES = 'sf-icon-button sf-icon-button--close sf-icon-button--variant-close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center';

export function renderToastTemplate(context) {
  const rootClasses = joinClasses(
    'sf-toast',
    // The component normalises the legacy words, so the template sees only the
    // shared vocabulary.
    `sf-toast--${['neutral', 'info', 'success', 'warning', 'error'].includes(context.status ?? context.type)
      ? (context.status ?? context.type)
      : 'neutral'}`,
    // The author's switch (owner 2026-11-13, #q-layout-override): the action
    // under the text at every width; auto (and any other word) is layout L3a.
    context.actionsLayout === 'under' ? 'sf-toast--actions-under' : '',
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
        // The status icon is an sf-icon, as the alert's is (1.2.1): it asks
        // the Loader for its own glyph. A bare <i class="sf-icon"> was found
        // only by the Loader's page scan, so a toast drawn where the scan
        // does not look (a data-sf-observer="ignore" region, a shadow root)
        // kept an empty box for a glyph the page had not asked for yet.
        ? html`<sf-icon icon=${context.icon} aria-hidden="true"></sf-icon>`
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
