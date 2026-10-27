#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The committed first-paint snapshots are what this build renders (standard
// simai.smart-component 1.3.8 §5.4; owner decision 2026-10-27): every
// src/smart/<folder>/static/ file and every composed assembly is rendered
// again from the built output and compared, byte for byte. A stale or missing
// snapshot fails; `node scripts/snapshot-first-paint.mjs <output>` writes them.
import {execFileSync} from 'node:child_process';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

if (!process.argv[2]) throw new Error('Build output root is required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
try {
  process.stdout.write(execFileSync(process.execPath, [join(repo, 'scripts', 'snapshot-first-paint.mjs'), resolve(process.argv[2]), '--check'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
} catch (error) {
  process.stdout.write(String(error.stdout ?? ''));
  console.error('first-paint snapshots are stale or missing: run node scripts/snapshot-first-paint.mjs <output> and commit src/smart/*/static');
  process.exit(1);
}
