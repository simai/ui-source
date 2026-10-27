// The words of an assembly (standard simai.smart-component 1.3.8 §11): its
// language files, `lang/<locale>.json`, keyed by locale. A rule passes codes
// and numbers, never words (§9); the words a part says because of a rule are
// `roles.<role>.words.<code>`, a word or plural forms with `{n}` (§11.2); a
// role's constant word settings are `roles.<role>.settings.<setting>` (§7.2);
// the words of a constant list's entries are `roles.<role>.items.<value>` and
// `roles.<role>.columns.<key>` (§11.3).
//
// Missing words fall back to English, then to the source language, then to
// nothing; the last two are reported (§11.1).

import {at} from './values.mjs';

const PLURALS = new Map();
const NUMBERS = new Map();

const normalise = (locale) => String(locale ?? '').trim().toLowerCase().replace('_', '-');

function plural(locale) {
  if (!PLURALS.has(locale)) {
    let rules = null;
    try { rules = new Intl.PluralRules(locale); } catch { rules = new Intl.PluralRules('en'); }
    PLURALS.set(locale, rules);
  }
  return PLURALS.get(locale);
}

function number(locale, n) {
  if (!NUMBERS.has(locale)) {
    let format = null;
    try { format = new Intl.NumberFormat(locale); } catch { format = new Intl.NumberFormat('en'); }
    NUMBERS.set(locale, format);
  }
  return NUMBERS.get(locale).format(n);
}

/** A word, or plural forms chosen by `n` in `locale`, with `{n}` in the page's number format (§11.1, §11.2). */
export function say(word, n, locale = 'en') {
  if (word === null || word === undefined) return null;
  let text = word;
  if (typeof word === 'object') {
    const count = Number(n ?? 0);
    const form = n === 0 && word.zero !== undefined ? 'zero' : plural(locale).select(Number.isFinite(count) ? count : 0);
    text = word[form] ?? word.other;
    if (text === undefined) return null;
  }
  text = String(text);
  if (n === undefined || n === null || !text.includes('{n}')) return text;
  const count = Number(n);
  return text.split('{n}').join(Number.isFinite(count) ? number(locale, count) : String(n));
}

/**
 * The words of one assembly. `files` is `{<locale>: <language file>}`;
 * `source` is the language the assembly was written in (its first file when
 * not given).
 */
export function createWords(files = {}, source = null) {
  const byLocale = new Map(Object.entries(files ?? {}).map(([locale, file]) => [normalise(locale), file]));
  const sourceLocale = normalise(source ?? byLocale.keys().next().value ?? 'en');

  /** `{word, from}` for a dotted path: `from` is the locale it came from, or null. */
  function find(locale, path) {
    const wanted = normalise(locale) || 'en';
    const order = [];
    for (const candidate of [wanted, wanted.split('-')[0], 'en', sourceLocale]) if (candidate && !order.includes(candidate)) order.push(candidate);
    for (const candidate of order) {
      const word = at(byLocale.get(candidate), path);
      if (word !== undefined && word !== null) return {word, from: candidate, fallback: candidate !== wanted && candidate !== wanted.split('-')[0] && candidate !== 'en'};
    }
    return {word: null, from: null, fallback: true};
  }

  return {
    locales: () => [...byLocale.keys()],
    source: sourceLocale,
    find,
    /** The word at `path` said in `locale` with the number `n`; null when there is none. */
    text(locale, path, n) {
      const {word} = find(locale, path);
      return say(word, n, normalise(locale) || 'en');
    },
  };
}
