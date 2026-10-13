#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.resolve(root, process.env.SIMAI_UI_STUDIO_REPO || '../ui-studio');
const output = await mkdtemp(path.join(tmpdir(), 'simai-smart-registry-'));
const cli = path.join(studio, 'packages/cli/src/cli.mjs');
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: studio, encoding: 'utf8' });
const worktree = process.env.STUDIO_ALLOW_OWNER_WORKTREE === '1' ? ['--worktree'] : [];
const projection = (entry) => ({
  id: entry.id,
  manifest_sha256: entry.source?.manifest_sha256 ?? entry.manifest_sha256,
  runtime_pair: entry.runtime_pair
});

try {
  run(
    'registry', 'build',
    '--sources', path.join(studio, 'contracts/sources.lock.json'),
    '--paths', path.join(root, 'contracts/studio.sources.local.json'),
    '--schema', path.join(studio, 'contracts/schema/smart-component-manifest.v1.schema.json'),
    '--output', output,
    ...worktree,
    '--json'
  );
  run('registry', 'verify', '--registry', path.join(output, 'registry.json'), '--schema', path.join(studio, 'contracts/schema/smart-component-manifest.v1.schema.json'), '--json');
  const [studioRegistry, b0Registry] = await Promise.all([
    readFile(path.join(output, 'registry.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'contracts/generated/smart-component-contract-registry.json'), 'utf8').then(JSON.parse)
  ]);
  const b0Projection = b0Registry.entries.map(projection);
  const b0Ids = new Set(b0Projection.map(({id}) => id));
  const studioProjection = studioRegistry.entries.filter(({id}) => b0Ids.has(id)).map(projection);
  if (JSON.stringify(studioProjection) !== JSON.stringify(b0Projection)) {
    throw new Error('studio_registry_projection_drift');
  }

  const validatorModule = await import(pathToFileURL(path.join(studio, 'packages/contracts/src/manifest-validator.mjs')));
  const schemas = Object.fromEntries(await Promise.all([1, 2].map(async schemaVersion => [
    schemaVersion,
    JSON.parse(await readFile(path.join(studio, `contracts/schema/smart-component-manifest.v${schemaVersion}.schema.json`), 'utf8')),
  ])));
  const validateManifest = validatorModule.createVersionedManifestValidator(schemas);
  const localManifests = [];
  for (const directory of (await readdir(path.join(root, 'src/smart'))).sort()) {
    const manifestPath = path.join(root, 'src/smart', directory, 'smart.manifest.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const result = validateManifest(manifest);
      if (!result.ok) {
        const error = result.errors[0];
        throw new Error(`local_manifest_invalid:${manifest.id}:${error.path}:${error.message}`);
      }
      localManifests.push({id: manifest.id, path: path.relative(root, manifestPath)});
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const localIds = new Set(localManifests.map(({id}) => id));
  if (localIds.size !== localManifests.length) throw new Error('local_manifest_id_duplicate');
  const pinnedPaths = new Set(studioRegistry.entries.map(entry => entry.source.manifest_path));
  const awaitingPublication = localManifests.filter(manifest => !pinnedPaths.has(manifest.path));
  process.stdout.write(
    `Studio contract verification passed for ${studioRegistry.entries.length} pinned source manifests and ${localManifests.length} local manifests; `
    + `${awaitingPublication.length} local manifest(s) await source-lock publication. B0 rollback remains available.\n`,
  );
} finally {
  await rm(output, { recursive: true, force: true });
}
