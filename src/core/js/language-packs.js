// Fetching language packs (owner decision C177, 2026-11-14; format
// docs/developer/language-packs.md, schema core/contracts/language-pack.v1.schema.json).
//
// English is built into every component (owner decision C282, 2026-11-17:
// core/lang/built-in.json). Any other language, Russian too, is one pack
// per language and delivery. The Framework's own is written in parts, one per
// component family (core/lang/<code>/<family>.json, listed with the
// components each holds in core/lang/index.json, written by
// scripts/build-language-packs.mjs), so a page asks only for a part that
// exists and only for the families it shows (C177 follow-up: one language file
// had reached 15.2 KB gzip with half the words to come). A page fetches when
// it speaks that language: <html lang> when core starts (core's words and the
// families of the elements already in the document, again when the document
// is parsed), SF.language.use(), or the first word a component looks up in it
// (its family's part; a part of the page with a [lang] of its own).
// SF.language.load(code) fetches every part. A product names its own pack,
// one file, the same way, one line:
// SF.language.addPack('de', '/assets/product/lang/de.json') or
// SF_BOOT_CONFIG.languages = {de: '/assets/product/lang/de.json'}.
//
// A page may instead include a pack's script form before core.js
// (core/lang/<code>.js, C282): its words are in the registry before core runs,
// it is marked as here whole, and core fetches no Framework part of that
// language.
//
// Only core fetches: every bundle carries page-language.js, which asks through
// the shared store (globalThis.__sfPageLanguage.packs) and reads the words.
import FRAMEWORK_PACKS from '../lang/index.mjs';
import BUILT_IN_LANGUAGES from '../lang/built-in.mjs';
import { language, refreshLanguage } from './page-language.js';

const BUILT_IN = new Set(['en', ...(BUILT_IN_LANGUAGES?.built_in ?? [])]);

// The family of core's own words (file sizes, relative days): fetched with the
// language, as core formats without a component to ask for them.
const CORE_PART = 'core';

const STORE = globalThis.__sfPageLanguage;
const PACKS = STORE?.packs;

// Where core came from (public-path.js): core/lang/ beside core/js/.
function coreRoot() {
  try {
    // eslint-disable-next-line no-undef
    return typeof __webpack_public_path__ === 'string' && __webpack_public_path__ ? __webpack_public_path__ : '';
  } catch {
    return '';
  }
}

function resolve(url) {
  try {
    return new URL(url, globalThis.document?.baseURI ?? undefined).href;
  } catch {
    return String(url);
  }
}

