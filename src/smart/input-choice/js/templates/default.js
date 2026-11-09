import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

// sf-input-choice's markup: the label row, the cards and the hint or error
// line under them (owner decision C28, prototype input-choice-world.html).
//
//   div.sf-choice[data-layout=list|tile|picture]
//     span.sf-choice-label            names the group (aria-labelledby)
//     div.sf-choice-grid              role radiogroup (single) or group (multiple)
//       label.sf-choice-card          one per option; the whole card is the target
//         span.sf-choice-media        picture: the image, to the card's edges
//         span.sf-choice-head         the name line and what hangs from it
//           span.sf-radio-button | span.sf-checkbox
//                                     the class radio or checkbox sf-radio and
//                                     sf-checkbox draw, size 1: its box is the
//                                     name line; the native input is in it
//           span.sf-choice-body       the name (icon, title, sf-badge) and the description
//           span.sf-choice-meta       list: price and term, a column at the line's end
//         span.sf-choice-rule         tile and picture with a price: the divider
//         span.sf-choice-price        tile and picture: price and term at the foot
//     span.sf-choice-message          the hint, or the error while invalid
//
// The native inputs are the control: the arrow keys move and choose in a
// radio group, Space toggles a checkbox, and each is named by its title (and
// badge; never the icon's ligature) and
// described by its description, price and term. While the host is the form
// control they stay out of the page's form (§17.1 item 6).

const joinClasses = (...tokens) => tokens.flat().filter(Boolean).join(' ');

// The control on the name line: the markup of the class radio or checkbox,
// with the card's own native input in its box and the same utility classes
// sf-radio and sf-checkbox write (the class sheets leave display to them). Invalid marks the control of a
// card not chosen (C13: error).
function renderControl(context, item, state) {
  const {checked, disabled, ids} = state;
  const described = [item.caption ? ids.caption : '', item.price || item.term ? ids.price : ''].filter(Boolean).join(' ');
  const input = html`<input class="sf-choice-input" type=${context.multiple ? 'checkbox' : 'radio'}
           name=${context.controlName || nothing} form=${context.innerForm || nothing}
           value=${item.value} .checked=${checked} ?disabled=${disabled}
           aria-labelledby=${item.badge ? `${ids.title} ${ids.badge}` : ids.title} aria-describedby=${described || nothing}
           aria-invalid=${context.invalid ? 'true' : nothing}>`;
  const error = context.invalid && !checked ? 'error' : '';
  // sf-choice-mark: the 1.0 ring's class, a legacy alias of sf-choice-control
  // until 2027-01-01 (change journal class-input-choice-mark-to-control).
  const control = ['sf-choice-control', 'sf-choice-mark'];
  if (context.multiple) {
    return html`<span class=${joinClasses('sf-checkbox', 'sf-checkbox--size-1', 'flex', control, error)}><span class="sf-checkbox-box transition flex items-cross-center content-main-center">${input}${checked
      ? html`<span class="sf-icon" aria-hidden="true">check</span>`
      : nothing}</span></span>`;
  }
  return html`<span class=${joinClasses('sf-radio-button', 'sf-radio-button--size-1', 'flex', control, error)}><span class="sf-radio-button-box transition flex items-cross-center content-main-center">${input}<span class="sf-radio-button-mark" aria-hidden="true"></span></span></span>`;
}

function renderPrice(item, id, kind) {
  if (!item.price && !item.term) return nothing;
  return html`<span class=${kind} id=${id}>${item.price
    ? html`<span class="sf-choice-price-value">${item.price}</span>`
    : nothing}${item.term ? html`<span class="sf-choice-term">${item.term}</span>` : nothing}</span>`;
}

function renderCard(context, item, index) {
  const checked = context.chosen.has(item.value);
  const disabled = context.fieldDisabled || item.disabled;
  const n = index + 1;
  const ids = {
    title: `${context.id}--title-${n}`,
    badge: `${context.id}--badge-${n}`,
    caption: `${context.id}--caption-${n}`,
    price: `${context.id}--price-${n}`,
  };
  const list = context.layout === 'list';
  const picture = context.layout === 'picture';
  const foot = !list && (item.price || item.term);
  return html`<label class=${joinClasses('sf-choice-card', checked ? 'sf-choice-card--checked' : '', disabled ? 'sf-choice-card--disabled' : '')}>
    ${picture && item.image
      ? html`<span class="sf-choice-media" aria-hidden="true"><img src=${item.image} alt="" loading="lazy" decoding="async"></span>`
      : nothing}
    <span class="sf-choice-head">
      ${renderControl(context, item, {checked, disabled, ids})}
      <span class="sf-choice-body">
        <span class="sf-choice-title">${item.icon
          ? html`<span class="sf-icon sf-choice-icon" aria-hidden="true">${item.icon}</span>`
          : nothing}<span class="sf-choice-title-text" id=${ids.title}>${item.label}</span>${item.badge
          ? html`<sf-badge class="sf-choice-badge" id=${ids.badge} text=${item.badge} appearance="tonal" scheme="primary" line="1/2"
                           root-class=${disabled ? 'sf-badge--disabled' : nothing}></sf-badge>`
          : nothing}</span>
        ${item.caption ? html`<span class="sf-choice-caption" id=${ids.caption}>${item.caption}</span>` : nothing}
      </span>
      ${list ? renderPrice(item, ids.price, 'sf-choice-meta') : nothing}
    </span>
    ${foot ? html`<span class="sf-choice-rule" aria-hidden="true"></span>${renderPrice(item, ids.price, 'sf-choice-price')}` : nothing}
  </label>`;
}

export function renderChoiceTemplate(context) {
  const labelId = `${context.id}--label`;
  const messageId = `${context.id}--message`;
  const message = context.invalid && context.errorMessage ? context.errorMessage : context.hint;
  return html`<div class=${joinClasses('sf-choice', context.multiple ? 'sf-choice--multiple' : '', context.invalid ? 'sf-choice--invalid' : '', context.fieldDisabled ? 'sf-choice--disabled' : '', context.rootClass)}
                   style=${context.rootStyle || nothing} data-layout=${context.layout} data-columns=${context.columns}>
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
