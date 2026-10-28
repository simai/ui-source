import {html, nothing} from 'lit';
import {renderInheritedSlot} from '../../../helpers/inherited-value';
import './default.css';

// The control is a swatch that opens the browser's own colour picker, with the
// product's own colours beside it and a way back to the inherited one. The native
// input is what opens the picker: every platform has one, it is reachable from the
// keyboard, and reimplementing a colour wheel would be a worse version of a thing
// the system already does well.
export function renderColorTemplate(context) {
    if (context.variant === 'theme') return renderThemeTemplate(context);
    const {painted, isSet, disabled, size, appearance} = context;

    return html`
        <div class="sf-color sf-color--${appearance} sf-color--size-${size}"
             data-set=${isSet ? 'true' : 'false'}>
            <label class="sf-color-swatch" title=${context.chooseLabel}>
                <span class="sf-color-chip"
                      style=${painted ? `--sf-color-chip: ${painted}` : nothing}
                      data-empty=${painted ? nothing : 'true'}
                      aria-hidden="true"></span>
                <input
                        type="color"
                        class="sf-color-input"
                        .value=${painted || '#000000'}
                        ?disabled=${disabled}
                        aria-label=${context.label || context.chooseLabel}
                        @input=${(event) => context.component._pickerInput(event)}
                        @change=${(event) => context.component._pickerChange(event)}
                >
            </label>
            ${context.hiddenName
                    // Without ElementInternals the form gets the value from a
                    // hidden input, empty while the inherited colour applies. The
                    // colour input cannot hold «nothing»: named, it submitted
                    // #000000 for every colour nobody had chosen.
                    ? html`<input type="hidden" name=${context.hiddenName} .value=${context.value}>`
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

// variant theme: one icon-only primary button that opens the same native
// picker. The input stays in the tree under the button -- transparent, out of
// the focus order and out of the accessibility tree -- so the picker opens
// where the button is; the button is what a keyboard reaches and what a screen
// reader names («Цвет темы», «Theme colour»).
function renderThemeTemplate(context) {
    const {isSet, disabled, size} = context;

    return html`
        <div class="sf-color sf-color--theme sf-color--size-${size}"
             data-set=${isSet ? 'true' : 'false'}>
            <span class="sf-color-theme">
                <input
                        type="color"
                        class="sf-color-input"
                        tabindex="-1"
                        aria-hidden="true"
                        .value=${context.pickerValue || '#000000'}
                        ?disabled=${disabled}
                        @input=${(event) => context.component._pickerInput(event)}
                        @change=${(event) => context.component._pickerChange(event)}
                >
                <sf-icon-button
                        size=${size}
                        icon="palette"
                        data-action="theme"
                        aria-label=${context.themeLabel}
                        title=${context.themeLabel}
                        ?disabled=${disabled}
                        @click=${() => context.component._openPicker()}
                ></sf-icon-button>
            </span>
            ${context.hiddenName
                    ? html`<input type="hidden" name=${context.hiddenName} .value=${context.value}>`
                    : nothing}
            ${context.clearable && isSet
                    ? html`
                        <sf-icon-button
                                appearance="link"
                                size=${size}
                                icon="restart_alt"
                                data-action="clear"
                                aria-label=${context.themeResetLabel}
                                title=${context.themeResetLabel}
                                ?disabled=${disabled}
                                @click=${() => context.component.clear()}
                        ></sf-icon-button>`
                    : nothing}
        </div>
    `;
}