export function installLanguagePacks({ root = coreRoot(), packs = FRAMEWORK_PACKS, fetchJson, again = false } = {}) {
  // Once per page: a second core (two pairs on one page) leaves the first's.
  // `again` is for tests.
  if (!PACKS || (PACKS.request && !again)) return PACKS;
  const sources = new Map();
  const parts = new Map();
  const asked = new Set();
  const fetched = new Set();
  const inFlight = new Map();
  const get = fetchJson ?? ((url) => globalThis.fetch(url, { credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }));

  // One drawing for the parts that arrive before the next frame, not one per
  // part.
  let drawing = false;
  const redraw = () => {
    if (drawing) return;
    drawing = true;
    const run = () => {
      drawing = false;
      refreshLanguage();
    };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
    else run();
  };

  const fetchSome = (code, urls) => {
    const fresh = [...new Set(urls)].filter((url) => !fetched.has(url));
    if (!fresh.length) return PACKS.pending.get(code) ?? Promise.resolve([]);
    for (const url of fresh) fetched.add(url);
    inFlight.set(code, (inFlight.get(code) ?? 0) + 1);
    const mine = Promise.all(fresh.map((url) => get(url).then(
      (pack) => ({ pack, url }),
      (error) => {
        globalThis.console?.warn?.(`[SIMAI Framework] language pack ${url} not loaded (${error?.message ?? error}); its words are said in English`);
        return null;
      },
    ))).then((arrived) => {
      // No longer pending before the words are taken: the drawing that
      // registering starts reports what the packs still lack (C177 (4)).
      const left = inFlight.get(code) - 1;
      if (left) inFlight.set(code, left);
      else {
        inFlight.delete(code);
        PACKS.pending.delete(code);
      }
      PACKS.quiet = (PACKS.quiet ?? 0) + 1;
      let taken;
      try {
        taken = arrived.filter(Boolean).map(({ pack, url }) => language.registerPack(pack, url));
      } finally {
        PACKS.quiet -= 1;
      }
      redraw();
      return taken;
    });
    const before = PACKS.pending.get(code);
    const all = before ? Promise.all([before, mine]).then(([earlier, now]) => [...earlier, ...now]) : mine;
    PACKS.pending.set(code, all);
    return all;
  };

  // A Framework pack of the language already here whole: its script form,
  // included before core (C282). Its parts are not fetched.
  const whole = (code) => (PACKS.loaded.get(code) ?? []).some((info) => info?.whole && (info.delivery ?? 'framework') === 'framework');

  // The Framework's parts of a language: {url of a family, family of a component}.
  const partUrl = (code, family) => parts.get(code)?.urls.get(family);
  // A component's words may ride in two parts (C282: core says a few of a
  // Smart component's words itself): every one of them.
  const familiesOf = (code, component) => [...(parts.get(code)?.families.get(component) ?? [])];

  // What the page shows now: core's words and the families of the elements
  // already in the document. While the document is parsed, again once it is.
  const shown = (code) => {
    const known = parts.get(code);
    if (!known) return [];
    const families = new Set([CORE_PART]);
    const doc = globalThis.document;
    const tags = [...known.families.keys()].filter((id) => /^[a-z][a-z0-9]*-[a-z0-9-]*$/u.test(id));
    try {
      // A tag, or a class component's class (sf-tabs, sf-slider: C282).
      const selector = tags.flatMap((id) => [id, `.${id}`]).join(',');
      for (const element of selector ? doc?.querySelectorAll?.(selector) ?? [] : []) {
        const ids = [String(element.localName ?? element.tagName ?? '').toLowerCase(), ...(element.classList ?? [])];
        for (const id of ids) {
          for (const family of known.families.get(id) ?? []) families.add(family);
        }
      }
    } catch {
      // A document that cannot be asked: the parts come with the first words.
    }
    return [...families].map((family) => partUrl(code, family)).filter(Boolean);
  };

  const begin = (code) => {
    if (asked.has(code)) return;
    asked.add(code);
    fetchSome(code, [...(sources.get(code) ?? []), ...(whole(code) ? [] : shown(code))]);
    const doc = globalThis.document;
    if (parts.has(code) && doc?.readyState === 'loading' && typeof doc.addEventListener === 'function') {
      doc.addEventListener('DOMContentLoaded', () => {
        if (!whole(code)) fetchSome(code, shown(code));
      }, { once: true });
    }
  };

  PACKS.add = (code, url) => {
    if (!code || !url) return false;
    const href = resolve(url);
    if (!sources.has(code)) sources.set(code, []);
    if (!sources.get(code).includes(href)) sources.get(code).push(href);
    // A pack named after its language was asked for is fetched now.
    if (asked.has(code)) fetchSome(code, [href]);
    return true;
  };
  PACKS.load = (code) => {
    const codes = [...new Set([code.split('-')[0], code])];
    for (const one of codes) begin(one);
    return Promise.all(codes.map((one) => fetchSome(one, [...(sources.get(one) ?? []), ...(whole(one) ? [] : parts.get(one)?.urls.values() ?? [])])))
      .then((lists) => lists.flat());
  };
  // A bundle asks for a language and, from page-language.js of this pair on,
  // names the component that looks up a word: its family's part comes too.
  PACKS.request = (code, component) => {
    begin(code);
    const families = component && !whole(code) ? familiesOf(code, component) : [];
    if (families.length) fetchSome(code, families.map((family) => partUrl(code, family)));
  };

  for (const code of packs?.languages ?? []) {
    const byFamily = packs?.parts?.[code];
    if (!byFamily || typeof byFamily !== 'object') {
      PACKS.add(code, `${root}lang/${code}.json`);
      continue;
    }
    const known = { urls: new Map(), families: new Map() };
    for (const [family, components] of Object.entries(byFamily)) {
      known.urls.set(family, resolve(`${root}lang/${code}/${family}.json`));
      for (const component of [].concat(components)) {
        if (!known.families.has(component)) known.families.set(component, new Set());
        known.families.get(component).add(family);
      }
    }
    parts.set(code, known);
  }
  const configured = globalThis.SF_BOOT_CONFIG?.languages;
  if (configured && typeof configured === 'object') {
    for (const [code, urls] of Object.entries(configured)) {
      for (const url of [].concat(urls)) PACKS.add(String(code).trim().toLowerCase(), url);
    }
  }
  // The page's own language, as soon as core runs, so the words are usually
  // here before the first component draws; the Loader holds the components
  // while they are on their way (core/js/loader.js languageHold, C282).
  const lang = globalThis.document?.documentElement?.getAttribute('lang');
  if (lang) {
    const wanted = String(lang).trim().toLowerCase().replace('_', '-');
    const base = wanted.split('-')[0];
    if (!BUILT_IN.has(base)) {
      PACKS.request(base);
      if (wanted !== base) PACKS.request(wanted);
    }
  }
  return PACKS;
}
