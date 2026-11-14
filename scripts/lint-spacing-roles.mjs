#!/usr/bin/env node
// Usage: node scripts/lint-spacing-roles.mjs [--json] [--all] [folder ...]
//
// The spacing roles H2, H3 and H6 of the horizontal spacing standard (owner
// decisions C105 and C144, C178 "every general rule has an automatic check in
// the pair build") read on the component sources. The role table is not
// repeated here: it is read from the geometry standard,
// docs/foundation-composition-geometry.md §5 (the table tests/horizontal-
// spacing.contract.test.mjs holds and the acceptance gate
// ui-control control/tools/spacing-gate measures on a page):
//
//   H2  picture -> text in a row (list, menu, options, field, notice, cell,
//       tree row, a choice's box -> its label)      --sf-space-1/2
//   H3  picture -> text inside running text (breadcrumbs, link, help mark)
//                                                    --sf-space-1/4
//   H6  between groups and cells                     --sf-space-1
//
// Every horizontal distance in src/component and src/smart -- gap,
// column-gap, margin-inline(-start|-end), margin-left/right, or a component
// variable named ...gap / ...space-x / ...between; a gap in a column flex is
// vertical and left out -- is followed through var() fallbacks, the file's
// own variables and core's simple aliases to the step it ends on, and read
// twice:
//
//   table      the step is one the role table names in any row (H1-H6), or
//              zero, auto (a spread), inherit, a hairline (--sf-px), a
//              control's own inset (--sf-ui-S--space-x, C76). A size
//              primitive (--sf-a4, --sf-b0) or a step no role names is a
//              finding: the role table is the whole vocabulary of horizontal
//              distances (C105 "six roles on existing tokens", C18);
//   H2/H3/H6   where the rule names its role -- a picture word in a row's
//              folder (H2), the picture of breadcrumbs, a link or a help mark
//              (H3), groups or cells (H6), a choice's own box-to-label gap
//              (H2) -- the role's own step.
//
// A role token of owner decision C173 (src/core/contracts/role-tokens.v1.json,
// when it is in the tree) counts as the step it names, so
// --sf-gap--icon-text is H2's --sf-space-1/2; no role name is assumed here.
// A value this cannot read (a calc of a picture's size, a Sass expression) is
// left to the page measurement (the spacing gate).
//
// The H1 picture -> label inside a control and the H5 neighbours are measured
// on the page; the controls' own folders are read only for the table. Exit 1
// on a finding not listed in contracts/spacing-roles-review.json, or on a
// listed one that is gone (stale). --all prints every reading.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));

// ---------- the role table, from the standard ----------

/** {H2: ['--sf-space-1/2', ...], H3: [...], H6: [...]}: the first space step of each role's row, and every other token the row names. */
export function roleTable(doc = readFileSync(join(repo, 'docs/foundation-composition-geometry.md'), 'utf8')) {
  const table = {};
  for (const role of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']) {
    const row = doc.split('\n').find((line) => line.startsWith(`| ${role} |`));
    if (!row) throw new Error(`the geometry standard has no row for ${role}`);
    const token = row.split('|')[4] ?? '';
    table[role] = [...token.matchAll(/`(--sf-[a-zA-Z0-9-]+(?:\/\d+)?)`/gu)].map(([, name]) => name);
  }
  return table;
}

/** The C173 role tokens as {name: step}, when the contract is in this tree. */
export function roleTokens(path = join(repo, 'src/core/contracts/role-tokens.v1.json')) {
  if (!existsSync(path)) return {};
  const contract = JSON.parse(readFileSync(path, 'utf8'));
  return Object.fromEntries((contract.tokens ?? []).filter((token) => token.step).map((token) => [token.name, token.step]));
}

/** The simple aliases core declares, {name: step} (--sf-content--space-text: var(--sf-space-1)), and the zero primitives. */
export function coreAliases(base = repo) {
  const aliases = {'--sf-a0': '0', '--sf-0': '0', '--sf-space-0': '0'};
  const walkCore = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkCore(path);
    return /\.scss$/u.test(entry.name) ? [path] : [];
  });
  for (const path of walkCore(join(base, 'src/core'))) {
    for (const [, name, target] of readFileSync(path, 'utf8').matchAll(/(--sf-[a-z][\w-]*--[\w-]+)\s*:\s*var\((--sf-space-[\w\\/-]+)\)\s*;/gu)) {
      if (!aliases[name]) aliases[name] = plain(target);
    }
  }
  return aliases;
}

