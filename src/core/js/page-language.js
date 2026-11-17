// What language a component speaks, and how a product adds one.
//
// The Framework speaks English by default and whatever the page says otherwise:
// the language is the nearest [lang] above the node, else the document's, else
// English. One rule for every component, so a page never mixes two because two
// components looked in different places.
//
// Until 2026-10-10 that was the whole of it, and every component carried a
// dictionary of exactly two languages written into its source. Adding a third
// meant editing sixteen files, and a product that needed one could not add it
// at all. There will be many more than two (owner, 2026-10-11), so the
// dictionaries a component ships are now a FLOOR rather than the whole set:
// anything can be registered beside them, for any language, including one the
// Framework has never heard of.
//
// Where a word comes from, in order:
//
//   1. the component's own attribute — a consumer who names a word has named
//      it, and no language changes it;
//   2. a word registered for the resolved language;
//   3. the word the component ships for that language;
//   4. the same two again for the language without its region (`pt-BR` → `pt`);
//   5. the same two again for English;
//   6. the key itself, which is a visible defect rather than a blank.
//
// Registering is additive and reversible, and it does not require the
// Framework to know the language exists.

// The state is shared between every copy of this module, which there are
// several of: core, each smart component and each composite are separate
// bundles, and each one carries its own copy of this file. With the registry
// in module scope the page had as many registries as bundles -- `SF.language`
// was published from core's copy, the table read its own, and registering a
// language changed nothing on screen. Only a browser shows that, and it did
// (2026-10-11).
import {canonicalTag} from './tag-aliases.js';
// The languages built into the bundles (owner decision C282): English; every
// other language, Russian too, is a language file (core/js/language-packs.js).
import BUILT_IN_LANGUAGES from '../lang/built-in.mjs';

const STORE = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfPageLanguage';
  if (!root[key]) {
    root[key] = { listeners: new Set(), registered: new Map(), chosen: null };
  }
  return root[key];
})();

const LISTENERS = STORE.listeners;
const REGISTERED = STORE.registered;

// Language packs (owner decision C177, 2026-11-14; C282, 2026-11-17): every
// language but English, the one built in, is one file per language and
// delivery, fetched only by a page that speaks it (or included before core as
// its script form, core/lang/<code>.js). A pack's words go into the same registry as words registered one
// by one -- so a bundle built before packs existed reads them too -- a
// Framework pack's beneath what is there, any other pack's over it: a product
// overrides a Framework word whichever arrived first. The fetching is core's
// (core/js/language-packs.js); each bundle only asks for a language. A STORE
// made by an older bundle has no packs yet: they are added here.
const PACKS = (STORE.packs ??= {
  loaded: new Map(), pending: new Map(), request: null,
});
// The languages built into the bundles: English, and in a rollback build Russian
// too (src/core/lang/built-in.json, C282).
const isBuiltIn = (code) => code === 'en' || (BUILT_IN_LANGUAGES?.built_in ?? []).includes(code);

/**
 * Ask core for the pack of a language this page speaks (nothing for a
 * built-in language), and for the part that holds `component`'s words: the Framework's pack
 * comes in parts by family (core/js/language-packs.js). A core from before
 * parts takes the language alone.
 */
function needPack(code, component) {
  const wanted = normalise(code);
  const base = wanted.split('-')[0];
  if (!base || isBuiltIn(base) || typeof PACKS.request !== 'function') return;
  const name = component ? canonicalTag(component) : undefined;
  PACKS.request(base, name);
  if (wanted !== base) PACKS.request(wanted, name);
}

// Words are kept under a component's current tag: a product that registered
// them for a renamed tag (sf-datepicker, now sf-input-date) keeps its words
// while the old tag is a dated alias, whichever name the element was written
// with (core/js/tag-aliases.js).
const wordsOf = (component) => REGISTERED.get(canonicalTag(component));

function normalise(value) {
  return String(value ?? '').trim().toLowerCase().replace('_', '-');
}

/** The languages to try, most specific first, English last. */
const chain = (language) => {
  const wanted = normalise(language);
  const base = wanted.split('-')[0];
  const order = [];
  for (const candidate of [wanted, base, 'en']) {
    if (candidate && !order.includes(candidate)) order.push(candidate);
  }
  return order;
};

/** Which component a node belongs to, for words registered against one. */
const componentOf = (node) => {
  const tag = node?.tagName;
  return typeof tag === 'string' ? tag.toLowerCase() : null;
};

