import {html, nothing} from 'lit';
import {renderInheritedSlot} from '../../../helpers/inherited-value';

// The class component's markup (component/quantity), so its sheet draws the
// field: the root, the label row, the wrap with «−», the box and «+». The
// layout utilities are the ones the class constructor puts on each part from
// quantity.utility.json. The steppers stay size 1/3 icon buttons at every
// field size, as the class draws them; the sheet sizes them one rung below the
// field and their glyph to the field's own icon (QT-03).
const LAYOUT = {
  root: 'flex flex-col flex-nowrap justify-start',
  label: 'flex flex-row flex-nowrap justify-start items-start',
  wrap: 'flex flex-row flex-nowrap justify-center items-center',
  count: 'flex flex-row flex-nowrap justify-start items-center',
  input: 'flex',
};

// The quiet neutral ghost (C15): no plate at rest, the surface hover fill and
// on-surface ink under a pointer, as a field's own clear button. secondary was
// retired (QT-04).
const STEPPER = 'sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--on-surface-variant sf-icon-button--size-1/3';

function renderStepper(context, direction) {
  const {component, field} = context;
  const down = direction < 0;
  // The remove mode (C122): on the lower bound «−» is the trash, the same
  // button in the same grey (removal can be undone, so no danger colour).
  const trash = down && context.removeShown;
  const reached = trash ? false : down ? context.atMin : context.atMax;
  // Out of the tab order, as the APG spinbutton has its buttons: the arrow
  // keys already do what they do, and two more stops per field would make a
  // form of numbers three times as long to cross. Still real buttons, named,
  // reachable by a pointer and a screen reader. The trash is in the Tab
  // order: removal is not a step, no key does it.
  return html`
    <button type="button"
            class="${STEPPER} ${LAYOUT.count}"
            tabindex=${trash ? '0' : '-1'}
            aria-label=${trash ? context.removeLabel : down ? context.decrementLabel : context.incrementLabel}
            aria-controls=${trash ? nothing : field.controlId}
            ?disabled=${!context.interactive || reached}
            @pointerdown=${(event) => component.onStepPointerDown(event, direction)}
            @mousedown=${(event) => component.onStepMouseDown(event)}
            @click=${(event) => component.onStepClick(event, direction)}
    ><i class="sf-icon" aria-hidden="true">${trash ? 'delete' : down ? 'remove' : 'add'}</i></button>
  `;
}

export function renderQuantityTemplate(context) {
  const {component, field} = context;
  const labelId = `${context.id}--label`;
  const steppers = context.steppers !== 'none';
  const rootClasses = [
    'sf-quantity',
    `sf-quantity--size-${context.size}`,
    steppers ? '' : 'sf-quantity--steppers-none',
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
  // The inherited marker and the reset stand after the box, on its row (C53,
  // F3): a stepper box has no free end, and inside it they pushed the
  // steppers out of the border and the number to nothing.
  const inheritedSlot = renderInheritedSlot(component, {size: context.size, disabled: !context.interactive, className: 'sf-quantity-inherited'});
  const value = context.value;

  return html`
    <div class=${rootClasses.join(' ')}
         style=${context.rootStyle || nothing}>
      ${hasLabel
        ? html`<label class="sf-quantity-label ${LAYOUT.label}" for=${field.controlId}>${labelContent}</label>`
        : nothing}

      <span class="sf-quantity-row">
      <span class="sf-quantity-wrap ${LAYOUT.wrap}" style=${context.digitsStyle}>
        ${steppers ? renderStepper(context, -1) : nothing}
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
               aria-valuetext=${value === null ? nothing : context.valueText}
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
               @mousedown=${(event) => component.onInputMouseDown(event)}
               @mouseup=${(event) => component.onInputMouseUp(event)}
               @focus=${(event) => component.onInputFocus(event)}
               @blur=${() => component.commitDraft('commit')}>
        ${context.unit
          // The unit after the number, in the box: part of the picture only;
          // the spinbutton says it in its value text.
          ? html`<span class="sf-quantity-unit" aria-hidden="true" @click=${() => component.focusDelegate?.()?.focus?.()}>${context.unit}</span>`
          : nothing}
        ${steppers ? renderStepper(context, 1) : nothing}
      </span>
      ${inheritedSlot}
      </span>

      ${context.controlName
        // The form gets the number with a point and no grouping, whatever the
        // box shows; the box itself has no name.
        ? html`<input type="hidden" class="sf-quantity-value" name=${context.controlName} value=${context.formValue} ?disabled=${context.disabled}>`
        : nothing}

      ${context.message
        ? html`<span id=${field.messageId} class="sf-quantity-hint-text-wrap"
                     data-field-message=${context.messageKind}>${context.message}</span>`
        : nothing}

      ${context.interactive
        // A number kept past a bound shows its error under the box; the status
        // says it once, when the commit shows it (QR-1). Empty otherwise.
        ? html`<span class="sf-quantity-status sr-only" role="status" aria-live="polite" aria-atomic="true">${context.announcement || ''}</span>`
        : nothing}
    </div>
  `;
}
