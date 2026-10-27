import { html, nothing } from 'lit';

export function renderRadioTemplate(context) {
  const { size, label, description, help, checked, disabled, name, value, invalid, innerForm } =
    context;

  const rootClasses = ['sf-radio-button', `sf-radio-button--size-${size}`, 'flex', context.rootClass];

  if (invalid) {
    rootClasses.push('error');
  }

  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? context.component.getSlotContent('label')
      : label
        ? html`<span class="sf-radio-button-text">${label}</span>`
        : '';

  const descriptionContent =
    context.component?.hasSlotContent?.('description')
      ? context.component.getSlotContent('description')
      : description
        ? html`<span class="sf-radio-button-description">${description}</span>`
        : '';

  const helpContent =
    context.component?.hasSlotContent?.('help')
      ? context.component.getSlotContent('help')
      : help
        ? html`<i class="sf-icon" aria-hidden="true">${help}</i>`
        : '';

  const showContainer = !!(labelContent || descriptionContent || helpContent);

  return html`
    <label class=${rootClasses.filter(Boolean).join(' ')} style=${context.rootStyle || nothing}>
      <span class="sf-radio-button-box transition flex items-cross-center content-main-center">
        <input
          type="radio"
          name=${name || nothing}
          form=${innerForm || nothing}
          .value=${value || 'on'}
          .checked=${checked}
          ?disabled=${disabled}
        />
        <span class="sf-radio-button-mark" aria-hidden="true"></span>
      </span>

      ${showContainer
        ? html`
            <span class="sf-radio-button-container flex flex-col">
              ${labelContent || helpContent
                ? html`
                    <span class="sf-radio-button-top flex">
                      ${labelContent}
                      ${helpContent}
                    </span>
                  `
                : ''}
              ${descriptionContent}
            </span>
          `
        : ''}
    </label>
  `;
}
