#!/usr/bin/env node
// Usage:
//   node tools/lint-kbd-styles.mjs [--json] [--ignore <substring>]... <file or folder>...
//
// A product never styles a key (owner decision 2026-11-07, docs review R030,
// rule C04): the kbd component of SIMAI Framework owns how a key reads -- a
// keycap in running text, a soft cap in a control, plain glyphs in a menu --
// and a page writes the keys (or a `shortcut` setting) and nothing else. This
// lint reads a product's stylesheets and says where they reach into keys:
//
//   kbd-element    a selector whose element is kbd (kbd, .row kbd, :where(kbd))
//   kbd-class      a selector naming a class of the kbd component
//                  (.sf-kbd, .sf-kbd--group, .sf-kbd--square, .sf-kbd-join)
//   kbd-like-class a selector naming a class of the product's own that carries
//                  "kbd" in its name (.sf-admin-nav-kbd, &-kbd): a host class on
//                  a key is the usual way a product styles one
//   kbd-internal   an internal variable of the component (--sf-kbd--size), set
//                  or read: it may change in any release
//
// Customisation goes through the public variables (--sf-kbd-size,
// --sf-kbd-plain-color, ... src/core/contracts/public-variables.v1.json), set
// on the key or any ancestor: they are not findings. Neither is the
// appearance attribute (appearance="cap|plain|key") in markup.
//
// Reads .css, .scss, .sass, .less, .pcss and the <style> blocks of .html,
// .vue, .svelte and .astro files. Skips node_modules, .git, the SIMAI
// Framework distribution a product carries (any path with /distr/,
// /ui-smart/, /component/kbd/ or @simai-studio/ui) and every path containing
// an --ignore substring. A rule that must stay is marked on its line or the
// line above with the comment `sf-kbd-lint: allow <reason>`.
//
// Exit code: 0 clean, 1 findings, 2 usage. --json prints {files, findings}.
//
// ui-pro and ui-doc run it from a ui-source checkout beside them:
//   node ../ui-source/tools/lint-kbd-styles.mjs components/src
// The self-test is tests/kbd-styles-lint.contract.test.mjs.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHEETS = new Set(['.css', '.scss', '.sass', '.less', '.pcss']);
const PAGES = new Set(['.html', '.htm', '.vue', '.svelte', '.astro']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git']);
const FRAMEWORK_PATHS = ['/distr/', '/ui-smart/', '/component/kbd/', '@simai-studio/ui'];
const ALLOW = /sf-kbd-lint:\s*allow\b/u;

// A comment becomes spaces of its own length, its newlines kept, so every
// offset still points at the same line and column of the source.
const blank = (text) => text.replace(/[^\n]/gu, ' ');
const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//gu, blank)
  .replace(/(^|[^:\\])\/\/[^\n]*/gu, (match, before) => before + blank(match.slice(before.length)));

const position = (source, at) => {
  const before = source.slice(0, at);
  const line = before.split('\n').length;
  return {line, column: at - before.lastIndexOf('\n')};
};

// A selector list split at its own commas, not those inside :is(a, b).
const selectorsOf = (text) => {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    if ('(['.includes(text[at])) depth += 1;
    else if (')]'.includes(text[at])) depth -= 1;
    else if (text[at] === ',' && depth === 0) { parts.push(text.slice(from, at)); from = at + 1; }
  }
  parts.push(text.slice(from));
  return parts.map((part) => part.trim()).filter(Boolean);
};

// The compound a selector styles: what follows its last combinator outside
// brackets (`.row kbd` styles the kbd, `kbd code` the code inside a key).
const subjectOf = (selector) => {
  let depth = 0;
  let from = 0;
  for (let at = 0; at < selector.length; at += 1) {
    const char = selector[at];
    if ('(['.includes(char)) depth += 1;
    else if (')]'.includes(char)) depth -= 1;
    else if (depth === 0 && /[\s>+~]/u.test(char)) from = at + 1;
  }
  return selector.slice(from);
};

