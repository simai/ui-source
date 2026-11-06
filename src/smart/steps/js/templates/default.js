import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// A stage's glyph: completed and error keep their status colours, skipped and
// running are the quiet on-surface-variant marks, running turning (1.2.0).
const STAGE_ICONS = { completed: 'check_circle', error: 'error', skipped: 'do_not_disturb_on', running: 'progress_activity' };

function renderStep(item, context) {
  const stepClasses = joinClasses(
    'sf-step',
    `sf-step--size-${context.size}`,
    `sf-step--stage-${item.stage}`,
    'flex',
    'items-center',
    'justify-center',
    item.selected ? 'selected' : '',
    item.disabled ? 'disabled' : 'cursor-pointer',
  );

  const iconName = STAGE_ICONS[item.stage] || '';
  const statusLabel = item.stage === 'completed'
    ? context.completedLabel
    : item.stage === 'error'
      ? context.errorLabel
      : item.stage === 'skipped'
        ? context.skippedLabel
        : item.stage === 'running'
          ? context.runningLabel
          : '';
  const accessibleLabel = statusLabel ? `${item.label}, ${statusLabel}` : nothing;

  return html`
    <button
      type="button"
      class=${stepClasses}
      data-step-index=${String(item.index)}
      ?disabled=${item.disabled}
      aria-current=${item.selected ? 'step' : nothing}
      aria-label=${accessibleLabel}
    >
      ${iconName ? html`<i class="sf-icon" aria-hidden="true">${iconName}</i>` : ''}
      <div class="sf-step-container flex items-center justify-center">${item.label}</div>
    </button>
  `;
}

export function renderStepsTemplate(context) {
  const rootClasses = joinClasses(
    'sf-steps',
    `sf-steps--size-${context.size}`,
    'flex',
    'flex-col',
    context.rootClass,
  );

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      role="group"
      aria-label=${context.ariaLabel || nothing}
    >
      <div class="sf-steps-container flex items-center">
        ${context.items.map(
          (item, index) => html`
            ${renderStep(item, context)}
            ${index < context.items.length - 1
              ? html`<i
                  class=${joinClasses(
                    'sf-icon',
                    'sf-steps-separator',
                    context.separatorIcon === 'chevron_right'
                      ? 'sf-steps-separator--directional'
                      : '',
                  )}
                  aria-hidden="true"
                >${context.separatorIcon}</i>`
              : ''}
          `,
        )}
      </div>
    </div>
  `;
}
