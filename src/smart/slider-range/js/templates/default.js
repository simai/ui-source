import {html, nothing} from 'lit';

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(' ');
}

function valueOrNothing(value) {
    return value === '' || value === null || value === undefined ? nothing : String(value);
}

// The field around the slider (C78): the visible name above, as every field's
// label, with the value at the end of that line when value-display="text";
// the slider's own track line under it. The class component draws the track
// (component/range-slider); the name line belongs to the host.
function renderHead(context) {
    const showName = Boolean(context.name);
    // With the from/to field the numbers are in the field; the line keeps the name.
    const showOutput = context.valueDisplay === 'text' && !context.field;
    if (!showName && !showOutput) return nothing;
    return html`
        <div class="sf-range-slider-head">
            ${showName
                ? html`<span class="sf-range-slider-name" id=${context.nameId}>${context.name}</span>`
                : nothing}
            ${showOutput
                // Each handle reads its own value out (aria-valuetext); this is the sighted copy.
                // A property, not a text part: the host rewrites the text as the
                // handles move, and a text part's markers would go with it, so the
                // next render (a setting changed after the first) had nowhere to write.
                ? html`<span class="sf-range-slider-output" aria-hidden="true" .textContent=${context.outputText ?? ''}></span>`
                : nothing}
        </div>
    `;
}

// The scale under the track (C78, C80): the ends with scale, or the author's
// marks ("1:плохо,3:нормально,5:отлично"; a mark without text writes its
// number). Numbers are written by the host after the slider is bound, in the
// slider's own language and digits.
function renderScale(context) {
    const marks = context.scaleMarks || [];
    if (!marks.length) return nothing;
    return html`
        <div class="sf-range-slider-scale" aria-hidden="true">
            ${marks.map((mark) => html`<span
                    class=${joinClasses('sf-range-slider-scale-mark', mark.edge ? `sf-range-slider-scale-mark--${mark.edge}` : '')}
                    style=${`inset-inline-start: ${mark.percent}%`}
                    data-value=${String(mark.value)}
                    .textContent=${mark.text ?? ''}
            ></span>`)}
        </div>
    `;
}

// The from/to field (owner decision C80, #r2-fields): one field
// «5 000 – 20 000 ₽» at the end of the track line, the field height of the
// step, as a period is one field (C62). Typing a number and Enter (or leaving
// the box) moves the handle; dragging rewrites the number. The numbers are
// written by the host after the slider is bound.
function renderField(context) {
    if (!context.field) return nothing;
    const {component} = context;
    // Each box sits in a one-cell grid with two hidden rulers holding the ends
    // of the range, written by the host: the cell is as wide as the wider end
    // in the box's own font, and follows a late web font, a size or a density
    // by layout alone. The box fills the cell (acceptance R2: 8ch clipped).
    const input = (index) => html`<span class="sf-range-slider-field-box"
        ><span class="sf-range-slider-field-ruler" aria-hidden="true"></span
        ><span class="sf-range-slider-field-ruler" aria-hidden="true"></span
        ><input
            type="text"
            size="1"
            class="sf-range-slider-field-input"
            data-handle=${String(index)}
            inputmode=${context.fieldDecimal ? 'decimal' : 'numeric'}
            autocomplete="off"
            spellcheck="false"
            aria-label=${context.fieldLabels[index] || nothing}
            ?disabled=${context.disabled}
            ?readonly=${context.readonly}
            @focus=${(event) => event.target.select?.()}
            @keydown=${(event) => component.onFieldKeyDown(event, index)}
            @input=${(event) => event.stopPropagation()}
            @change=${(event) => { event.stopPropagation(); component.commitField(index); }}
    ></span>`;
    return html`
        <span class="sf-range-slider-field">
            ${context.prefixText ? html`<span class="sf-range-slider-field-unit" aria-hidden="true">${context.prefixText.trim()}</span>` : nothing}
            ${input(0)}
            ${context.multiple
                ? html`<span class="sf-range-slider-field-dash" aria-hidden="true">–</span>${input(1)}`
                : nothing}
            ${context.suffix ? html`<span class="sf-range-slider-field-unit" aria-hidden="true">${context.suffix.trim()}</span>` : nothing}
        </span>
    `;
}

export function renderRangeSliderTemplate(context) {
    const groupClasses = joinClasses(
        'sf-range-slider-group',
        `sf-range-slider-group--size-${context.size}`,
        context.disabled ? 'disabled' : '',
        context.readonly && !context.disabled ? 'readonly' : '',
    );
    const rootClasses = joinClasses(
        'sf-range-slider',
        'flex-1',
        `sf-range-slider--size-${context.size}`,
        context.rootClass,
        context.disabled ? 'disabled' : '',
        context.readonly && !context.disabled ? 'readonly' : '',
    );

    return html`
        <div class=${groupClasses}>
            ${renderHead(context)}
            <div class="sf-range-slider-line">
              <div class="sf-range-slider-track-column">
                <div
                        class=${rootClasses}
                        style=${valueOrNothing(context.rootStyle)}
                        data-min=${valueOrNothing(context.min)}
                        data-max=${valueOrNothing(context.max)}
                        data-start=${valueOrNothing(context.start)}
                        data-multiple=${String(!!context.multiple)}
                        data-step=${valueOrNothing(context.step)}
                        data-page-step=${valueOrNothing(context.pageStep)}
                        data-margin=${valueOrNothing(context.margin)}
                        data-connect=${valueOrNothing(context.connect)}
                        data-keyboard=${String(!!context.keyboard)}
                        data-label=${valueOrNothing(context.handleLabel)}
                        data-prefix=${valueOrNothing(context.prefixText)}
                        data-suffix=${valueOrNothing(context.suffix)}
                        data-lower-label=${valueOrNothing(context.lowerLabel)}
                        data-upper-label=${valueOrNothing(context.upperLabel)}
                        data-labelledby=${context.name ? context.nameId : nothing}
                        data-precision=${valueOrNothing(context.precision)}
                        data-grouping=${context.grouping === false ? 'false' : nothing}
                        data-locale=${valueOrNothing(context.locale)}
                        data-tooltip-position=${valueOrNothing(context.tooltipPosition)}
                        data-label-position=${valueOrNothing(context.labelPosition)}
                        data-ticks=${context.ticks ? 'true' : nothing}
                        ?disabled=${context.disabled}
                ></div>
                ${renderScale(context)}
              </div>
              ${renderField(context)}
            </div>
        </div>
    `;
}
