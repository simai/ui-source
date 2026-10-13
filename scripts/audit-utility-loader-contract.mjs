#!/usr/bin/env node
/* global process */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {exactClassPattern} from './utility-exact-rule.mjs';

const args = process.argv.slice(2);
let cliDistributionRoot = '';
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--json' || args[index] === '--compiled-rules') {
    index++;
    continue;
  }
  if (!args[index].startsWith('--')) {
    cliDistributionRoot = args[index];
    break;
  }
}
const options = cliDistributionRoot
  ? args.filter(argument => argument !== cliDistributionRoot)
  : args;
const distributionRoot =
  cliDistributionRoot || process.env.SF_UTILITY_DISTRIBUTION_ROOT || '';
const jsonIndex = options.indexOf('--json');
const jsonPath = jsonIndex === -1 ? '' : options[jsonIndex + 1];
const strict = options.includes('--strict');
// Diagnostic candidate only: do not overwrite source or distribution rules.
const candidate = options.includes('--candidate-exact');
const compiledIndex = options.indexOf('--compiled-rules');
if (candidate && compiledIndex !== -1) throw new Error('Choose source candidate or compiled rules, not both');

if (!distributionRoot || !path.isAbsolute(distributionRoot)) {
  process.stderr.write(
      'Usage: node scripts/audit-utility-loader-contract.mjs ' +
      '<absolute-distribution-root> [--json <path>] [--strict]\n',
  );
  process.exit(2);
}

const sourceRoot = path.resolve(import.meta.dirname, '..', 'src', 'utility');
const rules = {};

function walk(root, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walk(target, predicate));
    else if (predicate(target)) result.push(target);
  }
  return result.sort();
}

for (const rulePath of walk(sourceRoot, candidate => candidate.endsWith('/rule.js'))) {
  const context = { SF: { RuleLoader: rules } };
  vm.runInNewContext(fs.readFileSync(rulePath, 'utf8'), context, {
    filename: rulePath,
  });
}

if (compiledIndex !== -1) {
  const payload = JSON.parse(fs.readFileSync(options[compiledIndex + 1], 'utf8'));
  if (payload.failures?.length) throw new Error('Compiled corpus contains failures');
  const records = new Map((payload.records || payload).map(record => [record.name, record]));
  for (const key of Object.keys(rules)) {
    const literal = records.get(key)?.regex;
    if (typeof literal !== 'string' || !literal.startsWith('/')) throw new Error(`Missing compiled rule: ${key}`);
    const end = literal.lastIndexOf('/');
    rules[key] = new RegExp(literal.slice(1, end), literal.slice(end + 1));
  }
}

function layerContents(css, layerName) {
  const contents = [];
  const marker = `@layer ${layerName}`;
  let cursor = 0;

  while ((cursor = css.indexOf(marker, cursor)) !== -1) {
    const open = css.indexOf('{', cursor + marker.length);
    if (open === -1) break;
    let depth = 1;
    let end = open + 1;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') depth--;
      end++;
    }
    if (depth === 0) contents.push(css.slice(open + 1, end - 1));
    cursor = end;
  }

  return contents.join('\n');
}

