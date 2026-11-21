// The part every format module shares (core/js/format.js says what the
// helpers are): the locale a call formats in, a Date from what a host gives,
// and the Intl formatters, kept on a global every copy of these modules shares
// (bundles each carry their own module copy; page-language.js says why).
//
// No top-level side effects, here or in format-number.js, format-date.js,
// format-relative.js and format-file-size.js (ui-chart, 2026-11-05): a bundle
// that imports one function carries that function and what it calls, nothing
// else. The global is made on the first format, not on load, and SF.format is
// published by core's entry (index.js, publishFormat in format.js).
import {pageLocale} from './page-language.js';

/** The locale a call formats in: the one it names, else its node's page language. */
export function formatLocale({locale, node} = {}) {
  return String(locale || '').trim() || pageLocale(node);
}

/** A Date from a Date, a time in milliseconds or a date string; null when it is none. */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The formatters every copy shares, made on the first call.
function formatterCache() {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!root.__sfFormat) root.__sfFormat = {formatters: new Map()};
  return root.__sfFormat.formatters;
}

// One formatter per kind, locale and options. An unknown locale falls back to
// the browser's, and options the platform refuses (an unknown unit or
// currency) to a plain number, so a typo in a page never throws at a reader.
export function intlFormatter(kind, locale, options) {
  const key = `${kind}|${locale}|${JSON.stringify(options)}`;
  const cache = formatterCache();
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

// A date's year keeps the abbreviation that follows it (A4, group build 15):
// Russian, Ukrainian, Bulgarian, Belarusian, Kazakh, Lithuanian, Macedonian
// and Armenian write one after the year -- «19 нояб. 2026 г.», «2026 р.»,
// «2026 m.», «2026 թ.» -- and the platform joins it with an ordinary space, so
// a narrow cell or a wrapped line printed «2026» at the end of one line and
// «г.» alone at the start of the next. Only the space before an abbreviation
// (letters closed by a full stop: г., гг., m.) becomes a no-break space; a word
// such as English «at» or German «um», a comma, a slash or a time after the
// year is left as the platform writes it (DEV answer msg-e6758728).

/** A DateTimeFormat's text of a moment with the year's marker held to the year. */
export function formatDateText(formatter, moment) {
  if (typeof formatter?.formatToParts !== 'function') return formatter.format(moment);
  // A module-level regular expression is a statement a bundler keeps (core-format test): made here.
  const gap = /^[\s\u00a0\u202f]+(?=\p{L}+\.)/u;
  let text = '';
  let afterYear = false;
  for (const part of formatter.formatToParts(moment)) {
    text += afterYear && part.type === 'literal' ? part.value.replace(gap, '\u00a0') : part.value;
    afterYear = part.type === 'year';
  }
  return text;
}