/** What a role accepts: H2 its row's first space step; H3 the same; H6 the groups' step (the first of its row). */
export function expectedSteps(table = roleTable()) {
  const first = (role) => table[role].find((name) => /^--sf-space-/u.test(name));
  return {H2: first('H2'), H3: first('H3'), H6: first('H6')};
}

/**
 * Every step the role table names, H1 to H6 (the space steps of every row),
 * and what goes with them: H1's --sf-ui-S--text-space-x, a control's own
 * inset --sf-ui-S--space-x (C76, the edge a field or a button keeps), zero,
 * auto (a spread), inherit, and a hairline --sf-px (a joined edge).
 */
export function tableSteps(table = roleTable()) {
  const steps = new Set(Object.values(table).flat().filter((name) => /^--sf-space-/u.test(name)));
  return (step) => steps.has(step) || step === '0' || step === 'auto' || step === 'inherit' || step === '--sf-px'
    || /^--sf-ui-(1\/4|1\/3|1\/2|1|2|3)--(text-)?space-x$/u.test(step);
}

// ---------- reading a sheet ----------

const blank = (text) => text.replace(/[^\n]/gu, ' ');
const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//gu, blank)
  .replace(/(^|[^:\\])\/\/[^\n]*/gu, (match, before) => before + blank(match.slice(before.length)));

const splitTop = (text, separator) => {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && separator.test(char)) { parts.push(text.slice(from, at)); from = at + 1; }
  }
  parts.push(text.slice(from));
  return parts.map((part) => part.trim()).filter(Boolean);
};

const combine = (parent, child) => {
  if (!parent) return child;
  const parents = splitTop(parent, /,/u);
  return splitTop(child, /,/u).flatMap((one) => parents.map((outer) => (one.includes('&') ? one.replaceAll('&', outer) : `${outer} ${one}`))).join(', ');
};

/** Every declaration of a sheet: {property, value, selector, at: [@-rules], line}. */
export function declarationsOf(source) {
  const code = withoutComments(source);
  const out = [];
  const stack = [];
  const blocks = [];
  let block = 0;
  let blockCount = 0;
  let start = 0;
  const lineAt = (at) => code.slice(0, at).split('\n').length;
  const current = () => {
    let selector = '';
    const at = [];
    for (const frame of stack) {
      if (frame.startsWith('@')) at.push(frame.replace(/\s+/gu, ' '));
      else selector = combine(selector, frame.replace(/\s+/gu, ' '));
    }
    return {selector, at};
  };
  const declare = (text, offset) => {
    const trimmed = text.trim();
    const colon = trimmed.indexOf(':');
    if (colon < 1 || trimmed.startsWith('@') || trimmed.startsWith('$')) return;
    const property = trimmed.slice(0, colon).trim();
    if (!/^(--[\w-]+|[a-z-]+)$/u.test(property)) return;
    const value = trimmed.slice(colon + 1).trim();
    out.push({property, value, ...current(), block, line: lineAt(offset + text.indexOf(trimmed))});
  };
  for (let at = 0; at < code.length; at += 1) {
    const char = code[at];
    if (char === '{') {
      if (code[at - 1] === '#') { // #{...} interpolation
        const close = code.indexOf('}', at);
        at = close < 0 ? code.length : close;
        continue;
      }
      stack.push(code.slice(start, at).trim());
      blocks.push(block);
      blockCount += 1;
      block = blockCount;
      start = at + 1;
    } else if (char === ';') {
      declare(code.slice(start, at), start);
      start = at + 1;
    } else if (char === '}') {
      declare(code.slice(start, at), start);
      stack.pop();
      block = blocks.pop() ?? 0;
      start = at + 1;
    }
  }
  return out;
}

// ---------- following a value to its step ----------

const VAR = /^var\(\s*(--[\w\\/-]+)\s*(?:,\s*([\s\S]*))?\)$/u;
const plain = (name) => name.replace(/\\/gu, '');

/** The step a value ends on: a token name (unescaped), '0', or the literal left. */
export function stepOf(value, local = new Map(), aliases = {}, seen = new Set()) {
  let text = value.replace(/!important/gu, '').trim();
  for (let guard = 0; guard < 20; guard += 1) {
    const match = VAR.exec(text);
    if (!match) break;
    const name = plain(match[1]);
    // A variable the file declares itself is read where it is declared (each
    // of its declarations is a finding of its own); a fallback is the value
    // only when the variable is not declared.
    if (local.has(name) && !seen.size) return 'declared';
    if (local.has(name) && !seen.has(name)) { seen.add(name); text = local.get(name); continue; }
    if (match[2] !== undefined && match[2].trim()) { text = match[2].trim(); continue; }
    text = name;
    break;
  }
  text = plain(text);
  if (aliases[text]) return aliases[text];
  if (/^0(px|rem)?$/u.test(text)) return '0';
  return text;
}

