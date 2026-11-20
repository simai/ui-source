import {html, nothing} from 'lit';
import './default.css';
import {createInlineSpinner} from '../../../../component/spinner/js/_spinner-draw';
import {nameWithBadge, renderAnchoredBadge, renderAnchoredBadgeText} from '../../../helpers/anchored-badge';

const ICON_BUTTON_SIZES = new Set(['1/3', '1/2', '1', '2', '3']);
// The drawing class of each appearance; surface is resolved to tonal by the
// element (C15), a value off the list draws the default. Ghost is drawn by
// sf-icon-button--ghost (component.icon-buttons 1.14.0, RG-IB-2); plain is
// the plate-less look (C201), toggle the quiet on/off look whose state is
// the plate and a ring, never the glyph (C393). The former
// --link is an alias the runtime notes, so the element never writes it.
const ICON_BUTTON_LOOK = {default: 'default', tonal: 'tonal', outline: 'outline', ghost: 'ghost', link: 'ghost', surface: 'tonal', plain: 'plain', toggle: 'toggle'};

function statusClasses(status, scheme) {
    if (status === 'danger' || status === 'error') return ['sf-icon-button--danger', 'sf-icon-button--error'];
    // secondary was retired (C15): drawn as on-surface-variant.
    const colour = scheme === 'secondary' ? 'on-surface-variant' : (scheme || 'primary');
    // on-surface-variant is the on-surface family one step quieter, one class
    // (SM-CPY-2): the class sheet lists it with every on-surface rule
    // (component.icon-buttons), so on-surface is not written beside it.
    return colour === 'on-surface-variant'
        ? ['sf-icon-button--on-surface-variant']
        : [`sf-icon-button--${colour}`];
}

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
        // closable tag's), and then sf-button-close sizes it alone: the class it got
        // here had no rule (documentation trial 6, 2026-10-18).
        ICON_BUTTON_SIZES.has(size || '1') ? `sf-icon-button--size-${size || '1'}` : '',
        `sf-icon-button--${kind ?? variant ?? 'icon'}`,
        // ghost is drawn by the ghost class (C15 made ghost the name; the
        // link class is its former twin, RG-IB-2).
        `sf-icon-button--${ICON_BUTTON_LOOK[appearance || type] || 'default'}`,
        'flex',
        'items-cross-center',
        segment ? `segment-${segment}` : '',
        // One colour name, as the styles expect: the status when one is set, the
        // scheme otherwise. A status says what the control is about -- an error
        // for something destructive -- and a scheme says which colour family it
        // takes; they cannot both paint it.
        // danger is a control's status (C13), drawn with the error roles: the
        // class is the danger one and the error one the sheets also select.
        ...statusClasses(status, scheme),
        // No density class (owner decision C213): an icon button is sized by
        // size and height only; spacing / tightness are noted by the element.
        // The height (decisions C27, C35): the class of the size's tightness
        // step, declared after the density classes; default draws none.
        ['low', 'high', 'highest'].includes(context.height) ? `sf-icon-button--height-${context.height}` : '',
        radius ? `radius-${radius}` : '',
        rootClass,
        loading ? 'loading sf-icon-button-state-loading' : '',
        // A loading icon button keeps its scheme colour (C36 follow-up); one
        // that is disabled as well wears the disabled look, so it says so.
        loading && disabled ? 'disabled' : '',
        // A toggle that is on wears the pressed look (component.icon-buttons
        // 1.3.0, rule C12): the class carries it whether or not aria-pressed is said.
        context.pressed || context.cycleView?.pressedLook ? 'sf-icon-button--pressed' : '',
    ].filter(Boolean);

    // A toggle whose name changes (label-pressed, 1.5.0): «Добавить в избранное»
    // at rest, «Убрать из избранного» while on. The name then says the state,
    // so aria-pressed is not written as well (docs review R028, rule C12).
    const name = context.cycleView ? context.cycleView.name : context.pressed === true && context.labelPressed ? context.labelPressed : ariaLabel;
    const announcesPressed = context.pressed !== undefined && !context.labelPressed;

    // The toggle look keeps the glyph's outline weight in both states (owner
    // decision C393): its state is the plate and the ring.
    const toggleLook = ICON_BUTTON_LOOK[appearance || type] === 'toggle';

    // Loading shows the spinner in place of the icon, at the icon's size
    // (simai/ui-source#10); the button keeps its name and says aria-busy.
    const iconContent = loading
        ? createInlineSpinner({className: 'sf-icon-button-spinner'})
        : context.component?.hasSlotContent?.('icon')
            ? context.component.getSlotContent('icon')
            : (kind ?? variant) === 'close'
                ? html`
                            <sf-button-close root-class="pointer-events-none" size="${size || '1'}"></sf-button-close>`
                : html`
                            <sf-icon filled="${filled || (!toggleLook && (context.pressed === true || Boolean(context.cycleView?.pressedLook)))}" root-class="pointer-events-none" icon="${context.cycleView?.icon || icon}" weight="400" aria-hidden="true"></sf-icon>`;

    // href (1.9.0, decision C51): a link with the icon button's look, as
    // sf-button's -- the quiet «Скачать <name>» of a table row. Disabled or
    // loading, the link has no href, so it is not reached or followed, and
    // says aria-disabled; pressed and native-type do not apply to a link.
    if (context.href) {
        const inactive = Boolean(disabled || loading);
        return html`
        <a
                href=${inactive ? nothing : context.href}
                target=${context.linkTarget || nothing}
                rel=${context.linkRel || nothing}
                download=${context.linkDownload === null || inactive ? nothing : context.linkDownload}
                class=${(inactive && !rootClasses.includes('disabled') ? [...rootClasses, 'disabled'] : rootClasses).join(' ')}
                style=${context.rootStyle || nothing}
                role=${inactive ? 'link' : nothing}
                aria-disabled=${inactive ? 'true' : nothing}
                aria-label=${name ? nameWithBadge(name, badge?.phrase) : nothing}
                aria-busy=${loading ? 'true' : nothing}
        >
            ${iconContent}${renderAnchoredBadge(badge)}${name ? nothing : renderAnchoredBadgeText(badge, false)}
        </a>
    `;
    }

    return html`
        <button
                type=${nativeType}
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                ?disabled=${disabled || loading}
                aria-label=${name ? nameWithBadge(name, badge?.phrase) : nothing}
                aria-busy=${loading ? 'true' : nothing}
                aria-pressed=${announcesPressed ? String(Boolean(context.pressed)) : nothing}
        >
            ${iconContent}${renderAnchoredBadge(badge)}${name ? nothing : renderAnchoredBadgeText(badge, false)}
        </button>${context.cycleView ? html`<span class="sf-icon-button-announce sr-only" role="status" aria-live="polite" aria-atomic="true">${context.cycleView.announcement}</span>` : nothing}
    `;
}
