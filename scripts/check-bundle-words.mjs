#!/usr/bin/env node
// The bundles say English only (owner decision C282, 2026-11-17): Russian and
// every other language reach a page as a language file (core/lang/<code>.js
// or its parts), so no component or core bundle carries Cyrillic words.
//
// What a bundle may still carry, read from the sources so the check follows
// them:
//   - the input-parsing rules: a literal on a source line marked
//     `c282-allow` (on the line or the line before) or inside a
//     `c282-allow-start` ... `c282-allow-end` block -- what a person types
//     (ё searched as е, «мб» read as megabytes, the words an initials rule
//     skips), not words the Framework says;
//   - the languages' names in themselves (smart/language/data/names.json
//     `native`, sf-language's data: «Беларуская» is Belarusian's own name).
// The language files themselves (core/lang/**), the kits and the contracts
// (core/kits/**, core/contracts/**) are not bundles of components.
//
// Every string, template and regular expression literal of every .js / .mjs
// file under the directories given is read (a JSON.parse('...') payload, the
// way webpack inlines a large JSON module, is read as JSON); a Cyrillic one
// that is not allowed is reported with its file.
//
//   node scripts/check-bundle-words.mjs <distribution dir>... [--json]
//     exit 0: none; exit 1: Cyrillic words in a bundle; exit 2: usage
//   node scripts/check-bundle-words.mjs --sources     the allowed literals, from src/
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CYRILLIC = /[Ѐ-ӿ]/u;
const SKIP = [/(^|\/)core\/lang\//u, /(^|\/)core\/kits\//u, /(^|\/)core\/contracts\//u, /(^|\/)node_modules\//u];

const walk = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(file);
  return /\.m?js$/u.test(entry.name) ? [file] : [];
});

// The literals of a script: [{kind, value, line}] (value: a string's or a
// template chunk's cooked text, a regular expression's pattern).
export function literals(code) {
  const out = [];
  const tokens = acorn.tokenizer(code, {ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true, allowReturnOutsideFunction: true});
  let previous = [];
  for (const token of tokens) {
    const label = token.type.label;
    if (label === 'string') {
      // JSON.parse('...'): the payload's strings.
      const parsed = previous.length === 4 && previous[0].value === 'JSON' && previous[2].value === 'parse' ? json(token.value) : undefined;
      if (parsed !== undefined) for (const value of strings(parsed)) out.push({kind: 'json', value, line: token.loc.start.line});
      else out.push({kind: 'string', value: token.value, line: token.loc.start.line});
    } else if (label === 'template') {
      if (token.value) out.push({kind: 'template', value: String(token.value), line: token.loc.start.line});
    } else if (label === 'regexp') {
      out.push({kind: 'regexp', value: token.value.pattern, line: token.loc.start.line});
    }
    previous = [...previous, token].slice(-4);
  }
  return out;
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const one of value) yield* strings(one);
  else if (value && typeof value === 'object') for (const [key, one] of Object.entries(value)) {
    yield key;
    yield* strings(one);
  }
}

/** The Cyrillic literals the sources allow: {values: Set, places: [{file, line, value}]}. */
export function allowedLiterals(root = ROOT) {
  const values = new Set();
  const places = [];
  for (const file of walk(path.join(root, 'src'))) {
    const relative = path.relative(root, file);
    if (SKIP.some((pattern) => pattern.test(relative))) continue;
    const code = readFileSync(file, 'utf8');
    if (!CYRILLIC.test(code) || !code.includes('c282-allow')) continue;
    const lines = code.split('\n');
    const allowed = new Set();
    let open = false;
    lines.forEach((line, index) => {
      if (/c282-allow-start/u.test(line)) open = true;
      else if (/c282-allow-end/u.test(line)) open = false;
      else if (open || /c282-allow(?!-)/u.test(line) || /c282-allow(?!-)/u.test(lines[index - 1] ?? '')) allowed.add(index + 1);
    });
    let found;
    try {
      found = literals(code);
    } catch (error) {
      throw new Error(`${relative}: ${error.message}`);
    }
    for (const literal of found) {
      if (!CYRILLIC.test(literal.value) || !allowed.has(literal.line)) continue;
      values.add(literal.value);
      places.push({file: relative, line: literal.line, value: literal.value});
    }
  }
  const names = JSON.parse(readFileSync(path.join(root, 'src/smart/language/data/names.json'), 'utf8')).names ?? {};
  for (const one of Object.values(names)) if (typeof one?.native === 'string') values.add(one.native);
  return {values, places};
}

/** The Cyrillic literals of the bundles under `dirs` that the sources do not allow: [{file, values}]. */
export function bundleWords(dirs, {root = ROOT, allowed = allowedLiterals(root).values} = {}) {
  const found = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const relative = path.relative(dir, file);
      if (SKIP.some((pattern) => pattern.test(relative))) continue;
      const code = readFileSync(file, 'utf8');
      if (!CYRILLIC.test(code)) continue;
      let list;
      try {
        list = literals(code);
      } catch (error) {
        found.push({file: path.join(path.basename(dir), relative), values: [`(not read: ${error.message})`]});
        continue;
      }
      const values = [...new Set(list.filter((literal) => CYRILLIC.test(literal.value) && !allowed.has(literal.value)).map((literal) => literal.value))];
      if (values.length) found.push({file: path.join(path.basename(dir), relative), values});
    }
  }
  return found;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--sources')) {
    for (const place of allowedLiterals().places) process.stdout.write(`${place.file}:${place.line}: ${JSON.stringify(place.value)}\n`);
    process.exit(0);
  }
  const dirs = args.filter((arg) => !arg.startsWith('--'));
  if (!dirs.length || dirs.some((dir) => !existsSync(dir) || !statSync(dir).isDirectory())) {
    process.stderr.write('usage: node scripts/check-bundle-words.mjs <distribution dir>... [--json]\n');
    process.exit(2);
  }
  const found = bundleWords(dirs.map((dir) => path.resolve(dir)));
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
  else {
    for (const {file, values} of found) process.stdout.write(`${file}: ${values.length} Cyrillic literal(s): ${values.slice(0, 5).map((value) => JSON.stringify(value.slice(0, 60))).join(', ')}\n`);
    process.stdout.write(found.length ? `bundle words: ${found.length} file(s) carry Cyrillic words (C282: Russian is a language file)\n` : 'bundle words: no bundle carries a Cyrillic word but the parsing rules and the languages\' own names (C282)\n');
  }
  process.exit(found.length ? 1 : 0);
}
