import {html, nothing} from 'lit';


export function renderButtonTemplate(context) {
    const {
        size,
        appearance,
        type,
        scheme,
        status,
        text,
        icon,
        iconLeft,
        iconRight,
        iconPosition,
        spacing,
        radius,
        rootClass,
        textPosition,
        loading,
        disabled,
        nativeType,
        ariaLabel,
        segment,
    } = context;

    const normalizedIconPosition = String(iconPosition || 'start').toLowerCase();
    const isIconEnd = ['right', 'end'].includes(normalizedIconPosition);
    const leftIconName = context.iconStart ?? (iconLeft || (icon && !isIconEnd ? icon : ''));
    const rightIconName = context.iconEnd ?? (iconRight || (icon && isIconEnd ? icon : ''));
    const component = context.component;
    const leftIconContent =
        component?.hasSlotContent?.('icon-start')
            ? component.getSlotContent('icon-start')
            : component?.hasSlotContent?.('icon-left')
            ? component.getSlotContent('icon-left')
            : component.createIcon(leftIconName);
    const rightIconContent =
        component?.hasSlotContent?.('icon-end')
            ? component.getSlotContent('icon-end')
            : component?.hasSlotContent?.('icon-right')
            ? component.getSlotContent('icon-right')
            : component.createIcon(rightIconName);
    const textContent =
        component?.hasSlotContent?.('text')
            ? component.getSlotContent('text')
            : text;
    const fullText = !leftIconContent && !rightIconContent;
    const rootClasses = [
        'sf-button',
        `sf-button--size-${size}`,
        `sf-button--${appearance || type}`,
        // One colour name, as the styles expect: the status when one is set, the
        // scheme otherwise. A status says what the control is about -- an error
        // for something destructive -- and a scheme says which colour family it
        // takes; they cannot both paint it.
        `sf-button--${status || scheme}`,
        'flex',
        'items-cross-center',
        segment ? `segment-${segment}` : '',
        // The spacing class, not its retired tightness name (journal
        // class-tightness-to-spacing; docs trial 4).
        spacing && spacing !== 'normal' ? `spacing-${spacing}` : '',
        radius ? `radius-${radius}` : '',
        rootClass,
        loading ? 'loading sf-button-state-loading' : '',
    ].filter(Boolean);

    return html`
        <button
                type=${nativeType}
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                ?disabled=${disabled || loading}
                aria-label=${ariaLabel || nothing}
                aria-busy=${loading ? 'true' : nothing}
        >
            ${leftIconContent}
            ${textContent ? html`<span
                    class="sf-button-text-container text-${textPosition} pointer-event-none${fullText ? ' flex-1' : ''}">
        ${textContent}
      </span>` : ''}
            ${rightIconContent}
        </button>
    `;
}
