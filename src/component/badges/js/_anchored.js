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
//
// One runtime per page, whatever number of copies of this file run
// (simai/ui-source#12 follow-up). The Loader inserted the badges script once
// per plugin naming it, and a page or another bundle may include it again;
// each copy had its own observer and its own memory of the names it wrote, so
// each took another copy's write for the author's label and appended the
// phrase again -- thousands of writes, then a crashed tab. Now the first copy
// installs the runtime on a shared global (Symbol.for, not module scope: each
// bundle carries its own module copy) and every later copy uses that one: one
// boot, one observer, one memory of names and hidden words. A name is written
// only when it differs from what is there, so the observer's own write ends
// the round.
import {language} from '../../../core/js/page-language';
import {anchoredBadgeState, badgeFlag, nameWithBadge} from './_anchored-state';

const SELECTOR = '.sf-badge[data-count], .sf-badge[data-dot]';
const TEXT_CLASS = 'sf-badge-anchored-text';
const OWNER_SELECTOR = 'a[href], button, [role="button"], [role="link"], [role="img"], [role="menuitem"], [role="tab"], [role="option"], [role="treeitem"]';
const OBSERVED = ['data-count', 'data-dot', 'data-cap', 'data-label', 'aria-label'];
const SHARED = Symbol.for('simai.sf.anchoredBadges');

function isElement(value) {
    return typeof Element !== 'undefined' && value instanceof Element;
}

function stateOf(badge) {
    return anchoredBadgeState({
        count: badge.getAttribute('data-count'),
        dot: badge.hasAttribute('data-dot') ? badgeFlag(badge.getAttribute('data-dot')) : false,
        cap: badge.getAttribute('data-cap'),
        label: badge.getAttribute('data-label'),
    }, badge);
}

// A name with the phrases it may already carry taken off its end: a label
// that comes back with a phrase on it -- copied from the attribute, or written
// by a copy of this file from before it was shared -- is not taken for the
// author's.
function withoutPhrases(name, phrases) {
    let base = String(name ?? '');
    let changed = true;
    while (changed) {
        changed = false;
        for (const phrase of phrases) {
            if (!phrase) continue;
            const tail = `, ${phrase}`;
            if (base.endsWith(tail)) {
                base = base.slice(0, -tail.length);
                changed = true;
            } else if (base.trim() === phrase.trim()) {
                base = '';
                changed = true;
            }
        }
    }
    return base;
}

