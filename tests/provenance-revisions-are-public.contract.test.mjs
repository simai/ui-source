import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// A manifest's provenance names the revision its source digests were taken at,
// and ui-studio shows it as «Исходники». Since ui-source became a public
// snapshot, 55 manifests still named d73527c9, a commit that exists only in
// the private ui-source-history; nobody outside could open it. Every
// source_revision has to be an ancestor of this checkout. (The digests are
// held to the working files by sf-contract; the revision is where a reader
// starts looking, so it only has to exist in public history.)
const root = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore']});

test('every manifest source_revision is a public ancestor', (t) => {
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
  }
  assert.deepEqual(problems, []);
});
