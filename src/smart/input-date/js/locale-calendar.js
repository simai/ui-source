// What a locale says about its calendar, read from Intl once per locale: the
// first day of the week and the days off (Intl.Locale#getWeekInfo, the older
// weekInfo getter where a browser still has that). No DOM, so the rules are
// unit-tested as they are (tests/datepicker-c62.contract.test.mjs).
//
// Days are numbered as Date#getDay numbers them, 0 Sunday to 6 Saturday; Intl
// numbers them 1 Monday to 7 Sunday, so 7 is read as Sunday too.

const weekInfos = new Map();

function weekInfo(code) {
    if (weekInfos.has(code)) return weekInfos.get(code);
    let info = null;
    try {
        const locale = new Intl.Locale(code);
        info = (typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo) || null;
    } catch {
        // An unknown locale keeps the defaults below.
    }
    weekInfos.set(code, info);
    return info;
}

// The first day of the locale's week, read once per locale: the grid asks it
// several times a render. Monday where the locale does not say.
export function localeWeekStart(code) {
    const first = weekInfo(code)?.firstDay;
    return Number.isInteger(first) ? first % 7 : 1;
}

const SATURDAY_SUNDAY = Object.freeze([6, 0]);

// The locale's days off: Saturday and Sunday in ru, de and en-US, Friday and
// Saturday in ar-EG and he-IL. Saturday and Sunday where the locale does not say.
export function localeWeekend(code) {
    const days = weekInfo(code)?.weekend;
    if (!Array.isArray(days) || !days.length) return SATURDAY_SUNDAY;
    return Object.freeze(days.map((day) => day % 7));
}

// The `weekend` setting (owner decision C62: days off are red, and a product
// whose weekends are working days says so). Empty: the locale's days off.
// "none": no day is a day off. Otherwise the days, comma or space separated,
// 0 or 7 Sunday, 1 Monday to 6 Saturday ("6,7" as Intl writes Saturday and
// Sunday, "5,6" for Friday and Saturday). Anything else in the list is left
// out; a list with nothing left falls back to the locale.
export function weekendDays(setting, code) {
    const text = String(setting ?? '').trim().toLowerCase();
    if (!text) return new Set(localeWeekend(code));
    if (text === 'none') return new Set();
    const days = text.split(/[\s,]+/u)
        .filter((part) => /^[0-7]$/u.test(part))
        .map((part) => Number(part) % 7);
    return new Set(days.length ? days : localeWeekend(code));
}

// The date format of a locale, in the component's tokens (owner decision C62:
// typing follows the language and the country, not a fixed «ДД.ММ.ГГГГ»). The
// parts' order and the signs between them come from Intl alone:
// formatToParts of a two-digit day and month and a numeric year gives
// DD.MM.YYYY for ru and de, MM/DD/YYYY for en-US, DD/MM/YYYY for en-GB and fr,
// YYYY-MM-DD for sv-SE and en-CA. A sign before the first part or after the
// last («12.11.2026 г.» in bg, the closing dot of hu and ko) is left out: it is
// not between two numbers, and a person does not type it. Right-to-left marks
// are left out of the signs too. A locale Intl refuses, or a sign that is not
// one a date is typed with (. / - , or a space), keeps DD.MM.YYYY.
const DEFAULT_DATE_FORMAT = 'DD.MM.YYYY';
const PART_TOKENS = {day: 'DD', month: 'MM', year: 'YYYY'};
const dateFormats = new Map();

export function localeDateFormat(code) {
    if (dateFormats.has(code)) return dateFormats.get(code);
    let format = DEFAULT_DATE_FORMAT;
    try {
        const parts = new Intl.DateTimeFormat(code, {day: '2-digit', month: '2-digit', year: 'numeric'})
            .formatToParts(new Date(2026, 10, 12));
        const tokens = [];
        const signs = [];
        let sign = '';
        for (const part of parts) {
            if (part.type === 'literal') {
                sign += part.value.replace(/[\u200e\u200f\u061c]/gu, '');
            } else if (PART_TOKENS[part.type]) {
                if (tokens.length) signs.push(sign);
                tokens.push(PART_TOKENS[part.type]);
                sign = '';
            }
        }
        const whole = tokens.length === 3 && new Set(tokens).size === 3
            && signs.every((one) => /^[\s./,-]+$/u.test(one));
        if (whole) format = tokens.reduce((text, token, index) => text + (index ? signs[index - 1] : '') + token, '');
    } catch {
        // An unknown locale keeps the default.
    }
    dateFormats.set(code, format);
    return format;
}

// The hint in an empty field: the format written with the letters of the
// locale's own names for the parts (Intl.DisplayNames, type dateTimeField):
// ДД.ММ.ГГГГ in ru, MM/DD/YYYY in en-US, TT.MM.JJJJ in de, JJ/MM/AAAA in fr.
// A name in a script without letter case or initials (日, 年) gives the Latin
// D, M, Y, H instead.
const LATIN_LETTERS = {DD: 'D', MM: 'M', YYYY: 'Y', YY: 'Y', HH: 'H', mm: 'M'};
const FIELD_NAMES = {DD: 'day', MM: 'month', YYYY: 'year', YY: 'year', HH: 'hour', mm: 'minute'};
const INITIAL_RE = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u;
const placeholders = new Map();

function letterOf(token, code) {
    try {
        const name = new Intl.DisplayNames(code, {type: 'dateTimeField'}).of(FIELD_NAMES[token]) || '';
        const first = name.trim().charAt(0);
        if (INITIAL_RE.test(first)) return first.toLocaleUpperCase(code);
    } catch {
        // No names for this locale: the Latin letter below.
    }
    return LATIN_LETTERS[token];
}

export function formatPlaceholder(format, code) {
    const key = `${code}|${format}`;
    if (placeholders.has(key)) return placeholders.get(key);
    const text = String(format || '').replace(/YYYY|YY|MM|DD|HH|mm/gu,
        (token) => letterOf(token, code).repeat(token.length));
    placeholders.set(key, text);
    return text;
}
