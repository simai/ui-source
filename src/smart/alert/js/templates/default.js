import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function resolveIcon(context) {
  if (context.icon === 'none') {
    return '';
  }
  if (context.icon !== undefined && context.icon !== null && context.icon !== '') {
    return context.icon;
  }

  // Keyed by the shared status vocabulary. The component normalises the legacy
  // words before the template sees them, so clear and danger do not appear here.
  const byStatus = {
    neutral: 'info',
    info: 'info',
    error: 'error',
    warning: 'warning',
    success: 'check_circle',
  };

  return byStatus[context.status ?? context.type] || 'info';
}

// The notice's actions (owner decision C35, as the toast; DEV acceptance D3):
// unsized (size 1) low buttons -- 32, compact and phone 28 -- whose label is
// the notice's text size; the first tonal surface (owner decision C110 as
// amended 2026-11-12, variant E: tonal on-surface, the same neutral plate on
// every level), its plate starting at the text edge, the second ghost
// on-surface after it. The class toast writes the same classes
// (component/toast/js/_toast.js).
const ALERT_ACTION_CLASSES = 'sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center';
const ALERT_SECONDARY_ACTION_CLASSES = 'sf-button sf-button--ghost sf-button--link sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center';

export function renderAlertTemplate(context) {
  const rootClasses = joinClasses(
    'sf-alert',
    `sf-alert--${context.status ?? context.type}`,
    `sf-alert--${context.appearance ?? context.variant}`,
    'flex',
    'items-start',
    context.rootClass,
  );

  const iconName = resolveIcon(context);
  const titleContent =
    context.component?.hasSlotContent?.('title') ? context.component.getSlotContent('title') : context.heading;
  const supportingTextContent =
    context.component?.hasSlotContent?.('supporting-text')
      ? context.component.getSlotContent('supporting-text')
      : context.supportingText;

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role=${context.liveRole || nothing}
      aria-label=${context.accessibleName || nothing}
    >
      ${iconName ? html`<sf-icon icon="${iconName}" aria-hidden="true"></sf-icon>` : nothing}

      <div class="sf-alert-wrap flex flex-col flex-1">
        <div class="sf-alert-content flex flex-col flex-1">
          ${titleContent ? html`<div class="sf-alert-text">${titleContent}</div>` : nothing}
          ${supportingTextContent
            ? html`<div class="sf-alert-supporting-text">${supportingTextContent}</div>`
            : nothing}
        </div>

        ${context.actionText || context.secondaryActionText
          ? html`
              <div class="sf-alert-buttons flex flex-wrap items-center">
                ${context.actionText
                  ? html`
                      <button
                        type="button"
                        class=${ALERT_ACTION_CLASSES}
                        data-action=${context.action || 'action'}
                        data-alert-action=${context.action || 'action'}
                      >
                        <span class="sf-button-text-container">${context.actionText}</span>
                      </button>
                    `
                  : nothing}
                ${context.secondaryActionText
                  ? html`
                      <button
                        type="button"
                        class=${ALERT_SECONDARY_ACTION_CLASSES}
                        data-action=${context.secondaryAction || 'secondary'}
                        data-alert-action=${context.secondaryAction || 'secondary'}
                      >
                        <span class="sf-button-text-container">${context.secondaryActionText}</span>
                      </button>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>

      ${context.closable
        ? html`
                  <sf-button-icon
                          kind="close"
                          size="1"
                          height="low"
                          appearance="ghost"
                          scheme="on-surface"
                          data-close
                          data-alert-close
                          aria-label=${context.closeLabel || 'Close alert'}
                  ></sf-button-icon>
          `
        : nothing}
    </div>
  `;
}
