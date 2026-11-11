import { html, nothing } from 'lit';
import { keepHelpOutOfLabel } from '../../../../component/checkable-text-helper';

// The help mark keeps the label's line: 1/3 beside the lines of sizes 1/2 and
// 1, 1/2 beside size 2 (the mark adds no height of its own).
const HELP_SIZE = { '1/2': '1/3', 1: '1/3', 2: '1/2' };

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

  const helpContent =
    context.component?.hasSlotContent?.('help')
      ? context.component.getSlotContent('help')
      // help is the explanation: a «?» button after the label text that opens
      // it (sf-help-mark), outside the control's activation.
      : help
        ? html`<sf-help-mark class="sf-radio-button-help" size=${HELP_SIZE[size] || '1/3'} text=${help} label=${context.helpLabel || nothing}></sf-help-mark>`
        : '';

  const showContainer = !!(labelContent || descriptionContent);

  const control = html`
    <label class=${rootClasses.filter(Boolean).join(' ')} style=${context.rootStyle || nothing} @click=${keepHelpOutOfLabel}>
      <span class="sf-radio-button-box transition flex items-cross-center content-main-center">
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

      ${showContainer
        ? html`
            <span class="sf-radio-button-container flex flex-col">
              ${labelContent
                ? html`
                    <span class="sf-radio-button-top flex">
                      ${labelContent}
                    </span>
                  `
                : ''}
              ${descriptionContent}
            </span>
          `
        : ''}
    </label>
  `;
  // The help mark is the label's sibling in a row, not inside the <label>
  // (owner decision C59, as C33 for field labels): pressing «?» is no press
  // on the control.
  return helpContent
    ? html`<span class=${`sf-radio-button-row sf-radio-button-row--size-${size} flex flex-nowrap items-cross-start`}>${control}${helpContent}</span>`
    : control;
}
