// The languages of sf-language, without the element: codes made canonical,
// named in themselves and in English, the direction each is written in, the
// look a count of them takes, and what a search finds. The names of the
// languages the component supports ship with it (data/names.json, from CLDR:
// the browser's Intl.DisplayNames names fewer -- research LG-7); the browser
// names the rest, and what neither can name is shown as its code. The
// element gives this module the shipped names (useNames), so the module
// itself has no import a plain Node.js test cannot take.

export const MODES = ['auto', 'inline', 'menu', 'search', 'field'];
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

// The shipped names, by canonical code in lower case.
const SHIPPED = new Map();

/** Takes the shipped names (data/names.json): {names: {<code>: {native, en, ru}}}. */
export function useNames(data) {
  SHIPPED.clear();
  for (const [code, names] of Object.entries(data?.names ?? {})) {
    if (names && typeof names === 'object') SHIPPED.set(code.toLowerCase(), names);
  }
}

// A shipped name of a language in a language: native (in itself), en or ru;
// '' when none ships.
function shippedName(code, inLanguage) {
  const names = SHIPPED.get(String(code).toLowerCase());
  if (!names) return '';
  const want = String(inLanguage).toLowerCase();
  if (want === String(code).toLowerCase()) return names.native || '';
  return names[want] || names[want.split('-')[0]] || '';
}

// A language's name in a language: the shipped one first, else the
// browser's; '' when neither has one.
function displayName(code, inLanguage) {
  const shipped = shippedName(code, inLanguage);
  if (shipped) return shipped;
  try {
    const name = new Intl.DisplayNames([inLanguage], {type: 'language', fallback: 'none'}).of(code);
    return name && name !== code ? name : '';
  } catch {
    return '';
  }
}

// A name begins with a capital in a list, as a person writes it in a menu
// («Русский», «Español»); the capital is the language's own.
// Georgian has no capitals in running text: its upper case (Mtavruli) is a
// display style, so «ქართული» stays as it is.
const UNCASED = /^[\u10D0-\u10FF]/u;

