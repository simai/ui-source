#!/usr/bin/env node
// The layout a `utility-hint:` comment names, written into the stylesheet.
//
// A hint says which utility classes the rule under it needs -- a flex box, its
// direction, wrapping, alignment:
//
//   /* utility-hint: display/flex (.flex) flex-direction/row (.flex-row) ... */
//   .sf-button { ... }
//
// Until 2026-11-15 the classes were the only way the layout reached the page:
// the component's script added them (ComponentObserver.applyLayoutUtilities) or
// the author wrote them into the markup. A page that draws the component
// without its script -- a documentation example frame loading CSS only, any
// server-rendered page before the script runs -- got a block box, and a button
// drew its icon above its label (RG-B-53, owner remark, 2026-11-15).
//
// This generator writes, for every component folder with hints, one partial
// that gives each hinted rule the declarations of its hinted classes, taken
// from the utility sheet's own values. They stand in @layer sf.base, below
// sf.utilities and sf.components, so they only answer where nothing else
// speaks: a utility class on the element (the script's or the author's) and
// every rule of the component's own sheet win over them, and a page drawn with
// the script is drawn exactly as before. A hint item without a class (a gap
// written as a value, `display/block`) was never applied by anything and is not
// written; the report lists them.
//
// Usage:
//   node scripts/generate-utility-hint-layout.mjs --write    write the partials and the @use lines
//   node scripts/generate-utility-hint-layout.mjs --check    exit 1 when a partial or @use line is stale
//   node scripts/generate-utility-hint-layout.mjs --report   print every hint item that was not written
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATOR = 'scripts/generate-utility-hint-layout.mjs';
export const PARTIAL_STEM = 'css__utility_hint_layout';
export const PARTIAL = `_${PARTIAL_STEM}.scss`;
export const USE_LINE = `@use "${PARTIAL_STEM}";`;

// The utility classes a hint may name, with the declarations the utility sheet
// gives each (src/utility/*/default). A class not listed stops the generator:
// its value has to be read off the utility sheet before it is written here.
export const CLASS_DECLARATIONS = Object.freeze({
  'flex': [['display', 'flex']],
  'inline-flex': [['display', 'inline-flex']],
  'flex-row': [['flex-direction', 'row']],
  'flex-col': [['flex-direction', 'column']],
  'flex-nowrap': [['flex-wrap', 'nowrap']],
  'flex-wrap': [['flex-wrap', 'wrap']],
  'flex-1': [['flex', '1 1 0%']],
  'justify-start': [['justify-content', 'flex-start']],
  'justify-center': [['justify-content', 'center']],
  'justify-end': [['justify-content', 'flex-end']],
  'justify-between': [['justify-content', 'space-between']],
  // The items-* utilities set place-items: align-items and justify-items both.
  'items-start': [['align-items', 'start'], ['justify-items', 'start']],
  'items-center': [['align-items', 'center'], ['justify-items', 'center']],
  'items-end': [['align-items', 'end'], ['justify-items', 'end']],
  'items-stretch': [['align-items', 'stretch'], ['justify-items', 'stretch']],
});

// Rules the utility sheet adds to a class's children.
export const CLASS_CHILD_DECLARATIONS = Object.freeze({
  'flex-wrap': [['flex-shrink', '0'], ['max-width', '100%'], ['max-inline-size', '100%']],
});

const componentRoot = (root) => path.join(root, 'src/component');

// The selector a hint names: everything up to the next `{`, comments taken out
// (the same reading as tests/utility-hint-placement.contract.test.mjs and
// ui-doc scripts/build-layout-expectations.mjs).
export const selectorAfter = (source, end) => source
  .slice(end)
  .split('{')[0]
  .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
  .replaceAll(/\/\/[^\n]*/gu, '')
  .replaceAll(/\s+/gu, ' ')
  .trim();

// Every hint of a stylesheet: its classes, the items without a class and the
// selector of the rule under it.
export const hintsOf = (source) => {
  const hints = [];
  for (const match of source.matchAll(/utility-hint:([^*]*)\*\//gu)) {
    const text = match[1].trim();
    const classes = [];
    for (const group of text.matchAll(/\((\.[^)]*)\)/gu)) {
      for (const name of group[1].split(/\s+/u).filter(Boolean)) classes.push(name.replace(/^\./u, ''));
    }
    const unclassed = text
      .replaceAll(/[a-z-]+\/[^\s(]*\s*\(\.[^)]*\)/gu, ' ')
      .replaceAll(/\s+/gu, ' ')
      .trim();
    hints.push({
      text,
      classes,
      unclassed,
      selector: selectorAfter(source, match.index + match[0].length),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return hints;
};

export const declarationsOf = (classes) => {
  const own = new Map();
  const child = new Map();
  for (const name of classes) {
    const list = CLASS_DECLARATIONS[name];
    if (!list) throw new Error(`utility-hint names .${name}, which ${GENERATOR} has no declarations for`);
    for (const [property, value] of list) own.set(property, value);
    for (const [property, value] of CLASS_CHILD_DECLARATIONS[name] ?? []) child.set(property, value);
  }
  return {own: [...own], child: [...child]};
};

const sheetsOf = (folder) => readdirSync(folder)
  .filter((name) => name.endsWith('.scss') && name !== PARTIAL)
  .sort();

const filesUnder = (folder, extension) => {
  if (!existsSync(folder)) return [];
  const found = [];
  for (const entry of readdirSync(folder, {withFileTypes: true})) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full, extension));
    else if (entry.name.endsWith(extension)) found.push(full);
  }
  return found.sort();
};