// ---------- roles ----------

const HORIZONTAL = /^(gap|column-gap|margin-inline|margin-inline-start|margin-inline-end|margin-left|margin-right)$/u;
const SPACING_VARIABLE = /(?:^|-)(gap|space-x|between)$/u;
const VERTICAL_VARIABLE = /row-gap|block-gap|line-gap|(?:^|-)(row|block|vertical|stack|under|y)-gap$/u;
// A picture before text: the words a class or a variable uses for it.
const PICTURE = /icon|avatar-label|picture|visual|thumb|flag|swatch|media|marker|leading|prefix|glyph|emoji/u;
// The folders whose parts are rows (H2): list, menu, options, field, notice,
// cell, tree row, card row. A control's own folder (H1, H5) is not one.
const ROW_FOLDERS = /^(list|list-[a-z]+|menu|menu-context|context-menu|dropdown|alerts?|alert-bar|toast|tree|tree-item|inputs?|input-(?!quantity)[a-z]+|country-code|language|contents|search|file-upload|file-download|download-file|file-preview|card|settings-panel|empty-state|lookup|avatars)$/u;
const INLINE_TEXT_FOLDERS = /^(breadcrumbs|link|reference-link|help-mark)$/u;
const CHOICE_FOLDERS = /^(checkbox|radio|switch)$/u;
// Neighbours (H5), not a picture before text: a group of avatars, buttons, tags.
const NEIGHBOURS = /avatar-group|avatars-group|button|actions|tags?(?![a-z])|chips?|swatch-gap|swatches/u;

/** The role a declaration sets, or null: 'H2', 'H3' or 'H6'. */
export function roleOf({property, selector}, folder) {
  const horizontal = HORIZONTAL.test(property) || (property.startsWith('--') && SPACING_VARIABLE.test(property) && !VERTICAL_VARIABLE.test(property));
  if (!horizontal) return null;
  // what the rule styles: its last compound, and the variable's own name
  const subject = `${selector.split(',').map((one) => one.trim().split(/[\s>+~]+/u).pop()).join(' ')} ${property}`.toLowerCase();
  if (NEIGHBOURS.test(subject)) return null;
  // a choice: the box -> its label, the component's own gap
  if (CHOICE_FOLDERS.test(folder)) {
    const own = new RegExp(`^--sf-${folder}(-button)?--gap$`, 'u');
    return own.test(property) ? 'H2' : null;
  }
  if (INLINE_TEXT_FOLDERS.test(folder)) return /icon|item-container|glyph/u.test(subject) ? 'H3' : null;
  if (/(?:^|[_-])(groups|cells)(?![a-z])/u.test(subject)) return 'H6';
  if (ROW_FOLDERS.test(folder) && PICTURE.test(subject)) return 'H2';
  return null;
}

// ---------- the sources ----------

const SHEET = /\.(scss|css)$/u;
const walk = (directory) => readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return ['node_modules', 'static', 'docs', 'lang'].includes(entry.name) ? [] : walk(path);
  return SHEET.test(entry.name) ? [path] : [];
});

/** Whether a declaration sets a horizontal distance (a column gap, an inline margin, a variable named so). */
export function isHorizontal({property}) {
  return HORIZONTAL.test(property) || (property.startsWith('--') && SPACING_VARIABLE.test(property) && !VERTICAL_VARIABLE.test(property));
}

/**
 * Every horizontal distance in the component and Smart sources, read twice:
 *   role 'table'   its step is one the role table names (any of H1-H6), or
 *                  zero, auto, a hairline, a control's own inset;
 *   role H2/H3/H6  where the rule names its role, the role's own step.
 * [{file, line, folder, role, property, selector, value, step, expect, ok}].
 */
