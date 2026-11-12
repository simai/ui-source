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
