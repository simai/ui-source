// Language packs: one file per language and delivery (owner decision C177,
// 2026-11-14; format docs/developer/language-packs.md, schema
// src/core/contracts/language-pack.v1.schema.json).
//
// Every component keeps its words in its own folder, one file per language
// (lang/<code>.json, the words on screen under `runtime`). English is built
// into the component's bundle; every other language, Russian too (owner
// decision C282, 2026-11-17), is collected here into one pack for the whole
// delivery, which a page fetches only when it speaks that language. A language
// may come in parts: what a pack lacks is said in English and counted in its
// `coverage` (scripts/language-coverage.mjs lists it); en and ru must be
// complete (src/core/lang/built-in.json `complete`), so a word missing in them
// fails the check.
//
// Each pack is written in two forms of the same words (C282):
//   - core/lang/<code>/<family>.json, the parts core fetches for a page in that
//     language (below);
//   - core/lang/<code>.js, the whole pack as a classic script a page includes
//     before core.js: its words are in the registry before any component
//     draws, offline (file://) and in a one-file build too, and core fetches
//     nothing for that language.
//
// Which languages a bundle carries is src/core/lang/built-in.json; this script
// writes every language folder's lang/index.mjs from it (the module a bundle
// imports its words through), so built_in ["en", "ru"] and a rebuild put
// Russian back into the bundles (rollback).
//
// The Framework's own pack is written in parts, one per component family
// (component.json `family`; core's words are the family `core`): a page
// fetches the parts of the families it shows, not every word of the
// Framework (C177 follow-up: the Kazakh pack reached 15.2 KB gzip of a 16 KB
// cap with half the Framework's words still to come). Each part is a whole
// pack of the format; index.json says which components each part holds.
// Another delivery (ui-pro, ui-chart, a product) writes one file per language
// unless it asks for parts with --parts.
//
//   node scripts/build-language-packs.mjs            write src/core/lang/<code>/<family>.json, <code>.js,
//                                                    index.json and every folder's lang/index.mjs
//   node scripts/build-language-packs.mjs --check    exit 1 when a written file differs or a word is wrong
//
// Another delivery (ui-pro, ui-chart, a product) runs the same script over its
// own sources and ships the result beside its bundles:
//
//   node ../ui-source/scripts/build-language-packs.mjs --root ../ui-pro/components \
//     --delivery pro --out ../ui-pro/components/src/lang            (one file: <out>/<code>.json and <code>.js)
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FALLBACK, ROOT, builtInLanguages, folderGaps, languageFolders, placeholderGaps, runtimeWords} from './language-coverage.mjs';

export const FORMAT = 'simai.language-pack';
export const INDEX_FORMAT = 'simai.language-pack-index';
export const SCHEMA_VERSION = 1;

// The name a legacy component's words are registered under: the fourth
// argument of its pageText / pageWord calls (tests/language-packs.contract.test.mjs
// checks every call says it). A Smart component's is its tag.
export const LEGACY_IDS = Object.freeze({
  'component/admin-menu': 'sf-admin-menu',
  'component/badges': 'sf-badge',
  'component/breadcrumbs': 'sf-breadcrumbs',
  'component/button-group': 'sf-button-group',
  'component/country-code': 'sf-input-country',
  'component/download-file': 'download-file',
  'component/fab': 'sf-fab',
  'component/file-upload': 'sf-file-upload',
  'component/kbd': 'sf-kbd',
  'component/highlight': 'sf-highlight',
  'component/modal': 'sf-modal',
  'component/progress-scale': 'sf-progress-scale',
  'component/quantity': 'sf-quantity',
  'component/scrollbar': 'sf-scrollbar',
  'component/slider': 'sf-slider',
  'component/spinner': 'sf-spinner',
  'component/swiper': 'sf-swiper',
  'component/tabs': 'sf-tabs',
  'component/theme': 'sf-theme-button',
  'component/toast': 'sf-toast',
  // Core's own words (C282: core embeds English only; these come with the
  // language file's core part). A Smart component's name where core says a
  // few of its words itself, and a product's correction of them reaches both.
  'core/composition': 'sf-composition',
  'core/copy': 'sf-button-copy',
  'core/country-names': 'sf-input-country',
  'core/editor': 'sf-composition',
  'core/file-size': 'sf-file-size',
  'core/fragment': 'sf-fragment',
  'core/icon-search': 'sf-icon-search',
  'core/language-names': 'sf-language',
  'core/new-tab': 'sf-file-download',
  'core/notify': 'sf-notify',
  'core/relative-day': 'sf-relative-day',
  'core/skip-link': 'sf-display-settings',
});

