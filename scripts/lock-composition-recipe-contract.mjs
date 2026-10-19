#!/usr/bin/env node
// Writes or checks src/core/contracts/composition-recipe-v1/contract.lock.json,
// the lock of the Composition Recipe contract.
//
// contractDigest = sha256 of the canonical map relativePath -> sha256:bytes of
// the normative files: README.md, the schemas, limits.json and every fixture
// but the corpus with receipts (fixtures/header-switch.json), which the lock
// pins on its own so the digest never refers to itself. The lock never hashes
// itself. The `candidate` and `baseline` sections record the implementation
// accepted with 1.0.x and are carried over as they are.
//
// The lock keeps its versioned label: ui-builder reads it by that label when
// it packages the normative files (journal record format-names-without-version).
//
//   node scripts/lock-composition-recipe-contract.mjs          write
//   node scripts/lock-composition-recipe-contract.mjs --check  fail on drift

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stableStringify } from '../src/core/js/composition/index.mjs';

export const RECIPE_CONTRACT_VERSION = '1.1.0';
const CORPUS = ['fixtures/header-switch.json'];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(root, 'src/core/contracts/composition-recipe-v1');
const path = join(base, 'contract.lock.json');
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const filesUnder = (directory) => readdirSync(join(base, directory), { withFileTypes: true })
  .filter((entry) => entry.isFile()).map((entry) => `${directory}/${entry.name}`).sort();
const digests = (files) => Object.fromEntries(files.map((relative) => [relative, sha(readFileSync(join(base, relative)))]));

const current = readFileSync(path, 'utf8');
const previous = JSON.parse(current);
const schemas = readdirSync(base).filter((name) => name.endsWith('.schema.json'));
const normative = ['README.md', 'limits.json', ...schemas, ...filesUnder('fixtures').filter((file) => !CORPUS.includes(file))].sort();
const normativeFiles = digests(normative);
const lock = {
  schema: previous.schema,
  version: RECIPE_CONTRACT_VERSION,
  architecture: previous.architecture,
  implementation: previous.implementation,
  sourceBaseRevision: previous.sourceBaseRevision,
  contractDigest: sha(stableStringify(normativeFiles)),
  normativeFiles,
  fixtures: digests(CORPUS),
  checks: digests(filesUnder('checks')),
  candidate: previous.candidate,
  baseline: previous.baseline,
};
if (lock.schema !== 'simai.composition.recipe-contract-lock.v1') throw new Error(`unexpected lock label: ${lock.schema}`);
const output = `${JSON.stringify(lock, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (current !== output) {
    process.stderr.write('composition_recipe_lock_drift: run node scripts/lock-composition-recipe-contract.mjs\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`composition recipe lock ${lock.version} is current: ${lock.contractDigest}\n`);
  }
} else {
  writeFileSync(path, output);
  process.stdout.write(`composition-recipe-v1 ${lock.version} ${lock.contractDigest}\n`);
}
