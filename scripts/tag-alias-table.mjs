#!/usr/bin/env node
// The Framework's dated tag aliases as one static table for the runtime:
// src/core/js/tag-aliases.generated.js, from the `tag` rows of every
// src/smart/<folder>/aliases.json (core/js/tag-aliases.js reads it, so a lookup
// finds an old tag before the renamed component's bundle has run).
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

// -> [{from, to, since, remove_after, folder}] sorted by old tag; refusals throw.
export function tagAliasRows(repositoryRoot = root) {
  const smart = path.join(repositoryRoot, 'src/smart');
  const rows = [];
  for (const folder of readdirSync(smart).sort()) {
    const file = path.join(smart, folder, 'aliases.json');
    if (!existsSync(file)) continue;
    const table = JSON.parse(readFileSync(file, 'utf8'));
    const read = readTagAliases(table);
    if (read.refused.length) throw new Error(`src/smart/${folder}/aliases.json: ${read.refused.map((row) => `${row.from} ${row.reason}`).join(', ')}`);
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
    '// Generated from the `tag` rows of src/smart/*/aliases.json by scripts/tag-alias-table.mjs; do not edit.',
    '// The Framework\'s dated tag aliases, read by core/js/tag-aliases.js.',
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
      console.error(`${TABLE} is not what the aliases.json files say; run node scripts/tag-alias-table.mjs --write`);
      process.exit(1);
    }
    console.log(`${TABLE} ok`);
  }
}
