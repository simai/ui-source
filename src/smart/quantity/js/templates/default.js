import {html, nothing} from 'lit';
import {renderInheritedSlot} from '../../../helpers/inherited-value';

// The class component's markup (component/quantity), so its sheet draws the
// field: the root, the label row, the wrap with «−», the box and «+». The
// layout utilities are the ones the class constructor puts on each part from
// quantity.utility.json. The steppers stay size 1/3 icon buttons at every
// field size, as the class draws them; the sheet sizes their glyph to the field.
const LAYOUT = {
  root: 'flex flex-col flex-nowrap justify-start',
  label: 'flex flex-row flex-nowrap justify-start items-start',
  wrap: 'flex flex-row flex-nowrap justify-center items-center',
  count: 'flex flex-row flex-nowrap justify-start items-center',
  input: 'flex',
};

const STEPPER = 'sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3';

function renderStepper(context, direction) {
  const {component, field} = context;
  const down = direction < 0;
  const reached = down ? context.atMin : context.atMax;
  // Out of the tab order, as the APG spinbutton has its buttons: the arrow
  // keys already do what they do, and two more stops per field would make a
  // form of numbers three times as long to cross. Still real buttons, named,
  // reachable by a pointer and a screen reader.
  return html`
    <button type="button"
            class="${STEPPER} ${LAYOUT.count}"
            tabindex="-1"
            aria-label=${down ? context.decrementLabel : context.incrementLabel}
            aria-controls=${field.controlId}
            ?disabled=${!context.interactive || reached}
            @pointerdown=${(event) => component.onStepPointerDown(event, direction)}
            @mousedown=${(event) => component.onStepMouseDown(event)}
            @click=${(event) => component.onStepClick(event, direction)}
    ><i class="sf-icon" aria-hidden="true">${down ? 'remove' : 'add'}</i></button>
  `;
}

export function renderQuantityTemplate(context) {
  const {component, field} = context;
  const labelId = `${context.id}-label`;
  const rootClasses = [
    'sf-quantity',
    `sf-quantity--size-${context.size}`,
    field.invalid ? 'error' : '',
    context.rootClass,
    LAYOUT.root,
  ].filter(Boolean);

  const labelContent = component?.hasSlotContent?.('label')
    ? component.getSlotContent('label')
    : context.label
      ? html`<span class="sf-quantity-text" id=${labelId}>${context.label}</span>${field.required
        ? html`<span class="sf-quantity-required" aria-hidden="true">*</span>`
        : nothing}`
      // No label, no label row: the panel that prints the label beside the
      // field names the control through aria-label instead.
      : nothing;
  const hasLabel = labelContent !== nothing;
  const named = Boolean(context.label) && !component?.hasSlotContent?.('label');
  const inheritedSlot = renderInheritedSlot(component, {size: context.size, disabled: !context.interactive});
  const value = context.value;

  return html`
    <div class=${rootClasses.join(' ')}
         style=${context.rootStyle || nothing}
         @pointerdown=${() => component.onPointerFocus()}
         @keydown=${() => component.onKeyboardFocus()}
         @focusout=${(event) => component.onFocusOut(event)}>
      ${hasLabel
        ? html`<label class="sf-quantity-label ${LAYOUT.label}" for=${field.controlId}>${labelContent}</label>`
        : nothing}

      <span class="sf-quantity-wrap ${LAYOUT.wrap}">
        ${renderStepper(context, -1)}
        <input type="text"
               class=${`${LAYOUT.input}${field.invalid ? ' error' : ''}`}
               id=${field.controlId}
               role="spinbutton"
               inputmode=${context.precision > 0 ? 'decimal' : 'numeric'}
               autocomplete="off"
               spellcheck="false"
               placeholder=${context.shownPlaceholder || nothing}
               aria-labelledby=${named ? labelId : nothing}
               aria-label=${!hasLabel && context.ariaLabel ? context.ariaLabel : nothing}
               aria-valuemin=${context.min === null ? nothing : String(context.min)}
               aria-valuemax=${context.max === null ? nothing : String(context.max)}
               aria-valuenow=${value === null ? nothing : String(value)}
               aria-valuetext=${value === null ? nothing : context.text}
               aria-invalid=${field.invalid ? 'true' : nothing}
               aria-describedby=${context.message ? field.messageId : nothing}
               aria-errormessage=${field.invalid && context.message && context.messageKind === 'error' ? field.messageId : nothing}
               ?required=${field.required}
               ?disabled=${context.disabled}
               ?readonly=${context.readonly}
               @beforeinput=${(event) => component.onBeforeInput(event)}
               @paste=${(event) => component.onPaste(event)}
               @input=${(event) => component.onNativeInput(event)}
               @change=${(event) => component.onNativeChange(event)}
               @keydown=${(event) => component.onKeyDown(event)}
               @blur=${() => component.commitDraft('commit')}>
        ${inheritedSlot}
        ${renderStepper(context, 1)}
      </span>

      ${context.name
        // The form gets the number with a point and no grouping, whatever the
        // box shows; the box itself has no name.
        ? html`<input type="hidden" class="sf-quantity-value" name=${context.name} value=${context.formValue} ?disabled=${context.disabled}>`
        : nothing}

      ${context.message
        ? html`<span id=${field.messageId} class="sf-quantity-hint-text-wrap"
                     data-field-message=${context.messageKind}>${context.message}</span>`
        : nothing}
    </div>
  `;
}
