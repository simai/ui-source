import {html, nothing} from 'lit';
import {renderInheritedSlot} from '../../../helpers/inherited-value';
import {alphaOf, isPaletteName, paletteFill, solidOf} from '../color-math.js';
import './default.css';

// sf-input-color draws a field of the control ladder -- a swatch, the value and a
// chevron -- that opens the Framework's own compact window (owner decision C83,
// prototype ui-control prototypes/color-picker-study.html rounds 3 and 4). The
// browser's colour dialog is not used: it was a different window in every
// browser, with no palette and no alpha (R130). The theme variant is only a
// circle of the current colour that opens the same window (C84).

// One painter for every swatch (R167, C86): an opaque colour is a plain fill;
// a translucent one is split -- its left half the colour as it is over the
// checkerboard, its right half the same colour without alpha -- so a 20 %
// colour still shows its hue. The paint stays inside the 1 px border (R169).
export function paintStyle(value) {
    if (!value) return '';
    if (isPaletteName(value)) return `--sf-color-fill: ${paletteFill(value)}; --sf-color-solid: ${paletteFill(value)}`;
    return `--sf-color-fill: ${value}; --sf-color-solid: ${solidOf(value) || value}`;
}

const translucent = (value) => Boolean(value) && !isPaletteName(value) && alphaOf(value) < 1;

function renderChip(value, className = 'sf-color-chip') {
    return html`<span class=${className}
                      style=${paintStyle(value) || nothing}
                      ?data-alpha=${translucent(value)}
                      ?data-empty=${!value}
                      aria-hidden="true"></span>`;
}

export function renderColorTemplate(context) {
    if (context.variant === 'theme') return renderThemeTemplate(context);
    const {painted, isSet, disabled, size, appearance, open} = context;
    const component = context.component;
    const name = context.label || context.ariaLabel || context.chooseLabel;
    const shown = context.paintedName;
    // The value is read with the name: «Цвет метки: Синий».
    const spoken = shown ? `${name}: ${shown}` : name;

    // What the field says. A chosen palette colour is its word, an own colour
    // its code; while the inherited colour applies the field shows it in the
    // same place, with the shared «наследуется» marker at the end (CO-07: the
    // marker stood 16 px after where the code starts).
    const text = painted
        ? (isPaletteName(painted) ? html`<span class="sf-color-name">${shown}</span>` : html`<code>${painted}</code>`)
        : html`<span class="sf-color-empty">${context.hasInheritedValue ? '' : context.inheritedText}</span>`;

    return html`
        <div class="sf-color-field sf-color-field--size-${size}">
            ${context.label
                    // One field label look for every field (FB-10, CO-04):
                    // the trigger carries the same words as its name, so the
                    // visible copy is hidden from the accessibility tree.
                    ? html`<span class="sf-color-label" aria-hidden="true">${context.label}</span>`
                    : nothing}
            <div class="sf-color sf-color--${appearance} sf-color--size-${size}"
                 data-set=${isSet ? 'true' : 'false'}
                 data-open=${open ? 'true' : 'false'}>
                <div class="sf-color-frame"
                     ?data-disabled=${disabled}
                     @click=${(event) => {
                         if (disabled || event.target.closest?.('[data-inherited-reset], [data-action="clear"]')) return;
                         component.togglePicker();
                     }}>
                    <button type="button"
                            class="sf-color-trigger"
                            title=${context.chooseLabel}
                            aria-haspopup="dialog"
                            aria-expanded=${open ? 'true' : 'false'}
                            aria-label=${spoken}
                            ?disabled=${disabled}>
                        ${renderChip(painted)}
                        <span class="sf-color-text">${text}</span>
                    </button>
                    ${context.hasInheritedValue
                            // The marker while the inherited colour applies,
                            // the reset once a colour is chosen: the slot every
                            // field uses.
                            ? renderInheritedSlot(context.component, {size, disabled, className: 'sf-color-inherited-slot'})
                            : nothing}
                    ${context.clearable && isSet && !context.hasInheritedValue
                            ? html`
                                <sf-button-icon
                                        appearance="ghost"
                                        scheme="on-surface"
                                        size=${size === '2' ? '1' : '1/2'}
                                        icon="restart_alt"
                                        data-action="clear"
                                        aria-label=${context.clearLabel}
                                        title=${context.clearLabel}
                                        ?disabled=${disabled}
                                        @click=${(event) => {
                                            event.stopPropagation();
                                            component.clear();
                                        }}
                                ></sf-button-icon>`
                            : nothing}
                    <sf-icon icon=${open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                             root-class="sf-color-chevron"
                             aria-hidden="true"></sf-icon>
                </div>
                ${context.hiddenName
                        // Without ElementInternals the form gets the value from
                        // a hidden input, empty while the inherited colour applies.
                        ? html`<input type="hidden" name=${context.hiddenName} .value=${context.value}>`
                        : nothing}
            </div>
            ${open ? renderWindow(context, name) : nothing}
        </div>
    `;
}

