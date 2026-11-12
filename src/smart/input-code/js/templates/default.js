import {html, nothing} from 'lit';
import {live} from 'lit/directives/live.js';
import {repeat} from 'lit/directives/repeat.js';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// The class verification's canonical markup (src/component/verification):
// the field container, its label, the frame of cells with the one native input
// over them, and the hint -- so the class sheet draws it and nothing of it is
// forked. The container is a group named by the label; the native input is
// the field, the form value, the focus and what autofill and paste write to.
// The cells are drawn empty and aria-hidden: the element writes the code into
// them as it changes, without a render, and says which cell the caret is in
// through the polite position line the input is described by.
//
// data-sf-verification-owner="smart" keeps the class runtime off it: the
// element owns the input, the cells and the events.
export function renderCodeInputTemplate(context) {
  const {
    id,
    field,
    size,
    filled,
    label,
    hasLabel,
    labelContent,
    required,
    disabled,
    readonly,
    controlName,
    value,
    defaultCode,
    mode,
    length,
    mask,
    inputMode,
    uppercase,
    groups,
    separators = [],
    ariaLabel,
    groupLabel,
    messageContent,
    messageIsError,
  } = context;
  const labelId = `${id}--label`;
  const positionId = `${id}--position`;
  const describedBy = [positionId, messageContent ? field.messageId : ''].filter(Boolean).join(' ');
  // The cells, with a separator after each group (C82: 3 + 3, 4 + 4): a
  // picture only, aria-hidden with the cells, never in the value or a copy.
  const parts = [];
  for (let index = 0; index < length; index += 1) {
    parts.push({key: `cell-${index}`, separator: false});
    if (separators.includes(index)) parts.push({key: `separator-${index}`, separator: true});
  }

  return html`
    <div
      class=${joinClasses(
        'sf-verification-form',
        `sf-verification-form--size-${size}`,
        filled ? 'sf-verification-form--filled' : '',
        field.invalid ? 'error' : '',
        'sf-code-input',
        context.rootClass,
      )}
      style=${context.rootStyle || nothing}
      role="group"
      aria-labelledby=${hasLabel ? labelId : nothing}
      aria-label=${hasLabel ? nothing : groupLabel}
      data-length=${String(length)}
      data-mode=${mode}
      data-groups=${groups ? String(groups) : nothing}
      data-sf-verification-owner="smart"
    >
      ${hasLabel
        ? html`<label class="sf-verification-form-label" id=${labelId} for=${field.controlId}>${labelContent}${required
          ? html`<span class="sf-code-input-required" aria-hidden="true">*</span>`
          : nothing}</label>`
        : nothing}
      <div class=${joinClasses('sf-verification', `sf-verification--size-${size}`, filled ? 'sf-verification--filled' : '', field.invalid ? 'error' : '')}>
        <input
          class="sf-verification-input"
          id=${field.controlId}
          type=${mask ? 'password' : 'text'}
          inputmode=${inputMode}
          autocomplete="one-time-code"
          autocapitalize=${uppercase ? 'characters' : 'off'}
          autocorrect="off"
          spellcheck="false"
          dir="ltr"
          name=${controlName || nothing}
          .defaultValue=${defaultCode}
          .value=${live(value)}
          ?disabled=${disabled}
          ?readonly=${readonly}
          ?required=${field.required}
          aria-label=${hasLabel ? nothing : (ariaLabel || label || groupLabel)}
          aria-invalid=${field.invalid ? 'true' : nothing}
          aria-describedby=${describedBy}
          aria-errormessage=${messageIsError ? field.messageId : nothing}
        />
        <span class="sf-verification-cells" aria-hidden="true">${repeat(parts, (part) => part.key, (part) => (part.separator
          ? html`<span class="sf-verification-separator"></span>`
          : html`<span class="sf-verification-cell"></span>`))}</span>
      </div>
      ${messageContent
        ? html`<span class="sf-verification-form-hint" id=${field.messageId}
                     data-field-message=${messageIsError ? 'error' : 'hint'}>${messageContent}</span>`
        : nothing}
      <span class="sr-only sf-code-input-position" id=${positionId} aria-live="polite"></span>
    </div>
  `;
}
