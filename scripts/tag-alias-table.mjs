#!/usr/bin/env node
// The dated tag aliases as one static table for the runtime:
// src/core/js/tag-aliases.generated.js, from the `tag` rows of every
// src/smart/<folder>/aliases.json and from the `element_aliases` of every
// component package reference, src/core/contracts/packages/*.package.json
// (core/js/tag-aliases.js reads it, so a lookup finds an old tag before the
// renamed component's bundle has run, a package's as well as the Framework's).
//
// A package reference that is a dated alias of another (alias_of: larena.package.json
// repeats pro's provides) is not read twice. A package component's folder is
// not in ui-source; in the overlay a package is tested in (ui-pro
// components/scripts/overlay.mjs) it is, and its aliases.json must then say what
// the reference says: one row each, the same tags and days.
//
// Usage:
//   node scripts/tag-alias-table.mjs --write
//   node scripts/tag-alias-table.mjs --check     exit 1 when the committed table differs
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {readTagAliases} from '../src/core/js/alias-table.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TABLE = 'src/core/js/tag-aliases.generated.js';

// The element_aliases of the package references, as tag rows:
// -> [{from, to, since, remove_after, package, folder}].
export function packageTagAliasRows(repositoryRoot = root) {
  const directory = path.join(repositoryRoot, 'src/core/contracts/packages');
  if (!existsSync(directory)) return [];
  const rows = [];
  for (const name of readdirSync(directory).filter((file) => file.endsWith('.package.json')).sort()) {
    const reference = JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
    if (reference.alias_of) continue;
    for (const item of reference.provides ?? []) {
      if (!item.element_aliases) continue;
      const read = readTagAliases({component: item.element, aliases: item.element_aliases.map((row) => ({...row, to: item.element, kind: 'tag'}))});
      if (read.refused.length) throw new Error(`src/core/contracts/packages/${name} ${item.id}: ${read.refused.map((row) => `${row.from} ${row.reason}`).join(', ')}`);
      for (const row of read.rows) rows.push({...row, package: reference.package, folder: item.folder});
    }
  }
  return rows;
}

// -> [{from, to, since, remove_after, folder[, package]}] sorted by old tag; refusals throw.
export function tagAliasRows(repositoryRoot = root) {
  const smart = path.join(repositoryRoot, 'src/smart');
  const fromPackages = packageTagAliasRows(repositoryRoot);
  const packageFolders = new Set(fromPackages.map((row) => row.folder));
  const rows = [...fromPackages];
  for (const folder of readdirSync(smart).sort()) {
    const file = path.join(smart, folder, 'aliases.json');
    if (!existsSync(file)) continue;
    const table = JSON.parse(readFileSync(file, 'utf8'));
    const read = readTagAliases(table);
    if (read.refused.length) throw new Error(`src/smart/${folder}/aliases.json: ${read.refused.map((row) => `${row.from} ${row.reason}`).join(', ')}`);
    if (packageFolders.has(folder)) {
      // A package's folder laid over ui-source: the reference is the table's
      // source, and the folder must agree with it.
      const want = fromPackages.filter((row) => row.folder === folder).map(({from, to, since, remove_after: removeAfter}) => `${from}>${to} ${since}..${removeAfter}`).sort();
      const have = read.rows.map(({from, to, since, remove_after: removeAfter}) => `${from}>${to} ${since}..${removeAfter}`).sort();
      if (want.join() !== have.join()) throw new Error(`src/smart/${folder}/aliases.json: tag rows ${have.join(', ') || 'none'}, the package reference says ${want.join(', ')}`);
      continue;
    }
    for (const row of read.rows) rows.push({...row, folder});
  }
  rows.sort((a, b) => a.from.localeCompare(b.from));
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.from)) throw new Error(`${row.from}: an old tag names two components`);
    seen.add(row.from);
  }
  return rows;
}

export function tableSource(rows) {
  const body = rows.map(({from, to, since, remove_after: removeAfter}) => `  Object.freeze({from: '${from}', to: '${to}', since: '${since}', remove_after: '${removeAfter}'}),`);
  return [
    '// Generated from the `tag` rows of src/smart/*/aliases.json and the element_aliases of',
    '// src/core/contracts/packages/*.package.json by scripts/tag-alias-table.mjs; do not edit.',
    '// The dated tag aliases of the Framework and of its component packages, read by core/js/tag-aliases.js.',
    'export default Object.freeze([',
    ...body,
    ']);',
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(root, TABLE);
  const want = tableSource(tagAliasRows());
  if (process.argv.includes('--write')) {
    writeFileSync(file, want);
    console.log(`${TABLE} written`);
  } else {
    const have = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (have !== want) {
      console.error(`${TABLE} is not what the aliases.json files and the package references say; run node scripts/tag-alias-table.mjs --write`);
      process.exit(1);
    }
    console.log(`${TABLE} ok`);
  }
}
