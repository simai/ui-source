#!/usr/bin/env node
// Writes or checks contract.lock.json for each Composition capability bundle.
// contractDigest = sha256 of the canonical map relativePath -> sha256:bytes of
// the normative files (the lock never hashes itself), as in Recipe 1.0.1.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stableStringify } from '../src/core/js/composition/index.mjs';
import { BUNDLES } from './composition-capability-bundles.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contracts = resolve(root, 'src/core/contracts');
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function filesUnder(base, directory) {
  let entries = [];
  try { entries = readdirSync(join(base, directory), { withFileTypes: true }); } catch { return []; }
  return entries.filter((entry) => entry.isFile()).map((entry) => `${directory}/${entry.name}`).sort();
}

let drift = false;
for (const bundle of BUNDLES) {
  const base = resolve(contracts, bundle.directory);
  const normative = ['README.md', ...bundle.schemas, ...filesUnder(base, 'fixtures')].sort();
  const normativeFiles = Object.fromEntries(normative.map((relative) => [relative, sha(readFileSync(join(base, relative)))]));
  const checks = Object.fromEntries(filesUnder(base, 'checks').map((relative) => [relative, sha(readFileSync(join(base, relative)))]));
  const entries = bundle.entries();
  const manifests = Object.fromEntries(entries.map((entry) => [entry.key, sha(stableStringify(entry.value))]));
  // The lock keeps its versioned label: ui-builder reads it by that label when
  // it packages the normative files (journal record format-names-without-version).
  const lock = {
    schema: 'simai.composition.capability-contract-lock.v1',
    capability: bundle.capability,
    version: bundle.version,
    status: bundle.status,
    compatibility: bundle.compatibility,
    contractDigest: sha(stableStringify(normativeFiles)),
    normativeFiles,
    checks,
    manifests,
  };
  const output = `${JSON.stringify(JSON.parse(stableStringify(lock)), null, 2)}\n`;
  const path = join(base, 'contract.lock.json');
  if (process.argv.includes('--check')) {
    let current = null;
    try { current = readFileSync(path, 'utf8'); } catch { current = null; }
    if (current !== output) {
      drift = true;
      process.stderr.write(`composition_capability_lock_drift:${bundle.directory}\n`);
    }
  } else {
    writeFileSync(path, output);
    process.stdout.write(`${bundle.directory} ${lock.contractDigest}\n`);
  }
}
if (drift) process.exitCode = 1;
else if (process.argv.includes('--check')) process.stdout.write('composition capability locks are current\n');