// variant theme (C84): only a circle of the current colour, as a site header
// holds it; a press opens the same window as the field, at its normal size,
// with no text and no theme row. The button is what a keyboard reaches and
// what a screen reader names («Цвет темы», «Theme colour»).
function renderThemeTemplate(context) {
    const {isSet, disabled, size, open} = context;
    const component = context.component;

    return html`
        <div class="sf-color sf-color--theme sf-color--size-${size}"
             data-set=${isSet ? 'true' : 'false'}
             data-open=${open ? 'true' : 'false'}>
            <button type="button"
                    class="sf-color-dot sf-color-trigger"
                    data-action="theme"
                    aria-haspopup="dialog"
                    aria-expanded=${open ? 'true' : 'false'}
                    aria-label=${context.themeLabel}
                    title=${context.themeLabel}
                    ?disabled=${disabled}
                    @click=${() => component.togglePicker()}>
                ${renderChip(context.themeColor, 'sf-color-chip sf-color-chip--round')}
            </button>
            ${context.hiddenName
                    ? html`<input type="hidden" name=${context.hiddenName} .value=${context.value}>`
                    : nothing}
            ${context.clearable && isSet
                    ? html`
                        <sf-button-icon
                                appearance="ghost"
                                scheme="on-surface"
                                size=${size}
                                icon="restart_alt"
                                data-action="clear"
                                aria-label=${context.themeResetLabel}
                                title=${context.themeResetLabel}
                                ?disabled=${disabled}
                                @click=${() => component.clear()}
                        ></sf-button-icon>`
                    : nothing}
            ${open ? renderWindow(context, context.themeLabel) : nothing}
        </div>
    `;
}

// The window's own fields (the code, the %) send the browser's input and
// change, with no detail; they stop at the window, so the host's input and
// change are only its own, with {value, name}.
const stopNative = (event) => event.stopPropagation();

// The window: 304 wide on a desktop (eight 28 px swatches, 8 apart, 12 inside),
// anchored under the field and never taller than the room it has; a sheet at
// the bottom of the screen on a phone. «Палитра» and «Своё» replace each other
// in place under the standard segmented control (R147, R149, R151).
function renderWindow(context, name) {
    const {component, word} = context;
    const both = context.offersPalette && context.offersCustom;
    return html`
        <div class="sf-color-window"
             role="dialog"
             aria-label=${name}
             tabindex="-1"
             @input=${stopNative}
             @change=${stopNative}>
            ${both
                    ? html`
                        <div class="sf-color-views">
                            <sf-segmented size="1/2"
                                          full-width
                                          aria-label=${word('how')}
                                          items=${JSON.stringify([
                                              {value: 'palette', label: word('palette')},
                                              {value: 'own', label: word('own')},
                                          ])}
                                          value=${context.view}
                                          @change=${(event) => {
                                              event.stopPropagation();
                                              const view = event.detail?.value;
                                              if (view) component.showView(view);
                                          }}></sf-segmented>
                        </div>`
                    : nothing}
            ${context.view === 'own' ? renderOwn(context) : renderPalette(context)}
        </div>
    `;
}

