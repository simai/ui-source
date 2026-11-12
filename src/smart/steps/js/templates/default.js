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

  // The steps are an ordered list (R185 ST-13): a screen reader says how many
  // there are and which one this is; the current step says aria-current=step.
  // role="list" is written out because a list without its markers loses the
  // role in WebKit. Each item holds its step and the separator after it, so
  // the list has no child but its items and a step moves to the next line
  // whole, with its separator.
  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
    >
      <ol
        class="sf-steps-container flex items-center"
        role="list"
        aria-label=${context.ariaLabel || nothing}
      >
        ${context.items.map(
          (item, index) => html`<li class="flex items-center">
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
          </li>`,
        )}
      </ol>
    </div>
  `;
}
