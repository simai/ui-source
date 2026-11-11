import { html, nothing } from 'lit';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import { keepHelpOutOfLabel } from '../../../../component/checkable-text-helper';

// The help mark keeps the label's line: 1/3 beside the lines of sizes 1/2 and
// 1, 1/2 beside size 2 (the mark adds no height of its own).
const HELP_SIZE = { '1/2': '1/3', 1: '1/3', 2: '1/2' };

export function renderSwitchTemplate(context) {
  const { size, label, description, help, checked, disabled, checkboxName, value, ariaLabel } = context;

  const rootClasses = ['sf-switch', `sf-switch--size-${size}`, context.short ? 'sf-switch--short' : '', 'flex', context.rootClass];

  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? context.component.getSlotContent('label')
      : label
        ? html`<span class="sf-switch-text">${label}</span>`
        : '';

  // A slotted description is held in a plain span: the binding names it as the
  // checkbox's description (aria-describedby, simai/ui-source#44), and a bare
  // text node has no id. The span draws nothing of its own.
  const descriptionContent =
    context.component?.hasSlotContent?.('description')
      ? html`<span data-sf-switch-description>${context.component.getSlotContent('description')}</span>`
      : description
        ? html`<span class="sf-switch-description">${description}</span>`
        : '';

  const helpContent =
    context.component?.hasSlotContent?.('help')
      ? context.component.getSlotContent('help')
      // help is the explanation: a «?» button after the label text that opens
      // it (sf-help-mark), outside the switch's activation.
      : help
        ? html`<sf-help-mark class="sf-switch-help" size=${HELP_SIZE[size] || '1/3'} text=${help} label=${context.helpLabel || nothing}></sf-help-mark>`
        : '';

  const showContainer = !!(labelContent || descriptionContent);

  const control = html`
    <label class=${rootClasses.filter(Boolean).join(' ')} style=${context.rootStyle || nothing} @click=${keepHelpOutOfLabel}>
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
              ${labelContent
                ? html`
                    <span class="sf-switch-top flex">
                      <span class="sf-switch-container flex items-cross-center content-main-center">
                        ${labelContent}
                      </span>
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
  // The help mark is the label's sibling in a row, not inside the <label>
  // (owner decision C59, as C33 for field labels): pressing «?» is no press
  // on the switch.
  return helpContent
    ? html`<span class=${`sf-switch-row sf-switch-row--size-${size} flex flex-nowrap items-cross-start`}>${control}${helpContent}</span>`
    : control;
}
