import {html, nothing} from 'lit';
import './default.css';
import {closeSize} from '../close-size.js';
import {cssUrl} from '../../../../core/js/css-url';

// Sizes 1, 2 and 3 take the larger dot; 1/2 and 1/3 the smaller.
const LARGE_SIZES = new Set(['1', '2', '3']);

function dotSize(size) {
    return LARGE_SIZES.has(size) ? '1/2' : '1/3';
}

// A filter tag shows no mark until it is chosen; chosen, a check mark stands
// before the label on the primary container fill (owner decision C145 (2),
// tags study #q-selected B). The empty checkbox square on every tag is gone:
// the row read as a form of check boxes. The mark is an sf-icon, the picture
// of the tag's size (tag - 8, C58), so its name joins the icon request.
function renderCheckboxIcon(context) {
    if (context.component?.hasSlotContent?.('leading')) return context.component.getSlotContent('leading');
    return context.active
        ? html`<sf-icon icon="check" root-class="sf-tag-icon sf-tag-check" aria-hidden="true"></sf-icon>`
        : nothing;
}

// The icon is an sf-icon, as in every other component: the element tells the
// Loader its name, so the name joins the icon font request. A bare
// <i class="sf-icon"> drawn here after the page's scan never did -- its glyph
// stayed blank (buttons review 2026-11-09: label missing from icon_names).
function renderGenericIcon(context) {
    const iconName = context.icon || 'sell';

    return context.component?.hasSlotContent?.('leading')
        ? context.component.getSlotContent('leading')
        : html`<sf-icon icon=${iconName} root-class="sf-tag-icon" aria-hidden="true"></sf-icon>`;
}

// A colour from data is a dot of the static palette before the label; the
// tag itself stays neutral (owner decision C145 (7), tags study #q-color B):
// selection and hover read the same on every tag, and a label colour never
// mimics a status. The hue's role set (.sf-hue-<name>, core) gives the dot its
// strong fill in both themes.
function renderColorIcon(context) {
    if (context.component?.hasSlotContent?.('leading')) return context.component.getSlotContent('leading');
    const classes = [
        'sf-tag-color-icon',
        context.hue ? `sf-tag-color-icon--hue sf-hue-${context.hue}` : '',
        context.colorClass || '',
    ].filter(Boolean);
    return html`<span class=${classes.join(' ')} aria-hidden="true"></span>`;
}

function renderStatusDot(context) {
    return context.component?.hasSlotContent?.('leading')
        ? context.component.getSlotContent('leading')
        : html`
                <span class="sf-dot sf-dot--size-${dotSize(context.size)}" aria-hidden="true">
                    <div class="sf-dot-item"></div>
                </span>
        `;
}

function renderAvatar(context) {
    if (context.component?.hasSlotContent?.('avatar')) {
        return context.component.getSlotContent('avatar');
    }

    if (context.avatarImageUrl) {
        return html`
            <span
                    class="sf-avatar sf-avatar--size-1/4 bg-cover"
                    aria-hidden="true"
                    style=${`background-image: ${cssUrl(context.avatarImageUrl)};`}
            ></span>
        `;
    }

    if (context.avatarText) {
        return html`
            <span class="sf-avatar sf-avatar--size-1/4 sf-avatar--text flex justify-center items-center" aria-hidden="true">
        ${context.avatarText}
      </span>
        `;
    }

    return html`
        <span class="sf-avatar sf-avatar--size-1/4 sf-avatar--placeholder flex justify-center items-center" aria-hidden="true">
      <sf-icon icon="person" aria-hidden="true"></sf-icon>
    </span>
    `;
}

function renderLeading(context) {
    // A link carries no check mark (C145 (6)).
    if (context.href && context.type === 'checkbox') return nothing;
    switch (context.type) {
        case 'checkbox':
            return renderCheckboxIcon(context);
        case 'icon':
            return renderGenericIcon(context);
        case 'color':
            return renderColorIcon(context);
        case 'avatar':
            return renderAvatar(context);
        case 'info':
        case 'success':
        case 'error':
        case 'warning':
            return renderStatusDot(context);
        default:
            return nothing;
    }
}

