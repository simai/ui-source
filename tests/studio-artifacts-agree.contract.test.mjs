import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// The Studio generator regenerates manifests from the components' props and
// meta.mjs. It overwrote what the manifests said with what the props said and
// dropped inputs only the manifests named, so eleven manifests differed from
// what a regeneration would write, and nobody could regenerate without undoing
// authored work (2026-10-13). It keeps the manifest's word now, and the two
// agree; this holds them together.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('a regeneration writes the manifests that are committed', () => {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/generate-smart-studio-artifacts.mjs'), '--verify'], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /WOULD_WRITE 0 /u);
});
