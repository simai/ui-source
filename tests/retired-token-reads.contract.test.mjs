import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Retired-token sweep before the aliases go (C16 former names, remove_after
// 2027-01-01 in src/core/contracts/token-aliases.v1.json). The aliases keep
// a page that still writes a former name drawing; the Framework itself reads
// only the current role names, so removing an alias cannot move anything the
// Framework draws. A former name may still be declared (the role-aliases mixin,
// a plain sheet's written-out alias: former: var(current)); it is never read.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const aliases = JSON.parse(readFileSync(resolve(root, 'src/core/contracts/token-aliases.v1.json'), 'utf8'));
const former = [...new Set(aliases.tokens.map(({from}) => from))].sort((a, b) => b.length - a.length);
const reads = new RegExp(`var\\(\\s*(${former.map((name) => name.replace(/[/\\^$*+?.()|[\]{}]/gu, '\\$&')).join('|')})(?![\\w-])`, 'gu');

const files = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : files(path);
  return ['.scss', '.css'].includes(extname(entry.name)) && !entry.name.endsWith('.min.css') ? [path] : [];
});

test('no Framework sheet reads a C16 former theme-role name', () => {
  assert.ok(former.length >= 40, `the alias list holds ${former.length} former names`);
  const found = [];
  for (const path of files(resolve(root, 'src'))) {
    const bare = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    for (const [, name] of bare.matchAll(reads)) found.push(`${path.slice(root.length + 1)}: ${name}`);
  }
  assert.deepEqual(found, []);
});

test('the menu docs name the plates and the submenu default by their current names', () => {
  for (const path of ['src/smart/menu/docs.md', 'src/component/menu/docs/docs.md']) {
    const text = readFileSync(resolve(root, path), 'utf8');
    assert.doesNotMatch(text, /--sf-surface-transparent-(hover|active|select)|--sf-elevation-2--surface/u, path);
  }
});
