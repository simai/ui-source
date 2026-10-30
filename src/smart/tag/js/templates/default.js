import {html, nothing} from 'lit';
import './default.css';
import {closeSize} from '../close-size.js';

// Sizes 1, 2 and 3 take the larger dot; 1/2 and 1/3 the smaller.
const LARGE_SIZES = new Set(['1', '2', '3']);

function dotSize(size) {
    return LARGE_SIZES.has(size) ? '1/2' : '1/3';
}

function renderCheckboxIcon(context) {
    return context.component?.hasSlotContent?.('leading')
        ? context.component.getSlotContent('leading')
        : html`<span class="sf-tag-check" aria-hidden="true"></span>`;
}

function renderGenericIcon(context) {
    const iconName = context.icon || 'sell';

    return context.component?.hasSlotContent?.('leading')
        ? context.component.getSlotContent('leading')
        : html`<i class="sf-icon sf-tag-icon" aria-hidden="true">${iconName}</i>`;
}

function renderColorIcon(context) {
    const extraClass = context.colorClass || '';

    return context.component?.hasSlotContent?.('leading')
        ? context.component.getSlotContent('leading')
        : html`<span class=${['sf-tag-color-icon', extraClass].filter(Boolean).join(' ')} aria-hidden="true"></span>`;
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
                    style=${`background-image: url(${context.avatarImageUrl});`}
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
      <i class="sf-icon">person</i>
    </span>
    `;
}

function renderLeading(context) {
    switch (context.type) {
        case 'checkbox':
            return renderCheckboxIcon(context);
        case 'icon':
            return renderGenericIcon(context);
        case 'color':
            return renderColorIcon(context);
        case 'avatar':
            return renderAvatar(context);
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

function renderClose(context) {
    if (!context.closable) return nothing;

    return context.component?.hasSlotContent?.('close')
        ? context.component.getSlotContent('close')
        : html`
                <sf-icon-button
                        kind="close"
                        size="${closeSize(context.size)}"
                        appearance="link"
                        scheme="on-surface"
                        ?disabled=${context.disabled}
                        aria-label=${context.closeLabel}
                        @click="${(e) => {
                            e.stopPropagation();
                            context.component.onClose();
                        }}"
                ></sf-icon-button>
        `;
}

export function renderTagTemplate(context) {
    const textContent = context.component?.hasSlotContent?.('text')
        ? context.component.getSlotContent('text')
        : context.text;

    const classes = [
        'sf-tag',
        // One class still carries both answers, because the styles are written
        // that way: a status wins when it is set, exactly as the single list did.
        `sf-tag--${context.status || context.kind || context.type}`,
        // A named appearance carries its own class, because it is a different axis
        // from the type: the default appearance adds nothing.
        context.appearance && context.appearance !== 'default' ? `sf-tag--appearance-${context.appearance}` : '',
        `sf-tag--size-${context.size}`,
        context.spacing && context.spacing !== 'normal' ? `spacing-${context.spacing}` : '',
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
                <button
                        type="button"
                        class="sf-tag-action inline-flex flex-row flex-nowrap items-center min-w-0"
                        aria-label=${context.ariaLabel || nothing}
                        aria-pressed=${String(context.active)}
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
                    ?disabled=${context.disabled}
                    @click=${() => context.component.onToggle()}
            >${content}</button>
        `;
    }

    if (context.interactive) {
        return html`
            <div
                    class=${classes.join(' ')}
                    style=${context.rootStyle || nothing}
            >
                <button
                        type="button"
                        class="sf-tag-action inline-flex flex-row flex-nowrap items-center min-w-0"
                        aria-label=${context.ariaLabel || nothing}
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
        >${content}</div>
    `;
}
