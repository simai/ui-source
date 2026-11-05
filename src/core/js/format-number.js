// Numbers in the page's language by a format word: formatNumber and
// numberOptions alone, with no top-level side effects (format-intl.js). The
// same functions as core/js/format.js and SF.format.number; a bundle that
// formats numbers only imports them from here.
import {formatLocale, intlFormatter} from './format-intl.js';

/**
 * The Intl options of a number format word (ui-chart's words, kept so a page
 * writes a format as an attribute):
 *
 *   number (default)  1 234,5   as many digits as `step` needs, at most 6; 2 without one
 *   integer           1 235
 *   decimal-<n>       n digits after the point, always (0 to 20)
 *   percent           a share 0..1 as 12 %
 *   compact           1,2 тыс.  /  1.2K
 *   currency-<CODE>   1 234,50 ₽ (an ISO 4217 code)
 *   unit-<unit>       45,3 ГБ (an Intl unit: gigabyte, megabit-per-second)
 *
 * Anything else reads as number.
 */
export function numberOptions(format = 'number', step = 0) {
  const word = String(format || 'number').trim();
  if (word === 'integer') return {maximumFractionDigits: 0};
  if (word === 'percent') return {style: 'percent', maximumFractionDigits: 1};
  if (word === 'compact') return {notation: 'compact', maximumFractionDigits: 1};
  const decimal = /^decimal-(\d{1,2})$/u.exec(word);
  if (decimal) {
    const digits = Math.min(20, Number(decimal[1]));
    return {minimumFractionDigits: digits, maximumFractionDigits: digits};
  }
  const unit = /^unit-([a-z]+(?:-per-[a-z]+)?)$/u.exec(word);
  if (unit) return {style: 'unit', unit: unit[1], unitDisplay: 'short', maximumFractionDigits: 1};
  const currency = /^currency-([A-Z]{3})$/u.exec(word);
  if (currency) return {style: 'currency', currency: currency[1]};
  const digits = step > 0 && step < 1 ? Math.min(6, Math.ceil(-Math.log10(step) - 1e-9)) : 2;
  return {maximumFractionDigits: digits};
}

/**
 * A number in the locale by a format word (numberOptions). `grouping: false`
 * writes it without thousands marks («2026»), `step` sets the digits of
 * `number`, and a value that is not a finite number is `gap`, '' by default
 * (a chart passes '—').
 */
export function formatNumber(value, format = 'number', {step = 0, gap = '', grouping = true, ...where} = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return gap;
  const options = numberOptions(format, step);
  if (grouping === false) options.useGrouping = false;
  return intlFormatter('NumberFormat', formatLocale(where), options).format(number);
}
