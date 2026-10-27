#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
// Directories under src/smart that are modules rather than elements. A
// manifest requires a custom element name, so a module cannot have one; the
// field renderer set is a module by design -- it is called, not placed in
// markup -- which is why the registry cannot describe it yet. Recorded in
// ui-control's ledger as a question for the registry's owner.
// inputs, icons, buttons, icon-buttons and badges are former distribution paths of Smart elements, forwarding
// bundles until 2026-12-01 (change journal path-smart-<old>-to-<new>), not elements.
const serviceDirectories = new Set(['helpers', 'field-renderers', 'inputs', 'icons', 'buttons', 'icon-buttons', 'badges']);
const runtimeRoot = path.resolve(root, '../ui-smart');
const uiRoot = path.resolve(root, '../ui');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function revision(repository, explicitRevision) {
  const requested = explicitRevision || 'HEAD';
  const value = execFileSync('git', ['rev-parse', `${requested}^{commit}`], {
    cwd: repository,
    encoding: 'utf8'
  }).trim();
  return value;
}

function fileAtRevision(repository, commit, file) {
  return execFileSync('git', ['show', `${commit}:${file}`], {
    cwd: repository,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024
  });
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const sourceRevision = revision(root, argument('--source-revision'));
const runtimeRevision = revision(runtimeRoot, argument('--runtime-revision'));
const uiRevision = revision(uiRoot, argument('--ui-revision'));
const write = process.argv.includes('--write');

const directories = (await readdir(path.join(root, 'src/smart'), {withFileTypes: true}))
  .filter((entry) => entry.isDirectory() && !serviceDirectories.has(entry.name))
  .sort((left, right) => left.name.localeCompare(right.name));

const changes = [];

for (const {name} of directories) {
  const manifestFile = path.join(root, 'src/smart', name, 'smart.manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));

  manifest.compatibility.runtime_pair = {
    ui_revision: uiRevision,
    ui_smart_revision: runtimeRevision
  };
  manifest.provenance.source_revision = sourceRevision;
  manifest.provenance.source_artifacts = manifest.provenance.source_artifacts.map((artifact) => ({
    ...artifact,
    sha256: sha256(fileAtRevision(root, sourceRevision, artifact.path))
  }));
  manifest.provenance.generated_runtime = manifest.provenance.generated_runtime.map((artifact) => ({
    ...artifact,
    revision: runtimeRevision,
    sha256: sha256(fileAtRevision(runtimeRoot, runtimeRevision, artifact.path))
  }));

  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  const previous = await readFile(manifestFile, 'utf8');
  if (content === previous) continue;
  changes.push(path.relative(root, manifestFile));
  if (write) await writeFile(manifestFile, content);
}

process.stdout.write(`${write ? 'UPDATED' : 'WOULD_UPDATE'} ${changes.length} manifests\n`);
for (const file of changes) process.stdout.write(`${file}\n`);
