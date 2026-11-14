// The language files of the SIMAI Framework and how much of them a language
// covers (localization study LC-7, owner decision C177 (4), 2026-11-14).
//
// Every component keeps its words in its own folder: src/smart/<name>/lang/,
// src/component/<name>/lang/ and core's src/core/js/lang/<part>/, one file per
// language, the words on screen under `runtime`. ru and en are built in
// (C177 (2)): each holds every word, and a word that takes a number holds
// every plural form of its language. Any other language may come in parts
// (C177 (4)): what it lacks is said in English on the page, and shown here.
//
//   node scripts/language-coverage.mjs            the built-in check (exit 1 on a gap)
//   node scripts/language-coverage.mjs de         coverage of de: share and the words missing
//   node scripts/language-coverage.mjs de --json  the same as JSON
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUILT_IN = Object.freeze(['ru', 'en']);
export const FALLBACK = 'en';

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

/** Coverage of one language over every folder. */
export function languageCoverage(code, root = ROOT) {
  const folders = languageFolders(root).map(({id, dir}) => ({id, ...folderGaps(dir, code)}));
  const total = folders.reduce((sum, folder) => sum + folder.words, 0);
  const missing = folders.reduce((sum, folder) => sum + folder.missing.length, 0);
  return {
    language: code,
    built_in: BUILT_IN.includes(code),
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
  for (const code of codes.length ? codes : BUILT_IN) {
    const report = languageCoverage(code);
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${code}: ${report.share} % of ${report.words} words${report.built_in ? ' (built in)' : ''}\n`);
      for (const folder of report.folders) {
        if (!folder.file) process.stdout.write(`  ${folder.id}: no ${code}.json (${folder.words} words in English)\n`);
        else if (folder.missing.length) process.stdout.write(`  ${folder.id}: missing ${folder.missing.join(', ')}\n`);
        for (const gap of folder.gaps) process.stdout.write(`  ${folder.id}: ${gap}\n`);
      }
    }
    if (report.built_in && report.folders.length) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}