function createRuntime() {
    // The owners whose aria-label this runtime has written: the label the
    // author gave and the one written, so a label rewritten by its owner is
    // recognised.
    const owners = new WeakMap();
    // The hidden words of each badge whose name is read from content.
    const texts = new WeakMap();
    let observer = null;

    function nameOwner(badge) {
        const parent = badge.parentElement;
        if (!parent) return null;
        if (parent.hasAttribute('aria-label') || owners.has(parent)) return parent;
        const control = parent.closest(OWNER_SELECTOR);
        if (control && (control.hasAttribute('aria-label') || owners.has(control))) return control;
        return null;
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
        const current = owner.getAttribute('aria-label') ?? '';
        const phrases = [...owner.querySelectorAll(SELECTOR)]
            .filter((badge) => nameOwner(badge) === owner)
            .map((badge) => stateOf(badge))
            .filter((state) => state.visible)
            .map((state) => state.phrase);
        let entry = owners.get(owner);
        if (!entry) {
            entry = {base: withoutPhrases(current, phrases), written: null};
            owners.set(owner, entry);
        } else if (entry.written !== null && current !== entry.written) {
            // The owner wrote a new label of its own.
            entry.base = withoutPhrases(current, phrases);
        }
        const next = phrases.reduce((name, phrase) => nameWithBadge(name, phrase), entry.base);
        entry.written = next;
        if (current !== next) owner.setAttribute('aria-label', next);
    }

    // Where a badge's hidden words go: at the end of the link or button around
    // it, so they close its name, else at the end of the badge's parent.
    function textNode(badge) {
        const host = badge.parentElement.closest(OWNER_SELECTOR) || badge.parentElement;
        let node = texts.get(badge);
        if (!node) {
            node = document.createElement('span');
            node.className = TEXT_CLASS;
            texts.set(badge, node);
        }
        if (node.parentElement !== host || node !== host.lastElementChild) host.append(node);
        return node;
    }

    function dropText(badge) {
        texts.get(badge)?.remove();
        texts.delete(badge);
    }

    function update(badge) {
        if (!isElement(badge) || !badge.matches(SELECTOR)) return;
        const state = stateOf(badge);
        const explicitDot = badge.hasAttribute('data-dot') && badgeFlag(badge.getAttribute('data-dot'));

        if (badge.hidden !== !state.visible) badge.hidden = !state.visible;
        if (badge.classList.contains('sf-badge--dot') !== explicitDot) badge.classList.toggle('sf-badge--dot', explicitDot);
        if (badge.textContent !== state.text) badge.textContent = state.text;
        if (badge.getAttribute('aria-hidden') !== 'true') badge.setAttribute('aria-hidden', 'true');
        const title = state.visible && state.phrase ? state.phrase : null;
        if (badge.getAttribute('title') !== title) {
            if (title) badge.setAttribute('title', title);
            else badge.removeAttribute('title');
        }

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

    function init(scope = document) {
        if (!scope) return;
        if (isElement(scope) && scope.matches(SELECTOR)) update(scope);
        scope.querySelectorAll?.(SELECTOR).forEach(update);
    }

    function boot() {
        if (observer || typeof MutationObserver === 'undefined') return;
        init(document);
        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (mutation.attributeName === 'aria-label') {
                        const entry = owners.get(target);
                        if (entry && target.getAttribute('aria-label') !== entry.written) updateOwner(target);
                        continue;
                    }
                    if (target.matches?.(SELECTOR)) update(target);
                    else if (target.matches?.('.sf-badge')) {
                        // The last attribute went: the badge is no longer kept here.
                        if (target.hidden) target.hidden = false;
                        dropText(target);
                        const owner = target.parentElement && (owners.has(target.parentElement) ? target.parentElement : target.parentElement.closest(OWNER_SELECTOR));
                        if (owner && owners.has(owner)) updateOwner(owner);
                    }
                    continue;
                }
                mutation.removedNodes.forEach((node) => {
                    if (!isElement(node) || node.classList.contains(TEXT_CLASS)) return;
                    // A badge taken out of the page takes its hidden words with
                    // it, and its owner gets its own name back.
                    const gone = node.matches(SELECTOR) ? [node] : [...node.querySelectorAll(SELECTOR)];
                    gone.forEach((badge) => { if (!badge.isConnected) dropText(badge); });
                    const target = mutation.target;
                    if (gone.length && isElement(target) && target.isConnected) {
                        const owner = owners.has(target) ? target : target.closest(OWNER_SELECTOR);
                        if (owner && owners.has(owner)) updateOwner(owner);
                    }
                });
                mutation.addedNodes.forEach((node) => {
                    if (isElement(node) && !node.classList.contains(TEXT_CLASS)) init(node);
                });
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: OBSERVED,
        });
        language.onChange?.(() => init(document));
    }

    return {init, update, boot, booted: () => Boolean(observer)};
}

// The runtime of the page: the first copy's, for every copy.
function sharedRuntime() {
    const scope = globalThis;
    if (!scope[SHARED]) {
        Object.defineProperty(scope, SHARED, {value: createRuntime(), configurable: true});
    }
    return scope[SHARED];
}

export function updateAnchoredBadge(badge) {
    sharedRuntime().update(badge);
}

export function initAnchoredBadges(scope = document) {
    sharedRuntime().init(scope);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const runtime = sharedRuntime();
    window.SF = window.SF || {};
    window.SF.AnchoredBadge = window.SF.AnchoredBadge || {
        init: runtime.init,
        update: runtime.update,
        state: anchoredBadgeState,
    };
    if (!runtime.booted()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runtime.boot, {once: true});
        } else {
            runtime.boot();
        }
    }
}