export function lintSpacingRoles({roots = ['src/component', 'src/smart'], base = repo} = {}) {
  const table = roleTable(readFileSync(join(base, 'docs/foundation-composition-geometry.md'), 'utf8'));
  const expect = expectedSteps(table);
  const onTable = tableSteps(table);
  const aliases = {...coreAliases(base), ...roleTokens(join(base, 'src/core/contracts/role-tokens.v1.json'))};
  const found = [];
  for (const rootPath of roots) {
    const top = join(base, rootPath);
    if (!existsSync(top)) continue;
    for (const path of walk(top)) {
      const file = relative(base, path).split('\\').join('/');
      const folder = file.split('/')[2];
      const declarations = declarationsOf(readFileSync(path, 'utf8'));
      const local = new Map();
      for (const one of declarations) if (one.property.startsWith('--') && !local.has(one.property)) local.set(one.property, one.value);
      // a gap in a column flex is a vertical distance
      const columns = new Set(declarations.filter((one) => one.property === 'flex-direction' && /column/u.test(one.value)).map((one) => one.block));
      for (const one of declarations) {
        if (!isHorizontal(one)) continue;
        if (one.property === 'gap' && columns.has(one.block)) continue;
        const parts = one.property === 'gap' ? splitTop(one.value, /\s/u) : [one.value];
        const value = parts[parts.length - 1];
        const step = stepOf(value, local, aliases);
        // A value that does not end on a token or a length (a calc of a
        // picture's size, a component variable with no default in its file,
        // a Sass expression) is not a step this can read: the page
        // measurement (the spacing gate) reads it.
        if (!/^--sf-[\w/-]+$|^0$|^auto$|^inherit$|^-?[\d.]+(px|rem|em)$/u.test(step)) continue;
        if (/^--sf-(?!space-|gap--|inset--|ui-|px$|[a-i]\d+$)/u.test(step)) continue;
        const base0 = {file, line: one.line, folder, property: one.property, selector: one.selector.slice(0, 160), value: value.replace(/\s+/gu, ' '), step};
        found.push({...base0, role: 'table', expect: 'a step of the role table', ok: onTable(step)});
        const role = roleOf(one, folder);
        if (role) found.push({...base0, role, expect: expect[role], ok: step === expect[role] || step === '0' || step === 'auto'});
      }
    }
  }
  return found;
}

/** The reviewed findings (contracts/spacing-roles-review.json) applied: {open, reviewed, stale}. */
export function review(findings, list) {
  const keyOf = (one) => `${one.file}|${one.role}|${one.property}|${one.step}`;
  const counts = new Map();
  for (const entry of list) counts.set(`${entry.file}|${entry.role}|${entry.property}|${entry.step}`, {entry, want: entry.count ?? 1, took: 0});
  const open = [];
  const reviewed = [];
  for (const one of findings.filter((item) => !item.ok)) {
    const hit = counts.get(keyOf(one));
    if (hit && hit.took < hit.want) { hit.took += 1; reviewed.push({...one, reason: hit.entry.reason, owner: hit.entry.owner}); } else open.push(one);
  }
  const stale = [...counts.values()].filter(({entry, want, took}) => took !== want && !(entry.optional && took === 0)).map(({entry, took}) => ({...entry, found: took}));
  return {open, reviewed, stale};
}

export const REVIEW_PATH = 'contracts/spacing-roles-review.json';

function main(argv) {
  const json = argv.includes('--json');
  const all = argv.includes('--all');
  const roots = argv.filter((one) => !one.startsWith('--'));
  const findings = lintSpacingRoles(roots.length ? {roots} : {});
  const list = existsSync(join(repo, REVIEW_PATH)) ? JSON.parse(readFileSync(join(repo, REVIEW_PATH), 'utf8')).reviewed : [];
  const result = review(findings, list);
  if (json) {
    console.log(JSON.stringify({checked: findings.length, byRole: Object.fromEntries(['table', 'H2', 'H3', 'H6'].map((role) => [role, findings.filter((one) => one.role === role).length])), ...result, ...(all ? {findings} : {})}, null, 1));
  } else {
    const print = (one, mark) => console.log(`${mark} ${one.file}:${one.line} ${one.role} ${one.property}: ${one.value} -> ${one.step} (expected ${one.expect})  ${one.selector}`);
    if (all) for (const one of findings) print(one, one.ok ? 'ok ' : 'BAD');
    for (const one of result.open) print(one, 'open');
    for (const one of result.stale) console.log(`stale review entry: ${one.file} ${one.property} ${one.step} (listed ${one.count ?? 1}, found ${one.found})`);
    console.log(`spacing roles: ${findings.length} declarations read, ${findings.filter((one) => !one.ok).length} off the role, ${result.reviewed.length} reviewed, ${result.open.length} open, ${result.stale.length} stale`);
  }
  return result.open.length || result.stale.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