function selectorClassGroupsFromCss(css) {
  const groups = [];
  const utilities = layerContents(css, 'sf.utilities');
  const withoutComments = utilities.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of withoutComments.matchAll(/([^{}]+)\{/g)) {
    const selector = block[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    for (const arm of selector.split(',')) {
      const classes = [];
      for (const match of arm.matchAll(/\.((?:\\.|[a-zA-Z0-9_-])+)/g)) {
        classes.push(
          match[1]
              .replace(/\\([!"#$%&'()*+,./:;<=>?@[\]^`{|}~-])/g, '$1')
              .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
                String.fromCodePoint(Number.parseInt(hex, 16))),
        );
      }
      if (classes.length) groups.push({ classes, selector: arm.trim() });
    }
  }
  return groups;
}

function ruleRegex(rule) {
  const isRegexLike = candidate =>
    candidate && typeof candidate === 'object' &&
    typeof candidate.source === 'string' && typeof candidate.flags === 'string';
  const candidate = isRegexLike(rule) ? rule : rule?.regex ?? rule;
  assert(isRegexLike(candidate) || typeof candidate === 'string');
  return isRegexLike(candidate)
    ? new RegExp(candidate.source, candidate.flags.replace(/[gy]/g, ''))
    : new RegExp(candidate);
}

function matchesClassToken(rule, token) {
  const regex = ruleRegex(rule);
  regex.lastIndex = 0;
  const match = regex.exec(token);
  return Boolean(match && match.index === 0);
}

const cssFiles = walk(
    path.resolve(distributionRoot, 'utility'),
    candidate => /\/css\/[^/]+\.css$/.test(candidate) && !candidate.endsWith('.min.css'),
);
const modules = [];
const missingRules = [];
const uncovered = [];
const positionFailures = [];
const partialMatches = [];
const candidates = [];

for (const cssPath of cssFiles) {
  const relative = path.relative(path.resolve(distributionRoot, 'utility'), cssPath);
  const [family, variant] = relative.split(path.sep);
  const key = `${family}/${variant}`;
  const groups = selectorClassGroupsFromCss(fs.readFileSync(cssPath, 'utf8'));
  const classes = [...new Set(groups.flatMap(group => group.classes))].sort();
  let rule = rules[key];

  modules.push({ classes: classes.length, key });
  if (!rule) {
    missingRules.push({ classes, key });
    continue;
  }

  if (candidate && classes.length) {
    // Preserve every class already recognized by the source rule. When a CSS
    // selector arm is currently unreachable, add its first class as the
    // module trigger. The first class is the owning utility in compound
    // selectors such as `.max-container-1 .container`; adding every class
    // would make the generic `.container` token load this module.
    const triggers = new Set(classes.filter(name => matchesClassToken(rule, name)));
    for (const group of groups) {
      if (!group.classes.some(name => triggers.has(name))) triggers.add(group.classes[0]);
    }
    if (!triggers.size) throw new Error(`No trigger contract: ${key}`);
    const pattern = exactClassPattern([...triggers]);
    rule = new RegExp(pattern);
    candidates.push({name:key, regex:rule.toString(), classes:triggers.size});
  }

  for (const group of groups) {
    const triggers = group.classes.filter(className =>
      matchesClassToken(rule, className),
    );
    if (!triggers.length) {
      uncovered.push({
        className: group.classes.join(' '),
        key,
        selector: group.selector,
      });
      continue;
    }

    for (const className of triggers) {
    for (const [position, sample] of Object.entries({
      first: `${className} sibling`,
      middle: `sibling ${className} sibling`,
      only: className,
      last: `sibling ${className}`,
    })) {
      if (!sample.split(/\s+/).some(token => matchesClassToken(rule, token))) {
        positionFailures.push({ className, key, position });
      }
    }

    // A valid prefix is not a complete class. Exercise both ends and a
    // deliberately invalid terminal value, without mistaking another exported
    // class in this module for a negative fixture.
    const invalidValue = className.replace(/[^:-]+$/, 'sf-invalid-value');
    for (const sample of new Set([
      `x-${className}`, `${className}-sf-unrelated`, invalidValue,
    ])) {
      if (classes.includes(sample)) continue;
      if (matchesClassToken(rule, sample)) partialMatches.push({ className, key, sample });
    }
    }
  }
}

const report = {
  mode: candidate ? 'diagnostic-exact-candidate' : compiledIndex !== -1 ? 'compiled-rules' : 'source-rules',
  candidates,
  candidateStats: candidate ? {
    generatedModules:candidates.length,
    modulesWithoutClassSelectors:modules.filter(module => module.classes === 0).map(module => module.key),
    regexBytes:Buffer.byteLength(JSON.stringify(candidates.map(({name, regex}) => ({name, regex})))),
    regexGzipBytes:gzipSync(JSON.stringify(candidates.map(({name, regex}) => ({name, regex})))).length,
  } : null,
  distributionRoot,
  failures: {
    missingRules,
    partialMatches,
    positionFailures,
    uncovered,
  },
  modules,
  schema: 'sf5.utility-loader-contract',
  status:
    missingRules.length || uncovered.length || positionFailures.length || partialMatches.length
      ? 'needs_revision'
      : 'pass',
  summary: {
    classCount: modules.reduce((sum, item) => sum + item.classes, 0),
    missingRuleCount: missingRules.length,
    moduleCount: modules.length,
    partialMatchCount: partialMatches.length,
    positionFailureCount: positionFailures.length,
    uncoveredCount: uncovered.length,
  },
};

const output = `${JSON.stringify(report, null, 2)}\n`;
if (jsonPath) fs.writeFileSync(jsonPath, output);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

if (strict && report.status !== 'pass') process.exitCode = 1;
