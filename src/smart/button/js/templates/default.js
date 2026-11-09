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
    const leftIconName = context.cycleView?.icon || (context.iconStart ?? (iconLeft || (icon && !isIconEnd ? icon : '')));
    const rightIconName = context.iconEnd ?? (iconRight || (icon && isIconEnd ? icon : ''));
    const component = context.component;
    const leftIconContent =
        component?.hasSlotContent?.('icon-start')
            ? component.getSlotContent('icon-start')
            : component?.hasSlotContent?.('icon-left')
            ? component.getSlotContent('icon-left')
            : component.createIcon(leftIconName, context.pressed === true || Boolean(context.cycleView?.pressedLook));
    const rightIconContent =
        component?.hasSlotContent?.('icon-end')
            ? component.getSlotContent('icon-end')
            : component?.hasSlotContent?.('icon-right')
            ? component.getSlotContent('icon-right')
            : component.createIcon(rightIconName, context.pressed === true);
    // A toggle whose label changes (text-pressed, 1.6.0): «В избранное» at rest,
    // «В избранном» while on. The label then says the state, so aria-pressed
    // is not written as well (docs review R028, rule C12): a screen reader
    // would hear «В избранном, нажата». The look follows pressed either way.
    const pressedLabel = context.pressed === true && context.textPressed ? context.textPressed : '';
    const announcesPressed = context.pressed !== undefined && !context.textPressed;
    const textContent =
        component?.hasSlotContent?.('text')
            ? component.getSlotContent('text')
            : context.cycleView?.label || pressedLabel || text;
    // The shortcut's keys sit at the end; the label then takes the free room,
    // so a stretched button reads label ... keys and text-position places it.
    // The keys are the kbd component's (soft caps inside a button); the
    // wrapper only gives them the label's ink.
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
        // ghost (C15) is drawn by the link class, the one the sheets and
        // their consumers select; href, not the look, makes a link.
        `sf-button--${(appearance || type) === 'ghost' ? 'link' : (appearance || type)}`,
        // One colour name, as the styles expect: the status when one is set, the
        // scheme otherwise. A status says what the control is about -- an error
        // for something destructive -- and a scheme says which colour family it
        // takes; they cannot both paint it.
        // danger (C13) is drawn with the error roles: the danger class and the
        // error one the sheets and their consumers also select.
        ...(status === 'danger' || status === 'error' ? ['sf-button--danger', 'sf-button--error'] : [`sf-button--${scheme}`]),
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
        // A toggle that is on wears the pressed look (component.buttons 1.5.0,
        // rule C12): the class carries it whether or not aria-pressed is said.
        context.pressed || context.cycleView?.pressedLook ? 'sf-button--pressed' : '',
    ].filter(Boolean);

    const content = html`
            ${overlayContent}
            ${startContent}
            ${textContent ? html`<span
                    class="sf-button-text-container text-${textPosition} pointer-event-none${fullText ? ' flex-1' : ''}">
        ${textContent}
      </span>` : ''}
            ${endContent}${shortcutCaps.length ? html`<span class="sf-button-shortcut pointer-event-none" aria-hidden="true"><kbd class="sf-kbd--group">${shortcutCaps.map((cap, at) => html`${at && context.shortcutJoin ? html`<span class="sf-kbd-join">+</span>` : nothing}<kbd class=${cap.square ? 'sf-kbd--square' : nothing}>${cap.text}</kbd>`)}</kbd></span>` : ''}
`;

    // href (1.4.0): a link with the button's look. The browser's own link
    // follows it (Enter, the context menu, a new tab); a button's states that
    // a link has no words for -- native-type, expanded, pressed -- do not
    // apply. Disabled or loading, the link has no href, so it is not reached
    // or followed, and says aria-disabled.
    if (context.href) {
        const inactive = Boolean(disabled || loading);
        return html`
        <a
                href=${inactive ? nothing : context.href}
                target=${context.linkTarget || nothing}
                rel=${context.linkRel || nothing}
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                role=${inactive ? 'link' : nothing}
                aria-disabled=${inactive ? 'true' : nothing}
                aria-label=${ariaLabel || nothing}
                aria-busy=${loading ? 'true' : nothing}
                aria-keyshortcuts=${context.ariaKeyShortcuts || nothing}
        >${content}</a>
    `;
    }

    return html`
        <button
                type=${nativeType}
                form=${context.formId || nothing}
                name=${context.submitName || nothing}
                value=${context.submitName || context.submitValue ? context.submitValue : nothing}
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                ?disabled=${disabled || loading}
                aria-label=${ariaLabel || nothing}
                aria-busy=${loading ? 'true' : nothing}
                aria-expanded=${context.expanded === undefined ? nothing : String(Boolean(context.expanded))}
                aria-pressed=${announcesPressed ? String(Boolean(context.pressed)) : nothing}
                aria-keyshortcuts=${context.ariaKeyShortcuts || nothing}
        >${content}</button>${context.cycleView ? html`<span class="sf-button-announce sr-only" role="status" aria-live="polite" aria-atomic="true">${context.cycleView.announcement}</span>` : nothing}
    `;
}
