// Decimal numbers as strings, never as floats (simai.property-view-port
// 1.18.0; Larena property types standard, notes of 2026-11-03: «Never a float
// on the wire»). What a person typed is read into a canonical decimal string,
// and a decimal, a money amount and a percent are shown in the page's language
// through Intl, which formats a string by its digits: «1500.10» never passes
// through a float on the way to «1 500,10 ₽». Pure, so the unit suite reads it
// without a browser. Money and percent are the Framework's in every mode
// (owner decision C291 (2)) and their display, paste and totals follow owner
// decision C294 (2026-11-17, MP-1..MP-12): the standard sign, never the
// narrow one; a minus and nothing else for a negative; the amount and its
// sign never broken apart; a direction mark on a right-to-left page; what a
// person pastes («1 234,50 ₽», «$1,234.50») read as a decimal string. The
// View set's items, compound and ru.requisites call these functions instead
// of keeping a copy.

import {intlFormatter} from '../../core/js/format-intl.js';
import {percentSign} from '../../core/js/format-number.js';

const TYPED = /^([+-]?)(\d*)(?:[.,](\d*))?$/u;
// Spaces a person or a formatter puts between groups of digits: the plain
// space, the no-break space and the narrow no-break space ru-RU writes, and
// the apostrophe some locales group with.
const GROUP_SPACES = /[\s\u00a0\u202f']/gu;

/**
 * What a person typed, read as a decimal: `{ok: true, value}` with the
 * canonical string (an optional minus, the integer digits without leading
 * zeros, the fraction digits as typed; null for nothing typed), or
 * `{ok: false}` for text that is not a number. A comma and a point both
 * separate the fraction. A JSON integer is read as its digits; a float is not
 * a decimal and is refused rather than guessed at.
 */
export function readDecimal(text) {
    if (text === null || typeof text === 'undefined') return {ok: true, value: null};
    if (typeof text === 'number') {
        return Number.isSafeInteger(text) ? {ok: true, value: String(text)} : {ok: false};
    }
    const plain = String(text).replace(GROUP_SPACES, '');
    if (plain === '') return {ok: true, value: null};
    const match = TYPED.exec(plain);
    if (!match) return {ok: false};
    const [, sign, whole, fraction] = match;
    if (whole === '' && (fraction ?? '') === '') return {ok: false};
    const integer = whole.replace(/^0+(?=\d)/u, '') || '0';
    const digits = fraction ?? '';
    const zero = /^0*$/u.test(integer + digits);
    return {ok: true, value: `${sign === '-' && !zero ? '-' : ''}${integer}${digits ? `.${digits}` : ''}`};
}

/** How many digits a canonical decimal string has after its point. */
export function fractionDigits(value) {
    const at = String(value ?? '').indexOf('.');
    return at === -1 ? 0 : String(value).length - at - 1;
}

// A float a host sent anyway is shown, not refused: a cell is not the place to
// argue with a stored value. Only what reads as a decimal is formatted. A
// float that is not a whole number is rounded to `digits` when they are given
// (a currency's minor units, a percent's six) -- 0.1 + 0.2 roubles are
// «0,30 ₽», never «0,30000000000000004 ₽» (MP-2) -- and the page hears it once
// in the console: the value should have been a decimal string.
const FLOAT_WARNED = new Set();

function warnFloat(kind) {
    if (FLOAT_WARNED.has(kind)) return;
    FLOAT_WARNED.add(kind);
    globalThis.console?.warn?.(`SF.fieldRenderers: a ${kind} value came as a number; send a decimal string ("1500.5"), a float loses digits.`);
}

function decimalOf(value, digits = null, kind = 'number') {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        if (Number.isInteger(value)) return Number.isSafeInteger(value) ? String(value) : BigInt(value).toString();
        if (!Number.isInteger(digits)) return String(value);
        warnFloat(kind);
        return readDecimal(value.toFixed(Math.min(20, digits)).replace(/(\.\d*?)0+$/u, '$1').replace(/\.$/u, '')).value;
    }
    const read = readDecimal(value);
    return read.ok ? read.value : null;
}

