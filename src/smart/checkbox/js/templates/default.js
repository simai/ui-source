import {html, nothing} from 'lit';
import {keepHelpOutOfLabel} from '../../../../component/checkable-text-helper';
import {checkableClasses, renderCheckableHelp, renderCheckableRow, renderCheckableText} from '../../../helpers/checkable-row';
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

    const helpContent = renderCheckableHelp(context, 'sf-checkbox-help');

    const showContainer = !!(labelContent || descriptionContent);
    rootClasses.push(...checkableClasses(size, showContainer));
    const isStart = position === 'start';
    const input = html`
        <span class="sf-checkbox-box flex">
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
    const control = html`
        <label class=${rootClasses.filter(Boolean).join(' ')} style=${rootStyle || nothing} @click=${keepHelpOutOfLabel}>
            ${isStart ? input : ''}
            ${renderCheckableText({column: 'sf-checkbox-container', top: 'sf-checkbox-top'}, labelContent, descriptionContent)}
            ${!isStart ? input : ''}
        </label>
    `;
    return renderCheckableRow(size, control, helpContent);
}
