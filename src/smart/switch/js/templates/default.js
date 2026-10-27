import { html, nothing } from 'lit';
import { renderInheritedSlot } from '../../../helpers/inherited-value';

export function renderSwitchTemplate(context) {
  const { size, label, description, help, checked, disabled, checkboxName, value, ariaLabel } = context;

  const rootClasses = ['sf-switch', `sf-switch--size-${size}`, 'flex', context.rootClass];

  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? context.component.getSlotContent('label')
      : label
        ? html`<span class="sf-switch-text">${label}</span>`
        : '';

  const descriptionContent =
    context.component?.hasSlotContent?.('description')
      ? context.component.getSlotContent('description')
      : description
        ? html`<span class="sf-switch-description">${description}</span>`
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
      <span class="sf-switch-toggler transition flex items-cross-center content-main-start">
        <input
          type="checkbox"
          role="switch"
          name=${checkboxName || nothing}
          .value=${value || 'on'}
          .checked=${checked}
          ?disabled=${disabled}
          aria-label=${!labelContent && ariaLabel ? ariaLabel : nothing}
        />
        <span class="sf-switch-inner transition" aria-hidden="true"></span>
      </span>

      ${showContainer
        ? html`
            <span class="sf-switch-container-wrap flex flex-col">
              ${labelContent || helpContent
                ? html`
                    <span class="sf-switch-top flex">
                      ${labelContent
                        ? html`
                            <span class="sf-switch-container flex items-cross-center content-main-center">
                              ${labelContent}
                            </span>
                          `
                        : ''}
                      ${helpContent}
                    </span>
                  `
                : ''}
              ${descriptionContent}
            </span>
          `
        : ''}
      ${renderInheritedSlot(context.component, { size, disabled, className: 'sf-switch-inherited' })}
    </label>
  `;
}
