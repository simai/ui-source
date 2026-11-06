// The languages of sf-language, without the element: codes made canonical,
// named by the browser (Intl.DisplayNames) in themselves and in English, the
// direction each is written in, and the look a count of them takes. No
// dictionary: what the browser cannot name is shown as its code.

export const MODES = ['auto', 'inline', 'menu', 'search'];
export const SIZES = ['1/3', '1/2', '1', '2', '3'];

// The languages written right to left, by their primary subtag, where the
// browser cannot say it itself (Intl.Locale textInfo); and the scripts that
// make any language right to left (ku-Arab, pa-Arab, ms-Arab).
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ks', 'lrc', 'mzn', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi']);
const RTL_SCRIPTS = new Set(['adlm', 'arab', 'hebr', 'mand', 'nkoo', 'rohg', 'syrc', 'thaa']);

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** A language code in its canonical BCP 47 spelling (pt-br -> pt-BR), or '' when it is none. */
export function canonicalCode(value) {
  const code = text(value).replace(/_/gu, '-');
  if (!code || !/^[a-z]{2,8}(-[a-z0-9]{1,8})*$/iu.test(code)) return '';
  try {
    return Intl.getCanonicalLocales(code)[0] || '';
  } catch {
    return '';
  }
}

/** ltr or rtl: how a language is written. */
export function dirOf(code) {
  const canonical = canonicalCode(code);
  if (!canonical) return 'ltr';
  try {
    const locale = new Intl.Locale(canonical);
    const info = typeof locale.getTextInfo === 'function' ? locale.getTextInfo() : locale.textInfo;
    if (info?.direction === 'rtl' || info?.direction === 'ltr') return info.direction;
  } catch {
    // Read below.
  }
  const [primary, ...rest] = canonical.toLowerCase().split('-');
  const script = rest.find((part) => part.length === 4);
  if (script) return RTL_SCRIPTS.has(script) ? 'rtl' : 'ltr';
  return RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr';
}

// A language's name in a language, from the browser; '' when it has none.
function displayName(code, inLanguage) {
  try {
    const name = new Intl.DisplayNames([inLanguage], {type: 'language', fallback: 'none'}).of(code);
    return name && name !== code ? name : '';
  } catch {
    return '';
  }
}

// A name begins with a capital in a list, as a person writes it in a menu
// («Русский», «Español»); the capital is the language's own.
function capitalised(name, code) {
  if (!name) return '';
  try {
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

/** The name of a language in itself: «Deutsch» for de. */
export function nativeName(code) {
  return capitalised(displayName(code, code), code) || code.toUpperCase();
}

/** The name of a language in English: «German» for de. */
export function englishName(code) {
  return capitalised(displayName(code, 'en'), 'en') || code.toUpperCase();
}

/** The name of a language in another, for the search: «немецкий» for de on a Russian page. */
export function nameIn(code, language) {
  return displayName(code, language);
}

/** The code as a compact label shows it: RU, EN, PT-BR. */
export function shortLabel(code) {
  return code.toUpperCase();
}

/**
 * The languages as given: codes in a string («ru en de», commas allowed), or a
 * list of codes or of {code, label, href}. `href` (a pattern with {code})
 * gives each language without its own href one. Unknown codes and repeats are
 * left out.
 */
export function normalizeLanguages(languages, items, href = '') {
  const source = Array.isArray(items) && items.length
    ? items
    : (Array.isArray(languages) ? languages : text(languages).split(/[\s,;]+/u));
  const pattern = text(href);
  const seen = new Set();
  const list = [];
  for (const entry of source) {
    const given = typeof entry === 'string' ? {code: entry} : (entry && typeof entry === 'object' ? entry : null);
    if (!given) continue;
    const code = canonicalCode(given.code ?? given.value ?? given.lang);
    if (!code || seen.has(code.toLowerCase())) continue;
    seen.add(code.toLowerCase());
    const own = nativeName(code);
    const label = text(given.label) || own;
    list.push({
      code,
      label,
      native: own,
      english: englishName(code),
      short: text(given.short) || shortLabel(code),
      href: text(given.href) || (pattern ? pattern.replace(/\{(code|lang)\}/gu, code) : ''),
      dir: dirOf(code),
    });
  }
  return list;
}

/** The look for a number of languages: none, inline, menu or search. */
export function lookFor(count, {mode = 'auto', inlineMax = 3, searchFrom = 8} = {}) {
  if (count < 2) return 'none';
  if (mode === 'inline' || mode === 'menu' || mode === 'search') return mode;
  const inline = Number.isFinite(Number(inlineMax)) ? Number(inlineMax) : 3;
  const search = Number.isFinite(Number(searchFrom)) ? Number(searchFrom) : 8;
  if (count >= search) return 'search';
  return count <= inline ? 'inline' : 'menu';
}

/** The language of a list that a code names: the same code, else the same primary language. */
export function matchLanguage(list, value) {
  const code = canonicalCode(value).toLowerCase();
  if (!code) return null;
  const exact = list.find((language) => language.code.toLowerCase() === code);
  if (exact) return exact;
  const primary = code.split('-')[0];
  return list.find((language) => language.code.toLowerCase() === primary)
    ?? list.find((language) => language.code.toLowerCase().split('-')[0] === primary)
    ?? null;
}
