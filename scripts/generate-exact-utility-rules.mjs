#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));

export function regexSource(literal) {
  if (typeof literal !== 'string' || literal[0] !== '/') throw new Error('Invalid regex literal');
  const end = literal.lastIndexOf('/');
  if (end <= 0 || literal.slice(end + 1)) throw new Error('Exact rules must not use flags');
  return literal.slice(1, end);
}

export function exactRuleSource(current, name, literal) {
  const expression = `new RegExp(${JSON.stringify(regexSource(literal))})`;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const registration = current.match(new RegExp(`SF\\.RuleLoader\\[(['"])${escapedName}\\1\\]`));
  if (!registration) throw new Error(`Rule registration does not match ${name}`);
  const assignment = registration[0];
  if (/=\s*\{/.test(current)) {
    if (!/regex:\s*.*?,\s*mode:/.test(current)) throw new Error(`Unsupported object rule: ${name}`);
    return current.replace(/regex:\s*.*?,\s*mode:/, `regex: ${expression}, mode:`);
  }
  const comments = current.split(/\r?\n/).filter(line => line.trim().startsWith('//'));
  return `${comments.length ? `${comments.join('\n')}\n` : ''}${assignment} = ${expression};\n`;
}

export function generateExactRules({candidateReport, sourceRoot, write = false}) {
  if (candidateReport.mode !== 'diagnostic-exact-candidate' || candidateReport.status !== 'pass') {
    throw new Error('Candidate report must be a passing diagnostic-exact-candidate');
  }
  const changes = [];
  for (const candidate of candidateReport.candidates || []) {
    if (!/^[a-z0-9-]+\/(?:default|hover|focus|focus-visible|active|sm|md|lg|xl|xxl)$/.test(candidate.name)) {
      throw new Error(`Invalid Utility module name: ${candidate.name}`);
    }
    const target = path.join(sourceRoot, 'utility', candidate.name, 'rule.js');
    const current = fs.readFileSync(target, 'utf8');
    const expected = exactRuleSource(current, candidate.name, candidate.regex);
    if (current !== expected) {
      changes.push(candidate.name);
      if (write) fs.writeFileSync(target, expected);
    }
  }
  return changes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [reportPath, mode] = process.argv.slice(2);
  if (!reportPath || !path.isAbsolute(reportPath) || !['--check', '--write'].includes(mode)) {
    process.stderr.write('Usage: generate-exact-utility-rules.mjs <absolute-candidate-report> --check|--write\n');
    process.exit(2);
  } else {
    const candidateReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const sourceRoot = path.resolve(scriptRoot, '..', 'src');
    const changes = generateExactRules({candidateReport, sourceRoot, write: mode === '--write'});
    process.stdout.write(`${JSON.stringify({changes, count: changes.length, mode})}\n`);
    if (mode === '--check' && changes.length) process.exitCode = 1;
  }
}
