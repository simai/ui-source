// How a stored file reads to people: its size in the page's language and its
// name when nobody gave it one. sf-image-field wrote these first (its
// value.mjs re-exports them); the Composition renderer draws content.file with
// the same rule, so a size reads the same in a field and on a page. No DOM.

// The four words of a size, in the languages the SIMAI Framework ships; any
// other language reads the English words with its own digits.
export const FILE_SIZE_UNITS = Object.freeze({
  en: Object.freeze(['B', 'KB', 'MB', 'GB']),
  ru: Object.freeze(['Б', 'КБ', 'МБ', 'ГБ']),
});

/** The unit words for a locale: its language's, else English. */
export function fileSizeUnits(locale = 'en') {
  const language = String(locale || 'en').toLowerCase().split('-')[0];
  return Object.hasOwn(FILE_SIZE_UNITS, language) ? FILE_SIZE_UNITS[language] : FILE_SIZE_UNITS.en;
}

// A size as people read it: «2 КБ», «1,4 МБ». `units` are the four words in
// the page's language, `locale` its formatting. Text the host already
// formatted is returned as it came; anything that is not a size is ''.
export function formatFileSize(size, units = FILE_SIZE_UNITS.en, locale = 'en') {
  if (typeof size === 'string') return size;
  const bytes = Number(size);
  if (size === null || size === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = index === 0 || amount >= 10 ? 0 : 1;
  let number;
  try {
    number = new Intl.NumberFormat(locale, {maximumFractionDigits: digits}).format(amount);
  } catch {
    number = amount.toFixed(digits);
  }
  return `${number} ${units[index]}`;
}

// The last part of an address, decoded, without its query and fragment: the
// name a file is shown under when it has no label.
export function fileNameFromAddress(href) {
  const tail = String(href).split(/[?#]/u)[0].split('/').pop() || '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}
