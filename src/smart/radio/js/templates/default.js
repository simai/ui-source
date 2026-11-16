import { html, nothing } from 'lit';
import { keepHelpOutOfLabel } from '../../../../component/checkable-text-helper';
import { checkableClasses, renderCheckableHelp, renderCheckableRow, renderCheckableText } from '../../../helpers/checkable-row';

export function renderRadioTemplate(context) {
  const { size, label, description, help, checked, disabled, controlName, value, invalid, innerForm } =
    context;

  const rootClasses = ['sf-radio-button', `sf-radio-button--size-${size}`, 'flex', context.rootClass];

  if (invalid) {
    rootClasses.push('error');
  }

  const labelContent =
    context.component?.hasSlotContent?.('label')
      // A slotted label is held in a plain span so the input is named by the
      // label alone (aria-labelledby), not by the help beside it.
      ? html`<span data-sf-radio-label>${context.component.getSlotContent('label')}</span>`
      : label
        ? html`<span class="sf-radio-button-text">${label}</span>`
        : '';

  const descriptionContent =
    context.component?.hasSlotContent?.('description')
      // A slotted description is held in a plain span so the input can name it
      // as its description (aria-describedby): a bare text node has no id.
      ? html`<span data-sf-radio-description>${context.component.getSlotContent('description')}</span>`
      : description
        ? html`<span class="sf-radio-button-description">${description}</span>`
        : '';

  const helpContent = renderCheckableHelp(context, 'sf-radio-button-help');

  const showContainer = !!(labelContent || descriptionContent);
  rootClasses.push(...checkableClasses(size, showContainer));

  const control = html`
    <label class=${rootClasses.filter(Boolean).join(' ')} style=${context.rootStyle || nothing} @click=${keepHelpOutOfLabel}>
      <span class="sf-radio-button-box flex items-cross-center content-main-center">
        <input
          type="radio"
          name=${controlName || nothing}
          form=${innerForm || nothing}
          .value=${value || 'on'}
          .checked=${checked}
          ?disabled=${disabled}
        />
        <span class="sf-radio-button-mark" aria-hidden="true"></span>
      </span>

      ${renderCheckableText({ column: 'sf-radio-button-container', top: 'sf-radio-button-top' }, labelContent, descriptionContent)}
    </label>
  `;
  return renderCheckableRow(size, control, helpContent);
}
