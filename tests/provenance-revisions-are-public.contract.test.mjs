import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as crypto from 'node:crypto';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// A manifest's provenance names the revision its source digests were taken at,
// and ui-studio shows it as «Исходники». Since ui-source became a public
// snapshot, 55 manifests still named d73527c9, a commit that exists only in
// the private ui-source-history; nobody outside could open it. Every
// source_revision has to be an ancestor of this checkout, and its files there
// have to hash to the stored digests.
const root = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore']});

test('every manifest source_revision is a public ancestor whose files match the digests', (t) => {
  try { git('rev-parse', 'HEAD'); } catch { t.skip('not a git checkout'); return; }
  const problems = [];
  for (const name of readdirSync(resolve(root, 'src/smart'))) {
    const path = resolve(root, 'src/smart', name, 'smart.manifest.json');
    if (!existsSync(path)) continue;
    const provenance = JSON.parse(readFileSync(path, 'utf8')).provenance ?? {};
    if (!provenance.source_revision) continue;
    try {
      git('merge-base', '--is-ancestor', provenance.source_revision, 'HEAD');
    } catch {
      problems.push(`${name}: ${provenance.source_revision.slice(0, 12)} is not in this history`);
      continue;
    }
    for (const artifact of provenance.source_artifacts ?? []) {
      const bytes = git('show', `${provenance.source_revision}:${artifact.path}`);
      const sha = crypto.createHash('sha256').update(bytes).digest('hex');
      if (sha !== artifact.sha256) problems.push(`${name}: ${artifact.path} differs at ${provenance.source_revision.slice(0, 12)}`);
    }
  }
  assert.deepEqual(problems, []);
});