function renderCount(context) {
    if (context.type !== 'default') return nothing;

    return context.component?.hasSlotContent?.('count')
        ? context.component.getSlotContent('count')
        // No count, no element: an empty one kept its padding and the gap
        // before it, an empty band at the end of every tag (owner, 2026-10-14).
        : context.count ? html`<span class="sf-tag-count pointer-events-none flex">${context.count}</span>` : nothing;
}

// The remove button is sf-button-close, plain (owner decision C14: a tag's
// remove has no spot, the cross darkens and the ring stands around it). It was
// sf-button-icon kind="close", the name C14 retired (LK-06); before that link,
// the alias F3 of pair ui-a0370c0c99fb counted on every closable tag.
function renderClose(context) {
    if (!context.closable) return nothing;

    return context.component?.hasSlotContent?.('close')
        ? context.component.getSlotContent('close')
        : html`
                <sf-button-close
                        size="${closeSize(context.size)}"
                        appearance="plain"
                        ?disabled=${context.disabled}
                        aria-label=${context.closeLabel}
                        @click="${(e) => {
                            e.stopPropagation();
                            context.component.onClose();
                        }}"
                ></sf-button-close>
        `;
}

// A status on a tag that is neither pressed nor removed is a badge (owner
// decision C140 (6), badges study BG-6): the tag draws the tonal badge of the
// same status -- the same container fill, the same hue -- in the badge's size
// for a row of the tag's size (host -> badge: 1/3 in rows 1/3 to 1, 1/2 in a
// row 2, 1 in a row 3), or on the tag's line when it has one. Status on a tag
// is for a filter or a chosen value: interactive or closable.
const BADGE_FOR_TAG = {'1/3': '1/3', '1/2': '1/3', '1': '1/3', '2': '1/2', '3': '1'};

function renderStatusBadge(context, textContent) {
    const classes = [
        'sf-badge',
        'sf-badge--tonal',
        `sf-badge--${context.status}`,
        `sf-badge--size-${BADGE_FOR_TAG[context.size] || '1/3'}`,
        context.line ? `sf-badge--line-${context.line}` : '',
        'sf-tag-badge',
        'inline-flex',
        'flex-row',
        'flex-nowrap',
        'justify-center',
        'items-center',
        `${context.rootClass || ''}`,
    ].filter(Boolean);
    return html`<span class=${classes.join(' ')} style=${context.rootStyle || nothing}><span
        class="sf-badge-text-container flex items-center"><span
        class="sf-badge-text">${textContent}</span></span></span>`;
}

// A tag that leads to a page (owner decision C145 (6), tags study #q-link B):
// the whole tag is one native link, with no check mark and no cross; its
// label underlines on hover like any link (component.tags, .sf-tag--link).
// A tag list of an article (Docara, Larena sites) is the use.
function renderLinkTag(context, textContent) {
    const classes = [
        'sf-tag',
        `sf-tag--${context.status || (context.kind === 'checkbox' ? 'default' : context.kind) || 'default'}`,
        context.appearance && context.appearance !== 'default' ? `sf-tag--appearance-${context.appearance}` : '',
        `sf-tag--size-${context.size}`,
        context.height && context.height !== 'default' ? `sf-tag--height-${context.height}` : '',
        context.inline ? 'sf-tag--inline' : '',
        context.line ? `sf-tag--line-${context.line}` : '',
        'sf-tag--link',
        'inline-flex',
        'flex-row',
        'flex-nowrap',
        'items-center',
        `${context.rootClass}`,
        context.disabled ? 'disabled' : '',
    ].filter(Boolean);
    // A disabled link leads nowhere: no href, aria-disabled, out of the Tab order.
    return html`<a
            class=${classes.join(' ')}
            style=${context.rootStyle || nothing}
            href=${context.disabled ? nothing : context.href}
            aria-disabled=${context.disabled ? 'true' : nothing}
            aria-label=${context.ariaLabel || nothing}
            data-tooltip=${context.cutTooltipId || nothing}
    >${renderLeading(context)}<span class="sf-tag-container pointer-events-none">${textContent}</span>${renderCount(context)}${renderCutTooltip(context)}</a>`;
}

