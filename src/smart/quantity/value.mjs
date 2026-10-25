// The parts of sf-quantity that are about numbers, not the page: how typed text
// reads in the page's language, how a value is written back, where a step
// lands and where the bounds hold it. Kept apart from the element so the
// contract tests run them in Node, as sf-image-field's value.mjs is.
//
// The class component (component/quantity) has its own parser, written for
// markup that may carry a mask and a soft typing mode. This one is strict: a
// character that cannot be part of a number is refused as it is typed, and the
// value is a number or nothing -- never the text that happened to be in the box.

const symbolCache = new Map();

// The decimal and group marks of a locale, from the platform's own formatter.
// An unknown locale falls back to en-US rather than throwing.
export function numberSymbols(locale) {
  const key = String(locale || '');
  if (symbolCache.has(key)) return symbolCache.get(key);
  let formatter;
  try {
    formatter = new Intl.NumberFormat(key || undefined);
  } catch {
    formatter = new Intl.NumberFormat('en-US');
  }
  const parts = formatter.formatToParts(-12345.6);
  const symbols = {
    group: parts.find((part) => part.type === 'group')?.value || ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value || '.',
    minus: parts.find((part) => part.type === 'minusSign')?.value || '-',
  };
  if (symbolCache.size >= 32) symbolCache.delete(symbolCache.keys().next().value);
  symbolCache.set(key, symbols);
  return symbols;
}

// Digits after the point a step implies: 0.25 has two, 1e-3 three, 5 none.
export function inferPrecision(step) {
  const text = String(step ?? '').trim().toLowerCase();
  const number = Number(text);
  if (!text || !Number.isFinite(number) || number <= 0) return 0;
  const [coefficient, exponent = '0'] = text.split('e');
  const fraction = coefficient.split('.')[1]?.length || 0;
  return Math.max(0, fraction - Number(exponent));
}

// A bound or a step from an attribute: a finite number, or null when it is
// empty or not a number. Written the programmer's way, with a point.
export function readNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function clamp(value, min, max) {
  let next = value;
  if (min !== null && Number.isFinite(min)) next = Math.max(next, min);
  if (max !== null && Number.isFinite(max)) next = Math.min(next, max);
  return next;
}

// Rounded to the digits the field shows, so 0.1 + 0.2 is 0.3 and a value never
// carries more than it can draw.
export function roundTo(value, precision) {
  const digits = Math.min(20, Math.max(0, Number(precision) || 0));
  const scale = 10 ** digits;
  const scaled = Math.round(value * scale) / scale;
  return Object.is(scaled, -0) ? 0 : scaled;
}

// Typed text, normalised: the locale's own minus, its group marks and the
// spaces people type between thousands go; the locale's decimal mark, and the
// other of «.» and «,» when the locale does not group with it, become a point.
function normalise(text, locale) {
  const {group, decimal, minus} = numberSymbols(locale);
  let value = String(text ?? '').replace(/[\u061c\u200e\u200f]/gu, '');
  value = value.split(minus).join('-').replace(/[\s\u00a0\u202f]/gu, '');
  const groupMark = group.replace(/[\s\u00a0\u202f]/gu, '');
  if (groupMark && groupMark !== decimal) value = value.split(groupMark).join('');
  value = value.split(decimal).join('.');
  // The other mark of the two is a decimal too, unless the locale groups with it
  // (then it is gone already): a point typed on a Russian page is a comma.
  if (decimal !== ',' && groupMark !== ',') value = value.split(',').join('.');
  return value;
}

function pattern({allowDecimal, allowNegative}) {
  const sign = allowNegative ? '-?' : '';
  return allowDecimal ? new RegExp(`^${sign}\\d*(?:\\.\\d*)?$`, 'u') : new RegExp(`^${sign}\\d*$`, 'u');
}

// Whether text can still become a number as the person goes on typing: «-»,
// «1,» and an empty box can, «1,2,3» and «12a» cannot. The strict typing rule.
export function isEditableText(text, {locale, allowDecimal = false, allowNegative = false} = {}) {
  return pattern({allowDecimal, allowNegative}).test(normalise(text, locale));
}

// The number typed text says: null for an empty box, NaN for text that is not
// a whole number yet («-», «.») or not a number at all.
export function parseNumber(text, {locale, allowDecimal = false, allowNegative = false} = {}) {
  const value = normalise(text, locale);
  if (value === '') return null;
  if (!pattern({allowDecimal, allowNegative}).test(value) || !/\d/u.test(value)) return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

// A value as the page's language writes it, with the field's digits.
export function formatNumber(value, {locale, precision = 0, grouping = true} = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const digits = Math.min(20, Math.max(0, Number(precision) || 0));
  try {
    return new Intl.NumberFormat(locale || undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: grouping,
    }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

// The value as a form submits it: a point, no grouping, the field's digits.
export function formValue(value, precision = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return roundTo(value, precision).toFixed(Math.min(20, Math.max(0, Number(precision) || 0)));
}

// Where `count` steps from the current value land (negative counts go down).
// An empty field counts from zero; when zero is outside the bounds, the first
// step lands on the nearer bound instead: «+» on an empty field with min 1
// gives 1, not 2.
export function stepFrom(current, count, {step = 1, min = null, max = null, precision = 0} = {}) {
  const size = Number.isFinite(step) && step > 0 ? step : 1;
  if (current === null || current === undefined || !Number.isFinite(current)) {
    const start = clamp(0, min, max);
    return roundTo(start === 0 ? clamp(size * count, min, max) : start, precision);
  }
  return roundTo(clamp(current + size * count, min, max), precision);
}