// A layer drawn in a portal carries a copy of its host's language, stamped by
// carryLayerOrigin (§19.1). When that copy came from the page itself, it has
// to follow the page before the listeners draw: a word read inside a drawer
// during SF.language.use() answered the language the page had just left, and
// the portal was carried again only later, with nothing to draw it again
// (simai/ui-source#55, found by ui-mail). A portal whose host sits in a
// section with a language of its own is not touched: that section means it.
const carryPageLanguage = () => {
  const doc = globalThis.document;
  if (!doc?.querySelectorAll) return;
  const lang = doc.documentElement?.getAttribute('lang') || '';
  for (const portal of doc.querySelectorAll('[data-sf-layer-lang="page"]')) {
    if (lang) portal.setAttribute('lang', lang);
    else portal.removeAttribute('lang');
  }
};

const announce = () => {
  carryPageLanguage();
  for (const listener of [...LISTENERS]) {
    try {
      listener();
    } catch {
      // A listener that throws is not allowed to stop the others: a page that
      // half-changed language would be worse than one that did not change.
    }
  }
};

// The nearest element that says its language, looking past shadow roots: a
// pagination drawn inside a data view's shadow root found no [lang] there,
// fell back to <html lang> and spoke English inside a Russian admin whose
// language was set on the shell around it.
function langOwner(node) {
  let current = node;
  while (current) {
    const owner = typeof current.closest === 'function' ? current.closest('[lang]') : null;
    if (owner) return owner;
    const root = typeof current.getRootNode === 'function' ? current.getRootNode() : null;
    current = root && root !== current && root.host ? root.host : null;
  }
  return null;
}

// The language of a part of the page wins over the language chosen for the
// whole page (owner, 2026-10-26; standard simai.smart-component 1.3.8 §11.1):
//   1. a word given on the element itself (the component's own attribute);
//   2. the nearest [lang] below <html>;
//   3. the page's choice, SF.language.use(), which also sets <html lang>;
//   4. <html lang>;
//   5. English.
// Until 2026-10-27 the choice won over a section's [lang], so an English
// section inside a Russian page that had called use('ru') spoke Russian.
function languageSource(node) {
  const owner = langOwner(node);
  const root = globalThis.document?.documentElement ?? null;
  if (owner && owner !== root) return owner.getAttribute('lang');
  if (STORE.chosen) return STORE.chosen;
  return owner?.getAttribute('lang') || root?.lang || 'en';
}

/**
 * The page's language for this node: the nearest [lang] below <html>, else
 * the language the page chose, else <html lang>, else English.
 */
export function pageLanguage(node) {
  // The language without its region, whichever way it was set: a page that
  // chose 'pt-BR' is a Portuguese page, as a page whose markup says
  // lang="pt-BR" is. The chosen value kept its region and answered 'pt-br',
  // which matched no dictionary keyed by language and made isRussianPage false
  // on a page that chose 'ru-RU'. The region stays in pageLocale.
  return normalise(languageSource(node)).split('-')[0] || 'en';
}

/** The page's language with its region kept, which is what formatting wants. */
export function pageLocale(node) {
  return normalise(languageSource(node)) || 'en';
}

/**
 * Follows `lang` in the document (§11.1 «changes are followed»): one observer
 * for the page, whichever bundle starts it, and the elements under a changed
 * [lang] draw again. `element.requestComponentUpdate('language')` is what a
 * Smart element does; anything else passes its own `redraw`. Returns the way
 * to stop following.
 */
export function followLanguage(element, redraw = () => element.requestComponentUpdate?.('language')) {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const doc = element?.ownerDocument ?? root.document;
  const Observer = doc?.defaultView?.MutationObserver ?? root.MutationObserver;
  if (!doc?.documentElement || typeof Observer !== 'function') return () => {};
  if (!root.__sfLanguageWatch || root.__sfLanguageWatch.document !== doc) {
    const watch = {document: doc, elements: new Map(), observer: null};
    watch.observer = new Observer((records) => {
      const changed = [...new Set(records.map((record) => record.target))];
      for (const [one, again] of [...watch.elements]) {
        if (changed.some((target) => within(target, one))) {
          try {
            again();
          } catch {
            // One element that fails to draw does not keep the others in the
            // old language.
          }
        }
      }
    });
    watch.observer.observe(doc.documentElement, {attributes: true, attributeFilter: ['lang'], subtree: true});
    root.__sfLanguageWatch = watch;
  }
  const watch = root.__sfLanguageWatch;
  watch.elements.set(element, redraw);
  return () => watch.elements.delete(element);
}

// Whether `node` is `target` or below it, across shadow roots.
function within(target, node) {
  for (let current = node; current; ) {
    if (current === target) return true;
    current = current.parentNode || current.host || null;
  }
  return false;
}

