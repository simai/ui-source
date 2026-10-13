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

test('review policy preserves known decisions without approving new dimensions', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'src/core/contracts/dimension-policy.v1.json'), 'utf8'));
  const result = inventory(path.join(repositoryRoot, 'src'), {policy});
  assert.ok(result.findingCount > 0);
  assert.ok(result.byStatus['accepted-system-definition'] > 0);
  assert.ok(result.byStatus['accepted-runtime-geometry'] > 0);
  assert.ok(result.unresolvedCount > 0, 'new source findings must remain visible until reviewed');

  const unknown = scanDimensions('node.style.width = `${newDesignWidth}px`;', 'smart/modal/index.js');
  const reviewed = reviewDimensionFindings(unknown, policy);
  assert.equal(reviewed[0].status, 'unreviewed');
  assert.deepEqual(reviewed[0].policyMatches, []);
});
