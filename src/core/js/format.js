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
// This module gathers the helpers and the SF.format object; the helpers live
// in modules of their own with no top-level side effects (core.runtime 1.28.0;
// ui-chart, 2026-11-05), and a bundle imports what it calls from those:
//
//   format-number.js     formatNumber, numberOptions
//   format-date.js       formatDate, calendarDayOffset, msUntilNextDay, toDate
//   format-relative.js   formatRelativeDay, formatRelativeTime
//   format-file-size.js  formatFileSize, fileSizeUnits, FILE_SIZE_UNITS
//   format-intl.js       formatLocale, toDate (and the shared Intl formatters)
//
// Until 1.28.0 this module published SF.format on load, from whichever bundle
// ran it first; that kept every helper in every bundle that imported one (each
// chart bundle grew by 1.3-1.4 KB gzip). Core's entry publishes it now
// (index.js calls publishFormat), and importing this module changes nothing on
// the page. Its exports are as they were.
import {formatLocale, toDate} from './format-intl.js';
import {calendarDayOffset, formatDate, msUntilNextDay} from './format-date.js';
import {formatRelativeDay, formatRelativeTime} from './format-relative.js';
import {formatNumber, numberOptions} from './format-number.js';
import {FILE_SIZE_UNITS, fileSizeUnits, formatFileSize} from './format-file-size.js';

export {
  calendarDayOffset,
  FILE_SIZE_UNITS,
  fileSizeUnits,
  formatDate,
  formatFileSize,
  formatLocale,
  formatNumber,
  formatRelativeDay,
  formatRelativeTime,
  msUntilNextDay,
  numberOptions,
  toDate,
};

const Format = /* @__PURE__ */ Object.freeze({
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

/**
 * Publishes SF.format on `root` (the page's global), unless something is there
 * already: core's entry calls it once; a component bundle never does.
 */
export function publishFormat(root = typeof globalThis !== 'undefined' ? globalThis : undefined) {
  if (!root) return undefined;
  root.SF = root.SF || {};
  if (!root.SF.format) root.SF.format = Format;
  return root.SF.format;
}

export default Format;
