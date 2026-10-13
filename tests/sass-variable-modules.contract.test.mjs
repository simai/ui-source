import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A Sass partial that declares nothing but variables is only worth keeping while
// something reads it. Four such files had outlived their consumers: one of them
// held a third copy of the theme colour map, so an edit could land in a file that
// never reached a build. This rule keeps that from happening again — it is about
// files nobody loads, not about variables a file uses itself.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(path, 'utf8');

const sassFiles = (directory) => {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      found.push(...sassFiles(full));
    } else if (entry.name.endsWith('.scss')) {
      found.push(full);
    }
  }
  return found;
};

const files = sassFiles(resolve(root, 'src'));

// `@use 'vars/sf_var__size'` and `@import '../vars/sf_var__size'` both name the
// partial without its underscore or extension.
const moduleName = (path) => path.split('/').pop().replace(/^_/, '').replace(/\.scss$/u, '');

test('a Sass partial that only declares variables is loaded by something', () => {
  const corpus = files.map((path) => ({ path, text: read(path) }));
  const dead = [];
  for (const { path, text } of corpus) {
    const declaresVariables = /^\$[a-z0-9-]+\s*:/mu.test(text);
    // A partial that also writes rules or custom properties earns its place by
    // what it emits, whether or not anything imports its variables.
    const emitsStyles = /^[^$@\s/][^\n]*\{|--[a-z0-9-]+\s*:/mu.test(text);
    if (!declaresVariables || emitsStyles) continue;
    const name = moduleName(path);
    const loaded = corpus.some(({ path: other, text: otherText }) => other !== path
      && new RegExp(String.raw`@(?:use|import|forward)\s+["'][^"']*\b${name}\b`, 'u').test(otherText));
    if (!loaded) dead.push(relative(root, path));
  }
  assert.deepEqual(dead, [], 'nothing loads these, so an edit in them changes nothing');
});

test('the theme colours are declared in one place', () => {
  // The semantic layer is the one place. A second map of the same tokens is how
  // the two theme lists drifted apart before they were merged.
  const maps = files
    .filter((path) => /\$color-token-array|\$theme-(?:light|dark)-array/u.test(read(path)))
    .map((path) => relative(root, path));
  assert.deepEqual(maps, [], 'a second copy of the theme colour map');
  const theme = read(resolve(root, 'src/core/scss/_sf_css__theme.scss'));
  assert.match(theme, /light-dark\(/u, 'the semantic layer carries both themes itself');
});

test('no token is kept only by an OLD marker', () => {
  const theme = read(resolve(root, 'src/core/scss/_sf_css__theme.scss'));
  const marked = [...theme.matchAll(/^\s*(--[a-z0-9-]*(?:OLD|LEGACY|DEPRECATED)[a-z0-9-]*)\s*:/gmu)]
    .map(([, name]) => name);
  assert.deepEqual(marked, [], 'a token named OLD is migration debt, not a contract');
});

test('the files this rule protects are actually there', () => {
  // A rule that walks nothing passes for the wrong reason.
  assert.ok(files.length > 200, `only ${files.length} Sass files found`);
  assert.ok(statSync(resolve(root, 'src/core/scss/_sf_css__theme.scss')).isFile());
});
