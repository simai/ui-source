// Decimal numbers as strings, never as floats (simai.property-view-port
// 1.18.0; Larena property types standard, notes of 2026-11-03: «Never a float
// on the wire»). What a person typed is read into a canonical decimal string,
// and a decimal, a money amount and a percent are shown in the page's language
// through Intl, which formats a string by its digits: «1500.10» never passes
// through a float on the way to «1 500,10 ₽». Pure, so the unit suite reads it
// without a browser; the View set draws the editors of money, percent and
// items with its own copy of the same rules.

import {intlFormatter} from '../../core/js/format-intl.js';

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
    return intlFormatter('NumberFormat', locale, {style: 'unit', unit: 'percent',
        minimumFractionDigits: digits, maximumFractionDigits: digits}).format(decimal);
}