// The family of a part that holds core's own words (file sizes, relative days).
export const CORE_PART = 'core';
const PART_NAME = /^[a-z][a-z0-9-]*$/u;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** The registry name of a language folder ({id, dir} of languageFolders). */
export function componentId(folder) {
  if (LEGACY_IDS[folder.id]) return LEGACY_IDS[folder.id];
  const [kind, name] = folder.id.split('/');
  if (kind === 'smart') {
    const manifest = path.join(folder.dir, '..', 'component.json');
    const tag = existsSync(manifest) ? readJson(manifest).tag : null;
    return typeof tag === 'string' && tag ? tag : `sf-${name}`;
  }
  throw new Error(`${folder.id}: no registry name; add it to LEGACY_IDS in scripts/build-language-packs.mjs`);
}

/**
 * The languages that have at least one file beside English, the fallback:
 * every one of them ships as a pack, built in or not (C282: a page that
 * includes ru.js stays right after a rollback that builds Russian back in).
 */
export function packLanguages(root = ROOT) {
  const codes = new Set();
  for (const {dir} of languageFolders(root)) {
    for (const file of readdirSync(dir)) {
      const match = /^([a-z]{2,3}(?:-[a-z0-9]{2,8})*)\.json$/u.exec(file);
      if (match && match[1] !== FALLBACK) codes.add(match[1]);
    }
  }
  return [...codes].sort();
}

