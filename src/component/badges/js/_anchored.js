// The ordinary runtime of counts and dots (simai/ui-source#12).
//
// Markup alone is enough: a `.sf-badge` with `data-count` or `data-dot` is kept
// by this file wherever it is -- on an anchor (`sf-badge--anchored` inside an
// avatar, an icon button or a `.sf-badge-anchor`) or as a counter in a row --
// and a package component writes nothing but the attributes:
//
//   <span class="sf-badge sf-badge--anchored" data-count="3"></span>
//   <span class="sf-badge sf-badge--anchored" data-dot data-label="есть новое"></span>
//
// For each one it draws the number (capped, «99+» by default, `data-cap` to
// change it), hides the badge at 0, hides the digits from assistive technology,
// sets the phrase as the tooltip and joins it to the accessible name:
//
//   - an owner with an aria-label -- the badge's parent, or the link or button
//     around it -- gets «<its label>, <phrase>», and gets its own label back when
//     the badge hides; a label the owner rewrites later is taken as the new one;
//   - otherwise visually hidden words «, <phrase>» close the link or button
//     around the badge (or its parent, when there is none), so a name read from
//     content -- a link, a button, a row -- ends with it.
//
// The Smart sf-avatar, sf-icon and sf-icon-button draw their badges themselves
// (no data-count on them) and are not touched here. The words follow the page
// language and change with it.
import {language} from '../../../core/js/page-language';
import {anchoredBadgeState, badgeFlag, nameWithBadge} from './_anchored-state';

const SELECTOR = '.sf-badge[data-count], .sf-badge[data-dot]';
const TEXT_CLASS = 'sf-badge-anchored-text';
const OWNER_SELECTOR = 'a[href], button, [role="button"], [role="link"], [role="img"], [role="menuitem"], [role="tab"], [role="option"], [role="treeitem"]';
const OBSERVED = ['data-count', 'data-dot', 'data-cap', 'data-label', 'aria-label'];

// The owners whose aria-label this file has written: the label the author gave
// and the one written, so a label rewritten by its owner is recognised.
const OWNERS = new WeakMap();
// The hidden words of each badge whose name is read from content.
const TEXTS = new WeakMap();

function isElement(value) {
    return typeof Element !== 'undefined' && value instanceof Element;
}

function nameOwner(badge) {
    const parent = badge.parentElement;
    if (!parent) return null;
    if (parent.hasAttribute('aria-label') || OWNERS.has(parent)) return parent;
    const control = parent.closest(OWNER_SELECTOR);
    if (control && (control.hasAttribute('aria-label') || OWNERS.has(control))) return control;
    return null;
}

function stateOf(badge) {
    return anchoredBadgeState({
        count: badge.getAttribute('data-count'),
        dot: badge.hasAttribute('data-dot') ? badgeFlag(badge.getAttribute('data-dot')) : false,
        cap: badge.getAttribute('data-cap'),
        label: badge.getAttribute('data-label'),
    }, badge);
}

// Text a reader takes from a node, roughly: what is not hidden from it, the
// alternative text of images, and none of the badges' own parts.
function readableText(node, skip) {
    if (node.nodeType === 3) return node.textContent;
    if (!isElement(node) || node === skip) return '';
    if (node.getAttribute('aria-hidden') === 'true' || node.hidden) return '';
    if (getComputedStyle(node).display === 'none') return '';
    if (node.matches(`${SELECTOR}, .${TEXT_CLASS}`)) return '';
    if (node.matches('img')) return node.getAttribute('alt') || '';
    if (node.hasAttribute('aria-label')) return node.getAttribute('aria-label');
    return [...node.childNodes].map((child) => readableText(child, skip)).join(' ');
}

function updateOwner(owner) {
    const entry = OWNERS.get(owner) ?? {base: owner.getAttribute('aria-label') ?? '', written: null};
    const current = owner.getAttribute('aria-label') ?? '';
    if (entry.written !== null && current !== entry.written) entry.base = current;
    const phrases = [...owner.querySelectorAll(SELECTOR)]
        .filter((badge) => nameOwner(badge) === owner)
        .map((badge) => stateOf(badge))
        .filter((state) => state.visible)
        .map((state) => state.phrase);
    const next = phrases.reduce((name, phrase) => nameWithBadge(name, phrase), entry.base);
    entry.written = next;
    OWNERS.set(owner, entry);
    if (current !== next) owner.setAttribute('aria-label', next);
}

