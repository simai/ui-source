import {html, nothing} from 'lit';
import {renderInheritedSlot} from '../../../helpers/inherited-value';
import './default.css';

// The control is a swatch that opens the browser's own colour picker, with the
// product's own colours beside it and a way back to the inherited one. The native
// input is what opens the picker: every platform has one, it is reachable from the
// keyboard, and reimplementing a colour wheel would be a worse version of a thing
// the system already does well.
export function renderColorTemplate(context) {
    const {shown, isSet, disabled, size, appearance} = context;

    return html`
        <div class="sf-color sf-color--${appearance} sf-color--size-${size}"
             data-set=${isSet ? 'true' : 'false'}>
            <label class="sf-color-swatch" title=${context.chooseLabel}>
                <span class="sf-color-chip"
                      style=${shown ? `--sf-color-chip: ${shown}` : nothing}
                      data-empty=${shown ? nothing : 'true'}
                      aria-hidden="true"></span>
                <input
                        type="color"
                        class="sf-color-input"
                        .value=${shown || '#000000'}
                        ?disabled=${disabled}
                        aria-label=${context.label || context.chooseLabel}
                        @input=${(event) => context.component._pickerInput(event)}
                        @change=${(event) => context.component._pickerChange(event)}
                >
            </label>
            ${context.name
                    // The form gets the value, empty while the inherited colour
                    // applies. The colour input cannot hold «nothing»: named, it
                    // submitted #000000 for every colour nobody had chosen.
                    ? html`<input type="hidden" name=${context.name} .value=${context.value}>`
                    : nothing}

            <span class="sf-color-text">
                ${isSet
                        ? html`<code>${context.value}</code>`
                        // With an inherited colour the shared slot says «inherited»
                        // (simai/ui-source#28); without one the words stay here.
                        : context.hasInheritedValue
                                ? nothing
                                : html`<span class="sf-color-inherited">${context.inheritedText}</span>`}
            </span>

            ${context.swatchList.length
                    ? html`
                        <span class="sf-color-swatches" role="group" aria-label=${context.chooseLabel}>
                            ${context.swatchList.map((swatch) => html`
                                <button
                                        type="button"
                                        class="sf-color-preset"
                                        style=${`--sf-color-chip: ${swatch.value}`}
                                        title=${swatch.name}
                                        aria-label=${swatch.name}
                                        aria-pressed=${context.value === swatch.value ? 'true' : 'false'}
                                        ?disabled=${disabled}
                                        @click=${() => context.component.setValue(swatch.value)}
                                ></button>
                            `)}
                        </span>`
                    : nothing}

            ${context.hasInheritedValue
                    // The marker while the inherited colour applies, the reset
                    // once a colour is chosen: the same slot every field uses.
                    ? renderInheritedSlot(context.component, {size, disabled, className: 'sf-color-inherited-slot'})
                    : nothing}

            ${context.clearable && isSet && !context.hasInheritedValue
                    ? html`
                        <sf-icon-button
                                appearance="link"
                                size=${size}
                                icon="restart_alt"
                                data-action="clear"
                                aria-label=${context.clearLabel}
                                ?disabled=${disabled}
                                @click=${() => context.component.clear()}
                        ></sf-icon-button>`
                    : nothing}
        </div>
    `;
}
