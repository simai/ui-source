// Language packs: one file per language and delivery (owner decision C177,
// 2026-11-14; format docs/developer/language-packs.md, schema
// src/core/contracts/language-pack.v1.schema.json).
//
// Every component keeps its words in its own folder, one file per language
// (lang/<code>.json, the words on screen under `runtime`). ru and en are built
// into the component's bundle; every other language is collected here into one
// pack for the whole delivery, which a page fetches only when it speaks that
// language. A language may come in parts: what a pack lacks is said in English
// and counted in its `coverage` (scripts/language-coverage.mjs lists it).
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
//   node scripts/build-language-packs.mjs            write src/core/lang/<code>/<family>.json and index.json
//   node scripts/build-language-packs.mjs --check    exit 1 when a written pack differs or a word is wrong
//
// Another delivery (ui-pro, ui-chart, a product) runs the same script over its
// own sources and ships the result beside its bundles:
//
//   node ../ui-source/scripts/build-language-packs.mjs --root ../ui-pro/components \
//     --delivery pro --out ../ui-pro/components/src/lang            (one file: <out>/<code>.json)
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUILT_IN, FALLBACK, ROOT, folderGaps, languageFolders, placeholderGaps, runtimeWords} from './language-coverage.mjs';

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
  'component/country-code': 'sf-input-country',
  'component/download-file': 'download-file',
  'component/file-upload': 'sf-file-upload',
  'component/kbd': 'sf-kbd',
  'component/highlight': 'sf-highlight',
  'component/modal': 'sf-modal',
  'component/quantity': 'sf-quantity',
  'component/scrollbar': 'sf-scrollbar',
  'component/spinner': 'sf-spinner',
  'component/swiper': 'sf-swiper',
  'component/theme': 'sf-theme-button',
  'component/toast': 'sf-toast',
  'core/file-size': 'sf-file-size',
  'core/relative-day': 'sf-relative-day',
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

/** The languages that have at least one file beside the built-in ones. */
export function packLanguages(root = ROOT) {
  const codes = new Set();
  for (const {dir} of languageFolders(root)) {
    for (const file of readdirSync(dir)) {
      const match = /^([a-z]{2,3}(?:-[a-z0-9]{2,8})*)\.json$/u.exec(file);
      if (match && !BUILT_IN.includes(match[1])) codes.add(match[1]);
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
  const words = new Map();
  let total = 0;
  let translated = 0;
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const gaps = folderGaps(folder.dir, code);
    total += gaps.words;
    translated += gaps.words - gaps.missing.length;
    for (const gap of gaps.gaps) problems.push(`${folder.id}: ${gap}`);
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

/**
 * The part each component's words ride in: Map id -> family. A Smart
 * component's family is its component.json `family`; core's words are `core`;
 * a class component that shares its name with a Smart one rides with it
 * (sf-badge), any other is its own family, its name without sf-.
 */
export function packFamilies(root = ROOT) {
  const families = new Map();
  const smart = path.join(root, 'src/smart');
  const byTag = new Map();
  if (existsSync(smart)) {
    for (const name of readdirSync(smart).sort()) {
      const manifest = path.join(smart, name, 'component.json');
      if (!existsSync(manifest)) continue;
      const {tag, family} = readJson(manifest);
      if (typeof tag === 'string' && typeof family === 'string' && family) byTag.set(tag, family);
    }
  }
  for (const folder of languageFolders(root)) {
    const id = componentId(folder);
    const family = folder.id.startsWith('core/') ? CORE_PART : byTag.get(id) ?? id.replace(/^sf-/u, '');
    if (!PART_NAME.test(family)) throw new Error(`${folder.id}: family "${family}" is not a file name`);
    if (families.has(id) && families.get(id) !== family) throw new Error(`${id}: two families, ${families.get(id)} and ${family}`);
    families.set(id, family);
  }
  return families;
}

/**
 * A pack in parts: [{family, pack}], one pack per family that says a word, by
 * family name. Each part is a whole pack of the format (lang, delivery, the
 * header) whose words are its family's and whose coverage is its family's.
 */
export function splitPack(pack, {root = ROOT, families = packFamilies(root)} = {}) {
  const parts = new Map();
  for (const [id, words] of Object.entries(pack.words)) {
    const family = families.get(id);
    if (!family) throw new Error(`${id}: no family`);
    if (!parts.has(family)) parts.set(family, {});
    parts.get(family)[id] = words;
  }
  const counts = familyCoverage(pack.lang, {root, families});
  return [...parts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([family, words]) => {
    const {words: total, translated} = counts.get(family) ?? {words: 0, translated: 0};
    // A part sits one folder deeper (core/lang/<code>/<family>.json).
    return {family, pack: {...pack, $schema: '../../contracts/language-pack.v1.schema.json', coverage: {words: total, translated, share: total ? Math.round((translated / total) * 1000) / 10 : 100}, words}};
  });
}

// Words and words said, per family, for one language.
function familyCoverage(code, {root, families}) {
  const counts = new Map();
  for (const folder of languageFolders(root)) {
    const family = families.get(componentId(folder));
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
    process.stdout.write(`${code}: ${pack.coverage.share} % of ${pack.coverage.words} words, ${Object.keys(pack.words).length} components${inParts ? ` in ${Object.keys(parts[code]).length} parts` : ''}, ${pack.status}\n`);
  }
  files.set(path.join(out, 'index.json'), text(packIndex(codes, delivery, inParts ? {parts, coverage} : {})));
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
      return entry.name.endsWith('.json') ? [file] : [];
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
