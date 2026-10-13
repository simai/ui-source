import {html, nothing} from 'lit';

function joinClasses(...tokens) {
    return tokens.flat().filter(Boolean).join(' ');
}

function valueOrNothing(value) {
    return value === '' || value === null || value === undefined ? nothing : String(value);
}

export function renderRangeSliderTemplate(context) {
    const rootClasses = joinClasses(
        'sf-range-slider',
        'flex-1',
        context.rootClass,
        context.disabled ? 'disabled' : '',
    );

    return html`
        <div
                class=${rootClasses}
                style=${valueOrNothing(context.rootStyle)}
                data-min=${valueOrNothing(context.min)}
                data-max=${valueOrNothing(context.max)}
                data-start=${valueOrNothing(context.start)}
                data-multiple=${String(!!context.multiple)}
                data-step=${valueOrNothing(context.step)}
                data-margin=${valueOrNothing(context.margin)}
                data-connect=${valueOrNothing(context.connect)}
                data-keyboard=${String(!!context.keyboard)}
                data-label=${valueOrNothing(context.label)}
                data-prefix=${valueOrNothing(context.prefix)}
                data-suffix=${valueOrNothing(context.suffix)}
                data-lower-label=${valueOrNothing(context.lowerLabel)}
                data-upper-label=${valueOrNothing(context.upperLabel)}
                data-decimals=${valueOrNothing(context.decimals)}
                data-tooltip-position=${valueOrNothing(context.tooltipPosition)}
                data-text-position=${valueOrNothing(context.textPosition)}
                data-label-position=${valueOrNothing(context.labelPosition)}
                ?disabled=${context.disabled}
        ></div>
    `;
}
