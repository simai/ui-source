// Every utility class a built sheet defines loads. The Loader fetches a
// utility sheet only when a class on the page matches that utility's rule, so
// a class the sheet has and the rule lacks ships and never loads:
// radius-ui, radius-surface and radius-4 were added to the sheet (52a3915fa,
// cef2f0719) and the grid rows renamed (ab729dd7f) while the rules kept their
// old lists, and elevation-* had no rule at all (documentation trial,
// 2026-10-12). scripts/audit-utility-loader-contract.mjs has measured this
// since the rules were made exact; nothing ran it.
//
// The sheets are read from a built distribution: UI_CORE_ROOT, default ../ui.
// When this fails, rebuild the rules from the built sheets:
//   node scripts/audit-utility-loader-contract.mjs <ui>/distr --json <report> --candidate-exact
//   node scripts/generate-exact-utility-rules.mjs <report> --write
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distribution = resolve(process.env.UI_CORE_ROOT ?? resolve(root, '../ui'), 'distr');

test('every utility sheet has a rule and every owning class matches it', () => {
  const work = mkdtempSync(join(tmpdir(), 'utility-audit-'));
  try {
    const report = join(work, 'report.json');
    const run = spawnSync(process.execPath, [
      join(root, 'scripts/audit-utility-loader-contract.mjs'), distribution, '--json', report, '--strict',
    ], {encoding: 'utf8'});
    const {status, summary, failures} = JSON.parse(readFileSync(report, 'utf8'));
    assert.ok(summary.moduleCount > 700, `audited only ${summary.moduleCount} sheets under ${distribution}`);
    assert.deepEqual(
      {status, missingRules: failures.missingRules.map(({key}) => key), uncovered: failures.uncovered.slice(0, 20)},
      {status: 'pass', missingRules: [], uncovered: []},
    );
    assert.equal(run.status, 0, run.stderr);
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
});