// The entries of a folder's json/*.utility.json that its script applies: a
// selector named in an applyLayoutUtilities(target, '<selector>') call.
export const appliedMapEntries = (unit) => {
  const applied = new Set();
  for (const file of filesUnder(path.join(unit, 'js'), '.js')) {
    for (const call of readFileSync(file, 'utf8').matchAll(/applyLayoutUtilities\(\s*[^,]+,\s*(['"])(.+?)\1\s*\)/gu)) applied.add(call[2]);
  }
  const entries = [];
  for (const file of filesUnder(path.join(unit, 'json'), '.utility.json')) {
    const raw = readFileSync(file, 'utf8');
    if (!raw.trim()) continue;
    for (const [selector, values] of Object.entries(JSON.parse(raw))) {
      if (!applied.has(selector)) continue;
      const hint = hintsOf(`utility-hint: ${values.join(' ')} */\n${selector} {`)[0];
      entries.push({...hint, file: path.relative(path.resolve(unit, '../../..'), file)});
    }
  }
  return entries;
};

// Every hint of a folder's stylesheets, in file order.
export const sheetHints = (root, family) => {
  const folder = path.join(componentRoot(root), family, 'scss');
  if (!existsSync(folder)) return [];
  const hints = [];
  for (const name of sheetsOf(folder)) {
    for (const hint of hintsOf(readFileSync(path.join(folder, name), 'utf8'))) hints.push({...hint, file: `src/component/${family}/scss/${name}`});
  }
  return hints;
};

// The component folders whose script lays parts out, each with the entries
// its script applies, in map order. Those are written. A stylesheet hint whose
// selector no script lays out is not: nothing ever drew it -- not the script,
// which never added its classes, and not a page that works today -- and many
// are a Figma frame written out in full that the component's own rules
// contradict (sf-accordion: a row of flex-1 parts on a block that stacks its
// heading over its content). Written, they redraw working pages; --report lists
// them for a decision per hint.
export const collect = (root = repositoryRoot) => {
  const families = [];
  const base = componentRoot(root);
  for (const family of readdirSync(base).sort()) {
    const folder = path.join(base, family, 'scss');
    if (!existsSync(folder)) continue;
    const rules = appliedMapEntries(path.join(base, family)).filter((rule) => declarationsOf(rule.classes).own.length);
    if (rules.length) families.push({family, folder, rules});
  }
  return families;
};

// Only markup a page wrote. A Smart element draws its own markup, with the
// layout classes its template chose -- an sf-button's root is `flex
// items-cross-center`, its label container no flex box at all -- and that
// drawing must not move. Its root is the element's child (the element itself
// is display: contents) and is marked data-sf-static while it is the printed
// first paint, so the guard sits on the first part of the selector, the
// component's root: a root a started Smart element drew, or a printed one, is
// left as it was. In :where(), so the specificity stays the selector's own.
export const PLAIN_ROOT = ':where(:not([data-sf-started] > *):not([data-sf-static]))';

export const plainSelector = (selector) => selector
  .split(',')
  .map((part) => {
    const complex = part.trim();
    let depth = 0;
    for (let index = 0; index < complex.length; index += 1) {
      const character = complex[index];
      if (character === '(' || character === '[') depth += 1;
      else if (character === ')' || character === ']') depth -= 1;
      else if (depth === 0 && /[\s>+~]/u.test(character)) return `${complex.slice(0, index)}${PLAIN_ROOT}${complex.slice(index)}`;
    }
    return `${complex}${PLAIN_ROOT}`;
  })
  .join(', ');

const indent = (lines, by = '  ') => lines.map((line) => (line ? `${by}${line}` : line));

export const renderPartial = ({family, rules}) => {
  const body = [];
  for (const rule of rules) {
    const {own, child} = declarationsOf(rule.classes);
    if (!own.length) continue;
    if (/#\{/u.test(rule.selector)) throw new Error(`${rule.file}:${rule.line}: a hinted selector with interpolation cannot be copied`);
    body.push(`// ${rule.file}`);
    body.push(`${plainSelector(rule.selector)} {`);
    for (const [property, value] of own) body.push(`  ${property}: ${value};`);
    body.push('}');
    if (child.length) {
      const children = plainSelector(rule.selector).split(', ').map((part) => `${part} > *`).join(', ');
      body.push(`${children} {`);
      for (const [property, value] of child) body.push(`  ${property}: ${value};`);
      body.push('}');
    }
    body.push('');
  }
  while (body.at(-1) === '') body.pop();
  return [
    `// Generated by ${GENERATOR} from src/component/${family}/json/*.utility.json`,
    '// (the parts the component script lays out with applyLayoutUtilities). Do not edit; change the',
    '// map and run the generator with --write.',
    '//',
    '// The same layout in the stylesheet, so markup a page writes -- without the script, or',
    '// where the script never builds the part -- draws as the script\'s own parts do (RG-B-53).',
    '// In sf.base, below the utilities and the component rules: the classes the script adds and',
    '// every rule of the component sheet still decide. A root a Smart element drew is left alone.',
    '@layer sf.base {',
    ...indent(body),
    '}',
    '',
  ].join('\n');
};

// index.scss with the partial's @use as its last line.
export const renderIndex = (source) => {
  const lines = source.replace(/\s+$/u, '').split('\n').filter((line) => line.trim() !== USE_LINE);
  return `${lines.join('\n')}\n${USE_LINE}\n`;
};

export const plan = (root = repositoryRoot) => {
  const files = [];
  for (const family of collect(root)) {
    files.push({path: path.join(family.folder, PARTIAL), content: renderPartial(family)});
    const index = path.join(family.folder, 'index.scss');
    if (!existsSync(index)) throw new Error(`src/component/${family.family}/scss has hints and no index.scss`);
    files.push({path: index, content: renderIndex(readFileSync(index, 'utf8'))});
  }
  return files;
};

// Every stylesheet hint (and hint item) the partials do not write.
export const report = (root = repositoryRoot) => {
  const rows = [];
  const base = componentRoot(root);
  for (const family of readdirSync(base).sort()) {
    const written = new Map(appliedMapEntries(path.join(base, family)).map((rule) => [rule.selector, rule]));
    for (const hint of sheetHints(root, family)) {
      const rule = written.get(hint.selector);
      if (!rule) {
        rows.push({family, file: hint.file, line: hint.line, selector: hint.selector, reason: 'no script lays it out', hint: hint.text});
        continue;
      }
      const missing = hint.classes.filter((name) => !rule.classes.includes(name));
      if (missing.length) rows.push({family, file: hint.file, line: hint.line, selector: hint.selector, reason: `the script applies ${rule.classes.map((c) => `.${c}`).join(' ')}; the hint also names ${missing.map((c) => `.${c}`).join(' ')}`, hint: hint.text});
      if (hint.unclassed) rows.push({family, file: hint.file, line: hint.line, selector: hint.selector, reason: 'items without a class', hint: hint.unclassed});
    }
  }
  return rows;
};

const main = () => {
  const args = new Set(process.argv.slice(2));
  if (args.has('--report')) {
    for (const row of report()) console.log([`${row.file}:${row.line}`, row.selector, row.reason, row.hint].join('\t'));
    return;
  }
  const files = plan();
  if (args.has('--write')) {
    let written = 0;
    for (const file of files) {
      const current = existsSync(file.path) ? readFileSync(file.path, 'utf8') : null;
      if (current === file.content) continue;
      writeFileSync(file.path, file.content);
      written += 1;
    }
    console.log(`utility-hint layout: ${files.length / 2} folders, ${written} files written`);
    return;
  }
  if (args.has('--check')) {
    const stale = files.filter((file) => !existsSync(file.path) || readFileSync(file.path, 'utf8') !== file.content)
      .map((file) => path.relative(repositoryRoot, file.path));
    // A partial left behind in a folder that has no hints any more.
    for (const family of readdirSync(componentRoot(repositoryRoot)).sort()) {
      const partial = path.join(componentRoot(repositoryRoot), family, 'scss', PARTIAL);
      if (existsSync(partial) && !files.some((file) => file.path === partial)) stale.push(path.relative(repositoryRoot, partial));
    }
    if (stale.length) {
      console.error(`utility-hint layout is stale (run ${GENERATOR} --write):\n  ${stale.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`utility-hint layout: ${files.length / 2} folders up to date`);
    return;
  }
  console.error(`usage: node ${GENERATOR} --write | --check | --report`);
  process.exit(2);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