// Where a badge's hidden words go: at the end of the link or button around
// it, so they close its name, else at the end of the badge's parent.
function textNode(badge) {
    const host = badge.parentElement.closest(OWNER_SELECTOR) || badge.parentElement;
    let node = TEXTS.get(badge);
    if (!node) {
        node = document.createElement('span');
        node.className = TEXT_CLASS;
        TEXTS.set(badge, node);
    }
    if (node.parentElement !== host || node !== host.lastElementChild) host.append(node);
    return node;
}

function dropText(badge) {
    TEXTS.get(badge)?.remove();
    TEXTS.delete(badge);
}

export function updateAnchoredBadge(badge) {
    if (!isElement(badge) || !badge.matches(SELECTOR)) return;
    const state = stateOf(badge);
    const explicitDot = badge.hasAttribute('data-dot') && badgeFlag(badge.getAttribute('data-dot'));

    badge.hidden = !state.visible;
    badge.classList.toggle('sf-badge--dot', explicitDot);
    if (badge.textContent !== state.text) badge.textContent = state.text;
    if (badge.getAttribute('aria-hidden') !== 'true') badge.setAttribute('aria-hidden', 'true');
    if (state.visible && state.phrase) badge.setAttribute('title', state.phrase);
    else badge.removeAttribute('title');

    const owner = nameOwner(badge);
    if (owner) {
        dropText(badge);
        updateOwner(owner);
        return;
    }
    if (!badge.parentElement) return;
    const words = state.visible ? state.phrase : '';
    if (!words) {
        dropText(badge);
        return;
    }
    const node = textNode(badge);
    const said = readableText(node.parentElement, badge).trim() ? `, ${words}` : words;
    if (node.textContent !== said) node.textContent = said;
}

export function initAnchoredBadges(scope = document) {
    if (!scope) return;
    if (isElement(scope) && scope.matches(SELECTOR)) updateAnchoredBadge(scope);
    scope.querySelectorAll?.(SELECTOR).forEach(updateAnchoredBadge);
}

let observer = null;

function boot() {
    if (observer || typeof MutationObserver === 'undefined') return;
    initAnchoredBadges(document);
    observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (mutation.attributeName === 'aria-label') {
                    const entry = OWNERS.get(target);
                    if (entry && target.getAttribute('aria-label') !== entry.written) updateOwner(target);
                    continue;
                }
                if (target.matches?.(SELECTOR)) updateAnchoredBadge(target);
                else if (target.matches?.('.sf-badge')) {
                    // The last attribute went: the badge is no longer kept here.
                    target.hidden = false;
                    dropText(target);
                    const owner = target.parentElement && (OWNERS.has(target.parentElement) ? target.parentElement : target.parentElement.closest(OWNER_SELECTOR));
                    if (owner && OWNERS.has(owner)) updateOwner(owner);
                }
                continue;
            }
            mutation.removedNodes.forEach((node) => {
                if (!isElement(node) || node.classList.contains(TEXT_CLASS)) return;
                // A badge taken out of the page takes its hidden words with it.
                const gone = node.matches(SELECTOR) ? [node] : [...node.querySelectorAll(SELECTOR)];
                gone.forEach((badge) => { if (!badge.isConnected) dropText(badge); });
            });
            mutation.addedNodes.forEach((node) => {
                if (isElement(node) && !node.classList.contains(TEXT_CLASS)) initAnchoredBadges(node);
            });
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: OBSERVED,
    });
    language.onChange?.(() => initAnchoredBadges(document));
}

if (typeof window !== 'undefined') {
    window.SF = window.SF || {};
    window.SF.AnchoredBadge = window.SF.AnchoredBadge || {
        init: initAnchoredBadges,
        update: updateAnchoredBadge,
        state: anchoredBadgeState,
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, {once: true});
    } else {
        boot();
    }
}
