import {html, nothing} from 'lit';
import './default.css'

export function renderCheckboxTemplate(context) {
    const {
        size,
        label,
        description,
        help,
        checked,
        disabled,
        position,
        indeterminate,
        name,
        rootClass,
        rootStyle,
        value,
        error,
        stateIcon,
        ariaLabel,
    } = context;

    const rootClasses = ['sf-checkbox', `sf-checkbox--size-${size}`, 'flex', rootClass];

    if (error) {
        rootClasses.push('error');
    }
    if (!disabled) {
        rootClasses.push('cursor-pointer');
    }

    const labelContent =
        context.component?.hasSlotContent?.('label')
            ? context.component.getSlotContent('label')
            : label
                ? html`<span class="sf-checkbox-label">${label}</span>`
                : '';

    const descriptionContent =
        context.component?.hasSlotContent?.('description')
            ? context.component.getSlotContent('description')
            : description
                ? html`<span class="sf-checkbox-description">${description}</span>`
                : '';

    const helpContent =
        context.component?.hasSlotContent?.('help')
            ? context.component.getSlotContent('help')
            : help
                ? html`
                            <sf-icon aria-hidden="true" icon="${help}"></sf-icon>`
                : '';

    const showContainer = !!(labelContent || descriptionContent || helpContent);
    const isStart = position === 'start';
    const input = html`
        <span class="sf-checkbox-box transition flex">
        <input
                type="checkbox"
                name=${name || ''}
                .value=${value || ''}
                .checked=${checked}
                ?disabled=${disabled}
                .indeterminate=${indeterminate}
                aria-invalid=${error ? 'true' : nothing}
                aria-label=${!label && !context.component?.hasSlotContent?.('label') && ariaLabel ? ariaLabel : nothing}
        />
          <sf-icon aria-hidden="true" icon=${stateIcon || ''}></sf-icon>
      </span>`
    return html`
        <label class=${rootClasses.filter(Boolean).join(' ')} style=${rootStyle || nothing}>
            ${isStart ? input : ''}
            ${showContainer
                    ? html`
                        <span class="sf-checkbox-container flex flex-col">
              ${labelContent || helpContent
                      ? html`
                          <span class="sf-checkbox-top flex">
                      ${labelContent}
                      ${helpContent}
                    </span>
                      `
                      : ''}
              ${descriptionContent}
            </span>
                    `
                    : ''}
            ${!isStart ? input : ''}
        </label>
    `;
}
