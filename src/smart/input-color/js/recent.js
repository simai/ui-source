import BundledPreferences from '../../../core/js/preferences.js';
import {normaliseHex} from './color-math.js';

// The recent own colours (owner decision C83, round 4 R168). One list for every
// colour field of the site, kept as a view preference (SF.Preferences under
// sf-input-color/recent: the browser's copy, and the host's when one keeps
// preferences for its user), holding own colours only (a palette colour is
// always in the grid): lowercase #rrggbb, or #rrggbbaa below full alpha (the
// same hue at another alpha is another colour), newest first, a repeat moved
// to the top, sixteen kept and eight shown. Picking a recent colour counts as
// using it.
//
// Every bundle carries its own copy of this module, so the list and its
// listeners live on one shared global: two fields drawn by two bundles of the
// page still show the same row.
export const RECENT_KEY = 'sf-input-color/recent';
export const RECENT_KEEP = 16;
export const RECENT_SHOW = 8;

const SHARED = Symbol.for('sf.input-color.recent');
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;

function cleaned(saved) {
    const list = [];
    if (Array.isArray(saved)) {
        for (const item of saved) {
            const hex = normaliseHex(item);
            if (hex && !list.includes(hex)) list.push(hex);
        }
    }
    return list.slice(0, RECENT_KEEP);
}

function store() {
    const scope = globalThis;
    if (!scope[SHARED]) {
        const shared = {list: cleaned(preferences()?.read(RECENT_KEY)), listeners: new Set()};
        scope[SHARED] = shared;
        // Another tab, or the host's values arriving after the first paint.
        preferences()?.subscribe(RECENT_KEY, (value) => {
            shared.list.splice(0, shared.list.length, ...cleaned(value));
            tell();
        });
    }
    return scope[SHARED];
}

function save(list) {
    if (list.length) preferences()?.write(RECENT_KEY, list);
    else preferences()?.remove(RECENT_KEY);
}

function tell() {
    for (const listener of store().listeners) {
        try {
            listener();
        } catch (error) {
            console.error(error);
        }
    }
}

/** Puts an own colour at the top of the list. A palette name or a non-hex is ignored. */
export function rememberColour(value) {
    const hex = normaliseHex(value);
    if (!hex) return;
    const {list} = store();
    const at = list.indexOf(hex);
    if (at >= 0) list.splice(at, 1);
    list.unshift(hex);
    list.length = Math.min(list.length, RECENT_KEEP);
    save(list);
    tell();
}

export function forgetRecentColours() {
    store().list.length = 0;
    save([]);
    tell();
}

/**
 * The colours a field shows: without alpha it hides translucent ones -- it
 * cannot take that value, and a flattened lookalike would be another colour
 * than the one shown.
 */
export function recentColours({alpha = false} = {}) {
    return store().list.filter((hex) => alpha || hex.length === 7);
}

export function onRecentChange(listener) {
    const {listeners} = store();
    listeners.add(listener);
    return () => listeners.delete(listener);
}
