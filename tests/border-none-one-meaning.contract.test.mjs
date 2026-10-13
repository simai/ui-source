import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// `.border-none` meant a transparent 1px border in Core and border-style: none in
// the border-style utility; which one a page got depended on load order.

test('Core gives border-none the utility meaning in every variant', () => {
  const source = readFileSync(new URL('../src/core/scss/_sf_css__border.scss', import.meta.url), 'utf8');
  const rules = [...source.matchAll(/border-none(?::hover)?\s*\{([^}]*)\}/gu)].map((m) => m[1].trim());
  assert.ok(rules.length >= 3, 'plain, responsive and hover');
  for (const body of rules) assert.equal(body, 'border-style: none;');
});
