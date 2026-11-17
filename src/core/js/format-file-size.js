// File sizes in the page's language («1,4 МБ»), with no top-level side
// effects (format-intl.js). The same functions as core/js/format.js,
// composition/file-size.mjs and SF.format.fileSize.
import {formatLocale, intlFormatter} from './format-intl.js';

// The four words of a size live in core's language files
// (core/js/lang/file-size, localization study LC-3): English ships in the
// bundle; Russian and any other language take the words their language file
// or a product registers for `sf-file-size` (owner decision C282;
// SF.language.register('sf-file-size', 'de', {b, kb, mb, gb})), else the
// English words with its own digits. A component with words of its own passes
// them as `units`. The registry is read from the shared global the page
// language keeps (core/js/page-language.js), so this module still runs
// nothing on load.
import UNIT_WORDS from './lang/file-size/index.mjs';

const UNIT_KEYS = /* @__PURE__ */ Object.freeze(['b', 'kb', 'mb', 'gb']);
function unitsOf(words) {
  return Object.freeze(UNIT_KEYS.map((key) => words[key]));
}

function registeredUnits(code) {
  const words = globalThis.__sfPageLanguage?.registered?.get?.('sf-file-size')?.get?.(code);
  return words && UNIT_KEYS.every((key) => typeof words[key] === 'string') ? unitsOf(words) : null;
}

// The built-in languages' units (English; owner decision C282), and `ru` as
// before for a reader of SF.format.FILE_SIZE_UNITS.ru: the units the ru
// language file registered, null until it is on the page.
function unitTable(words) {
  const table = {};
  for (const [code, own] of Object.entries(words)) table[code] = unitsOf(own);
  if (!table.ru) Object.defineProperty(table, 'ru', {enumerable: true, get: () => registeredUnits('ru')});
  return Object.freeze(table);
}

export const FILE_SIZE_UNITS = /* @__PURE__ */ unitTable(UNIT_WORDS);

/** The unit words for a locale: registered for it, its own, its language's, else English. */
export function fileSizeUnits(locale = 'en') {
  const wanted = String(locale || 'en').trim().toLowerCase().replace('_', '-');
  for (const code of [...new Set([wanted, wanted.split('-')[0]])]) {
    const units = registeredUnits(code) ?? (Object.hasOwn(FILE_SIZE_UNITS, code) ? FILE_SIZE_UNITS[code] : null);
    if (units) return units;
  }
  return registeredUnits('en') ?? FILE_SIZE_UNITS.en;
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
