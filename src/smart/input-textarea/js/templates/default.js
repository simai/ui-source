import { html, nothing } from 'lit';
import { createFieldContract } from '../../../../component/field-contract';
import { renderInheritedSlot } from '../../../helpers/inherited-value';

export function renderTextareaTemplate(context) {
  const {
    size,
    appearance,
    type,
    label,
    required,
    placeholder,
    autocomplete,
    inputmode,
    minlength,
    maxlength,
    spellCheck,
    wrap,
    hint,
    value,
    defaultValue = '',
    controlName,
    rows,
    disabled,
    readonly,
    error,
    invalid,
    errorMessage,
    mask,
    maskPattern,
    maskOptions,
    autoGrow,
    minRows,
    maxRows,
    ariaLabel,
    labelledBy,
    resize,
    count = '',
    countOver = false,
    countSaid = '',
    code = false,
  } = context;
  const field = createFieldContract(context.component, {
    prefix: 'sf-textarea',
    required,
    invalid: invalid || error,
    hint,
    errorMessage,
  });
  const errorContent =
    context.component?.hasSlotContent?.('error')
      ? context.component.getSlotContent('error')
      : errorMessage;
  const hintContent =
    context.component?.hasSlotContent?.('hint')
      ? context.component.getSlotContent('hint')
      : hint;
  const messageContent = field.invalid && errorContent ? errorContent : hintContent;
  // The count stands at the end of the message line (C141 (1)), so the line
  // is drawn for it alone too; the textarea is described by both.
  const countId = `${field.messageId}-count`;
  const describedBy = [messageContent ? field.messageId : '', count ? countId : ''].filter(Boolean).join(' ');

  const rootClasses = [
    'sf-textarea',
    `sf-textarea--size-${size}`,
    `sf-textarea--${appearance ?? type}`,
    field.invalid ? 'error' : '',
    autoGrow ? 'sf-textarea--auto-grow' : '',
    resize && !autoGrow ? 'sf-textarea--resize' : '',
    code ? 'sf-textarea--code' : '',
    countOver ? 'sf-textarea--over' : '',
    'flex',
    'flex-col',
    context.rootClass,
  ].filter(Boolean);

  const labelContent = label
    ? html`
        <span class="sf-textarea-text">${label}</span>
        ${required ? html`<span class="sf-textarea-required">*</span>` : ''}
      `
    // A label row with nothing but a star names nothing: see sf-input.
    : '';
  // The visible label names the textarea through the wrapping <label>; with no
  // visible label the host's aria-label lands on the textarea, as in sf-input.
  // The host's aria-labelledby is the author's explicit choice and always
  // lands (simai/ui-source#30).
  const accessibleName = !labelContent && ariaLabel ? ariaLabel : nothing;
  const accessibleLabelledBy = labelledBy || nothing;

  // The message line: the hint, or the error in its place. With the count it
  // shares one row, the count at the end; without it the markup is as it was.
  const messageNode = messageContent
    ? html`<span
        id=${field.messageId}
        class="sf-textarea-hint-text-wrap"
        data-field-message=${field.invalid && errorContent ? 'error' : 'hint'}
      >${messageContent}</span>`
    : '';

  return html`
    <label
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-mask=${String(mask)}
      data-mask-pattern=${maskPattern || ''}
      data-mask-options=${maskOptions || ''}
    >
      ${labelContent
        ? html`
            <span class="sf-textarea-label flex">
              ${labelContent}
            </span>
          `
        : ''}

      <textarea
        id=${field.controlId}
        class=${`transition${field.invalid ? ' error' : ''}`}
        placeholder=${context.inheritedValue || placeholder}
        autocomplete=${autocomplete || nothing}
        inputmode=${inputmode || nothing}
        minlength=${minlength ?? nothing}
        .spellcheck=${spellCheck}
        wrap=${code ? 'off' : wrap}
        autocapitalize=${code ? 'off' : nothing}
        autocorrect=${code ? 'off' : nothing}
        translate=${code ? 'no' : nothing}
        .value=${value}
        .defaultValue=${defaultValue}
        name=${controlName || nothing}
        rows=${autoGrow ? minRows : rows}
        ?disabled=${disabled}
        ?readonly=${readonly}
        ?required=${field.required}
        aria-label=${accessibleName}
        aria-labelledby=${accessibleLabelledBy}
        aria-invalid=${field.invalid ? 'true' : nothing}
        aria-describedby=${describedBy || nothing}
        aria-errormessage=${field.invalid && errorContent ? field.messageId : nothing}
        data-mask=${String(mask)}
        data-mask-pattern=${maskPattern || ''}
        data-mask-options=${maskOptions || ''}
        data-auto-grow=${autoGrow ? 'true' : nothing}
        data-min-rows=${autoGrow ? minRows : nothing}
        data-max-rows=${autoGrow && maxRows ? maxRows : nothing}
      ></textarea>

      ${renderInheritedSlot(context.component, {
        size,
        disabled: disabled || readonly,
        className: 'sf-textarea-inherited',
      })}

      ${count
        ? html`<span class="sf-textarea-message flex">${messageNode}<span id=${countId} class="sf-textarea-count">${count}</span></span>`
        : messageNode}
    </label>${maxlength !== null && maxlength !== undefined
      ? html`<span class="sf-textarea-count-said" aria-live="polite">${countSaid}</span>`
      : ''}
  `;
}