// The compounds a subject is: itself without its functional pseudo-classes,
// and the subjects of :is() and :where() arguments (`:where(kbd)` styles a
// key). :not() and :has() only narrow the element styled, so they are left out.
const compoundsOf = (subject) => {
  const compounds = [];
  let outer = '';
  for (let at = 0; at < subject.length; at += 1) {
    const group = /^:(not|has|is|where|matches|-webkit-any|-moz-any)\(/u.exec(subject.slice(at));
    if (!group) { outer += subject[at]; continue; }
    let depth = 1;
    let close = at + group[0].length;
    for (; close < subject.length && depth; close += 1) depth += subject[close] === '(' ? 1 : subject[close] === ')' ? -1 : 0;
    if (!['not', 'has'].includes(group[1])) {
      for (const selector of selectorsOf(subject.slice(at + group[0].length, close - 1))) compounds.push(...compoundsOf(subjectOf(selector)));
    }
    at = close - 1;
  }
  return [outer, ...compounds];
};

// The checks of a compound a selector styles: what it names.
const SELECTOR_CHECKS = [
  {rule: 'kbd-element', pattern: /^kbd(?![\w-])/u, says: 'styles the kbd element'},
  {rule: 'kbd-class', pattern: /\.sf-kbd(?![\w])|\.sf-kbd(?:--|-)[\w-]+/u, says: 'styles a class of the kbd component'},
  {rule: 'kbd-like-class', pattern: /(?:\.|&)[\w-]*kbd[\w-]*/u, says: 'styles a key through a class of its own'},
];

/**
 * The findings in one stylesheet's text: [{rule, line, column, selector, says}].
 * `origin` is the text the lines are read from for the allow comment (the
 * whole page for a <style> block); `offset` is where the sheet starts in it.
 */
export function lintStylesheet(sheet, {origin = sheet, offset = 0} = {}) {
  const code = withoutComments(sheet);
  const lines = origin.split('\n');
  const allowed = (line) => ALLOW.test(lines[line - 1] ?? '') || ALLOW.test(lines[line - 2] ?? '');
  const findings = [];
  let start = 0;
  for (let at = 0; at < code.length; at += 1) {
    const char = code[at];
    if (char === ';' || char === '}') { start = at + 1; continue; }
    if (char !== '{') continue;
    // An interpolation #{...} is part of the selector, not a block.
    if (code[at - 1] === '#') {
      const close = code.indexOf('}', at);
      at = close < 0 ? code.length : close;
      continue;
    }
    const prelude = code.slice(start, at);
    const lead = prelude.length - prelude.trimStart().length;
    const text = prelude.trim();
    const where = position(origin, offset + start + lead);
    start = at + 1;
    if (!text || text.startsWith('@')) continue;
    if (allowed(where.line)) continue;
    for (const selector of selectorsOf(text)) {
      const compounds = compoundsOf(subjectOf(selector));
      const hit = SELECTOR_CHECKS.find((check) => compounds.some((compound) => check.pattern.test(compound)));
      if (hit) findings.push({rule: hit.rule, ...where, selector: selector.replace(/\s+/gu, ' '), says: hit.says});
    }
  }
  for (const match of code.matchAll(/--sf-kbd--[\w-]+/gu)) {
    const where = position(origin, offset + match.index);
    if (allowed(where.line)) continue;
    findings.push({rule: 'kbd-internal', ...where, selector: match[0], says: 'uses an internal variable of the kbd component'});
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** The findings in a file's text, by its extension. */
export function lintSource(source, extension) {
  if (SHEETS.has(extension)) return lintStylesheet(source);
  if (!PAGES.has(extension)) return [];
  const findings = [];
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)) {
    const offset = match.index + match[0].indexOf('>') + 1;
    findings.push(...lintStylesheet(match[1], {origin: source, offset}));
  }
  return findings;
}

function files(path, ignore) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, {withFileTypes: true}).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) return [];
      return files(child, ignore);
    }
    return [child];
  });
}

/** Every finding under the paths: [{file, rule, line, column, selector, says}]. */
export function lintPaths(paths, {ignore = []} = {}) {
  const read = [];
  const findings = [];
  for (const path of paths.map((one) => resolve(one))) {
    for (const file of files(path, ignore)) {
      const normal = file.split('\\').join('/');
      const extension = extname(file).toLowerCase();
      if (!SHEETS.has(extension) && !PAGES.has(extension)) continue;
      if (FRAMEWORK_PATHS.some((part) => normal.includes(part)) || ignore.some((part) => normal.includes(part))) continue;
      read.push(file);
      for (const finding of lintSource(readFileSync(file, 'utf8'), extension)) findings.push({file, ...finding});
    }
  }
  return {files: read.length, findings};
}

function main(argv) {
  const paths = [];
  const ignore = [];
  let json = false;
  for (let at = 0; at < argv.length; at += 1) {
    const argument = argv[at];
    if (argument === '--json') json = true;
    else if (argument === '--ignore' && argv[at + 1]) ignore.push(argv[(at += 1)]);
    else if (argument.startsWith('--')) { console.error(`unknown argument ${argument}`); return 2; }
    else paths.push(argument);
  }
  if (!paths.length) {
    console.error('Usage: node tools/lint-kbd-styles.mjs [--json] [--ignore <substring>]... <file or folder>...');
    return 2;
  }
  let report;
  try {
    report = lintPaths(paths, {ignore});
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const finding of report.findings) {
      console.log(`${relative(process.cwd(), finding.file)}:${finding.line}:${finding.column}  ${finding.rule}  ${finding.selector}  -- ${finding.says}`);
    }
    console.log(report.findings.length
      ? `${report.findings.length} finding(s) in ${report.files} file(s): the kbd component owns the look of a key; set its public --sf-kbd-* variables or appearance="cap|plain|key" instead (rule C04).`
      : `kbd styles: clean (${report.files} file(s)).`);
  }
  return report.findings.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