function renderOptions(context, list, {label, own = false, className = ''}) {
    const {component, value} = context;
    const chosen = list.findIndex((item) => item.value === value);
    return html`
        <div class="sf-color-options ${className}"
             role="radiogroup"
             aria-label=${label}
             @keydown=${(event) => component.optionKey(event)}>
            ${list.map((item, index) => {
                const checked = item.value === value;
                return html`
                    <button type="button"
                            class="sf-color-option"
                            role="radio"
                            aria-checked=${checked ? 'true' : 'false'}
                            tabindex=${index === (chosen < 0 ? 0 : chosen) ? '0' : '-1'}
                            data-value=${item.value}
                            data-own=${own ? 'true' : 'false'}
                            aria-label=${item.name}
                            title=${item.name}
                            ?data-alpha=${translucent(item.value)}
                            style=${`${paintStyle(item.value)}${checked ? `; --sf-color-ink: ${component.inkFor(item.value)}` : ''}`}
                            ?disabled=${context.disabled}
                            @click=${() => component.pick(item.value, {own})}>
                        ${checked ? html`<sf-icon icon="check" root-class="sf-color-check" aria-hidden="true"></sf-icon>` : nothing}
                    </button>`;
            })}
        </div>
    `;
}

// «Палитра»: the product's own colours first, then the sixteen palette hues,
// then -- after a thin divider, with no caption -- the recent own colours, the
// current own colour first and chosen (R153, R168).
function renderPalette(context) {
    const {component, word} = context;
    const hues = context.palette.map((hue) => ({value: hue, name: component.colourName(hue)}));
    const recent = context.recentRow.map((hex) => ({
        value: hex,
        name: alphaOf(hex) < 1 ? word('recent-alpha', {value: hex, alpha: Math.round(alphaOf(hex) * 100)}) : word('recent-one', {value: hex}),
    }));
    return html`
        <div class="sf-color-palette">
            ${context.swatchList.length
                    ? renderOptions(context, context.swatchList, {label: word('product'), className: 'sf-color-options--product'})
                    : nothing}
            ${component.showsHues
                    ? renderOptions(context, hues, {label: word('palette')})
                    : nothing}
            ${recent.length
                    ? html`<div class="sf-color-recent">${renderOptions(context, recent, {label: word('recent'), own: true})}</div>`
                    : nothing}
        </div>
    `;
}

