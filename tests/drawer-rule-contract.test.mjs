import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Smart Drawer is discoverable through the public RuleLoader contract', () => {
  const rule = fs.readFileSync(new URL('../src/smart/drawer/rule.js', import.meta.url), 'utf8');
  const registry = fs.readFileSync(new URL('../src/core/js/rule.src.js', import.meta.url), 'utf8');

  assert.match(rule, /SF\.RuleLoader\['cl-drawer'\]/);
  assert.match(rule, /tags:\s*\['sf-drawer'\]/);
  assert.match(rule, /type:\s*'smart'/);
  assert.match(rule, /mode:\s*'smart'/);
  assert.match(rule, /js:\s*true/);
  assert.match(rule, /css:\s*true/);
  assert.match(registry, /smart\/drawer\/rule\.js/);
});
