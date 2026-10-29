import {html, nothing} from 'lit';
import {createInlineSpinner} from '../../../../component/spinner/js/_spinner-draw';


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
    // The shortcut's keys sit at the end; the label then takes the free room,
    // so a stretched button reads label ... keys and text-position places it.
    const shortcutCaps = context.shortcutCaps || [];
    const fullText = (!leftIconContent && !rightIconContent) || shortcutCaps.length > 0;
    // Loading shows the spinner at the icon's size (simai/ui-source#10): in
    // place of the start icon, else of the end icon; a button without an icon
    // lays it over its label, which keeps its place (and the button its width)
    // and stays the accessible name. Icon-only is the first case.
    let startContent = leftIconContent;
    let endContent = rightIconContent;
    let overlayContent = '';
    if (loading) {
        const spinner = (overlay) => createInlineSpinner({className: 'sf-button-spinner', overlay});
        if (leftIconContent) startContent = spinner(false);
        else if (rightIconContent) endContent = spinner(false);
        else overlayContent = spinner(true);
    }
    const rootClasses = [
        'sf-button',
        `sf-button--size-${size}`,
        `sf-button--${appearance || type}`,
        // One colour name, as the styles expect: the status when one is set, the
        // scheme otherwise. A status says what the control is about -- an error
        // for something destructive -- and a scheme says which colour family it
        // takes; they cannot both paint it.
        `sf-button--${status || scheme}`,
        // on-surface-variant is the on-surface family one step quieter: both
        // classes, so every on-surface rule holds and one rule quietens it.
        !status && scheme === 'on-surface-variant' ? 'sf-button--on-surface' : '',
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
                aria-expanded=${context.expanded === undefined ? nothing : String(Boolean(context.expanded))}
                aria-keyshortcuts=${context.ariaKeyShortcuts || nothing}
        >
            ${overlayContent}
            ${startContent}
            ${textContent ? html`<span
                    class="sf-button-text-container text-${textPosition} pointer-event-none${fullText ? ' flex-1' : ''}">
        ${textContent}
      </span>` : ''}
            ${endContent}${shortcutCaps.length ? html`<kbd class="sf-kbd--group sf-button-shortcut pointer-event-none" aria-hidden="true">${shortcutCaps.map((cap) => html`<kbd class=${cap.chars ? `sf-button-shortcut-key--chars-${cap.chars}` : nothing}>${cap.text}</kbd>`)}</kbd>` : ''}
        </button>
    `;
}
