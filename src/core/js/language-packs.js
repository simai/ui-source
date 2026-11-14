// Fetching language packs (owner decision C177, 2026-11-14; format
// docs/developer/language-packs.md, schema core/contracts/language-pack.v1.schema.json).
//
// ru and en are built into every component. Any other language is one file
// per language and delivery: the Framework's own are core/lang/<code>.json,
// listed in core/lang/index.json (written by scripts/build-language-packs.mjs),
// so a page asks only for a pack that exists. A page fetches a pack only when
// it speaks that language: <html lang> when core starts, SF.language.use(),
// or the first word a component looks up in it (a part of the page with a
// [lang] of its own). A product names its own pack the same way, one line:
// SF.language.addPack('kk', '/assets/product/lang/kk.json') or
// SF_BOOT_CONFIG.languages = {kk: '/assets/product/lang/kk.json'}.
//
// Only core fetches: every bundle carries page-language.js, which asks through
// the shared store (globalThis.__sfPageLanguage.packs) and reads the words.
import FRAMEWORK_PACKS from '../lang/index.mjs';
import { language, refreshLanguage } from './page-language.js';

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
  const asked = new Set();
  const fetched = new Set();
  const get = fetchJson ?? ((url) => globalThis.fetch(url, { credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }));

  const fetchSome = (code) => {
    const urls = (sources.get(code) ?? []).filter((url) => !fetched.has(url));
    if (!urls.length) return PACKS.pending.get(code) ?? Promise.resolve([]);
    for (const url of urls) fetched.add(url);
    const before = PACKS.pending.get(code) ?? Promise.resolve([]);
    const run = before.then(() => Promise.all(urls.map((url) => get(url).then(
      (pack) => ({ pack, url }),
      (error) => {
        globalThis.console?.warn?.(`[SIMAI Framework] language pack ${url} not loaded (${error?.message ?? error}); its words are said in English`);
        return null;
      },
    )))).then((arrived) => {
      // No longer pending before the words are taken: the drawing that
      // registering starts reports what the packs still lack (C177 (4)).
      if (PACKS.pending.get(code) === run) PACKS.pending.delete(code);
      const taken = arrived.filter(Boolean).map(({ pack, url }) => language.registerPack(pack, url));
      if (!taken.some(Boolean)) refreshLanguage();
      return taken;
    });
    PACKS.pending.set(code, run);
    return run;
  };

  PACKS.add = (code, url) => {
    if (!code || !url) return false;
    const href = resolve(url);
    if (!sources.has(code)) sources.set(code, []);
    if (!sources.get(code).includes(href)) sources.get(code).push(href);
    // A pack named after its language was asked for is fetched now.
    if (asked.has(code)) fetchSome(code);
    return true;
  };
  PACKS.load = (code) => {
    const codes = [...new Set([code.split('-')[0], code])];
    for (const one of codes) asked.add(one);
    return Promise.all(codes.map(fetchSome)).then((lists) => lists.flat());
  };
  PACKS.request = (code) => {
    if (asked.has(code)) return;
    asked.add(code);
    if (sources.has(code)) fetchSome(code);
  };

  for (const code of packs?.languages ?? []) PACKS.add(code, `${root}lang/${code}.json`);
  const configured = globalThis.SF_BOOT_CONFIG?.languages;
  if (configured && typeof configured === 'object') {
    for (const [code, urls] of Object.entries(configured)) {
      for (const url of [].concat(urls)) PACKS.add(String(code).trim().toLowerCase(), url);
    }
  }
  // The page's own language, as soon as core runs, so the words are usually
  // here before the first component draws.
  const lang = globalThis.document?.documentElement?.getAttribute('lang');
  if (lang) {
    const wanted = String(lang).trim().toLowerCase().replace('_', '-');
    const base = wanted.split('-')[0];
    if (base !== 'ru' && base !== 'en') {
      PACKS.request(base);
      if (wanted !== base) PACKS.request(wanted);
    }
  }
  return PACKS;
}
