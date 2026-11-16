import { html, nothing } from 'lit';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import { keepHelpOutOfLabel } from '../../../../component/checkable-text-helper';
import { checkableClasses, renderCheckableHelp, renderCheckableRow, renderCheckableText } from '../../../helpers/checkable-row';

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

  const helpContent = renderCheckableHelp(context, 'sf-switch-help');

  const showContainer = !!(labelContent || descriptionContent);
  rootClasses.push(...checkableClasses(size, showContainer));

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

      ${renderCheckableText({ column: 'sf-switch-container-wrap', top: 'sf-switch-top', wrap: 'sf-switch-container flex items-cross-center content-main-center' }, labelContent, descriptionContent)}
      ${renderInheritedSlot(context.component, { size, disabled, className: 'sf-switch-inherited' })}
    </label>
  `;
  return renderCheckableRow(size, control, helpContent);
}
