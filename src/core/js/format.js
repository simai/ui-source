// Dates, days, numbers and file sizes as people read them, in the page's
// language (reuse audit 2026-11-02, finding 7). About fourteen components
// wrote these themselves -- three relative-day rules (thread-list, chat-window
// with its own midnight refresh, mail-letters), file sizes in four places,
// numbers in the chart and the quantity -- and they disagreed: «Вчера» in one
// list, «вчера» in the next, «1.4MB» beside «1,4 МБ». One rule now, through
// Intl only; the most complete copy was ui-chart's chart-core/format.js, whose
// number words are kept as they were.
//
// The locale is the page's (page-language.js pageLocale): an explicit
// `locale`, else the language of `node` -- the nearest [lang] above it, the
// page's choice, <html lang>, English. Never a fixed ru-RU.
//
// Nothing here holds state of its own: the Intl formatters are kept on a
// global shared by every copy of this module, which each bundle carries
// (bundles each carry their own module copy; page-language.js says why).
import {pageLocale} from './page-language.js';

const STORE = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfFormat';
  if (!root[key]) root[key] = {formatters: new Map()};
  return root[key];
})();

const DAY_MS = 86400000;

/** The locale a call formats in: the one it names, else its node's page language. */
export function formatLocale({locale, node} = {}) {
  return String(locale || '').trim() || pageLocale(node);
}

// One formatter per kind, locale and options. An unknown locale falls back to
// the browser's, and options the platform refuses (an unknown unit or
// currency) to a plain number, so a typo in a page never throws at a reader.
function formatter(kind, locale, options) {
  const key = `${kind}|${locale}|${JSON.stringify(options)}`;
  const cache = STORE.formatters;
  if (cache.has(key)) return cache.get(key);
  const Make = Intl[kind];
  let made;
  try {
    made = new Make(locale || undefined, options);
  } catch {
    try {
      made = new Make(undefined, options);
    } catch {
      made = new Make(locale || undefined, kind === 'NumberFormat' ? {maximumFractionDigits: 2} : {});
    }
  }
  // A page that formats in many locales does not grow the cache for ever.
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, made);
  return made;
}

/** A Date from a Date, a time in milliseconds or a date string; null when it is none. */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The first letter in capitals, by the locale's rule («вчера» → «Вчера»).
function capitalise(text, locale) {
  const first = Array.from(text)[0] ?? '';
  return first ? first.toLocaleUpperCase(locale || undefined) + text.slice(first.length) : text;
}

// ── dates ────────────────────────────────────────────────────────────────────

const DATE_STYLES = new Set(['short', 'medium', 'long', 'full']);

/**
 * A date, a time or both in the locale.
 *
 *   formatDate(at)                          3 нояб. 2026 г.  /  Nov 3, 2026
 *   formatDate(at, {date: 'short'})         03.11.2026       /  11/3/26
 *   formatDate(at, {date: 'long'})          3 ноября 2026 г. /  November 3, 2026
 *   formatDate(at, {time: 'short'})         3 нояб. 2026 г., 14:05
 *   formatDate(at, {date: null, time: 'short'})   14:05   /  2:05 PM
 *
 * `date` and `time` are Intl styles (short, medium, long, full); `intl` gives
 * Intl.DateTimeFormat options outright, for a form the styles do not name (a
 * chart's tick, «14:05» with two-digit hours). Anything that is not a date is
 * `gap`, '' by default.
 */
export function formatDate(value, {date = 'medium', time = null, intl = null, gap = '', ...where} = {}) {
  const moment = toDate(value);
  if (!moment) return gap;
  let options = intl;
  if (!options) {
    options = {};
    if (DATE_STYLES.has(date)) options.dateStyle = date;
    if (DATE_STYLES.has(time)) options.timeStyle = time;
    if (!options.dateStyle && !options.timeStyle) options.dateStyle = 'medium';
  }
  return formatter('DateTimeFormat', formatLocale(where), options).format(moment);
}

// ── days ─────────────────────────────────────────────────────────────────────

/**
 * Calendar days from `now` to the value in the reader's time zone: 0 today,
 * -1 yesterday, 1 tomorrow; NaN when the value is no date. Counted on
 * calendar dates, not 24-hour spans, so 23:59 yesterday is -1 at 00:01 and a
 * day of a clock change is still one day.
 */
export function calendarDayOffset(value, {now = new Date()} = {}) {
  const moment = toDate(value);
  const today = toDate(now);
  if (!moment || !today) return Number.NaN;
  const day = Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate());
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day - base) / DAY_MS);
}

/**
 * The day a moment fell on, as a list says it: «сегодня», «вчера», «завтра»,
 * the weekday within the last week («понедельник»), else the date («3 ноября»,
 * with the year when it is not this one). The words are the platform's for
 * the locale (Intl.RelativeTimeFormat, numeric auto); a component that ships
 * its own passes them (`today`, `yesterday`, `tomorrow`) and they win.
 * `weekday: false` goes from yesterday straight to the date; `capital: true`
 * starts the word with a capital, as a heading or a divider does.
 *
 * The answer changes at the reader's midnight: msUntilNextDay says when.
 */
