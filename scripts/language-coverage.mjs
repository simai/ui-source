// The language files of the SIMAI Framework and how much of them a language
// covers (localization study LC-7, owner decision C177 (4), 2026-11-14).
//
// Every component keeps its words in its own folder: src/smart/<name>/lang/,
// src/component/<name>/lang/ and core's src/core/js/lang/<part>/, one file per
// language, the words on screen under `runtime`. en and ru are complete
// (C177 (2)): each holds every word, and a word that takes a number holds
// every plural form of its language. English is built into the bundles,
// Russian ships as a language file (C282, src/core/lang/built-in.json). Any
// other language may come in parts (C177 (4)): what it lacks is said in
// English on the page, and shown here.
//
//   node scripts/language-coverage.mjs            the complete languages' check, en and ru (exit 1 on a gap)
//   node scripts/language-coverage.mjs de         coverage of de: share and the words missing
//   node scripts/language-coverage.mjs de --json  the same as JSON
//
// Every run also checks that each word of the language says the placeholders
// of its Russian word ({name}, {day}, {n}...): exit 1 when one does not.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FALLBACK = 'en';

// Which languages the bundles carry and which must say every word (owner
// decision C282, 2026-11-17): src/core/lang/built-in.json. English is built
// in; Russian is a language file like every other, and stays complete, so
// writing the words in Russian is unchanged. The switch is the file: built_in
// ["en", "ru"] puts Russian back into the bundles (rollback).
export function builtInLanguages(root = ROOT) {
  const file = path.join(root, 'src/core/lang/built-in.json');
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {built_in: ['ru', 'en'], complete: ['ru', 'en']};
  const builtIn = [...new Set([FALLBACK, ...(data.built_in ?? [])])];
  const complete = [...new Set([...builtIn, ...(data.complete ?? [])])];
  return {builtIn: Object.freeze(builtIn), complete: Object.freeze(complete)};
}
export const BUILT_IN = builtInLanguages().builtIn;
export const COMPLETE = builtInLanguages().complete;

const PLURAL_FORMS = (code) => new Intl.PluralRules(code).resolvedOptions().pluralCategories;

/** Every folder that holds language files: {id, dir}. */
export function languageFolders(root = ROOT) {
  const folders = [];
  for (const [kind, base] of [['smart', 'src/smart'], ['component', 'src/component'], ['core', 'src/core/js/lang']]) {
    const absolute = path.join(root, base);
    if (!existsSync(absolute)) continue;
    for (const name of readdirSync(absolute).sort()) {
      const dir = kind === 'core' ? path.join(absolute, name) : path.join(absolute, name, 'lang');
      if (existsSync(path.join(dir, 'en.json')) || existsSync(path.join(dir, 'ru.json'))) folders.push({id: `${kind}/${name}`, dir});
    }
  }
  return folders;
}

// The words a component says on screen: `runtime`, and the words of a trait it
// opts into (`x-trait-words`, looked up under the component's own name).
export const runtimeWords = (json) => ({...(json?.['x-trait-words']?.words ?? {}), ...(json?.runtime ?? {})});

const readRuntime = (dir, code) => {
  const file = path.join(dir, `${code}.json`);
  if (!existsSync(file)) return null;
  return runtimeWords(JSON.parse(readFileSync(file, 'utf8')));
};

const placeholders = (word) => [...new Set([...JSON.stringify(word).matchAll(/\{([a-z][\w-]*)\}/giu)].map((match) => match[1]))].sort();

/**
 * The gaps of one folder for one language against English, the fallback:
 * a word missing, a plural form missing, a {name} the English word has and
 * this one has not.
 */
