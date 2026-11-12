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
    const showOutput = context.valueDisplay === 'text';
    if (!showName && !showOutput) return nothing;
    return html`
        <div class="sf-range-slider-head">
            ${showName
                ? html`<span class="sf-range-slider-name" id=${context.nameId}>${context.name}</span>`
                : nothing}
            ${showOutput
                // Each handle reads its own value out (aria-valuetext); this is the sighted copy.
                ? html`<span class="sf-range-slider-output" aria-hidden="true">${context.outputText}</span>`
                : nothing}
        </div>
    `;
}

export function renderRangeSliderTemplate(context) {
    const groupClasses = joinClasses(
        'sf-range-slider-group',
        context.disabled ? 'disabled' : '',
    );
    const rootClasses = joinClasses(
        'sf-range-slider',
        'flex-1',
        context.rootClass,
        context.disabled ? 'disabled' : '',
    );

    return html`
        <div class=${groupClasses}>
            ${renderHead(context)}
            <div class="sf-range-slider-line">
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
                        ?disabled=${context.disabled}
                ></div>
            </div>
        </div>
    `;
}
