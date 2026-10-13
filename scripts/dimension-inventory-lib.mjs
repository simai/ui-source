import fs from 'node:fs';
import path from 'node:path';

// Conservative lexical inventory, not a semantic compliance verdict.
// Strings and comments remain visible: templates can contain executable CSS.
export function scanDimensions(source, file) {
  const commentRanges = [];
  let quote = null;
  for (let index = 0; index < source.length; index++) {
    const character = source[index], next = source[index+1];
    if (quote) {
      if (character === '\\') { index++; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === '/' && (next === '/' || next === '*')) {
      const block = next === '*';
      let end = block ? source.indexOf('*/', index+2) : source.indexOf('\n', index+2);
      end = end < 0 ? source.length : end + (block ? 2 : 0);
      commentRanges.push([index,end]);
      index = end-1;
    }
  }
  return [...source.matchAll(/(?<![\w.])(-?(?:\d+(?:\.\d*)?|\.\d+))(px|rem|em)(?![\w-])|\$\{[^{}\n]+\}(px|rem|em)(?![\w-])/g)].map(match => {
    const start = source.lastIndexOf('\n', match.index)+1;
    const end = source.indexOf('\n', match.index);
    const context = source.slice(start, end < 0 ? source.length : end).trim();
    const kind = match[3] ? 'runtime-expression' : 'literal';
    const inComment = commentRanges.some(([begin,end]) => match.index >= begin && match.index < end);
    const category = inComment ? 'comment-review'
      : /^(?:component\/(?:fancybox|swiper|icon|jquery)\/|plugin\/)/.test(file) ? 'vendor-review'
      : kind === 'runtime-expression' ? 'runtime-review'
      : /@(?:media|container)\b/.test(context) ? 'condition-review'
      : /(?:\/scss\/_?sf_var__|^core\/(?:scss\/vars\/|figma_variables\/|contracts\/|scss\/_sf_css__size\.scss$))/.test(file) ? 'definition-review'
      : /\.(?:js|mjs|cjs|json)$/.test(file) ? 'script-data-template-review' : 'style-review';
    return {file, line: source.slice(0,match.index).split('\n').length, column: match.index-start+1,
      text: match[0], unit: match[2] || match[3], kind, category, status: 'unreviewed', context};
  });
}

export function reviewDimensionFindings(findings, policy) {
  if (!policy?.rules?.length) return findings;
  const rules = policy.rules.map(rule => ({
    ...rule,
    fileRegex: new RegExp(rule.filePattern, 'u'),
    contextRegex: new RegExp(rule.contextPattern, 'u'),
  }));
  return findings.map(finding => {
    const matches = rules.filter(rule =>
      rule.category === finding.category
      && rule.fileRegex.test(finding.file)
      && rule.contextRegex.test(finding.context));
    if (matches.length !== 1) return {
      ...finding,
      status: matches.length ? 'policy-conflict' : 'unreviewed',
      policyMatches: matches.map(rule => rule.id),
    };
    const [rule] = matches;
    return {...finding, status: rule.status, policyRule: rule.id, reason: rule.reason};
  });
}

export function inventory(root, {policy = null} = {}) {
  const files = [], findings = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', '.git'].includes(entry.name)) walk(full); }
      else if (/\.(?:scss|css|js|mjs|cjs|html|json)$/.test(entry.name)) {
        const file = path.relative(root, full).split(path.sep).join('/');
        files.push(file);
        findings.push(...scanDimensions(fs.readFileSync(full, 'utf8'), file));
      }
    }
  }
  walk(root);
  const reviewedFindings = reviewDimensionFindings(findings, policy);
  const byCategory = {}, byLayer = {}, byStatus = {};
  for (const finding of reviewedFindings) {
    byCategory[finding.category] = (byCategory[finding.category] || 0)+1;
    byStatus[finding.status] = (byStatus[finding.status] || 0)+1;
    const layer = finding.file.split('/')[0];
    byLayer[layer] = (byLayer[layer] || 0)+1;
  }
  return {schemaVersion: 1, status: 'inventory-only', scannedFiles: files.length,
    limitations: ['Lexical candidates including comments and strings, not parsed violations', 'Unitless JSON dimension fields require schema-aware review', 'Nested or multiline interpolation is not covered', 'A policy match records a reviewed boundary but does not turn runtime geometry into a design token'],
    files, findingCount: reviewedFindings.length, byCategory, byLayer, byStatus,
    unresolvedCount: reviewedFindings.filter(finding => ['unreviewed', 'policy-conflict'].includes(finding.status)).length,
    findings: reviewedFindings};
}