// What a pack says about its language when it has no header file: the name in
// the language itself and the writing direction, from Intl.
function defaultHeader(code) {
  let name = code;
  let dir = 'ltr';
  try {
    name = new Intl.DisplayNames([code], {type: 'language'}).of(code) ?? code;
    name = name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch { /* the code stands for its name */ }
  try {
    const locale = new Intl.Locale(code);
    const info = locale.textInfo ?? locale.getTextInfo?.();
    if (info?.direction === 'rtl') dir = 'rtl';
  } catch { /* left to right */ }
  return {name, dir, status: 'draft', review: 'Not reviewed by a native speaker.'};
}

/**
 * One language's pack: {pack, problems}. A problem is a word that cannot ship
 * (a plural form or a {name} missing, other placeholders than its Russian
 * word, a key English does not have, two
 * folders of one component disagreeing); a word missing is not a problem,
 * only less coverage.
 */
export function buildPack(code, {root = ROOT, delivery = 'framework', headers} = {}) {
  const problems = [];
  // A language that must be complete (en, ru: C177 (2), C282) fails on a
  // word it lacks; any other is only less covered.
  const complete = builtInLanguages(root).complete.includes(code);
  const words = new Map();
  let total = 0;
  let translated = 0;
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const gaps = folderGaps(folder.dir, code);
    total += gaps.words;
    translated += gaps.words - gaps.missing.length;
    for (const gap of gaps.gaps) problems.push(`${folder.id}: ${gap}`);
    if (complete && gaps.missing.length) problems.push(`${folder.id}: ${gaps.file ? `missing ${gaps.missing.join(', ')}` : `no ${code}.json`} (${code} must be complete)`);
    if (!gaps.file) continue;
    const english = runtimeWords(readJson(path.join(folder.dir, `${FALLBACK}.json`)));
    const own = runtimeWords(readJson(path.join(folder.dir, `${code}.json`)));
    if (!words.has(id)) words.set(id, {});
    const target = words.get(id);
    for (const key of Object.keys(english)) {
      const word = own[key];
      if (word === undefined || word === null || (typeof word === 'string' && !word.trim())) continue;
      if (key in target && JSON.stringify(target[key]) !== JSON.stringify(word)) {
        problems.push(`${folder.id}: ${id} "${key}" differs from the same word of another folder of ${id}`);
        continue;
      }
      target[key] = word;
    }
  }
  // A word that says other placeholders than its Russian word cannot ship
  // (said once: a {name} English has and the word lacks is already above).
  for (const gap of placeholderGaps(root)) {
    if (gap.code !== code || problems.some((problem) => problem.startsWith(`${gap.id}: ${gap.key}: `))) continue;
    problems.push(`${gap.id}: ${gap.key}: {${gap.word.join('}, {')}} where ru says {${gap.ru.join('}, {')}}`);
  }
  const headerFile = path.join(headers ?? path.join(root, 'src/core/lang/headers'), `${code}.json`);
  const header = {...defaultHeader(code), ...(existsSync(headerFile) ? readJson(headerFile) : {})};
  if (!['draft', 'reviewed'].includes(header.status)) problems.push(`${code}: status must be draft or reviewed`);
  const ordered = Object.fromEntries([...words].filter(([, byKey]) => Object.keys(byKey).length).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const pack = {
    $schema: '../contracts/language-pack.v1.schema.json',
    schema: FORMAT,
    schema_version: SCHEMA_VERSION,
    delivery,
    lang: code,
    name: header.name,
    dir: header.dir,
    status: header.status,
    review: header.review,
    coverage: {words: total, translated, share: total ? Math.round((translated / total) * 1000) / 10 : 100},
    words: ordered,
  };
  return {pack, problems};
}

// The parts core's own folders ride in (C282): core's words, fetched with
// every page of the language, except the composition editor's words, which
// only an editor reads, and the icon search words, which only a search for
// an icon reads.
// The names of countries and languages in a language are words of
// sf-input-country and sf-language and come with their parts (`tag:`: the
// family of that Smart component), though no bundle carries their English
// (the components' data does).
export const CORE_FAMILIES = Object.freeze({
  'core/country-names': 'tag:sf-input-country',
  'core/editor': 'editor',
  'core/icon-search': 'icon-search',
  'core/language-names': 'tag:sf-language',
});

function smartFamilies(root) {
  const byTag = new Map();
  const smart = path.join(root, 'src/smart');
  if (!existsSync(smart)) return byTag;
  for (const name of readdirSync(smart).sort()) {
    const manifest = path.join(smart, name, 'component.json');
    if (!existsSync(manifest)) continue;
    const {tag, family} = readJson(manifest);
    if (typeof tag === 'string' && typeof family === 'string' && family) byTag.set(tag, family);
  }
  return byTag;
}

/**
 * The part each language folder's words ride in: Map folder id -> family. A
 * Smart component's family is its component.json `family`; core's folders
 * are `core` (CORE_FAMILIES names the others); a class component that shares
 * its name with a Smart one rides with it (sf-badge), any other is its own
 * family, its name without sf-. One component's words may ride in two parts
 * (C282): core says a few of a Smart component's words itself (the skip
 * link of sf-display-settings, the copy feedback of sf-button-copy), and
 * those come with core's part.
 */
export function folderFamilies(root = ROOT) {
  const byTag = smartFamilies(root);
  const families = new Map();
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const named = CORE_FAMILIES[folder.id];
    const family = folder.id.startsWith('core/')
      ? (named?.startsWith('tag:') ? byTag.get(named.slice(4)) : named) ?? CORE_PART
      : byTag.get(id) ?? id.replace(/^sf-/u, '');
    if (!PART_NAME.test(family)) throw new Error(`${folder.id}: family "${family}" is not a file name`);
    families.set(folder.id, family);
  }
  return families;
}

/**
 * The part each component's words ride in: Map id -> family, the family a
 * component's own words ride in when they ride in more than one (the
 * non-core one: core's part comes with every page anyway).
 */
export function packFamilies(root = ROOT) {
  const byFolder = folderFamilies(root);
  const families = new Map();
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const family = byFolder.get(folder.id);
    if (!families.has(id) || families.get(id) === CORE_PART) families.set(id, family);
  }
  return families;
}

/**
 * A pack in parts: [{family, pack}], one pack per family that says a word, by
 * family name. Each part is a whole pack of the format (lang, delivery, the
 * header) whose words are its family's folders' and whose coverage is its
 * family's.
 */
