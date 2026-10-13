import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');

/* A dictionary holds words. Twice while the languages were being written, a
   blanket replacement of a word's use also replaced the word inside the
   dictionary it had just been added to — `loadingOptions: setText(host,
   'loadingOptions')` and three like it — which is a value that reads itself.
   One of them took the whole component down with «Cannot access
   PROPERTY_VIEW_TEXT before initialization»; the other made a word resolve to
   nothing and was invisible. Neither is something a reader spots, so it is a
   check. */
// `node:fs` has no globSync on the version this gate runs, so the directories
// are walked instead.
const within = (directory, pick) => {
  try {
    return readdirSync(resolve(root, directory), {withFileTypes: true})
      .flatMap((entry) => pick(directory, entry));
  } catch {
    return [];
  }
};

const sources = [
  ...within('src/smart', (base, entry) => (entry.isDirectory() ? [`${base}/${entry.name}/index.js`] : [])),
  ...within('src/component', (base, entry) => (entry.isDirectory()
    ? within(`${base}/${entry.name}/js`, (inner, file) => (file.isFile() && file.name.endsWith('.js') ? [`${inner}/${file.name}`] : []))
    : [])),
  ...within('src/core/js', (base, entry) => (entry.isFile() && entry.name.endsWith('.js') ? [`${base}/${entry.name}`] : [])),
].filter((path) => {
  try {
    readFileSync(resolve(root, path), 'utf8');
    return true;
  } catch {
    return false;
  }
});

const dictionariesIn = (source) => {
  const found = [];
  for (const match of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\{/gu)) {
    let index = match.index + match[0].length - 1;
    let depth = 0;
    while (index < source.length) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    const body = source.slice(match.index, index + 1);
    if (/\ben\s*:\s*\{/u.test(body) && /\bru\s*:\s*\{/u.test(body)) found.push([match[1], body]);
  }
  return found;
};

test('a language dictionary holds words, not lookups', () => {
  const offenders = [];
  for (const path of sources) {
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const [name, body] of dictionariesIn(source)) {
      for (const call of body.matchAll(/(\w+)\s*:\s*(pageText|setText|this\.text)\s*\(/gu)) {
        offenders.push(`${path}: ${name}.${call[1]} is a ${call[2]}() call rather than a word`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('every language dictionary offers the same keys in both languages', () => {
  const offenders = [];
  const keysOf = (branch) => new Set(
    [...branch.matchAll(/^\s{4,8}(\w+)\s*:/gmu)].map(([, key]) => key),
  );
  for (const path of sources) {
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const [name, body] of dictionariesIn(source)) {
      const english = body.slice(body.indexOf('en:'), body.indexOf('ru:'));
      const russian = body.slice(body.indexOf('ru:'));
      const inEnglish = keysOf(english);
      const inRussian = keysOf(russian);
      for (const key of inEnglish) {
        if (!inRussian.has(key)) offenders.push(`${path}: ${name}.${key} has no Russian`);
      }
      for (const key of inRussian) {
        // English is the floor every other language falls back to, so a word
        // that exists only in Russian is a word an English page cannot say.
        if (!inEnglish.has(key)) offenders.push(`${path}: ${name}.${key} has no English`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
