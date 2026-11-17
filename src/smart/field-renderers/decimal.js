// Decimal numbers as strings, never as floats (simai.property-view-port
// 1.18.0; Larena property types standard, notes of 2026-11-03: «Never a float
// on the wire»). What a person typed is read into a canonical decimal string,
// and a decimal, a money amount and a percent are shown in the page's language
// through Intl, which formats a string by its digits: «1500.10» never passes
// through a float on the way to «1 500,10 ₽». Pure, so the unit suite reads it
// without a browser. Money and percent are the Framework's in every mode
// (owner decision C291 (2)); the View set keeps its own copy of these rules
// for items, compound and ru.requisites.

import {intlFormatter} from '../../core/js/format-intl.js';
import {percentSign} from '../../core/js/format-number.js';

const TYPED = /^([+-]?)(\d*)(?:[.,](\d*))?$/u;
// Spaces a person or a formatter puts between groups of digits: the plain
// space, the no-break space and the narrow no-break space ru-RU writes, and
// the apostrophe some locales group with.
const GROUP_SPACES = /[\s  ']/gu;

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
// argue with a stored value. Only what reads as a decimal is formatted.
function decimalOf(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
    const read = readDecimal(value);
    return read.ok ? read.value : null;
}

/** A decimal string in the locale's digits, with every digit it has: «1 500,5». */
export function formatDecimal(value, locale) {
    const decimal = decimalOf(value);
    if (decimal === null) return '';
    const digits = Math.min(20, fractionDigits(decimal));
    return intlFormatter('NumberFormat', locale, {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal);
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

/**
 * An amount with its currency, as a person reads it: «1 500,50 ₽», «$1,500.50».
 * The digits after the point are at least the currency's minor units (ISO
 * 4217) and every digit the amount has. Without a currency, the amount alone.
 */
export function formatMoney(value, field = {}, locale = 'en') {
    const {amount, currency} = moneyParts(value, field.currency);
    const decimal = decimalOf(amount);
    if (decimal === null) return '';
    if (!currency) return formatDecimal(decimal, locale);
    const minor = intlFormatter('NumberFormat', locale, {style: 'currency', currency}).resolvedOptions().maximumFractionDigits ?? 2;
    const digits = Math.min(20, Math.max(minor, fractionDigits(decimal)));
    return intlFormatter('NumberFormat', locale, {style: 'currency', currency, currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal);
}

/** A percent, «12,5 %» or «12.5%»: the value is the percent ("20" is 20 %), never the share. */
export function formatPercent(value, locale = 'en') {
    const decimal = decimalOf(value);
    if (decimal === null) return '';
    const digits = Math.min(20, fractionDigits(decimal));
    // One spelling in every language (C203 (3)): «12,5 %», «12.5 %».
    return percentSign(intlFormatter('NumberFormat', locale, {style: 'unit', unit: 'percent',
        minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal));
}

// What the editors of money and percent need (owner decision C291 (2): the two
// types are the Framework's in every mode, the View set's editors were the
// reference): the sign and minor units of a currency, two decimals compared by
// their digits, and a decimal as it is typed back in an input.

/**
 * A currency in a locale: {sign, before, minor} -- the narrow sign the locale
 * writes («₽», «$»), whether it stands before the amount, and its ISO 4217
 * minor units (RUB 2, JPY 0, KWD 3). A code Intl does not know keeps its
 * letters, after the amount, with two minor digits.
 */
export function currencyOf(code, locale = 'en') {
    const fallback = {sign: String(code ?? ''), before: false, minor: 2};
    if (typeof code !== 'string' || !/^[A-Z]{3}$/u.test(code)) return fallback;
    try {
        const format = new Intl.NumberFormat(locale, {style: 'currency', currency: code, currencyDisplay: 'narrowSymbol'});
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