// Right-to-left languages: a number drawn there starts with the right-to-left
// mark, so a minus, a sign or a «%» never jumps to the other end of the line
// (C294, MP-9). Intl writes the mark for a negative already; the positive
// amount had none.
const RTL_LANGUAGES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'yi', 'dv', 'ckb', 'sd', 'ug']);
const DIRECTION_MARKS = /[\u200e\u200f\u061c\u2066-\u2069]/gu;

export function isRtlLocale(locale) {
    return RTL_LANGUAGES.has(String(locale || '').toLowerCase().split(/[-_]/u)[0]);
}

// On a right-to-left page a sign that ends in a neutral mark («US$», «CA$»)
// is isolated left to right (U+2066 .. U+2069), or the browser draws «$US»; a
// percent is held left to right as a whole («12.5 %»), as Intl's Arabic
// pattern holds «12.5%» with its marks.
function directed(text, locale, {wholeLtr = false} = {}) {
    if (!text || !isRtlLocale(locale)) return text;
    if (wholeLtr) return `\u200f\u200e${text.replace(DIRECTION_MARKS, '')}\u200e`;
    const glued = text.replace(/[A-Za-z]+[^\sA-Za-z\d\u00a0\u202f\u200e\u200f\u061c\u2066-\u2069.,\u066b\u066c-]+/gu, '\u2066$&\u2069');
    return glued.startsWith('\u200f') ? glued : `\u200f${glued}`;
}

// The amount and its sign stay on one line: every plain space Intl leaves
// between them becomes a no-break one (ru, de write U+00A0 already).
const unbroken = (text) => text.replace(/ /gu, '\u00a0');

/**
 * A decimal string in the locale's digits and groups, with every digit it has
 * and at least `minDigits`: «1 500,5», «1 234 567,5» (the Number type, MP-5;
 * money and percent use the same groups). A float that is not whole keeps at
 * most six digits.
 */
export function formatDecimal(value, locale, {minDigits = 0} = {}) {
    const decimal = decimalOf(value, 6);
    if (decimal === null) return '';
    const digits = Math.min(20, Math.max(minDigits, fractionDigits(decimal)));
    return directed(unbroken(intlFormatter('NumberFormat', locale, {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal)), locale);
}

/** A money value as {amount, currency}; a field that fixes the currency takes a bare amount. */
export function moneyParts(value, fixed) {
    const currency = typeof fixed === 'string' && fixed ? fixed : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {amount: value.amount ?? null, currency: currency || (value.currency ?? null)};
    }
    if (value === null || typeof value === 'undefined' || value === '') return {amount: null, currency};
    return {amount: value, currency};
}

// How a field names its currency (C294, q-mp-sign): Intl's standard sign
// (`symbol`, the default) -- «₽» on a Russian page, «$» for the US dollar on an
// English one and «CA$» for the Canadian dollar, so two currencies never read
// the same -- or the code (`code`, for accounting and exports) or the name
// (`name`). The narrow sign wrote USD, CAD and AUD all as «$» (MP-3): a field
// asking for it gets the standard sign.
export const CURRENCY_DISPLAYS = Object.freeze(['symbol', 'code', 'name']);

export function currencyDisplayOf(field = {}) {
    return CURRENCY_DISPLAYS.includes(field?.currencyDisplay) ? field.currencyDisplay : 'symbol';
}

/** ISO 4217 minor units of a currency (RUB 2, JPY 0, KWD 3); 2 for a code Intl does not know. */
export function minorUnits(currency) {
    try {
        return new Intl.NumberFormat('en', {style: 'currency', currency}).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
        return 2;
    }
}