/**
 * Tell the page's components that words changed without a registration: the
 * composition editor words arrive in a chunk of their own (LC-1) and the
 * forms drawn before them draw again.
 */
export function refreshLanguage() {
  announce();
}

export function isRussianPage(node) {
  return pageLanguage(node) === 'ru';
}

/**
 * Text for `key` in the page's language.
 *
 * `dictionary` is what the component ships; `component` names it for the
 * registry and defaults to the node's own tag, so a component calling with
 * `this` identifies itself without saying so twice.
 */
export function pageText(dictionary, key, node, component) {
  return localeText(dictionary, key, pageLocale(node), component ?? componentOf(node));
}

/**
 * Text for `key` in a named language, with no node to read it from: a server
 * fallback or a form drawn before it is placed. The same order as pageText --
 * words registered for `component`, then the shipped ones, for the language,
 * the language without its region and English -- and the key last.
 */
export function localeText(dictionary, key, locale, component) {
  const order = chain(locale || 'en');
  needPack(order[0], component);
  for (const candidate of order) {
    const added = component ? wordsOf(component)?.get(candidate)?.[key] : undefined;
    if (added !== undefined) {
      if (candidate === 'en' && added !== '') warnFallback(order, component, key);
      return added;
    }
    const shipped = dictionary?.[candidate]?.[key];
    if (shipped !== undefined) {
      if (candidate === 'en' && shipped !== '') warnFallback(order, component, key);
      return shipped;
    }
  }
  return key;
}

// A language the Framework does not ship (owner decision C177 (4)) may come
// partly translated: a word it lacks is said in the fallback language,
// English, and that is shown, not silent (localization study LC-6). One
// warning per page and language (de-AT and de are one), naming the first word
// missed; every word missed is kept by language for SF.language.missing(),
// and the language files' coverage is scripts/language-coverage.mjs. Kept on
// the shared global, because every bundle carries this module.
function warnFallback(order, owner, key) {
  const wanted = String(order[0] || '').split('-')[0];
  // While its pack is on its way the English is a moment, not a gap.
  if (!wanted || wanted === 'en' || PACKS.pending.has(wanted)) return;
  const root = globalThis;
  if (!(root.__sfMissingWords instanceof Map)) root.__sfMissingWords = new Map();
  const seen = root.__sfMissingWords;
  if (!seen.has(wanted)) {
    seen.set(wanted, new Set());
    root.console?.warn?.(`[SIMAI Framework] "${wanted}": words missing, said in English (first: ${owner || 'component'} "${key}"); SF.language.missing('${wanted}') lists them`);
  }
  seen.get(wanted).add(`${owner || 'component'}|${key}`);
}

// Missing words are said once per component, word and language: a page that
// draws a hundred rows must not print a hundred warnings. The marks are kept on
// the shared global, because every bundle carries this module.
function warnWord(owner, key, locale, said) {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!(root.__sfWordWarnings instanceof Set)) root.__sfWordWarnings = new Set();
  const mark = `${owner}|${key}|${locale}|${said}`;
  if (root.__sfWordWarnings.has(mark)) return;
  root.__sfWordWarnings.add(mark);
  globalThis.console?.warn?.(`[SIMAI Framework] ${owner || 'component'}: no word "${key}" for ${locale}${said === 'key' ? '; the key is shown' : `; said in ${said}`}`);
}

function fill(text, locale, count, vars) {
  return String(text).replace(/\{([a-z][\w-]*)\}/giu, (whole, name) => {
    if (name === 'n' && count !== undefined) {
      try {
        return new Intl.NumberFormat(locale).format(count);
      } catch {
        return String(count);
      }
    }
    return vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
  });
}

/**
 * A component's own word (standard simai.smart-component 1.3.8 §11, §11.1).
 *
 * `dictionary` is `{<locale>: {<key>: word}}` from the component's language
 * files. A word given on the element itself is the caller's to prefer; this
 * resolves the rest: words registered for the element's language, then the
 * shipped ones, the language without its region, English, the component's
 * source language and, last, the key. The last two warn once. A word that
 * takes a number is an object of plural forms chosen by Intl.PluralRules of
 * the language the word was found in; `{n}` is the number in that language's
 * format and `{name}` takes `vars.name`.
 *
 * `former` names the key the same word had before a rename (one key or a
 * list): a product that registered its words under the old key keeps them
 * until the alias's day. For each language the word registered under the new
 * key wins, then one registered under an old key, then the shipped one; a
 * word taken by an old key is reported to `onFormer(oldKey)`, which notes the
 * deprecation.
 */
