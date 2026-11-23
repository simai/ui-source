#!/usr/bin/env node
// Validates every committed port.json against the frozen copy of the port
// declaration form that the live simai.composite-host-port standard pins.
//
//   node scripts/check-port-schemas.mjs                       this checkout's working tree
//   node scripts/check-port-schemas.mjs --repo ../ui-mail --rev origin/main
//                                                             another repository, read-only, from a git revision
//
// A port.json is a host port declaration when it names the format
// simai.composite.host-port (with or without the older .v1 label). Exit 1 when
// any port fails, or when no port is found in this checkout.

import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {pinnedPortSchema, validatePort} from './port-schema-kit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

export function liveStandards(base = root) {
  const directory = path.join(base, 'contracts/standards');
  return readdirSync(directory, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && !['history', 'pinned'].includes(entry.name))
    .flatMap((entry) => readdirSync(path.join(directory, entry.name), {withFileTypes: true})
      .filter((version) => version.isDirectory())
      .map((version) => JSON.parse(readFileSync(path.join(directory, entry.name, version.name, 'standard.json'), 'utf8'))));
}

export function pinnedSchema(base = root) {
  const {standard, pin} = pinnedPortSchema(liveStandards(base));
  const file = path.normalize(path.join(base, 'contracts/standards', standard.id, standard.version, pin.path));
  return {standard, pin, file, schema: JSON.parse(readFileSync(file, 'utf8'))};
}

const isHostPort = (value) => typeof value?.schema === 'string' && value.schema.startsWith('simai.composite.host-port');

function walk(directory, found = []) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name === 'port.json') found.push(full);
  }
  return found;
}

/** [{file, port, errors}] for every host port declaration found. */
export function checkPorts({repo = root, rev = null} = {}) {
  const {schema} = pinnedSchema();
  let files;
  let read;
  if (rev) {
    files = execFileSync('git', ['ls-tree', '-r', '--name-only', rev], {cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024})
      .split('\n').filter((name) => name === 'port.json' || name.endsWith('/port.json'));
    read = (file) => execFileSync('git', ['show', `${rev}:${file}`], {cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  } else {
    files = walk(path.join(repo, 'src')).map((file) => path.relative(repo, file));
    read = (file) => readFileSync(path.join(repo, file), 'utf8');
  }
  const results = [];
  for (const file of files.sort()) {
    const value = JSON.parse(read(file));
    if (!isHostPort(value)) continue;
    results.push({file, port: `${value.port ?? '?'}@${value.version ?? '?'}`, errors: validatePort(schema, value)});
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(argument('--repo') ?? root);
  const rev = argument('--rev') ?? (argument('--repo') ? 'origin/main' : null);
  const {standard, pin} = pinnedSchema();
  const results = checkPorts({repo, rev});
  const failed = results.filter(({errors}) => errors.length);
  const revision = rev ? execFileSync('git', ['rev-parse', rev], {cwd: repo, encoding: 'utf8'}).trim() : null;
  console.log(JSON.stringify({
    standard: `${standard.id} ${standard.version}`,
    schema: `${pin.id} ${pin.version} (${pin.path})`,
    repository: repo,
    revision,
    ports: results.length,
    failed: failed.map(({file, port, errors}) => ({file, port, errors: errors.slice(0, 10)})),
  }, null, 2));
  if (failed.length || (!rev && results.length === 0)) process.exitCode = 1;
}