/**
 * An amount with its currency, as a person reads it: «1 500,50 ₽», «$1,500.50»,
 * «CA$10.00» (C294). The digits after the point are at least the currency's
 * minor units (ISO 4217) and every digit the amount has; a float is rounded
 * to the minor units, with one console warning. A negative amount has the
 * minus where the language writes it and nothing else -- no colour, no
 * brackets (q-mp-negative). The amount and the sign never break apart, and a
 * right-to-left page gets the direction mark. Without a currency, the amount
 * alone.
 */
export function formatMoney(value, field = {}, locale = 'en') {
    const {amount, currency} = moneyParts(value, field.currency);
    const minor = currency ? minorUnits(currency) : 2;
    const decimal = decimalOf(amount, minor, 'money');
    if (decimal === null) return '';
    if (!currency) return formatDecimal(decimal, locale);
    const digits = Math.min(20, Math.max(minor, fractionDigits(decimal)));
    return directed(unbroken(intlFormatter('NumberFormat', locale, {style: 'currency', currency, currencyDisplay: currencyDisplayOf(field),
        minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal)), locale);
}

/**
 * A percent, «12,5 %» and «12.5 %»: the value is the percent ("20" is 20 %),
 * never the share -- the share is SF.format's word `share` (MP-4). One
 * spelling in every language (C203 (3)): the number, a no-break space, «%».
 * A float keeps at most six digits, with one console warning.
 */
export function formatPercent(value, locale = 'en') {
    const decimal = decimalOf(value, 6, 'percent');
    if (decimal === null) return '';
    const digits = Math.min(20, fractionDigits(decimal));
    return directed(percentSign(intlFormatter('NumberFormat', locale, {style: 'unit', unit: 'percent',
        minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal)), locale, {wholeLtr: true});
}

/** The sum of decimal strings, by their digits (a column total): "1500.5" + "0.75" is "1501.25"; null when one is not a decimal. */
export function addDecimal(...values) {
    let scale = 0;
    const read = [];
    for (const value of values.flat()) {
        if (value === null || value === undefined || value === '') continue;
        const one = decimalOf(value, 20);
        if (one === null) return null;
        read.push(one);
        scale = Math.max(scale, fractionDigits(one));
    }
    let total = 0n;
    for (const one of read) {
        const negative = one.startsWith('-');
        const [whole, fraction = ''] = one.replace('-', '').split('.');
        const units = BigInt(whole + fraction.padEnd(scale, '0'));
        total += negative ? -units : units;
    }
    const negative = total < 0n;
    const digits = (negative ? -total : total).toString().padStart(scale + 1, '0');
    const whole = digits.slice(0, digits.length - scale) || '0';
    const fraction = scale ? digits.slice(-scale).replace(/0+$/u, '') : '';
    const zero = /^0*$/u.test(whole + fraction);
    return `${negative && !zero ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/**
 * A money column's total (C294): the amounts added by their digits, one sum
 * per currency, in the order the currencies first appear -- a column of
 * dollars and euros is two sums, never one. [{currency, amount, text}];
 * values that are not money are left out.
 */
export function moneyTotals(values = [], field = {}, locale = 'en') {
    const sums = new Map();
    for (const value of values) {
        const {amount, currency} = moneyParts(value, field.currency);
        const decimal = decimalOf(amount, currency ? minorUnits(currency) : null);
        if (decimal === null) continue;
        const key = currency ?? '';
        sums.set(key, addDecimal(sums.get(key) ?? '0', decimal));
    }
    return [...sums].map(([currency, amount]) => ({
        currency: currency || null,
        amount,
        text: formatMoney(currency ? {amount, currency} : amount, {currencyDisplay: field.currencyDisplay}, locale),
    }));
}

// What a person pastes or types, read as a decimal (C294, MP-8). Arabic-Indic
// digits and separators are read as ASCII; the currency's signs and code,
// «%», spaces, apostrophes and direction marks are dropped; a minus may stand
// before or after the digits. With both a point and a comma the last one
// separates the fraction; a separator that repeats groups; a single one is
// the fraction, unless it is the page's group separator followed by exactly
// three digits -- «1,234» on an English page is 1234, on a Russian one 1,234.
const CURRENCY_MARKS = /[$€£¥₽₸₴₺₹₩₪₦₱฿₫¤]/gu;

function signsOf(currency, locale) {
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/u.test(currency)) return [];
    const signs = new Set([currency]);
    for (const display of ['symbol', 'narrowSymbol', 'code', 'name']) {
        try {
            for (const part of new Intl.NumberFormat(locale, {style: 'currency', currency, currencyDisplay: display}).formatToParts(2)) {
                if (part.type === 'currency') signs.add(part.value);
            }
        } catch {
            // A code Intl does not know keeps its letters only.
        }
    }
    return [...signs].sort((a, b) => b.length - a.length);
}

function separatorsOf(locale) {
    try {
        const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
        return {
            group: parts.find((part) => part.type === 'group')?.value ?? ',',
            decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
        };
    } catch {
        return {group: ',', decimal: '.'};
    }
}

/**
 * `{ok: true, value, typedDigits}` for what reads as a number -- the canonical
 * decimal string (no groups, a point, no trailing zeros after it; null for
 * nothing typed) and how many digits were typed after the separator -- or
 * `{ok: false}`. `currency` names the code whose signs may stand in the text.
 */
export function readTypedDecimal(text, {locale = 'en', currency = null} = {}) {
    if (text === null || text === undefined) return {ok: true, value: null, typedDigits: 0};
    if (typeof text === 'number') {
        const read = readDecimal(Number.isInteger(text) ? text : String(text));
        return read.ok ? {ok: true, value: read.value, typedDigits: fractionDigits(read.value ?? '')} : {ok: false};
    }
    let plain = String(text)
        .replace(/[\u0660-\u0669]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
        .replace(/[\u06f0-\u06f9]/gu, (digit) => String(digit.charCodeAt(0) - 0x6f0))
        .replace(/\u066b/gu, '.')
        .replace(/\u066c/gu, '');
    for (const sign of signsOf(currency, locale)) plain = plain.split(sign).join('');
    plain = plain
        .replace(CURRENCY_MARKS, '')
        .replace(/[%\u066a]/gu, '')
        .replace(DIRECTION_MARKS, '')
        .replace(/[\s\u00a0\u202f'\u2019]/gu, '')
        .replace(/[\u2212\u2013]/gu, '-');
    if (plain === '') return {ok: true, value: null, typedDigits: 0};
    let negative = false;
    if (plain.startsWith('-')) {
        negative = true;
        plain = plain.slice(1);
    } else if (plain.startsWith('+')) {
        plain = plain.slice(1);
    } else if (plain.endsWith('-')) {
        negative = true;
        plain = plain.slice(0, -1);
    }
    const dots = (plain.match(/\./gu) || []).length;
    const commas = (plain.match(/,/gu) || []).length;
    if (dots && commas) {
        const mark = plain.charAt(Math.max(plain.lastIndexOf('.'), plain.lastIndexOf(',')));
        plain = plain.split(mark === '.' ? ',' : '.').join('');
        if (mark === ',') plain = plain.replace(',', '.');
    } else if (dots + commas > 1) {
        plain = plain.split(dots ? '.' : ',').join('');
    } else if (dots + commas === 1) {
        const mark = dots ? '.' : ',';
        const after = plain.length - plain.indexOf(mark) - 1;
        if (mark === separatorsOf(locale).group && after === 3) plain = plain.replace(mark, '');
        else plain = plain.replace(',', '.');
    }
    if (!/^\d*(?:\.\d*)?$/u.test(plain) || !/\d/u.test(plain)) return {ok: false};
    const [whole = '', fraction = ''] = plain.split('.');
    const integer = whole.replace(/^0+(?=\d)/u, '') || '0';
    const digits = fraction.replace(/0+$/u, '');
    const zero = /^0*$/u.test(integer + digits);
    return {ok: true, value: `${negative && !zero ? '-' : ''}${integer}${digits ? `.${digits}` : ''}`, typedDigits: fraction.length};
}

/** A decimal at rest in an edit field: the locale's groups and point, at least `minDigits` after it, no sign («1 500,50»). */
export function restingDecimal(value, locale = 'en', minDigits = 0) {
    const read = readDecimal(value);
    if (!read.ok || read.value === null) return '';
    const digits = Math.min(20, Math.max(minDigits, fractionDigits(read.value)));
    return unbroken(intlFormatter('NumberFormat', locale, {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(read.value));
}

/** Every ISO 4217 code the browser knows, for a currency field that names no list; the ten offered codes where Intl cannot list them. */
export function currencyCodes(fallback = []) {
    try {
        const codes = Intl.supportedValuesOf?.('currency');
        if (Array.isArray(codes) && codes.length) return codes;
    } catch {
        // An older engine: the offered list.
    }
    return [...fallback];
}

// What the editors of money and percent need (owner decision C291 (2): the two
// types are the Framework's in every mode, the View set's editors were the
// reference): the sign and minor units of a currency, two decimals compared by
// their digits, and a decimal as it is typed back in an input.

/**
 * A currency in a locale: {sign, before, minor} -- the sign the locale writes
 * by the field's `currencyDisplay` (the standard sign by default: «₽», «$»,
 * «CA$»; C294), whether it stands before the amount, and its ISO 4217 minor
 * units (RUB 2, JPY 0, KWD 3). A code Intl does not know keeps its letters,
 * after the amount, with two minor digits.
 */
export function currencyOf(code, locale = 'en', display = 'symbol') {
    const fallback = {sign: String(code ?? ''), before: false, minor: 2};
    if (typeof code !== 'string' || !/^[A-Z]{3}$/u.test(code)) return fallback;
    try {
        const format = new Intl.NumberFormat(locale, {style: 'currency', currency: code,
            currencyDisplay: CURRENCY_DISPLAYS.includes(display) ? display : 'symbol'});
        const parts = format.formatToParts(1);
        const at = parts.findIndex((part) => part.type === 'currency');
        if (at === -1) return fallback;
        return {
            sign: parts[at].value,
            before: at < parts.findIndex((part) => part.type === 'integer'),
            minor: format.resolvedOptions().maximumFractionDigits ?? 2,
        };
    } catch {
        return fallback;
    }
}

/** -1, 0 or 1: two decimals (canonical strings or integers) compared by their digits, never as floats; null when either is not a decimal. */
export function compareDecimal(a, b) {
    const left = readDecimal(a);
    const right = readDecimal(b);
    if (!left.ok || !right.ok || left.value === null || right.value === null) return null;
    const scale = Math.max(fractionDigits(left.value), fractionDigits(right.value));
    const units = (value) => {
        const negative = value.startsWith('-');
        const [whole, fraction = ''] = value.replace('-', '').split('.');
        const digits = BigInt(whole + fraction.padEnd(scale, '0'));
        return negative ? -digits : digits;
    };
    const x = units(left.value);
    const y = units(right.value);
    return x === y ? 0 : (x < y ? -1 : 1);
}

/** A decimal as typed back into an input: the locale's point, no groups («1500,5» on a Russian page); '' for nothing or not a decimal. */
export function editableDecimal(value, locale = 'en') {
    const read = readDecimal(value);
    if (!read.ok || read.value === null) return '';
    let point = '.';
    try {
        point = intlFormatter('NumberFormat', locale, {}).formatToParts(1.5).find((part) => part.type === 'decimal')?.value || '.';
    } catch {
        point = '.';
    }
    return read.value.replace('.', point);
}
