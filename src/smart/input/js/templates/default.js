import { html, nothing } from 'lit';
import { createFieldContract } from '../../../../component/field-contract';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import { ariaKeyShortcuts, parseShortcut, shortcutView } from '../../../../component/kbd/js/shortcut';
import './default.css'
export function renderInputTemplate(context) {
  const {
    size,
    radius,
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
    min,
    max,
    step,
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
    shortcut,
    clearable,
    revealed,
  } = context;
  // The shortcut's keys (C04, C38): the kbd component's, read in this
  // platform's words; the field draws them at its end and never styles them.
  // The native input says the combination in aria-keyshortcuts.
  const {keys: shortcutKeys, join: shortcutJoin} = shortcutView(shortcut);
  const keyShortcuts = ariaKeyShortcuts(parseShortcut(shortcut));
  const maskLazyValue = maskLazy === '' ? '' : String(maskLazy);
  // A number field (1.5.0) takes the native range and step; other types do
  // not carry them.
  const isNumber = inputType === 'number';
  const numberMin = isNumber && min !== '' && min != null ? min : nothing;
  const numberMax = isNumber && max !== '' && max != null ? max : nothing;
  const numberStep = isNumber && step !== '' && step != null ? step : nothing;
  // While the field holds nothing of its own, the inherited value is what the
  // empty field shows, in the placeholder's ink -- never as its value.
  const shownPlaceholder = context.inheritedValue || placeholder;
  const inheritedSlot = renderInheritedSlot(context.component, {size, disabled: disabled || readonly});
  const inputValue = hasControlledValue ? value : defaultValue;
  // The actions inside the field (owner decision C123): glyphs without a plate,
  // the field layer's .sf-field-action, from the text to the edge: clear, then
  // the password reveal. A search field's clear is the Framework's in place of
  // the browser's own; any other field has it with clearable. Neither is drawn
  // where the person cannot change the value.
  const editable = !disabled && !readonly;
  const isPassword = inputType === 'password';
  const showClear = editable && (clearable || inputType === 'search');
  const nativeType = isPassword && revealed ? 'text' : inputType;
  const clearWord = context.component?.sfWord?.('clear') || 'Clear';
  const revealWord = context.component?.sfWord?.('reveal') || 'Show password';
  const actionsContent = html`
    ${showClear
      ? html`<button
          type="button"
          class="sf-field-action sf-input-clear"
          data-action="clear"
          aria-label=${clearWord}
          ?hidden=${!String(value ?? '')}
          @click=${(event) => context.component?.clearFromButton?.(event)}
        ><sf-icon icon="close" aria-hidden="true"></sf-icon></button>`
      : nothing}
    ${isPassword && !disabled
      ? html`<button
          type="button"
          class="sf-field-action sf-input-reveal"
          data-action="reveal"
          aria-label=${revealWord}
          aria-pressed=${revealed ? 'true' : 'false'}
          @click=${(event) => context.component?.toggleReveal?.(event)}
        ><sf-icon icon=${revealed ? 'visibility_off' : 'visibility'} aria-hidden="true"></sf-icon></button>`
      : nothing}
  `;
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
    radius && radius !== 'default' ? `sf-input--radius-${radius}` : '',
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
      ? html`${actionsContent}${context.component.getSlotContent('end')}`
      : context.component?.hasSlotContent?.('right')
      ? html`${actionsContent}${context.component.getSlotContent('right')}`
      : html`
          ${rightText ? html`<span class="sf-input-right"><span class="sf-input-text">${rightText}</span></span>` : ''}
          ${actionsContent}
          ${shortcutKeys.length ? html`<span class="sf-input-right sf-input-shortcut" aria-hidden="true"><kbd class="sf-kbd--group">${shortcutKeys.map((key, at) => html`${at && shortcutJoin ? html`<span class="sf-kbd-join">+</span>` : nothing}<kbd class=${key.square ? 'sf-kbd--square' : nothing}>${key.text}</kbd>`)}</kbd></span>` : ''}
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
                type=${nativeType}
                autocomplete=${autocomplete || nothing}
                inputmode=${inputmode || nothing}
                minlength=${minlength === '' ? nothing : minlength}
                maxlength=${maxlength === '' ? nothing : maxlength}
                pattern=${pattern || nothing}
                min=${numberMin}
                max=${numberMax}
                step=${numberStep}
                placeholder=${shownPlaceholder}
                .value=${value}
                .defaultValue=${defaultValue}
                name=${controlName || nothing}
                ?disabled=${disabled}
                ?readonly=${readonly}
                ?required=${field.required}
                aria-label=${accessibleName}
                aria-keyshortcuts=${keyShortcuts || nothing}
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
                type=${nativeType}
                autocomplete=${autocomplete || nothing}
                inputmode=${inputmode || nothing}
                minlength=${minlength === '' ? nothing : minlength}
                maxlength=${maxlength === '' ? nothing : maxlength}
                pattern=${pattern || nothing}
                min=${numberMin}
                max=${numberMax}
                step=${numberStep}
                placeholder=${shownPlaceholder}
                .defaultValue=${inputValue}
                .value=${value}
                name=${controlName || nothing}
                ?disabled=${disabled}
                ?readonly=${readonly}
                ?required=${field.required}
                aria-label=${accessibleName}
                aria-keyshortcuts=${keyShortcuts || nothing}
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
