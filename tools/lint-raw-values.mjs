#!/usr/bin/env node
// Usage:
//   node tools/lint-raw-values.mjs [--json] [--ignore <substring>]... [--rule <rule>]...
//                                  [--baseline <file.json>] <file or folder>...
//
// Every size and every layer comes from the SIMAI Framework systems (owner
// decisions C18 and C178, 2026-11-08 and 2026-11-14): a stylesheet writes a
// space, size, radius or line token, not a number of pixels, and a layer
// token, not a stacking number of its own. ui-source holds its own sources to
// that with tests/dimension-inventory.test.mjs and its dimension policy; this
// lint is the same rule in a form any package can run over its sheets (ui-pro,
// ui-doc, a product):
//
//   raw-px         a length in px other than 0 (`padding: 6px`, `top: -3px`,
//                  `calc(100% - 12px)`): use a space, size or radius token
//   raw-hairline   1px or 2px (a frame, a divider, a focus ring): use
//                  var(--sf-px) or a line token
//   raw-z-index    `z-index: <number>` beyond the local stacking -1, 0, 1, 2
//                  (a part over its sibling inside one component): use a
//                  layer token, var(--sf-z-index-N) or the layer stack
//
// A px length in a media or container condition is a raw-px too: a condition
// cannot read a variable, so it uses a step of the breakpoint ladder in rem.
//
// Reads .css, .scss, .sass, .less, .pcss and the <style> blocks of .html,
// .vue, .svelte and .astro files. Skips node_modules, .git and the SIMAI
// Framework distribution a product carries (any path with /distr/,
// /ui-smart/ or @simai-studio/ui) and every path containing an --ignore
// substring. A line that must stay is marked on the line or the line above
// with the comment `sf-raw-lint: allow <reason>`.
//
// --rule limits the lint to the rules named (repeatable). --baseline reads a
// JSON list of findings already reviewed and scheduled ({file, rule, text,
// count?, owner?, task?}; file is a path suffix): they do not fail the run,
// and an entry that no longer matches is reported as stale, so a fixed line
// leaves the list. That is how a package adopts the lint: the list of today's
// findings, owned, and nothing new.
//
// Exit code: 0 clean, 1 findings (or stale baseline entries), 2 usage.
// --json prints {files, findings, baselined, stale}.
//
// ui-pro and ui-doc run it from a ui-source checkout beside them:
//   node ../ui-source/tools/lint-raw-values.mjs components
// The self-test is tests/raw-values-lint.contract.test.mjs.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHEETS = new Set(['.css', '.scss', '.sass', '.less', '.pcss']);
const PAGES = new Set(['.html', '.htm', '.vue', '.svelte', '.astro']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git']);
const FRAMEWORK_PATHS = ['/distr/', '/ui-smart/', '@simai-studio/ui'];
const ALLOW = /sf-raw-lint:\s*allow\b/u;
export const RULES = ['raw-px', 'raw-hairline', 'raw-z-index'];
// The local stacking a component may write as a number: a part under (-1) or
// over (1, 2) its sibling inside the component's own stacking context.
const LOCAL_STACKING = new Set([-1, 0, 1, 2]);

const SAYS = {
  'raw-px': 'a length in px: use a space, size or radius token (C18)',
  'raw-hairline': 'a hairline in px: use var(--sf-px) or a line token (C18)',
  'raw-z-index': 'a stacking number beyond -1..2: use a layer token (C178)',
};

// A comment becomes spaces of its own length, its newlines kept, so every
// offset still points at the same line and column of the source. A string
// keeps its text: a url() or a content: "12px" is not a length, but a
// template a sheet carries can be, so strings are read too, except url().
const blank = (text) => text.replace(/[^\n]/gu, ' ');
const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//gu, blank)
  .replace(/(^|[^:\\])\/\/[^\n]*/gu, (match, before) => before + blank(match.slice(before.length)))
  .replace(/url\([^)]*\)/giu, blank);

const position = (source, at) => {
  const before = source.slice(0, at);
  const line = before.split('\n').length;
  return {line, column: at - before.lastIndexOf('\n')};
};

const lineOf = (source, at) => {
  const start = source.lastIndexOf('\n', at - 1) + 1;
  const end = source.indexOf('\n', at);
  return source.slice(start, end < 0 ? source.length : end).trim();
};

/**
 * The findings in one stylesheet's text: [{rule, line, column, text, context, says}].
 * `origin` is the text the lines are read from for the allow comment (the
 * whole page for a <style> block); `offset` is where the sheet starts in it.
 */
