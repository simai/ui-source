import {html, nothing} from 'lit';
import {keepHelpOutOfLabel} from '../../../../component/checkable-text-helper';
import './default.css'

// The help mark keeps the label's line: 1/3 beside the lines of sizes 1/2 and
// 1, 1/2 beside size 2 (the mark adds no height of its own).
const HELP_SIZE = {'1/2': '1/3', 1: '1/3', 2: '1/2'};

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
        invalid,
        stateIcon,
        ariaLabel,
    } = context;

    const rootClasses = ['sf-checkbox', `sf-checkbox--size-${size}`, 'flex', rootClass];

    if (invalid) {
        rootClasses.push('error');
    }
    if (!disabled) {
        rootClasses.push('cursor-pointer');
    }

    const labelContent =
        context.component?.hasSlotContent?.('label')
            // A slotted label is held in a plain span so the input is named
            // by the label alone (aria-labelledby), not by the help beside it.
            ? html`<span data-sf-checkbox-label>${context.component.getSlotContent('label')}</span>`
            : label
                ? html`<span class="sf-checkbox-label">${label}</span>`
                : '';

    const descriptionContent =
        context.component?.hasSlotContent?.('description')
            // A slotted description is held in a plain span so the input can
            // name it as its description (aria-describedby): a bare text node
            // has no id. The span draws nothing of its own.
            ? html`<span data-sf-checkbox-description>${context.component.getSlotContent('description')}</span>`
            : description
                ? html`<span class="sf-checkbox-description">${description}</span>`
                : '';

    const helpContent =
        context.component?.hasSlotContent?.('help')
            ? context.component.getSlotContent('help')
            // help is the explanation: a «?» button after the label text that
            // opens it (sf-help-mark), outside the control's activation.
            : help
                ? html`<sf-help-mark class="sf-checkbox-help" size=${HELP_SIZE[size] || '1/3'} text=${help} label=${context.helpLabel || nothing}></sf-help-mark>`
                : '';

    const showContainer = !!(labelContent || descriptionContent || helpContent);
    const isStart = position === 'start';
    const input = html`
        <span class="sf-checkbox-box transition flex">
        <input
                type="checkbox"
                name=${name || nothing}
                .value=${value || 'on'}
                .checked=${checked}
                ?disabled=${disabled}
                .indeterminate=${indeterminate}
                aria-invalid=${invalid ? 'true' : nothing}
                aria-label=${!label && !context.component?.hasSlotContent?.('label') && ariaLabel ? ariaLabel : nothing}
        />
          <sf-icon aria-hidden="true" icon=${stateIcon || ''}></sf-icon>
      </span>`
    return html`
        <label class=${rootClasses.filter(Boolean).join(' ')} style=${rootStyle || nothing} @click=${keepHelpOutOfLabel}>
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
