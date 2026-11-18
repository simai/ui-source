import { html, nothing } from 'lit';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import { keepHelpOutOfLabel } from '../../../../component/checkable-text-helper';
import { checkableClasses, renderCheckableHelp, renderCheckableMessage, renderCheckableRow, renderCheckableText } from '../../../helpers/checkable-row';

export function renderSwitchTemplate(context) {
  const { size, label, description, help, checked, disabled, checkboxName, value, ariaLabel } = context;

  // invalid (FO-1): .error is the look, as sf-checkbox's (component.switch).
  const rootClasses = ['sf-switch', `sf-switch--size-${size}`, context.short ? 'sf-switch--short' : '', context.invalid ? 'error' : '', 'flex', context.rootClass];

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

  // position="end" (C251, SM-SW-1): the track after the text column, as
  // sf-checkbox's box and the class markup's (the track the label's last child).
  const atEnd = context.position === 'end';
  // The thumb's glyphs (C251, SM-SW-1), the class markup's: one glyph stays in
  // both states; with icon-on the two cross over (.sf-switch-icon--off / --on).
  const icons = context.iconOn
    ? html`${context.icon ? html`<i class="sf-icon sf-switch-icon--off" aria-hidden="true">${context.icon}</i>` : nothing}<i class="sf-icon sf-switch-icon--on" aria-hidden="true">${context.iconOn}</i>`
    : context.icon ? html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>` : nothing;
  const toggler = html`
      <span class="sf-switch-toggler transition flex items-cross-center content-main-start">
        <input
          type="checkbox"
          role="switch"
          name=${checkboxName || nothing}
          .value=${value || 'on'}
          .checked=${checked}
          ?disabled=${disabled}
          aria-invalid=${context.invalid ? 'true' : nothing}
          aria-label=${!labelContent && ariaLabel ? ariaLabel : nothing}
        />
        <span class="sf-switch-inner transition" aria-hidden="true">${icons}</span>
      </span>`;
  const control = html`
    <label class=${rootClasses.filter(Boolean).join(' ')} style=${context.rootStyle || nothing} @click=${keepHelpOutOfLabel}>
      ${atEnd ? '' : toggler}
      ${renderCheckableText({ column: 'sf-switch-container-wrap', top: 'sf-switch-top', wrap: 'sf-switch-container flex items-cross-center content-main-center' }, labelContent, descriptionContent)}
      ${atEnd ? toggler : ''}
      ${renderInheritedSlot(context.component, { size, disabled, className: 'sf-switch-inherited' })}
    </label>
  `;
  return renderCheckableRow(size, control, helpContent, renderCheckableMessage(context));
}
