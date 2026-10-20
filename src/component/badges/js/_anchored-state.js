// What an anchored badge shows and what it says (simai/ui-source#12).
//
// A count or a dot sits on an avatar, an icon or an icon button. What it shows
// is decided here, once, for the ordinary runtime (_anchored.js, markup with
// data-count / data-dot) and for the Smart templates of sf-avatar, sf-icon and
// sf-icon-button, which import this file into their own bundles:
//
//   - a count above zero shows; 0 (or nothing, or a negative) hides the badge;
//   - a count above the cap shows as «<cap>+», 99+ by default; the cap is
//     configurable and the accessible name keeps the exact number;
//   - a dot shows when asked for and no count says otherwise;
//   - the phrase -- «3 непрочитанных», «есть новое» -- joins the anchor's
//     accessible name and is the badge's tooltip; the digits themselves are
//     hidden from assistive technology, so a number is never read on its own.
//
// Whether a count is drawn as a number or as a dot is the stylesheet's
// decision: on an anchor of 1/3 or 1/2 a count is a dot, whatever it says, and
// the number lives in the name and the tooltip alone.
import {pageLocale, pageText} from '../../../core/js/page-language.js';

// The words, by language. A count is one phrase per plural form, separated by
// «|» in the order of CLDR's categories -- one|few|many|other in Russian,
// one|other in English -- with {count} where the number goes. A product adds a
// language with SF.language.register('sf-badge', code, {count, dot}).
export const ANCHORED_BADGE_TEXT = {
    en: {
        count: '{count} unread',
        dot: 'new',
    },
    ru: {
        count: '{count} непрочитанное|{count} непрочитанных|{count} непрочитанных|{count} непрочитанного',
        dot: 'есть новое',
    },
};

export const ANCHORED_BADGE_COMPONENT = 'sf-badge';
export const DEFAULT_BADGE_CAP = 99;

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** A count as an integer, or null when nothing countable was given. */
export function badgeCount(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (text === '') return null;
    const number = Number(text);
    return Number.isFinite(number) ? Math.trunc(number) : null;
}

/** The cap: a whole number of at least 1, else 99. */
export function badgeCap(value) {
    const number = badgeCount(value);
    return number !== null && number >= 1 ? number : DEFAULT_BADGE_CAP;
}

/** A boolean attribute as written in markup: present, '', 'true' -- not 'false'. */
export function badgeFlag(value) {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    return String(value).trim().toLowerCase() !== 'false';
}

/**
 * The form of `forms` ("a|b|c") for `count` in `locale`. One form is used for
 * every number; with several, the n-th form answers the n-th plural category
 * the language has, and a category past the last form takes the last one.
 */
export function pluralForm(forms, count, locale = 'en') {
    const list = String(forms ?? '').split('|');
    if (list.length === 1) return list[0];
    try {
        const rules = new Intl.PluralRules(locale);
        const has = new Set(rules.resolvedOptions().pluralCategories);
        const categories = CATEGORIES.filter((category) => has.has(category));
        const index = categories.indexOf(rules.select(count));
        return list[Math.min(Math.max(index, 0), list.length - 1)];
    } catch {
        return list[list.length - 1];
    }
}

function formatNumber(count, locale) {
    try {
        return new Intl.NumberFormat(locale).format(count);
    } catch {
        return String(count);
    }
}

/**
 * The state of one anchored badge.
 *
 * `count`, `dot`, `cap` and `label` are what the author wrote; `node` is where
 * the badge is, for the page language. `label` replaces the default phrase: for
 * a dot it is the whole text equivalent («есть новое»), for a count it is the
 * phrase in the same «|»-separated plural forms, with {count} where the number
 * goes (a label without {count} is read after the number).
 *
 * Returns {visible, dot, text, phrase, count}: `text` is what the badge draws
 * (empty for a dot), `phrase` what joins the accessible name and the tooltip.
 */
export function anchoredBadgeState({count, dot, cap, label} = {}, node = null) {
    const number = badgeCount(count);
    const isDot = badgeFlag(dot);
    const locale = pageLocale(node);
    const custom = String(label ?? '').trim();

    if (number !== null) {
        if (number <= 0) {
            return {visible: false, dot: isDot, text: '', phrase: '', count: number};
        }
        const limit = badgeCap(cap);
        const forms = custom || pageText(ANCHORED_BADGE_TEXT, 'count', node, ANCHORED_BADGE_COMPONENT);
        const form = pluralForm(forms, number, locale);
        const formatted = formatNumber(number, locale);
        const phrase = form.includes('{count}')
            ? form.replaceAll('{count}', formatted)
            : `${formatted} ${form}`.trim();
        return {
            visible: true,
            dot: isDot,
            text: isDot ? '' : number > limit ? `${limit}+` : String(number),
            phrase,
            count: number,
        };
    }

    if (isDot) {
        return {
            visible: true,
            dot: true,
            text: '',
            phrase: custom || pageText(ANCHORED_BADGE_TEXT, 'dot', node, ANCHORED_BADGE_COMPONENT),
            count: null,
        };
    }

    return {visible: false, dot: false, text: '', phrase: '', count: null};
}

/** A name with the badge's phrase after it: «Анна Белова, 3 непрочитанных». */
export function nameWithBadge(name, phrase) {
    const base = String(name ?? '').trim();
    const extra = String(phrase ?? '').trim();
    if (!extra) return base;
    return base ? `${base}, ${extra}` : extra;
}

// The ladder step of a Smart sf-icon's anchor, from its icon size: the icon
// scale is not the control ladder. An icon of the scale's step 3 (the default,
// the 24-unit glyph) carries the small count, as a Material icon does; the
// smaller glyphs of rows and lines carry a dot; the large ones the larger counts.
const ICON_SIZE_STEP = {
    '1/4': '1/3', '1/3': '1/3', '1/2': '1/3', 1: '1/3',
    2: '1/2',
    3: '1',
    4: '2', 5: '2',
    6: '3', 7: '3',
};

export function iconBadgeStep(size) {
    return ICON_SIZE_STEP[String(size ?? '').trim()] || '1';
}