export function splitPack(pack, {root = ROOT, families = folderFamilies(root)} = {}) {
  const parts = new Map();
  const english = new Map();
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const words = pack.words[id];
    if (!words) continue;
    const family = families.get(folder.id);
    if (!family) throw new Error(`${folder.id}: no family`);
    const file = path.join(folder.dir, `${FALLBACK}.json`);
    const keys = Object.keys(existsSync(file) ? runtimeWords(readJson(file)) : {});
    if (!english.has(id)) english.set(id, new Set());
    if (!parts.has(family)) parts.set(family, {});
    const part = parts.get(family);
    for (const key of keys) {
      if (!(key in words)) continue;
      english.get(id).add(key);
      (part[id] ??= {})[key] = words[key];
    }
  }
  for (const [id, words] of Object.entries(pack.words)) {
    for (const key of Object.keys(words)) if (!english.get(id)?.has(key)) throw new Error(`${id} "${key}": in no part`);
  }
  const counts = familyCoverage(pack.lang, {root, families});
  return [...parts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([family, byId]) => {
    const {words: total, translated} = counts.get(family) ?? {words: 0, translated: 0};
    const words = Object.fromEntries(Object.entries(byId).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    // A part sits one folder deeper (core/lang/<code>/<family>.json).
    return {family, pack: {...pack, $schema: '../../contracts/language-pack.v1.schema.json', coverage: {words: total, translated, share: total ? Math.round((translated / total) * 1000) / 10 : 100}, words}};
  });
}

// Words and words said, per family, for one language.
function familyCoverage(code, {root, families}) {
  const counts = new Map();
  for (const folder of languageFolders(root)) {
    const family = families.get(folder.id);
    const gaps = folderGaps(folder.dir, code);
    const count = counts.get(family) ?? {words: 0, translated: 0};
    count.words += gaps.words;
    count.translated += gaps.words - gaps.missing.length;
    counts.set(family, count);
  }
  return counts;
}

/**
 * The index of a delivery's packs. `parts` (a delivery written in parts):
 * {code: {family: [component ids]}}, and `coverage`: {code: {words,
 * translated, share}} of the whole language.
 */
export function packIndex(codes, delivery = 'framework', {parts = null, coverage = null} = {}) {
  return {
    schema: INDEX_FORMAT, schema_version: SCHEMA_VERSION, delivery, languages: codes,
    ...(parts ? {parts} : {}),
    ...(coverage ? {coverage} : {}),
  };
}

/**
 * A pack as a classic script (C282): included before core.js, it puts its
 * words in the shared registry (globalThis.__sfPageLanguage, the store every
 * bundle's page-language.js reads) before any component draws, and marks the
 * language as here whole, so core fetches no part of it. A Framework pack's
 * words go beneath words already there, any other delivery's over them, as
 * SF.language.registerPack does; when core already runs, the script hands
 * the pack to it, and the page draws again.
 */
export function packScript(pack) {
  const header = `/* SIMAI Framework language file: ${pack.name} (${pack.lang}), delivery ${pack.delivery}, ${pack.coverage.share} % of ${pack.coverage.words} words.
   Written by scripts/build-language-packs.mjs from the lang/${pack.lang}.json files (owner decision C282); do not edit.
   Include it before core.js: <script src=".../core/lang/${pack.lang}.js"></script> */`;
  const body = {schema: pack.schema, schema_version: pack.schema_version, delivery: pack.delivery, lang: pack.lang, name: pack.name, dir: pack.dir, status: pack.status, coverage: pack.coverage, words: pack.words};
  return `${header}
(function (root) {
  'use strict';
  var pack = ${JSON.stringify(body)};
  var url = (root.document && root.document.currentScript && root.document.currentScript.src) || null;
  var store = root.__sfPageLanguage || (root.__sfPageLanguage = {listeners: new Set(), registered: new Map(), chosen: null});
  var packs = store.packs || (store.packs = {loaded: new Map(), pending: new Map(), request: null});
  var language = root.SF && root.SF.language;
  var info;
  if (language && typeof language.registerPack === 'function') {
    info = language.registerPack(pack, url);
  } else {
    var under = pack.delivery === 'framework';
    var count = 0;
    Object.keys(pack.words).forEach(function (component) {
      var byLanguage = store.registered.get(component);
      if (!byLanguage) store.registered.set(component, byLanguage = new Map());
      var now = byLanguage.get(pack.lang) || {};
      var words = pack.words[component];
      byLanguage.set(pack.lang, under ? Object.assign({}, words, now) : Object.assign({}, now, words));
      count += Object.keys(words).length;
    });
    info = {lang: pack.lang, delivery: pack.delivery, status: pack.status, coverage: pack.coverage, words: count, url: url};
    packs.loaded.set(pack.lang, (packs.loaded.get(pack.lang) || []).concat([info]));
  }
  if (info) info.whole = true;
})(typeof globalThis !== 'undefined' ? globalThis : self);
`;
}

