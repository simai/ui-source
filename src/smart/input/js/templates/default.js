import { html, nothing } from 'lit';
import { renderFieldHelp } from '../../../helpers/field-help';
import { createFieldContract } from '../../../../component/field-contract';
import { renderInheritedSlot } from '../../../helpers/inherited-value';
import { ariaKeyShortcuts, parseShortcut, shortcutView } from '../../../../component/kbd/js/shortcut';
import './default.css'

// A label written into the label slot keeps the label's look (text inputs
// study 2026-11-14, TI-24): its words stand in .sf-input-text, as the label
// setting's do, so they take the label's step, line and ink rather than the
// page's (16 on 24 in the text ink, the row 4 taller at size 1). A help mark
// written beside them stays a child of the label row, where the C33 / C133
// rules place it after the last word.
function isHelpMark(node) {
  return node?.nodeType === 1 && (node.localName === 'sf-help-mark' || node.classList?.contains('sf-help-mark'));
}

function slottedLabel(content) {
  const nodes = (Array.isArray(content) ? content : [content]).filter((node) => node != null && node !== nothing);
  const text = nodes.filter((node) => !isHelpMark(node));
  const marks = nodes.filter(isHelpMark);
  return html`${text.length ? html`<span class="sf-input-text">${text}</span>` : nothing}${marks}`;
}

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
    help,
    textStart,
    count = '',
    countOver = false,
    countSaid = '',
    countable = false,
    capsLock,
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
  // The reveal's name says what a press does next (C12 (3), C123 (4)): «Показать
  // пароль» while the password is hidden, «Скрыть пароль» while it shows. A
  // name that changes carries no aria-pressed -- the field-renderers' password
  // eye said it so, and since TI-7 it is this one.
  const revealWord = revealed
    ? context.component?.sfWord?.('conceal') || 'Hide password'
    : context.component?.sfWord?.('reveal') || 'Show password';
  // C191 (3): while the focused password field types with Caps Lock on, a line
  // in the hint's place and type says so; a polite live region after the
  // label says it to assistive technology (the line itself is not read twice).
  const capsWord = isPassword && !disabled ? context.component?.sfWord?.('caps-lock') || 'Caps Lock is on' : '';
  const capsLine = capsLock && capsWord
    ? html`<span class="sf-input-hint-text-wrap sf-input-caps" data-field-message="caps" aria-hidden="true">${capsWord}</span>`
    : nothing;
  const capsSaid = capsWord
    ? html`<span class="sf-input-caps-said" role="status" aria-live="polite" aria-atomic="true">${capsLock ? capsWord : ''}</span>`
    : nothing;
  const actionsContent = html`
    ${showClear
      ? html`<button
          type="button"
          class="sf-field-action sf-input-clear"
          data-action="clear"
          aria-label=${clearWord}
          tabindex="-1"
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
    countOver ? 'sf-input--over' : '',
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
  // The «?» after the label (C153 (8), C133's look, helpers/field-help.js):
  // the help setting's text behind sf-help-mark, a step below the value as the
  // label is; the label row keeps its height.
  const helpMark = renderFieldHelp({help, label, size, className: 'sf-input-help', component: context.component});
  const labelContent =
    context.component?.hasSlotContent?.('label')
      ? slottedLabel(context.component.getSlotContent('label'))
      : label
        ? html`
            <span class="sf-input-text">${label}</span>
            ${required ? html`<span class="sf-input-required" aria-hidden="true">*</span>` : ''}
            ${helpMark}
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
      : html`${leftIcon
        ? html`<span class="sf-input-left flex"><sf-icon icon="${leftIcon}"></sf-icon></span>`
        : ''}${textStart
        ? html`<span class="sf-input-start" aria-hidden="true">${textStart}</span>`
        : ''}`;

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
  // The count stands at the end of the message line (C153 (10), C141 (1)), so
  // the line is drawn for it alone too; the input is described by both. The
  // start text is said with the value's description, not read as typed text.
  const countId = `${field.messageId}-count`;
  const startId = `${field.messageId}-start`;
  const describedBy = [
    textStart && !context.component?.hasSlotContent?.('start') && !context.component?.hasSlotContent?.('left') ? startId : '',
    messageContent ? field.messageId : '',
    count ? countId : '',
  ].filter(Boolean).join(' ');
  const messageNode = messageContent
    ? html`<span
        id=${field.messageId}
        class="sf-input-hint-text-wrap"
        data-field-message=${field.invalid && errorContent ? 'error' : 'hint'}
      >${messageContent}</span>`
    : '';

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
                maxlength=${maxlength === '' || countable ? nothing : maxlength}
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
                aria-describedby=${describedBy || nothing}
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
                maxlength=${maxlength === '' || countable ? nothing : maxlength}
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
                aria-describedby=${describedBy || nothing}
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

      ${count
        ? html`<span class="sf-input-message flex">${messageNode}<span id=${countId} class="sf-input-count">${count}</span></span>`
        : messageNode}${capsLine}
      ${textStart ? html`<span id=${startId} class="sf-input-said" hidden>${textStart}</span>` : ''}
    </label>${countable
      ? html`<span class="sf-input-count-said" aria-live="polite">${countSaid}</span>`
      : ''}${capsSaid}
  `;
}