export function lintStylesheet(sheet, {origin = sheet, offset = 0, rules = RULES} = {}) {
  const code = withoutComments(sheet);
  const lines = origin.split('\n');
  const allowed = (line) => ALLOW.test(lines[line - 1] ?? '') || ALLOW.test(lines[line - 2] ?? '');
  const findings = [];
  const push = (rule, at, text) => {
    if (!rules.includes(rule)) return;
    const where = position(origin, offset + at);
    if (allowed(where.line)) return;
    findings.push({rule, ...where, text, context: lineOf(code, at), says: SAYS[rule]});
  };
  // A px length: a number not glued to a word before it (an id, a class, a
  // variable name like --sf-a12px), and px not followed by a word character.
  for (const match of code.matchAll(/(?<![\w.#$-])(-?(?:\d+(?:\.\d*)?|\.\d+))px(?![\w-])/gu)) {
    const value = Math.abs(Number(match[1]));
    if (value === 0) continue;
    push(value === 1 || value === 2 ? 'raw-hairline' : 'raw-px', match.index, match[0]);
  }
  for (const match of code.matchAll(/(?<![\w-])z-index\s*:\s*(-?\d+)\s*(?:!important\s*)?(?=[;}\n])/gu)) {
    if (LOCAL_STACKING.has(Number(match[1]))) continue;
    push('raw-z-index', match.index, match[0].replace(/\s+/gu, ' '));
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** The findings in a file's text, by its extension. */
export function lintSource(source, extension, {rules = RULES} = {}) {
  if (SHEETS.has(extension)) return lintStylesheet(source, {rules});
  if (!PAGES.has(extension)) return [];
  const findings = [];
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)) {
    const offset = match.index + match[0].indexOf('>') + 1;
    findings.push(...lintStylesheet(match[1], {origin: source, offset, rules}));
  }
  return findings;
}

function files(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : files(child);
    return entry.isFile() ? [child] : [];
  });
}

/**
 * Splits findings into the ones a baseline lists and the rest. A baseline
 * entry {file, rule, text, count = 1} takes up to `count` findings whose file
 * ends with `file`; an entry that takes fewer than its count is stale.
 */
export function applyBaseline(findings, baseline = []) {
  const left = [...findings];
  const baselined = [];
  const stale = [];
  for (const entry of baseline) {
    const want = entry.count ?? 1;
    let took = 0;
    for (let at = 0; at < left.length && took < want;) {
      const finding = left[at];
      const file = String(finding.file).split('\\').join('/');
      if (file.endsWith(entry.file) && finding.rule === entry.rule && finding.text === entry.text) {
        baselined.push({...finding, owner: entry.owner, task: entry.task});
        left.splice(at, 1);
        took += 1;
      } else at += 1;
    }
    if (took < want) stale.push({...entry, found: took});
  }
  return {findings: left, baselined, stale};
}

/** Every finding under the paths: {files, findings: [{file, rule, line, column, text, context, says}]}. */
export function lintPaths(paths, {ignore = [], rules = RULES, baseline = []} = {}) {
  const read = [];
  const found = [];
  for (const path of paths.map((one) => resolve(one))) {
    for (const file of files(path)) {
      const normal = file.split('\\').join('/');
      const extension = extname(file).toLowerCase();
      if (!SHEETS.has(extension) && !PAGES.has(extension)) continue;
      if (FRAMEWORK_PATHS.some((part) => normal.includes(part)) || ignore.some((part) => normal.includes(part))) continue;
      read.push(file);
      for (const finding of lintSource(readFileSync(file, 'utf8'), extension, {rules})) found.push({file, ...finding});
    }
  }
  return {files: read.length, ...applyBaseline(found, baseline)};
}

function main(argv) {
  const paths = [];
  const ignore = [];
  const rules = [];
  let baseline = [];
  let json = false;
  for (let at = 0; at < argv.length; at += 1) {
    const argument = argv[at];
    if (argument === '--json') json = true;
    else if (argument === '--ignore' && argv[at + 1]) ignore.push(argv[(at += 1)]);
    else if (argument === '--rule' && RULES.includes(argv[at + 1])) rules.push(argv[(at += 1)]);
    else if (argument === '--baseline' && argv[at + 1]) {
      try {
        const data = JSON.parse(readFileSync(argv[(at += 1)], 'utf8'));
        baseline = Array.isArray(data) ? data : data.findings ?? [];
      } catch (error) { console.error(`baseline: ${error.message}`); return 2; }
    } else if (argument.startsWith('--')) { console.error(`unknown argument ${argument}`); return 2; }
    else paths.push(argument);
  }
  if (!paths.length) {
    console.error(`Usage: node tools/lint-raw-values.mjs [--json] [--ignore <substring>]... [--rule ${RULES.join('|')}]... [--baseline <file.json>] <file or folder>...`);
    return 2;
  }
  let report;
  try {
    report = lintPaths(paths, {ignore, rules: rules.length ? rules : RULES, baseline});
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const finding of report.findings) {
      console.log(`${relative(process.cwd(), finding.file)}:${finding.line}:${finding.column}  ${finding.rule}  ${finding.text}  -- ${finding.context}`);
    }
    for (const entry of report.stale) console.log(`stale baseline entry: ${entry.file} ${entry.rule} ${entry.text} (listed ${entry.count ?? 1}, found ${entry.found})`);
    const counts = RULES.map((rule) => `${rule} ${report.findings.filter((finding) => finding.rule === rule).length}`).join(', ');
    console.log(report.findings.length || report.stale.length
      ? `${report.findings.length} finding(s) in ${report.files} file(s) (${counts}; ${report.baselined.length} in the baseline, ${report.stale.length} stale): sizes come from the space, size, radius and line tokens, layers from the layer tokens (C18, C178).`
      : `raw values: clean (${report.files} file(s), ${report.baselined.length} in the baseline).`);
  }
  return report.findings.length || report.stale.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