export function formatRelativeDay(value, {now = new Date(), today, yesterday, tomorrow, weekday = true, capital = false, gap = '', ...where} = {}) {
  const moment = toDate(value);
  if (!moment) return gap;
  const locale = formatLocale(where);
  const offset = calendarDayOffset(moment, {now});
  const own = {0: today, [-1]: yesterday, 1: tomorrow}[offset];
  let text;
  if (own) {
    text = String(own);
  } else if (offset >= -1 && offset <= 1) {
    text = formatter('RelativeTimeFormat', locale, {numeric: 'auto'}).format(offset, 'day');
  } else if (weekday && offset < -1 && offset > -7) {
    text = formatter('DateTimeFormat', locale, {weekday: 'long'}).format(moment);
  } else {
    const year = moment.getFullYear() === toDate(now).getFullYear() ? {} : {year: 'numeric'};
    text = formatter('DateTimeFormat', locale, {day: 'numeric', month: 'long', ...year}).format(moment);
  }
  return capital ? capitalise(text, locale) : text;
}

/**
 * Milliseconds from `now` to the reader's next midnight, when every relative
 * day on the screen moves by one. A component that shows them sets a timer
 * for this long (plus a second's margin, so it wakes in the new day) and
 * draws them again; «сегодня» said yesterday is wrong by morning.
 */
export function msUntilNextDay(now = new Date()) {
  const today = toDate(now) ?? new Date();
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return next.getTime() - today.getTime();
}

// The largest unit a span reaches is the one it is said in (mail-letters'
// steps, 2026-10): 90 seconds is «2 минуты назад», 40 days «в прошлом месяце».
const RELATIVE_STEPS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

/** «5 минут назад», «через 2 часа»: a moment from `now`, in the locale. */
export function formatRelativeTime(value, {now = new Date(), gap = '', ...where} = {}) {
  const moment = toDate(value);
  const base = toDate(now);
  if (!moment || !base) return gap;
  const seconds = Math.round((moment.getTime() - base.getTime()) / 1000);
  const format = formatter('RelativeTimeFormat', formatLocale(where), {numeric: 'auto'});
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(seconds, 'second');
}

// ── numbers ──────────────────────────────────────────────────────────────────

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
  return formatter('NumberFormat', formatLocale(where), options).format(number);
}

// ── file sizes ───────────────────────────────────────────────────────────────

// The four words of a size, in the languages the SIMAI Framework ships; any
// other language reads the English words with its own digits. A component
// with words of its own passes them as `units`.
export const FILE_SIZE_UNITS = Object.freeze({
  en: Object.freeze(['B', 'KB', 'MB', 'GB']),
  ru: Object.freeze(['Б', 'КБ', 'МБ', 'ГБ']),
});

/** The unit words for a locale: its language's, else English. */
export function fileSizeUnits(locale = 'en') {
  const language = String(locale || 'en').toLowerCase().split('-')[0];
  return Object.hasOwn(FILE_SIZE_UNITS, language) ? FILE_SIZE_UNITS[language] : FILE_SIZE_UNITS.en;
}

/**
 * A size as people read it: «512 Б», «2 КБ», «1,4 МБ», «12 GB». Binary steps
 * of 1024; one digit after the point under ten of a unit, none above it or in
 * bytes. Text a host already formatted is returned as it came; anything that
 * is not a size is ''.
 *
 *   formatFileSize(size, {node, units?, locale?})
 *   formatFileSize(size, units, locale)   -- the form composition/file-size.mjs
 *                                            and sf-image-field 1.x published
 */
export function formatFileSize(size, options = {}, legacyLocale) {
  const where = Array.isArray(options) ? {units: options, locale: legacyLocale ?? 'en'} : (options ?? {});
  if (typeof size === 'string') return size;
  const bytes = Number(size);
  if (size === null || size === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  const locale = formatLocale(where);
  const units = where.units?.length ? where.units : fileSizeUnits(locale);
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = index === 0 || amount >= 10 ? 0 : 1;
  return `${formatter('NumberFormat', locale, {maximumFractionDigits: digits}).format(amount)} ${units[index]}`;
}

const Format = Object.freeze({
  locale: formatLocale,
  date: formatDate,
  relativeDay: formatRelativeDay,
  relativeTime: formatRelativeTime,
  dayOffset: calendarDayOffset,
  msUntilNextDay,
  number: formatNumber,
  numberOptions,
  fileSize: formatFileSize,
});

// Core publishes the helper; component bundles that carry their own copy reuse
// an already published one instead of replacing it.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  if (!globalThis.SF.format) globalThis.SF.format = Format;
}

export default Format;
