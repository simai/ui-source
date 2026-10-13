import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {exactRuleSource, generateExactRules, regexSource} from '../scripts/generate-exact-utility-rules.mjs';

test('exact rule generation preserves object metadata and rejects flags', () => {
  const source = "SF.RuleLoader['gradient-type/default'] = { regex: /gr-/, mode: 'utility', relation: [{name:'x'}] };\n";
  const result = exactRuleSource(source, 'gradient-type/default', '/^(?:gr-line)(?![\\s\\S])/');
  assert.match(result, /regex: new RegExp/);
  assert.match(result, /relation: \[\{name:'x'\}\]/);
  assert.throws(() => regexSource('/x/i'));
});
test('writer is deterministic and check detects stale source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-exact-rules-'));
  const target = path.join(root, 'utility', 'gap', 'default', 'rule.js');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, "SF.RuleLoader['gap/default'] = /gap-/;\n");
  const candidateReport = {
    mode: 'diagnostic-exact-candidate',
    status: 'pass',
    candidates: [{name: 'gap/default', regex: '/^(?:gap-1)(?![\\s\\S])/' }],
  };
  try {
    assert.deepEqual(generateExactRules({candidateReport, sourceRoot: root}), ['gap/default']);
    assert.deepEqual(generateExactRules({candidateReport, sourceRoot: root, write: true}), ['gap/default']);
    assert.deepEqual(generateExactRules({candidateReport, sourceRoot: root}), []);
    assert.match(fs.readFileSync(target, 'utf8'), /new RegExp/);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
