// File sizes in the page's language («1,4 МБ»), with no top-level side
// effects (format-intl.js). The same functions as core/js/format.js,
// composition/file-size.mjs and SF.format.fileSize.
import {formatLocale, intlFormatter} from './format-intl.js';

// The four words of a size, in the languages the SIMAI Framework ships; any
// other language reads the English words with its own digits. A component
// with words of its own passes them as `units`.
export const FILE_SIZE_UNITS = /* @__PURE__ */ Object.freeze({
  en: /* @__PURE__ */ Object.freeze(['B', 'KB', 'MB', 'GB']),
  ru: /* @__PURE__ */ Object.freeze(['Б', 'КБ', 'МБ', 'ГБ']),
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
  return `${intlFormatter('NumberFormat', locale, {maximumFractionDigits: digits}).format(amount)} ${units[index]}`;
}
