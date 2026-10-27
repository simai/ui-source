import { html, nothing } from 'lit';
import { createFieldContract } from '../../../../component/field-contract';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import './default.css'
export function renderInputTemplate(context) {
  const {
    size,
    appearance,
    type,
    label,
    required,
    placeholder,
    inputType,
    autocomplete,
    inputmode,
    minlength,
    maxlength,
    pattern,
    hint,
    value,
    defaultValue,
    hasControlledValue,
    controlName,
    leftIcon,
    rightText,
    hintIcon,
    disabled,
    error,
    invalid,
    errorMessage,
    mask,
    rootClass,
    rootStyle,
    readonly,
    maskPattern,
    maskLazy,
    maskPlaceholderChar,
    maskOptions,
    ariaLabel,
  } = context;
  const maskLazyValue = maskLazy === '' ? '' : String(maskLazy);
  // While the field holds nothing of its own, the inherited value is what the
  // empty field shows, in the placeholder's ink -- never as its value.
  const shownPlaceholder = context.inheritedValue || placeholder;
  const inheritedSlot = renderInheritedSlot(context.component, {size, disabled: disabled || readonly});
  const inputValue = hasControlledValue ? value : defaultValue;
  const field = createFieldContract(context.component, {
    prefix: 'sf-input',
    required,
    invalid: invalid || error,
    hint,
    errorMessage,
  });

  const rootClasses = [
    'sf-input',
      field.invalid ? 'error' : '',
    `sf-input--size-${size}`,
    `sf-input--${appearance ?? type}`,
      rootClass,
    'flex',
    'flex-col',
  ];

  if(type === 'hidden') {
      return  html`<input
              style=${rootStyle || nothing}
              type="hidden"
              .value=${inputValue}
              name=${controlName || nothing}
              ?disabled=${disabled}
              ?readonly=${readonly}
              data-mask=${String(mask)}
              data-mask-pattern=${maskPattern || ''}
              data-mask-lazy=${maskLazyValue}
              data-mask-placeholder-char=${maskPlaceholderChar || ''}
              data-mask-options=${maskOptions || ''}
      />`
  }
  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? context.component.getSlotContent('label')
      : label
        ? html`
            <span class="sf-input-text">${label}</span>
            ${required ? html`<span class="sf-input-required">*</span>` : ''}
          `
        // No label, no label row. A lone star above a control names nothing --
        // the control's own `required` is what tells a reader and assistive
        // technology that it must be filled in -- and the row it stood in came
        // out as an empty line over every required control in a panel whose
        // labels are drawn beside them.
        : '';

  const leftContent =
    context.component?.hasSlotContent?.('start')
      ? context.component.getSlotContent('start')
      : context.component?.hasSlotContent?.('left')
      ? context.component.getSlotContent('left')
      : leftIcon
        ? html`<span class="sf-input-left flex"><sf-icon icon="${leftIcon}"></sf-icon></span>`
        : '';

  const rightContent =
    context.component?.hasSlotContent?.('end')
      ? context.component.getSlotContent('end')
      : context.component?.hasSlotContent?.('right')
      ? context.component.getSlotContent('right')
      : html`
          ${rightText ? html`<span class="sf-input-right"><span class="sf-input-text">${rightText}</span></span>` : ''}
          ${hintIcon ? html`<span class="sf-input-hint flex"><sf-icon icon="${hintIcon}"></sf-icon></span>` : ''}
        `;

  const hintContent =
    context.component?.hasSlotContent?.('hint')
      ? context.component.getSlotContent('hint')
      : hint;

  const errorContent =
    context.component?.hasSlotContent?.('error')
      ? context.component.getSlotContent('error')
      : errorMessage;
  const messageContent = field.invalid && errorContent ? errorContent : hintContent;
  // The visible label names the control through the wrapping <label>; with no
  // visible label there is nothing to name it, so the host's aria-label lands on
  // the native input. Both at once would make the name say one thing and the
  // page another.
  const accessibleName = !labelContent && ariaLabel ? ariaLabel : nothing;

  return html`
    <label
      class=${rootClasses.join(' ')}
      style=${rootStyle || nothing}
      data-mask=${String(mask)}
      data-mask-pattern=${maskPattern || ''}
      data-mask-lazy=${maskLazyValue}
      data-mask-placeholder-char=${maskPlaceholderChar || ''}
      data-mask-options=${maskOptions || ''}
    >
      ${labelContent
        ? html`
            <span class="sf-input-label flex">
              ${labelContent}
            </span>
          `
        : ''}

      <span class="sf-input-field items-cross-center transition flex">
        ${leftContent}
        ${hasControlledValue
          ? html`
              <input
                id=${field.controlId}
                type=${inputType}
                autocomplete=${autocomplete || nothing}
                inputmode=${inputmode || nothing}
                minlength=${minlength === '' ? nothing : minlength}
                maxlength=${maxlength === '' ? nothing : maxlength}
                pattern=${pattern || nothing}
                placeholder=${shownPlaceholder}
                .value=${value}
                .defaultValue=${defaultValue}
                name=${controlName || nothing}
                ?disabled=${disabled}
                ?readonly=${readonly}
                ?required=${field.required}
                aria-label=${accessibleName}
                aria-invalid=${field.invalid ? 'true' : nothing}
                aria-describedby=${messageContent ? field.messageId : nothing}
                aria-errormessage=${field.invalid && errorContent ? field.messageId : nothing}
                data-mask=${String(mask)}
                data-mask-pattern=${maskPattern || ''}
                data-mask-lazy=${maskLazyValue}
                data-mask-placeholder-char=${maskPlaceholderChar || ''}
                data-mask-options=${maskOptions || ''}
              />
            `
          : html`
              <input
                id=${field.controlId}
                type=${inputType}
                autocomplete=${autocomplete || nothing}
                inputmode=${inputmode || nothing}
                minlength=${minlength === '' ? nothing : minlength}
                maxlength=${maxlength === '' ? nothing : maxlength}
                pattern=${pattern || nothing}
                placeholder=${shownPlaceholder}
                .defaultValue=${inputValue}
                .value=${value}
                name=${controlName || nothing}
                ?disabled=${disabled}
                ?readonly=${readonly}
                ?required=${field.required}
                aria-label=${accessibleName}
                aria-invalid=${field.invalid ? 'true' : nothing}
                aria-describedby=${messageContent ? field.messageId : nothing}
                aria-errormessage=${field.invalid && errorContent ? field.messageId : nothing}
                data-mask=${String(mask)}
                data-mask-pattern=${maskPattern || ''}
                data-mask-lazy=${maskLazyValue}
                data-mask-placeholder-char=${maskPlaceholderChar || ''}
                data-mask-options=${maskOptions || ''}
              />
            `}
        ${inheritedSlot}
        ${rightContent}
      </span>

      ${messageContent
        ? html`<span
            id=${field.messageId}
            class="sf-input-hint-text-wrap"
            data-field-message=${field.invalid && errorContent ? 'error' : 'hint'}
          >${messageContent}</span>`
        : ''}
    </label>
  `;
}
