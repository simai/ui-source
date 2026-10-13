import {html, nothing} from 'lit';
import './default.css';

export function renderIconButtonTemplate(context) {
    const {
        size,
        appearance,
        type,
        scheme,
        status,
        icon,
        segment,
        tightness,
        kind,
        variant,
        radius,
        filled,
        rootClass,
        loading,
        disabled,
        nativeType,
        ariaLabel,
    } = context;

    const rootClasses = [
        'sf-icon-button',
        `sf-icon-button--size-${size || '1'}`,
        `sf-icon-button--${kind ?? variant ?? 'icon'}`,
        `sf-icon-button--${appearance || type || 'default'}`,
        'flex',
        'items-cross-center',
        segment ? `segment-${segment}` : '',
        // One colour name, as the styles expect: the status when one is set, the
        // scheme otherwise. A status says what the control is about -- an error
        // for something destructive -- and a scheme says which colour family it
        // takes; they cannot both paint it.
        `sf-icon-button--${status || scheme || 'primary'}`,
        tightness ? `tightness-${tightness}` : '',
        radius ? `radius-${radius}` : '',
        rootClass,
        loading ? 'loading sf-icon-button-state-loading' : '',
    ].filter(Boolean);

    const iconContent =
        context.component?.hasSlotContent?.('icon')
            ? context.component.getSlotContent('icon')
            : (kind ?? variant) === 'close'
                ? html`
                            <sf-close root-class="pointer-event-none" size="${size || '1'}"></sf-close>`
                : html`
                            <sf-icon filled="${filled}" root-class="pointer-event-none" icon="${icon}" weight="400" aria-hidden="true"></sf-icon>`;

    return html`
        <button
                type=${nativeType}
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                ?disabled=${disabled || loading}
                aria-label=${ariaLabel || nothing}
                aria-busy=${loading ? 'true' : nothing}
        >
            ${iconContent}
        </button>
    `;
}
