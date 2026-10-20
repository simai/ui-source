// The anchored badge of sf-avatar, sf-icon and sf-icon-button
// (simai/ui-source#12): the badge inputs read the same way on each, the same
// state as the ordinary runtime's, and the same markup, which the badge sheet
// (component/badges) places on the anchor. The element draws its badge
// itself, so the badge carries no data-count and the runtime leaves it alone.
import {html, nothing} from 'lit';
import {anchoredBadgeState, nameWithBadge} from '../../component/badges/js/_anchored-state';

// Every anchor declares the same four props -- badgeCount, badgeDot, badgeCap
// (99) and badgeLabel -- read from badge-count, badge-dot, badge-cap and
// badge-label.
export const ANCHORED_BADGE_ATTRIBUTES = Object.freeze(['badge-count', 'badge-dot', 'badge-cap', 'badge-label']);

/** What the element's badge shows and says, from its badge inputs. */
export function elementBadge(element) {
    const state = anchoredBadgeState({
        count: element.getProp?.('badgeCount'),
        dot: element.getProp?.('badgeDot'),
        cap: element.getProp?.('badgeCap'),
        label: element.getProp?.('badgeLabel'),
    }, element);
    // The sheet that places it comes with the badges component; an element
    // whose rule fetches it lazily asks for it when there is a badge to show.
    if (state.visible) globalThis.SF?.Loader?.ensurePlugin?.('badges');
    return state;
}

/** Whether there is a badge to draw. */
export function hasBadge(badge) {
    return Boolean(badge?.visible);
}

/** The badge itself: the digits and the dot hidden from assistive technology. */
export function renderAnchoredBadge(badge) {
    if (!badge?.visible) return nothing;
    return html`<span
        class="sf-badge sf-badge--anchored${badge.dot ? ' sf-badge--dot' : ''}"
        aria-hidden="true"
        title=${badge.phrase || nothing}
    >${badge.text}</span>`;
}

/** The phrase for a name read from content, out of sight. */
export function renderAnchoredBadgeText(badge, after = true) {
    if (!badge?.visible || !badge.phrase) return nothing;
    return html`<span class="sf-badge-anchored-text">${after ? ', ' : ''}${badge.phrase}</span>`;
}

export {nameWithBadge};