export function pageWord(dictionary, key, node, {component, source = '', count, vars, former, onFormer} = {}) {
  const owner = component ?? componentOf(node);
  const locale = pageLocale(node);
  const order = chain(locale);
  const sourceLanguage = normalise(source);
  if (sourceLanguage && !order.includes(sourceLanguage)) order.push(sourceLanguage);
  const formerKeys = former === undefined || former === null ? [] : [].concat(former);
  needPack(locale, owner);
  for (const candidate of order) {
    const registered = owner ? wordsOf(owner)?.get(candidate) : undefined;
    let added = registered?.[key];
    if (added === undefined && registered) {
      const old = formerKeys.find((name) => registered[name] !== undefined && registered[name] !== null);
      if (old !== undefined) {
        added = registered[old];
        onFormer?.(old);
      }
    }
    const word = added !== undefined ? added : dictionary?.[candidate]?.[key];
    if (word === undefined || word === null) continue;
    if (candidate === sourceLanguage && !chain(locale).includes(candidate)) warnWord(owner, key, locale, candidate);
    if (candidate === 'en' && word !== '') warnFallback(chain(locale), owner, key);
    if (typeof word === 'object') {
      let form = 'other';
      if (count !== undefined) {
        try {
          form = new Intl.PluralRules(candidate).select(Number(count));
        } catch {
          form = 'other';
        }
      }
      const picked = word[form] ?? word.other;
      if (picked === undefined) continue;
      return fill(picked, candidate, count, vars);
    }
    return fill(word, candidate, count, vars);
  }
  warnWord(owner, key, locale, 'key');
  return key;
}

/**
 * The word a product registered (SF.language.register, or a product pack)
 * under `key` for the node's language, its base language or English; the
 * words a component ships are not read. Undefined when none is registered.
 * A removed word key kept as a dated alias reads this: the old phrase is
 * said only while a product still writes the old key.
 */
export function registeredWord(component, key, node) {
  const byLanguage = wordsOf(component ?? componentOf(node));
  if (!byLanguage) return undefined;
  for (const candidate of chain(pageLocale(node))) {
    const word = byLanguage.get(candidate)?.[key];
    if (word !== undefined && word !== null) return word;
  }
  return undefined;
}