function capitalised(name, code) {
  if (!name) return '';
  if (UNCASED.test(name)) return name;
  try {
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

// A code's parts: the primary language, and the script and region subtags
// that make it a variant (pt-BR, zh-Hant), or '' when it has none.
function partsOf(code) {
  const [primary = '', ...rest] = String(code).split('-');
  const script = rest.find((part) => /^[a-z]{4}$/iu.test(part)) || '';
  const region = rest.find((part) => /^([a-z]{2}|\d{3})$/iu.test(part)) || '';
  return {primary: primary.toLowerCase(), script, region};
}

// A name from the browser in its standard form: the language and, in
// brackets, what makes the variant («português (Brasil)», «中文（简体）»),
// not the dialect name («português europeu», «简体中文»).
function standardName(code, inLanguage) {
  try {
    const name = new Intl.DisplayNames([inLanguage], {type: 'language', languageDisplay: 'standard', fallback: 'none'}).of(code);
    return name && name !== code ? name : '';
  } catch {
    return '';
  }
}

function subtagName(type, subtag, inLanguage) {
  try {
    return new Intl.DisplayNames([inLanguage], {type, fallback: 'none'}).of(subtag) || '';
  } catch {
    return '';
  }
}

// What makes a variant, in a language: the region («Бразилия») or the script.
function qualifierIn(code, inLanguage) {
  const {script, region} = partsOf(code);
  if (region) return subtagName('region', region.toUpperCase(), inLanguage);
  if (script) return subtagName('script', script.charAt(0).toUpperCase() + script.slice(1).toLowerCase(), inLanguage);
  return '';
}

/** Whether a code is a variant of a language: it names a script or a region (pt-BR, zh-Hant). */
export function isVariant(code) {
  const {script, region} = partsOf(code);
  return Boolean(script || region);
}

/**
 * The name of a language in itself: «Deutsch» for de. A variant is the full
 * name with what makes it one, in its own words (owner decision C142 (9)):
 * «Português (Brasil)», «Português (Portugal)», «中文（简体）».
 */
export function nativeName(code) {
  if (isVariant(code)) {
    const full = standardName(code, code);
    if (full) return capitalised(full, code);
    const base = displayName(partsOf(code).primary, partsOf(code).primary);
    const qualifier = qualifierIn(code, code);
    if (base && qualifier) return capitalised(`${base} (${qualifier})`, code);
  }
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

/**
 * The second name of a menu row: the language's name in the page's language
 * (owner decision C142 (3): «Deutsch немецкий» on a Russian page, W3C
 * language navigation), as it is written in running text. A variant says
 * what makes it one: «португальский, Бразилия»; a script variant the name
 * the component ships («китайский, упрощенное письмо»). '' when the page's
 * language has no name for it.
 */
export function pageName(code, page) {
  const language = text(page) || 'en';
  if (isVariant(code)) {
    const {primary, region} = partsOf(code);
    if (region) {
      const base = displayName(primary, language);
      const qualifier = qualifierIn(code, language);
      if (base && qualifier) return `${base}, ${qualifier}`;
    }
    const shipped = shippedName(code, language);
    if (shipped) return shipped;
    const full = standardName(code, language);
    if (full) return full;
  }
  return displayName(code, language);
}

/** The code as a code label (labels="code") shows it: RU, EN, PT-BR. */
export function shortLabel(code) {
  return code.toUpperCase();
}

// Chinese is told apart by its script, not its country (C142 (9)): the
// labels Chinese sites themselves write.
const CHINESE_SCRIPT = {hans: '简体', hant: '繁體'};
const CHINESE_REGION_SCRIPT = {cn: 'hans', sg: 'hans', my: 'hans', tw: 'hant', hk: 'hant', mo: 'hant'};

/**
 * The code a list shows for a language (the trigger, labels="code"): the
 * language alone while the list holds one variant of it («PT» for pt-BR);
 * the region too when it holds two («PT-BR», «PT-PT»); Chinese by its script
 * («简体», «繁體»). Owner decision C142 (9).
 */
export function shortLabelIn(code, list) {
  const {primary, script, region} = partsOf(code);
  const variants = list.filter((one) => partsOf(one).primary === primary).length;
  if (variants < 2) return primary.toUpperCase();
  if (primary === 'zh') {
    const by = (script || CHINESE_REGION_SCRIPT[region.toLowerCase()] || '').toLowerCase();
    if (CHINESE_SCRIPT[by]) return CHINESE_SCRIPT[by];
  }
  return shortLabel(code);
}

/**
 * The languages as given: codes in a string («ru en de», commas allowed), or a
 * list of codes or of {code, label, short, href, missing}. `href` (a pattern
 * with {code}) gives each language without its own href one. A language this
 * page has no translation for -- written in `missing` («de fr») or an item's
 * missing: true -- stays in the list (C142 (6)); its address is `home` (a
 * pattern with {code}) when given, the site's main page in that language.
 * Unknown codes and repeats are left out.
 */
export function normalizeLanguages(languages, items, href = '', {missing = '', home = ''} = {}) {
  const source = Array.isArray(items) && items.length
    ? items
    : (Array.isArray(languages) ? languages : text(languages).split(/[\s,;]+/u));
  const pattern = text(href);
  const homePattern = text(home);
  const absent = new Set(text(missing).split(/[\s,;]+/u).map((one) => canonicalCode(one).toLowerCase()).filter(Boolean));
  const seen = new Set();
  const given = [];
  for (const entry of source) {
    const one = typeof entry === 'string' ? {code: entry} : (entry && typeof entry === 'object' ? entry : null);
    if (!one) continue;
    const code = canonicalCode(one.code ?? one.value ?? one.lang);
    if (!code || seen.has(code.toLowerCase())) continue;
    seen.add(code.toLowerCase());
    given.push([code, one]);
  }
  const codes = given.map(([code]) => code);
  return given.map(([code, one]) => {
    const own = nativeName(code);
    const untranslated = one.missing === true || absent.has(code.toLowerCase());
    const address = untranslated && homePattern
      ? homePattern.replace(/\{(code|lang)\}/gu, code)
      : text(one.href) || (pattern ? pattern.replace(/\{(code|lang)\}/gu, code) : '');
    return {
      code,
      label: text(one.label) || own,
      native: own,
      english: englishName(code),
      short: text(one.short) || shortLabelIn(code, codes),
      href: address,
      missing: untranslated,
      dir: dirOf(code),
    };
  });
}

// What a search compares: lower case in the root locale, without accents
// (é and ё compare as e and е), so a query matches whatever case and marks it
// is typed in.
const folded = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('und');

// The words a name is made of: split at spaces, hyphens, brackets and the
// like, so «português (Brasil)» is «português» and «brasil», and pt-BR is pt
// and br as well as pt-br.
const WORD_BREAK = /[\s\-\u2010-\u2015()（）[\],.;:'"«»·/]+/u;

/** The word starts of a text, folded: what a search query must begin. */
export function searchWords(...texts) {
  const words = new Set();
  for (const text of texts) {
    const whole = folded(text).trim();
    if (!whole) continue;
    words.add(whole);
    for (const word of whole.split(WORD_BREAK)) if (word) words.add(word);
  }
  return [...words];
}

/**
 * Whether a query finds a language by its words (searchWords): each word of
 * the query begins one of them. «ру» finds Русский and румынский, not
 * белорусский or грузинский, where «ру» is inside the word (research LG-8).
 */
export function matchesQuery(words, query) {
  const parts = folded(query).trim().split(WORD_BREAK).filter(Boolean);
  if (!parts.length) return true;
  return parts.every((part) => words.some((word) => word.startsWith(part)));
}

/**
 * The look for a number of languages: none, inline, menu, search or field. In auto
 * every count from two is the menu (owner decision C142: one button, no
 * jump of width from a track to a button when a language is added), from
 * searchFrom the menu with search; the track is mode="inline", for a
 * settings page. inlineMax (1 since 1.4.0) still lets auto draw the track up
 * to that count for a page that writes it.
 */
export function lookFor(count, {mode = 'auto', inlineMax = 1, searchFrom = 8} = {}) {
  if (count < 2) return 'none';
  if (mode === 'inline' || mode === 'menu' || mode === 'search' || mode === 'field') return mode;
  const inline = Number.isFinite(Number(inlineMax)) ? Number(inlineMax) : 1;
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

/**
 * The menu rows of a list of languages (sf-menu-context entries): the name in
 * itself; beside it, as the row's value, its name in the page's language
 * (owner decision C142 (3)), left out when it is the same word; under it, for
 * a language this page has no translation of, the line `missing` (C142 (6));
 * the radio mark on the chosen one; each row in its own language. A query
 * keeps the rows whose words it begins (research LG-8). `prefix` goes before
 * each row's id (an app menu's «language:»).
 */
export function languageRows(list, current, {page = 'en', query = '', missing = '', prefix = ''} = {}) {
  const same = (a, b) => String(a).toLocaleLowerCase() === String(b).toLocaleLowerCase();
  return list
    .filter((language) => !query || matchesQuery(searchWords(language.label, language.native, language.english, nameIn(language.code, page), pageName(language.code, page), language.code), query))
    .map((language) => {
      const second = pageName(language.code, page);
      return {
        id: `${prefix}${language.code}`,
        text: language.label,
        value: second && !same(second, language.label) && !same(second, language.native) ? second : undefined,
        caption: language.missing && missing ? missing : undefined,
        kind: 'radio',
        checked: language.code === current?.code,
        lang: language.code,
      };
    });
}
