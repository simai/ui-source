import {html, nothing} from 'lit';
import './default.css';
import {createInlineSpinner} from '../../../../component/spinner/js/_spinner-draw';
import {nameWithBadge, renderAnchoredBadge, renderAnchoredBadgeText} from '../../../helpers/anchored-badge';

const ICON_BUTTON_SIZES = new Set(['1/3', '1/2', '1', '2', '3']);

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
        badge,
    } = context;

    const rootClasses = [
        'sf-icon-button',
        // The sizes the icon button draws; a close may be smaller (1/4, the
        // closable tag's), and then sf-close sizes it alone: the class it got
        // here had no rule (documentation trial 6, 2026-10-18).
        ICON_BUTTON_SIZES.has(size || '1') ? `sf-icon-button--size-${size || '1'}` : '',
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
        // on-surface-variant is the on-surface family one step quieter: both
        // classes, so every on-surface rule holds and one rule quietens it.
        !status && scheme === 'on-surface-variant' ? 'sf-icon-button--on-surface' : '',
        tightness ? `tightness-${tightness}` : '',
        radius ? `radius-${radius}` : '',
        rootClass,
        loading ? 'loading sf-icon-button-state-loading' : '',
    ].filter(Boolean);

    // Loading shows the spinner in place of the icon, at the icon's size
    // (simai/ui-source#10); the button keeps its name and says aria-busy.
    const iconContent = loading
        ? createInlineSpinner({className: 'sf-icon-button-spinner'})
        : context.component?.hasSlotContent?.('icon')
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
                aria-label=${ariaLabel ? nameWithBadge(ariaLabel, badge?.phrase) : nothing}
                aria-busy=${loading ? 'true' : nothing}
        >
            ${iconContent}${renderAnchoredBadge(badge)}${ariaLabel ? nothing : renderAnchoredBadgeText(badge, false)}
        </button>
    `;
}
