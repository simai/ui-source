import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

// sf-input-choice's markup: the label row, the grid of cards and the hint or
// error line under it.
//
//   div.sf-choice
//     span.sf-choice-label          names the group (aria-labelledby)
//     div.sf-choice-grid            role radiogroup (single) or group (multiple)
//       label.sf-choice-card        one per option
//         input.sf-choice-input     the native radio or checkbox, over the card
//         span.sf-choice-icon       the option's icon, when it has one
//         span.sf-choice-body       its title (with a badge) and caption
//         span.sf-choice-mark       the radio or check mark at the end
//     span.sf-choice-message        the hint, or the error while invalid
//
// The native inputs are the control: the arrow keys move and choose in a
// radio group, Space toggles a checkbox, and each is named by its title and
// described by its caption. While the host is the form control they stay
// out of the page's form (§17.1 item 6).

const joinClasses = (...tokens) => tokens.flat().filter(Boolean).join(' ');

function renderCard(context, item, index) {
  const checked = context.chosen.has(item.value);
  const disabled = context.fieldDisabled || item.disabled;
  const titleId = `${context.id}--title-${index + 1}`;
  const captionId = `${context.id}--caption-${index + 1}`;
  return html`<label class=${joinClasses('sf-choice-card', checked ? 'sf-choice-card--checked' : '', disabled ? 'sf-choice-card--disabled' : '')}>
    <input class="sf-choice-input" type=${context.multiple ? 'checkbox' : 'radio'}
           name=${context.controlName || nothing} form=${context.innerForm || nothing}
           value=${item.value} .checked=${checked} ?disabled=${disabled}
           aria-labelledby=${titleId} aria-describedby=${item.caption ? captionId : nothing}
           aria-invalid=${context.invalid ? 'true' : nothing}>
    ${item.icon ? html`<span class="sf-choice-icon" aria-hidden="true"><span class="sf-icon">${item.icon}</span></span>` : nothing}
    <span class="sf-choice-body">
      <span class="sf-choice-title" id=${titleId}><span class="sf-choice-title-text">${item.label}</span>${item.badge
        ? html`<span class="sf-badge sf-badge--tight">${item.badge}</span>`
        : nothing}</span>
      ${item.caption ? html`<span class="sf-choice-caption" id=${captionId}>${item.caption}</span>` : nothing}
    </span>
    <span class="sf-choice-mark" aria-hidden="true">${checked && context.multiple ? html`<span class="sf-icon">check</span>` : nothing}</span>
  </label>`;
}

export function renderChoiceTemplate(context) {
  const labelId = `${context.id}--label`;
  const messageId = `${context.id}--message`;
  const message = context.invalid && context.errorMessage ? context.errorMessage : context.hint;
  return html`<div class=${joinClasses('sf-choice', context.multiple ? 'sf-choice--multiple' : '', context.invalid ? 'sf-choice--invalid' : '', context.fieldDisabled ? 'sf-choice--disabled' : '', context.rootClass)}
                   style=${context.rootStyle || nothing} data-columns=${context.columns}>
    ${context.label
      ? html`<span class="sf-choice-label" id=${labelId}>${context.label}${context.required ? html`<span class="sf-choice-required" aria-hidden="true">*</span>` : nothing}</span>`
      : nothing}
    <div class="sf-choice-grid" role=${context.multiple ? 'group' : 'radiogroup'}
         aria-labelledby=${context.label ? labelId : nothing}
         aria-label=${!context.label && context.ariaLabel ? context.ariaLabel : nothing}
         aria-describedby=${message ? messageId : nothing}
         aria-required=${context.required && !context.multiple ? 'true' : nothing}
         aria-invalid=${context.invalid && !context.multiple ? 'true' : nothing}
         aria-disabled=${context.fieldDisabled ? 'true' : nothing}>
      ${repeat(context.items, (item) => item.value, (item, index) => renderCard(context, item, index))}
    </div>
    ${message
      ? html`<span class="sf-choice-message" id=${messageId} data-field-message=${context.invalid && context.errorMessage ? 'error' : 'hint'}>${message}</span>`
      : nothing}
  </div>`;
}