// The Framework's plain tooltip (component.tooltip, class markup), hidden
// until the tooltip controller shows it on hover or keyboard focus of the
// trigger: a name cut with an ellipsis says itself whole (owner decision C58;
// tags study TG-1). The label stays whole in the markup, so a screen reader
// hears all of it; the tooltip is for the eye.
function renderCutTooltip(context) {
    if (!context.cutTooltipId) return nothing;
    return html`<span id=${context.cutTooltipId} class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-tag-tooltip" aria-hidden="true" hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${context.cutText}</span></span></span>`;
}

export function renderTagTemplate(context) {
    const textContent = context.component?.hasSlotContent?.('text')
        ? context.component.getSlotContent('text')
        : context.text;

    if (context.status && !context.interactive && !context.closable && !context.href) {
        return renderStatusBadge(context, textContent);
    }

    if (context.href) return renderLinkTag(context, textContent);

    const classes = [
        'sf-tag',
        // One class still carries both answers, because the styles are written
        // that way: a status wins when it is set, exactly as the single list did.
        `sf-tag--${context.status || context.kind || context.type}`,
        // A named appearance carries its own class, because it is a different axis
        // from the type: the default appearance adds nothing.
        context.appearance && context.appearance !== 'default' ? `sf-tag--appearance-${context.appearance}` : '',
        `sf-tag--size-${context.size}`,
        // The height class (1.4.0, C27); spacing is read into it by the element.
        context.height && context.height !== 'default' ? `sf-tag--height-${context.height}` : '',
        context.inline ? 'sf-tag--inline' : '',
        context.line ? `sf-tag--line-${context.line}` : '',
        'inline-flex',
        'flex-row',
        'flex-nowrap',
        'items-center',
        `${context.rootClass}`,
        context.type === 'checkbox' || context.interactive ? 'sf-tag--interactive' : '',
        context.closable ? 'sf-tag--removable' : '',
        context.active ? 'active' : '',
        context.disabled ? 'disabled' : '',
    ].filter(Boolean);

    const content = html`
            ${renderLeading(context)}
            <span class="sf-tag-container pointer-events-none">${textContent}</span>
            ${renderCount(context)}
            ${renderClose(context)}
    `;

    // A removable checkbox tag is two controls side by side, the toggle and
    // the remove action, because a button cannot hold another button.
    if (context.type === 'checkbox' && context.closable) {
        return html`
            <div
                    class=${classes.join(' ')}
                    style=${context.rootStyle || nothing}
            >
                ${renderCutTooltip(context)}
                <button
                        type="button"
                        class="sf-tag-action inline-flex flex-row flex-nowrap items-center min-w-0"
                        aria-label=${context.ariaLabel || nothing}
                        aria-pressed=${String(context.active)}
                        data-tooltip=${context.cutTooltipId || nothing}
                        ?disabled=${context.disabled}
                        @click=${() => context.component.onToggle()}
                >
                    ${renderLeading(context)}
                    <span class="sf-tag-container pointer-events-none">${textContent}</span>
                    ${renderCount(context)}
                </button>
                ${renderClose(context)}
            </div>
        `;
    }

    if (context.type === 'checkbox') {
        return html`
            <button
                    type="button"
                    class=${classes.join(' ')}
                    style=${context.rootStyle || nothing}
                    aria-label=${context.ariaLabel || nothing}
                    aria-pressed=${String(context.active)}
                    data-tooltip=${context.cutTooltipId || nothing}
                    ?disabled=${context.disabled}
                    @click=${() => context.component.onToggle()}
            >${content}${renderCutTooltip(context)}</button>
        `;
    }

    if (context.interactive) {
        return html`
            <div
                    class=${classes.join(' ')}
                    style=${context.rootStyle || nothing}
            >
                ${renderCutTooltip(context)}
                <button
                        type="button"
                        class="sf-tag-action inline-flex flex-row flex-nowrap items-center min-w-0"
                        aria-label=${context.ariaLabel || nothing}
                        data-tooltip=${context.cutTooltipId || nothing}
                        ?disabled=${context.disabled}
                >
                    ${renderLeading(context)}
                    <span class="sf-tag-container pointer-events-none">${textContent}</span>
                    ${renderCount(context)}
                </button>
                ${renderClose(context)}
            </div>
        `;
    }

    return html`
        <div
                class=${classes.join(' ')}
                style=${context.rootStyle || nothing}
                data-tooltip=${context.cutTooltipId || nothing}
        >${content}${renderCutTooltip(context)}</div>
    `;
}
