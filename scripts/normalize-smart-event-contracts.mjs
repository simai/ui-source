#!/usr/bin/env node

import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const write = process.argv.includes('--write');
const changes = [];
for (const entry of await readdir(path.resolve(root, 'src/smart'), {withFileTypes: true})) {
  if (!entry.isDirectory() || entry.name === 'helpers') continue;
  const manifestFile = path.resolve(root, 'src/smart', entry.name, 'smart.manifest.json');
  const sourceFile = path.resolve(root, 'src/smart', entry.name, 'index.js');
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestFile, 'utf8')); } catch { continue; }
  if (manifest.schema_version !== 2) continue;
  const source = await readFile(sourceFile, 'utf8');
  const events = new Set();
  for (const match of source.matchAll(/new CustomEvent\(\s*['"]([^'"]+)['"]/g)) events.add(match[1]);
  for (const match of source.matchAll(/emitComponentEvent\(\s*['"]([^'"]+)['"]/g)) events.add(`sf-${match[1]}`);
  manifest.events = Object.fromEntries([...events].sort().map((name) => [name, {summary: `Runtime event ${name}.`, payload: {type: 'object'}}]));
  changes.push(path.relative(root, manifestFile));
  if (write) await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}
process.stdout.write(`${write ? 'WROTE' : 'WOULD_WRITE'} ${changes.length} event contracts\n`);