export const language = {
  /** What the page resolves to for this node, region and all. */
  current(node = globalThis.document?.documentElement ?? null) {
    return pageLocale(node);
  },

  /**
   * Choose a language for the whole page, whatever its markup says. `null`
   * returns to following the document, which is the default and what a
   * server-rendered page wants.
   */
  use(value) {
    const next = value === null || value === undefined ? null : normalise(value);
    if (next === STORE.chosen) return STORE.chosen;
    STORE.chosen = next;
    if (next) needPack(next);
    // The choice is the page's language: <html lang> says it too (§11.1), so
    // the browser, a screen reader and CSS :lang() agree with the words.
    // use(null) gives the markup's own language back.
    const root = globalThis.document?.documentElement;
    if (root) {
      const holder = globalThis;
      if (next) {
        if (holder.__sfMarkupLanguage === undefined) holder.__sfMarkupLanguage = root.getAttribute('lang');
        if (root.getAttribute('lang') !== next) root.setAttribute('lang', next);
      } else if (holder.__sfMarkupLanguage !== undefined) {
        if (holder.__sfMarkupLanguage === null) root.removeAttribute('lang');
        else root.setAttribute('lang', holder.__sfMarkupLanguage);
        holder.__sfMarkupLanguage = undefined;
      }
    }
    announce();
    return STORE.chosen;
  },

  /**
   * Add or replace one component's words for one language.
   *
   * The words are merged, so a product can correct a single label without
   * restating the rest, and `null` removes what it added.
   */
  register(component, value, words) {
    const name = canonicalTag(component ?? '');
    const code = normalise(value);
    if (!name || !code) throw new TypeError('a component and a language are required');
    if (!REGISTERED.has(name)) REGISTERED.set(name, new Map());
    const byLanguage = REGISTERED.get(name);
    if (words === null) byLanguage.delete(code);
    else byLanguage.set(code, { ...(byLanguage.get(code) ?? {}), ...words });
    announce();
    return this;
  },

  /**
   * A language pack (schema simai.language-pack, schema_version 1; schema
   * core/contracts/language-pack.v1.schema.json): every word of one language
   * for one delivery, by component. A Framework pack's words go beneath the
   * words already registered, any other pack's over them, as register() does.
   * The page draws again once. Answers what was taken, or null for something
   * that is not a pack.
   */
  registerPack(pack, url = null) {
    const code = normalise(pack?.lang);
    if (pack?.schema !== 'simai.language-pack' || pack.schema_version !== 1 || !code || !pack.words || typeof pack.words !== 'object') {
      globalThis.console?.warn?.(`[SIMAI Framework] not a language pack (simai.language-pack, schema_version 1)${url ? `: ${url}` : ''}`);
      return null;
    }
    const under = (pack.delivery ?? 'framework') === 'framework';
    let words = 0;
    for (const [component, byKey] of Object.entries(pack.words)) {
      if (!byKey || typeof byKey !== 'object') continue;
      const name = canonicalTag(component);
      if (!REGISTERED.has(name)) REGISTERED.set(name, new Map());
      const byLanguage = REGISTERED.get(name);
      const now = byLanguage.get(code) ?? {};
      byLanguage.set(code, under ? { ...byKey, ...now } : { ...now, ...byKey });
      words += Object.keys(byKey).length;
    }
    const info = { lang: code, delivery: pack.delivery ?? 'framework', status: pack.status ?? null, coverage: pack.coverage ?? null, words, url };
    PACKS.loaded.set(code, [...(PACKS.loaded.get(code) ?? []), info]);
    // Core registers the parts that arrived together and draws once
    // (PACKS.quiet while it does).
    if (!PACKS.quiet) announce();
    return info;
  },

  /**
   * Name a pack file to fetch when the page needs its language: one line for
   * a product or a page (also SF_BOOT_CONFIG.languages = {code: url}). Core
   * fetches it once, with the Framework's own pack of that language.
   */
  addPack(value, url) {
    return PACKS.add ? PACKS.add(normalise(value), url) : false;
  },

  /** Fetch the packs of a language now; resolves when they are registered. */
  load(value) {
    return PACKS.load ? PACKS.load(normalise(value)) : Promise.resolve([]);
  },

  /** The packs on the page: {code: [{lang, delivery, status, coverage, words, url}]}. */
  packs() {
    return Object.fromEntries([...PACKS.loaded].map(([code, list]) => [code, list.map((info) => ({ ...info }))]));
  },

  /** One language across many components: `{ 'sf-input-date': {...}, ... }`. */
  registerAll(value, byComponent = {}) {
    for (const [component, words] of Object.entries(byComponent)) {
      this.register(component, value, words);
    }
    return this;
  },

  /** The languages something has registered words for. */
  known(component) {
    return [...(wordsOf(component ?? '')?.keys() ?? [])];
  },

  /**
   * The words the page has said in English so far for want of one in
   * `value` (C177 (4): a language may ship partly; what it lacks is visible).
   * `['sf-pagination|pages-label', ...]`; every language's when none is named.
   */
  missing(value) {
    const seen = globalThis.__sfMissingWords instanceof Map ? globalThis.__sfMissingWords : new Map();
    if (value === undefined) return Object.fromEntries([...seen].map(([code, words]) => [code, [...words]]));
    return [...(seen.get(normalise(value).split('-')[0]) ?? [])];
  },

  /** Every component something has been registered for. */
  components() {
    return [...REGISTERED.keys()];
  },

  /**
   * Called whenever the chosen language or the registered words change, so a
   * component can draw itself again. Returns the way to stop listening.
   */
  onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    LISTENERS.add(listener);
    return () => LISTENERS.delete(listener);
  },

  /** Everything registered is forgotten. For tests, and for a product reset. */
  forget() {
    REGISTERED.clear();
    PACKS.loaded.clear();
    STORE.chosen = null;
    announce();
    return this;
  },
};

// Reachable by a consumer, which it was not: `sf-admin-menu` had written its
// own reading of the rule because the shared one was an internal module, and
// the two then disagreed about a region that names its own language. A product
// composing its own elements gets the same rule here.
if (typeof window !== 'undefined') {
    window.SF = window.SF || {};
    // Every bundle publishes its copy; they share one store, so any copy
    // answers alike -- except that a bundle built before language packs
    // (an older package on the page) has no registerPack, addPack, load or
    // packs. Once a copy with them is published, an older one does not
    // replace it (C177).
    const holder = window.SF;
    if (!Object.getOwnPropertyDescriptor(holder, 'language')?.set) {
      let published = holder.language;
      Object.defineProperty(holder, 'language', {
        configurable: true,
        enumerable: true,
        get: () => published,
        set: (value) => {
          if (typeof value?.registerPack === 'function' || typeof published?.registerPack !== 'function') published = value;
        },
      });
    }
    holder.language = language;
    window.SF.pageLanguage = pageLanguage;
    window.SF.pageText = pageText;
}