// «Своё», laid out as Figma's (R154): the shade area; the eyedropper left of
// the stacked hue and alpha strips; one joined row «format ▾ | code | %».
// Without `alpha` the alpha strip and the % field are not drawn.
function renderOwn(context) {
    const {component, word} = context;
    const [h, s, v] = context.hsv;
    const alpha = context.alphaValue;
    const percent = Math.round(alpha * 100);
    const solid = solidOf(context.ownColour);
    const formatWord = context.formatWords[context.format];
    return html`
        <div class="sf-color-own">
            <div class="sf-color-area"
                 role="slider"
                 tabindex="0"
                 aria-label=${word('shade')}
                 aria-valuemin="0"
                 aria-valuemax="100"
                 aria-valuenow=${Math.round(s * 100)}
                 aria-valuetext=${word('shade-value', {saturation: Math.round(s * 100), brightness: Math.round(v * 100)})}
                 style=${`--sf-color-hue: ${Math.round(h * 10) / 10}`}
                 @pointerdown=${(event) => component.dragOn(event, 'area')}
                 @keydown=${(event) => component.keyOn(event, 'area')}>
                <span class="sf-color-thumb"
                      style=${`inset-inline-start: ${s * 100}%; inset-block-start: ${(1 - v) * 100}%; --sf-color-fill: ${solid}; --sf-color-solid: ${solid}`}></span>
            </div>
            <div class="sf-color-tools">
                <sf-button-icon size="1/2"
                                appearance="ghost"
                                scheme="on-surface"
                                icon="colorize"
                                data-action="eyedropper"
                                aria-label=${word('eyedropper')}
                                title=${context.hasEyeDropper ? word('eyedropper') : word('eyedropper-missing')}
                                ?disabled=${!context.hasEyeDropper || context.disabled}
                                @click=${() => component.eyedrop()}></sf-button-icon>
                <div class="sf-color-strips">
                    <div class="sf-color-strip sf-color-strip--hue"
                         role="slider"
                         tabindex="0"
                         aria-label=${word('hue')}
                         aria-valuemin="0"
                         aria-valuemax="360"
                         aria-valuenow=${Math.round(h)}
                         aria-valuetext=${word('hue-value', {hue: Math.round(h)})}
                         @pointerdown=${(event) => component.dragOn(event, 'hue')}
                         @keydown=${(event) => component.keyOn(event, 'hue')}>
                        <span class="sf-color-thumb"
                              style=${`inset-inline-start: ${h / 360 * 100}%; --sf-color-fill: hsl(${Math.round(h)} 100% 50%); --sf-color-solid: hsl(${Math.round(h)} 100% 50%)`}></span>
                    </div>
                    ${context.alpha
                            ? html`
                                <div class="sf-color-strip sf-color-strip--alpha"
                                     role="slider"
                                     tabindex="0"
                                     aria-label=${word('alpha')}
                                     aria-valuemin="0"
                                     aria-valuemax="100"
                                     aria-valuenow=${percent}
                                     aria-valuetext=${word('alpha-value', {alpha: percent})}
                                     style=${`--sf-color-solid: ${solid}`}
                                     @pointerdown=${(event) => component.dragOn(event, 'alpha')}
                                     @keydown=${(event) => component.keyOn(event, 'alpha')}>
                                    <span class="sf-color-thumb"
                                          ?data-alpha=${alpha < 1}
                                          style=${`inset-inline-start: ${percent}%; ${paintStyle(context.ownColour)}`}></span>
                                </div>`
                            : nothing}
                </div>
            </div>
            <div class="sf-color-code-row" role="group" aria-label=${word('code')}>
                <button type="button"
                        class="sf-color-format"
                        aria-haspopup="menu"
                        aria-expanded=${context.formatOpen ? 'true' : 'false'}
                        aria-label=${word('format-current', {format: formatWord})}
                        @click=${() => component.toggleFormatMenu()}>
                    <span>${formatWord}</span>
                    <sf-icon icon="keyboard_arrow_down" root-class="sf-color-format-chevron" aria-hidden="true"></sf-icon>
                </button>
                <input type="text"
                       class="sf-color-code"
                       spellcheck="false"
                       autocomplete="off"
                       aria-label=${word('code-in', {format: formatWord})}
                       aria-invalid=${context.codeError ? 'true' : 'false'}
                       .value=${context.codeText}
                       @input=${(event) => component.codeOn(event, false)}
                       @change=${(event) => component.codeOn(event, true)}
                       @keydown=${(event) => {
                           if (event.key !== 'Enter') return;
                           event.preventDefault();
                           component.codeOn(event, true);
                       }}>
                ${context.alpha
                        ? html`
                            <span class="sf-color-percent">
                                <input type="text"
                                       class="sf-color-alpha-input"
                                       inputmode="numeric"
                                       maxlength="3"
                                       aria-label=${word('opacity')}
                                       .value=${String(percent)}
                                       @input=${(event) => component.alphaOn(event, false)}
                                       @change=${(event) => component.alphaOn(event, true)}
                                       @keydown=${(event) => component.alphaKeyOn(event)}>
                                <span aria-hidden="true">%</span>
                            </span>`
                        : nothing}
            </div>
            ${context.formatOpen
                    ? html`
                        <div class="sf-color-format-menu"
                             role="menu"
                             aria-label=${word('format')}
                             @keydown=${(event) => component.formatMenuKey(event)}>
                            ${context.formats.map((format) => html`
                                <button type="button"
                                        role="menuitemradio"
                                        data-format=${format}
                                        aria-checked=${format === context.format ? 'true' : 'false'}
                                        tabindex="-1"
                                        @click=${() => component.setFormat(format)}>${context.formatWords[format]}</button>
                            `)}
                        </div>`
                    : nothing}
            <div class="sf-color-error" aria-live="polite">${context.codeError}</div>
        </div>
    `;
}