export function folderGaps(dir, code) {
  const fallback = readRuntime(dir, FALLBACK) ?? {};
  const words = readRuntime(dir, code);
  const gaps = [];
  if (!words) return {file: false, words: Object.keys(fallback).length, missing: Object.keys(fallback), gaps};
  const missing = [];
  for (const [key, english] of Object.entries(fallback)) {
    const word = words[key];
    if (word === undefined || word === null || (typeof word === 'string' && !word.trim() && String(english).trim())) {
      missing.push(key);
      continue;
    }
    if (typeof english === 'object' || typeof word === 'object') {
      if (typeof word !== 'object') gaps.push(`${key}: a plural word, said as one string`);
      else for (const form of PLURAL_FORMS(code)) if (typeof (word[form] ?? (form === 'other' ? undefined : word.other)) !== 'string') gaps.push(`${key}: no plural form "${form}"`);
    }
    const want = placeholders(english).filter((name) => name !== 'n');
    const have = placeholders(word);
    for (const name of want) if (!have.includes(name)) gaps.push(`${key}: no {${name}}`);
  }
  for (const key of Object.keys(words)) if (!(key in fallback)) gaps.push(`${key}: not in ${FALLBACK}`);
  return {file: true, words: Object.keys(fallback).length, missing, gaps};
}

/**
 * Every word whose placeholders are not those of its Russian word, over every
 * folder and every language beside Russian: [{id, code, key, ru, word}], the
 * names sorted. Russian is the source of the words (C177), so a {name} or a
 * {day} it says must be said in English and in every pack too, and a word
 * must not ask for a value its Russian word does not give. A plural word
 * counts every form together; a word left empty on purpose has none; a key
 * Russian does not have is the coverage check's (folderGaps).
 */
export function placeholderGaps(root = ROOT) {
  const gaps = [];
  for (const {id, dir} of languageFolders(root)) {
    const russian = readRuntime(dir, 'ru');
    if (!russian) continue;
    for (const file of readdirSync(dir).sort()) {
      const match = /^([a-z]{2,3}(?:-[a-z0-9]{2,8})*)\.json$/u.exec(file);
      if (!match || match[1] === 'ru') continue;
      const words = readRuntime(dir, match[1]) ?? {};
      for (const [key, word] of Object.entries(words)) {
        if (!(key in russian) || word === null || (typeof word === 'string' && !word.trim())) continue;
        const want = placeholders(russian[key]);
        const have = placeholders(word);
        if (want.join() !== have.join()) gaps.push({id, code: match[1], key, ru: want, word: have});
      }
    }
  }
  return gaps;
}

/** Coverage of one language over every folder. */
export function languageCoverage(code, root = ROOT) {
  const folders = languageFolders(root).map(({id, dir}) => ({id, ...folderGaps(dir, code)}));
  const total = folders.reduce((sum, folder) => sum + folder.words, 0);
  const missing = folders.reduce((sum, folder) => sum + folder.missing.length, 0);
  return {
    language: code,
    built_in: BUILT_IN.includes(code),
    complete: COMPLETE.includes(code),
    words: total,
    missing,
    share: total ? Math.round(((total - missing) / total) * 1000) / 10 : 100,
    folders: folders.filter((folder) => folder.missing.length || folder.gaps.length),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const codes = args.filter((arg) => !arg.startsWith('--'));
  let failed = false;
  for (const code of codes.length ? codes : COMPLETE) {
    const report = languageCoverage(code);
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${code}: ${report.share} % of ${report.words} words${report.built_in ? ' (built in)' : report.complete ? ' (a language file, kept complete)' : ''}\n`);
      for (const folder of report.folders) {
        if (!folder.file) process.stdout.write(`  ${folder.id}: no ${code}.json (${folder.words} words in English)\n`);
        else if (folder.missing.length) process.stdout.write(`  ${folder.id}: missing ${folder.missing.join(', ')}\n`);
        for (const gap of folder.gaps) process.stdout.write(`  ${folder.id}: ${gap}\n`);
      }
    }
    if (report.complete && report.folders.length) failed = true;
    const mismatched = placeholderGaps().filter((gap) => gap.code === code);
    if (!json) for (const gap of mismatched) process.stdout.write(`  ${gap.id}: ${gap.key}: {${gap.word.join('}, {')}} where ru says {${gap.ru.join('}, {')}}\n`);
    if (mismatched.length) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}