/**
 * A language folder's lang/index.mjs (C282): the words a bundle carries, the
 * built-in languages' runtime words only. `default` is {code: words} (the
 * class components, core), `files` is {code: {runtime: words}} (a Smart
 * component's elementFromManifest). Written from src/core/lang/built-in.json;
 * every other language reaches the bundle through the registry.
 */
export function folderModule(dir, builtIn) {
  const codes = builtIn.filter((code) => existsSync(path.join(dir, `${code}.json`)));
  const name = (code) => code.replace(/[^a-z0-9]/gu, '_');
  return `// Written by scripts/build-language-packs.mjs from src/core/lang/built-in.json
// (owner decision C282); do not edit. The words this bundle carries: the
// built-in languages' (${codes.join(', ')}); every other language comes from
// a language file (core/lang/<code>.js or its parts).
${codes.map((code) => `import ${name(code)} from './${code}.json' with { type: 'json' };`).join('\n')}

export const files = { ${codes.map((code) => `${JSON.stringify(code).replace(/^"([a-z_]+)"$/u, '$1')}: { runtime: ${name(code)}.runtime }`).join(', ')} };

export default { ${codes.map((code) => `${JSON.stringify(code).replace(/^"([a-z_]+)"$/u, '$1')}: ${name(code)}.runtime`).join(', ')} };
`;
}

const text = (value) => `${JSON.stringify(value, null, 2)}\n`;

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
  };
  const check = args.includes('--check');
  const root = path.resolve(option('--root', ROOT));
  const delivery = option('--delivery', 'framework');
  const out = path.resolve(option('--out', path.join(root, 'src/core/lang')));
  const headers = path.resolve(option('--headers', path.join(ROOT, 'src/core/lang/headers')));
  // The Framework's own pack is written in parts by family; another delivery
  // asks for them with --parts.
  const inParts = delivery === 'framework' || args.includes('--parts');
  const codes = packLanguages(root);
  const files = new Map();
  const parts = {};
  const coverage = {};
  let failed = false;
  for (const code of codes) {
    const {pack, problems} = buildPack(code, {root, delivery, headers});
    for (const problem of problems) process.stderr.write(`${code}: ${problem}\n`);
    if (problems.length) failed = true;
    if (inParts) {
      parts[code] = {};
      coverage[code] = pack.coverage;
      for (const {family, pack: part} of splitPack(pack, {root})) {
        parts[code][family] = Object.keys(part.words);
        files.set(path.join(out, code, `${family}.json`), text(part));
      }
    } else {
      files.set(path.join(out, `${code}.json`), text(pack));
    }
    // The same words as a script a page includes before core.js (C282).
    files.set(path.join(out, `${code}.js`), packScript(pack));
    process.stdout.write(`${code}: ${pack.coverage.share} % of ${pack.coverage.words} words, ${Object.keys(pack.words).length} components${inParts ? ` in ${Object.keys(parts[code]).length} parts` : ''}, ${pack.status}\n`);
  }
  files.set(path.join(out, 'index.json'), text(packIndex(codes, delivery, inParts ? {parts, coverage} : {})));
  // The Framework's folders: the module each bundle takes its words through.
  if (delivery === 'framework') {
    const {builtIn} = builtInLanguages(root);
    for (const folder of languageFolders(root)) {
      const file = path.join(folder.dir, 'index.mjs');
      files.set(file, folderModule(folder.dir, builtIn));
    }
  }
  for (const [file, body] of files) {
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== body) {
        process.stderr.write(`${path.relative(process.cwd(), file)}: not what build-language-packs.mjs writes\n`);
        failed = true;
      }
    } else {
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, body);
    }
  }
  // A pack or a part no source says any more: reported by --check, removed
  // by a write (a family that lost its last word, a language whose files went).
  if (existsSync(out)) {
    const written = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return dir === out && entry.name !== 'headers' ? written(file) : [];
      // The switch the packs are built by is a source, not a pack (C282).
      if (dir === out && entry.name === 'built-in.json') return [];
      return entry.name.endsWith('.json') || (dir === out && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*\.js$/u.test(entry.name)) ? [file] : [];
    });
    for (const file of written(out)) {
      if (files.has(file)) continue;
      if (check) {
        process.stderr.write(`${path.relative(out, file)}: a pack of no language or family in the sources\n`);
        failed = true;
      } else {
        rmSync(file);
      }
    }
  }
  process.exitCode = failed ? 1 : 0;
}
