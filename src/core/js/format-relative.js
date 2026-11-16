// Relative days and times in the page's language («вчера», «5 минут назад»),
// with no top-level side effects (format-intl.js). The same functions as
// core/js/format.js and SF.format.relativeDay / relativeTime.
import {formatLocale, intlFormatter, toDate} from './format-intl.js';
import {calendarDayOffset, knownTimeZone} from './format-date.js';

// The first letter in capitals, by the locale's rule («вчера» → «Вчера»).
function capitalise(text, locale) {
  const first = Array.from(text)[0] ?? '';
  return first ? first.toLocaleUpperCase(locale || undefined) + text.slice(first.length) : text;
}

// «сегодня», «вчера», «завтра» are the platform's words, except where the
// platform has no words of the language: a browser without a language's
// relative-time data says «yesterday» on a page in it. Then the words come
// from core's language files (core/js/lang/relative-day, registered as
// `sf-relative-day`), which a language pack or a product brings
// (SF.language.register('sf-relative-day', 'de', {today, yesterday,
// tomorrow})). ru and en are never looked up: every platform speaks them.
const DAY_KEYS = /* @__PURE__ */ Object.freeze({0: 'today', [-1]: 'yesterday', 1: 'tomorrow'});

/** Whether Intl's relative-time words are those of the locale's language, not a fallback's. */
export function intlSpeaks(locale) {
  const wanted = String(locale || '').trim().toLowerCase().replace('_', '-').split('-')[0];
  if (!wanted) return true;
  if (wanted === 'en') return true;
  try {
    const own = intlFormatter('RelativeTimeFormat', locale, {numeric: 'auto'});
    if (String(own.resolvedOptions().locale).toLowerCase().split('-')[0] !== wanted) return false;
    // A platform may answer the locale's name over English data (a trimmed
    // ICU): its «yesterday» is then English's.
    return own.format(-1, 'day') !== intlFormatter('RelativeTimeFormat', 'en', {numeric: 'auto'}).format(-1, 'day');
  } catch {
    return false;
  }
}

function packDayWord(offset, locale) {
  if (intlSpeaks(locale)) return null;
  const words = globalThis.__sfPageLanguage?.registered?.get?.('sf-relative-day');
  const wanted = String(locale || '').trim().toLowerCase().replace('_', '-');
  for (const code of [...new Set([wanted, wanted.split('-')[0]])]) {
    const word = words?.get?.(code)?.[DAY_KEYS[offset]];
    if (typeof word === 'string' && word.trim()) return word;
  }
  return null;
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
 * `timeZone` counts the days and writes them on that zone's clock.
 *
 * The answer changes at the reader's midnight: msUntilNextDay (format-date.js)
 * says when.
 */
export function formatRelativeDay(value, {now = new Date(), today, yesterday, tomorrow, weekday = true, capital = false, timeZone = '', gap = '', ...where} = {}) {
  const moment = toDate(value);
  if (!moment) return gap;
  const locale = formatLocale(where);
  const offset = calendarDayOffset(moment, {now, timeZone});
  const zone = knownTimeZone(timeZone) ? {timeZone} : {};
  const own = {0: today, [-1]: yesterday, 1: tomorrow}[offset];
  let text;
  if (own) {
    text = String(own);
  } else if (offset >= -1 && offset <= 1) {
    text = packDayWord(offset, locale) ?? intlFormatter('RelativeTimeFormat', locale, {numeric: 'auto'}).format(offset, 'day');
  } else if (weekday && offset < -1 && offset > -7) {
    text = intlFormatter('DateTimeFormat', locale, {weekday: 'long', ...zone}).format(moment);
  } else {
    const year = moment.getFullYear() === toDate(now).getFullYear() ? {} : {year: 'numeric'};
    text = intlFormatter('DateTimeFormat', locale, {day: 'numeric', month: 'long', ...year, ...zone}).format(moment);
  }
  return capital ? capitalise(text, locale) : text;
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
  const format = intlFormatter('RelativeTimeFormat', formatLocale(where), {numeric: 'auto'});
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(seconds, 'second');
}
