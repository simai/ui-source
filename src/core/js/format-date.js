// Dates in the page's language: formatDate, the calendar day offset and the
// next midnight, with no top-level side effects (format-intl.js). The same
// functions as core/js/format.js and SF.format; relative days and times are
// format-relative.js, so a bundle that writes a date does not carry them.
import {formatLocale, intlFormatter, toDate} from './format-intl.js';

export {toDate};

const DAY_MS = 86400000;

function hasDateStyle(style) {
  return style === 'short' || style === 'medium' || style === 'long' || style === 'full';
}

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
 * chart's tick, «14:05» with two-digit hours). `timeZone` (an IANA name,
 * Europe/Moscow) writes the moment on that zone's clock instead of the
 * reader's (owner decision C183 (3): a product that knows the person's zone).
 * Anything that is not a date is `gap`, '' by default.
 */
export function formatDate(value, {date = 'medium', time = null, intl = null, timeZone = '', gap = '', ...where} = {}) {
  const moment = toDate(value);
  if (!moment) return gap;
  let options = intl;
  if (!options) {
    options = {};
    if (hasDateStyle(date)) options.dateStyle = date;
    if (hasDateStyle(time)) options.timeStyle = time;
    if (!options.dateStyle && !options.timeStyle) options.dateStyle = 'medium';
  }
  if (knownTimeZone(timeZone)) options = {...options, timeZone};
  return intlFormatter('DateTimeFormat', formatLocale(where), options).format(moment);
}

/**
 * Whether the platform knows an IANA time zone name (Europe/Moscow, UTC). An
 * empty or unknown name is the reader's own zone everywhere here.
 */
export function knownTimeZone(timeZone) {
  const name = String(timeZone ?? '').trim();
  if (!name) return false;
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!(root.__sfTimeZones instanceof Map)) root.__sfTimeZones = new Map();
  if (root.__sfTimeZones.has(name)) return root.__sfTimeZones.get(name);
  let known = true;
  try {
    new Intl.DateTimeFormat('en', {timeZone: name});
  } catch {
    known = false;
  }
  if (root.__sfTimeZones.size < 64) root.__sfTimeZones.set(name, known);
  return known;
}

// The calendar date and the clock of a moment in a zone, as numbers: the
// reader's own when the zone is none.
function wallClock(moment, timeZone) {
  if (!knownTimeZone(timeZone)) {
    return {year: moment.getFullYear(), month: moment.getMonth(), day: moment.getDate(), hour: moment.getHours(), minute: moment.getMinutes(), second: moment.getSeconds()};
  }
  const parts = {};
  for (const part of intlFormatter('DateTimeFormat', 'en-US', {timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'}).formatToParts(moment)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {year: parts.year, month: parts.month - 1, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second};
}

/**
 * The zone's offset from UTC at a moment, in minutes (Moscow +180, New York
 * -300 in winter); the reader's own when the zone is none.
 */
export function timeZoneOffset(value, {timeZone = ''} = {}) {
  const moment = toDate(value);
  if (!moment) return Number.NaN;
  if (!knownTimeZone(timeZone)) return -moment.getTimezoneOffset();
  const clock = wallClock(moment, timeZone);
  const asUtc = Date.UTC(clock.year, clock.month, clock.day, clock.hour, clock.minute, clock.second);
  return Math.round((asUtc - Math.floor(moment.getTime() / 1000) * 1000) / 60000);
}

/**
 * Calendar days from `now` to the value in the reader's time zone (or
 * `timeZone`'s): 0 today, -1 yesterday, 1 tomorrow; NaN when the value is no
 * date. Counted on calendar dates, not 24-hour spans, so 23:59 yesterday is
 * -1 at 00:01 and a day of a clock change is still one day.
 */
export function calendarDayOffset(value, {now = new Date(), timeZone = ''} = {}) {
  const moment = toDate(value);
  const today = toDate(now);
  if (!moment || !today) return Number.NaN;
  const at = wallClock(moment, timeZone);
  const from = wallClock(today, timeZone);
  const day = Date.UTC(at.year, at.month, at.day);
  const base = Date.UTC(from.year, from.month, from.day);
  return Math.round((day - base) / DAY_MS);
}

/**
 * Milliseconds from `now` to the reader's next midnight, when every relative
 * day on the screen moves by one. A component that shows them sets a timer
 * for this long (plus a second's margin, so it wakes in the new day) and
 * draws them again; «сегодня» said yesterday is wrong by morning.
 */
export function msUntilNextDay(now = new Date(), {timeZone = ''} = {}) {
  const today = toDate(now) ?? new Date();
  if (!knownTimeZone(timeZone)) {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return next.getTime() - today.getTime();
  }
  // In a named zone: the time left on its clock until 24:00, corrected by a
  // change of its offset before then (a clock change at night).
  const clock = wallClock(today, timeZone);
  const left = DAY_MS - ((clock.hour * 60 + clock.minute) * 60 + clock.second) * 1000 - today.getMilliseconds();
  const shift = timeZoneOffset(today, {timeZone}) - timeZoneOffset(new Date(today.getTime() + left), {timeZone});
  return Math.max(1, left + shift * 60000);
}
