import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {inventory, reviewDimensionFindings, scanDimensions} from '../scripts/dimension-inventory-lib.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('whole signed units and runtime coordinates have accurate source positions', () => {
  const source = 'x\nleft:-1px; gap:.25rem; pad:1.5em; `${rect.left}px`; 2pxThing 6remix';
  const found = scanDimensions(source, 'smart/x/index.js');
  assert.deepEqual(found.map(x => x.text), ['-1px', '.25rem', '1.5em', '${rect.left}px']);
  assert.equal(found[0].line, 2);
  assert.equal(found[0].column, 6);
  assert.equal(found[3].category, 'runtime-review');
  assert.ok(found.every(x => x.status === 'unreviewed'));
});
test('comments, definitions and vendor values are retained, not silently approved', () => {
  for (const [file, source, category] of [
    ['core/scss/vars/size.scss', 'a: 1rem;', 'definition-review'],
    ['utility/letter-spacing/default/scss/_sf_var__letter_spacing.scss', 'wide: .1em;', 'definition-review'],
    ['component/x/index.scss', '@media (min-width: 640px) {}', 'condition-review'],
    ['component/swiper/index.scss', '.x { width: 1px; }', 'vendor-review'],
    ['component/jquery/js/jquery.js', 'left: -11111px;', 'vendor-review'],
    ['component/x/index.scss', '// nominal 16px', 'comment-review'],
    ['component/x/index.scss', '.x { width: 1rem; } // nominal 16px', 'style-review'],
  ]) {
    const findings = scanDimensions(source, file);
    assert.equal(findings[0].category, category);
    assert.ok(findings.every(finding => finding.status === 'unreviewed'));
  }
  const inline = scanDimensions('.x { width: 1rem; } // nominal 16px', 'component/x/index.scss');
  assert.equal(inline[1].category, 'comment-review');
});

const policy = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'src/core/contracts/dimension-policy.v1.json'), 'utf8'));

test('review policy preserves known decisions without approving new dimensions', () => {
  const result = inventory(path.join(repositoryRoot, 'src'), {policy});
  assert.ok(result.findingCount > 0);
  assert.ok(result.byStatus['accepted-system-definition'] > 0);
  assert.ok(result.byStatus['accepted-runtime-geometry'] > 0);

  const unknown = scanDimensions('node.style.width = `${newDesignWidth}px`;', 'smart/modal/index.js');
  const reviewed = reviewDimensionFindings(unknown, policy);
  assert.equal(reviewed[0].status, 'unreviewed');
  assert.deepEqual(reviewed[0].policyMatches, []);
});

// C18 (owner, 2026-11-08): every size comes from the size system; a raw length
// is a defect unless a rule of dimension-policy.v1.json lists it. The gate:
// the source holds no length the policy has not reviewed.
test('C18 gate: every length in the source is reviewed by the policy', () => {
  const result = inventory(path.join(repositoryRoot, 'src'), {policy});
  const open = result.findings.filter(finding => ['unreviewed', 'policy-conflict'].includes(finding.status));
  assert.equal(result.unresolvedCount, 0, `unreviewed lengths -- use a size, space or radius token, or list a reviewed exception:\n${
    open.map(finding => `  ${finding.file}:${finding.line}:${finding.column} ${finding.text} [${finding.category}${finding.policyMatches?.length ? `; rules ${finding.policyMatches.join(', ')}` : ''}] ${finding.context}`).join('\n')}`);
  // A deferred defect names the task that removes it; it is not an acceptance.
  for (const finding of result.findings.filter(item => item.status === 'reviewed-deferred')) assert.ok(finding.task, `${finding.file}:${finding.line} is deferred without a task`);
});

test('C18 gate: raw component lengths, wrong fallbacks and off-step conditions are not accepted', () => {
  for (const [file, source] of [
    ['smart/x/scss/_smart__x.scss', '.x { max-block-size: 22.5rem; }'],
    ['smart/x/scss/_smart__x.scss', '.x { gap: var(--sf-space-1, .25rem); }'],
    ['smart/x/scss/_smart__x.scss', '.x { border-radius: 2px; }'],
    ['smart/x/scss/_smart__x.scss', '.x { padding: 3px; }'],
    ['smart/x/scss/_smart__x.scss', '@container x (max-width: 600px) {}'],
    ['smart/x/scss/_smart__x.scss', '@media (max-width: 27rem) {}'],
    ['component/x/scss/_x.scss', '.x { font-size: 0.875em; }'],
  ]) {
    const [finding] = reviewDimensionFindings(scanDimensions(source, file), policy);
    assert.equal(finding.status, 'unreviewed', `${source} must stay unreviewed`);
  }
  for (const [file, source, status] of [
    ['smart/x/scss/_smart__x.scss', '.x { border: 1px solid; }', 'accepted-hairline'],
    ['smart/x/scss/_smart__x.scss', '@container x (max-width: 38rem) {}', 'accepted-size-step'],
    ['smart/x/scss/_smart__x.scss', '.x { margin: 0px; }', 'accepted-zero-length'],
  ]) {
    const [finding] = reviewDimensionFindings(scanDimensions(source, file), policy);
    assert.equal(finding.status, status, source);
  }
});
