import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function renderIconContent(context) {
  if (context.type !== 'icon') {
    return html`<span class="sf-toggle-inner transition" aria-hidden="true"></span>`;
  }

  return html`<i class="sf-icon" aria-hidden="true">${context.icon || 'check'}</i>`;
}

export function renderToggleTemplate(context) {
  const rootClasses = joinClasses(
    'sf-toggle',
    `sf-toggle--${context.kind ?? context.type}`,
    `sf-toggle--size-${context.size}`,
    'flex',
    'items-center',
    context.rootClass,
  );

  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? context.component.getSlotContent('label')
      : context.label
        ? html`<span class="sf-toggle-text">${context.label}</span>`
        : '';

  return html`
    <label class=${rootClasses} style=${context.rootStyle || nothing}>
      <span class="sf-toggle-control">
        <input
          type="checkbox"
          role="switch"
          name=${context.name || ''}
          .value=${context.value || ''}
          .checked=${context.checked}
          ?disabled=${context.disabled}
        />
        <span class="sf-toggle-container transition flex items-center content-main-start">
          <span class="sf-toggle-inner-wrap transition flex items-center content-main-center">
            ${renderIconContent(context)}
          </span>
        </span>
      </span>
      ${labelContent}
    </label>
  `;
}
