import { html, nothing } from 'lit';
import { createFieldContract } from '../../../../component/field-contract';

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
    spellcheck,
    wrap,
    hint,
    value,
    name,
    rows,
    disabled,
    readonly,
    error,
    invalid,
    errorMessage,
    mask,
    maskPattern,
    maskOptions,
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

  const rootClasses = [
    'sf-textarea',
    `sf-textarea--size-${size}`,
    `sf-textarea--${appearance ?? type}`,
    field.invalid ? 'error' : '',
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
        placeholder=${placeholder}
        autocomplete=${autocomplete || nothing}
        inputmode=${inputmode || nothing}
        minlength=${minlength ?? nothing}
        maxlength=${maxlength ?? nothing}
        .spellcheck=${spellcheck}
        wrap=${wrap}
        .value=${value}
        .defaultValue=${value}
        name=${name || ''}
        rows=${rows}
        ?disabled=${disabled}
        ?readonly=${readonly}
        ?required=${field.required}
        aria-invalid=${field.invalid ? 'true' : nothing}
        aria-describedby=${messageContent ? field.messageId : nothing}
        aria-errormessage=${field.invalid && errorContent ? field.messageId : nothing}
        data-mask=${String(mask)}
        data-mask-pattern=${maskPattern || ''}
        data-mask-options=${maskOptions || ''}
      ></textarea>

      ${messageContent
        ? html`<span
            id=${field.messageId}
            class="sf-textarea-hint-text-wrap"
            data-field-message=${field.invalid && errorContent ? 'error' : 'hint'}
          >${messageContent}</span>`
        : ''}
    </label>
  `;
}
