// RG-B-53 (owner remark, 2026-11-15): a `utility-hint:` comment named the
// layout of the rule under it, and the layout itself reached the page only as
// utility classes -- added by the component's script to the parts it builds,
// or written by the author. Plain markup got none of them: the buttons sheet
// carried a comment where a flex box should have been, and the documentation
// example drew every button's icon above its label, three loads of three.
//
// The layout a component's script gives its parts (json/*.utility.json, the
// selectors passed to applyLayoutUtilities) is now in the stylesheet too,
// written by scripts/generate-utility-hint-layout.mjs into one partial per
// component folder, in @layer sf.base: under the utilities and the component
// rules, so the classes the script adds still decide, and plain markup draws
// as the script's own parts do. Hints no script applies are not written (they
// redraw working pages; the generator's --report lists them).
//
// The source half runs everywhere. The built half reads a build when the gate
// names one: UI_CORE_ROOT=<ui root> (the folder holding distr/).
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  CLASS_DECLARATIONS, PARTIAL, USE_LINE, collect, declarationsOf, hintsOf, plainSelector, plan,
} from '../scripts/generate-utility-hint-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every utility-hint layout partial and its @use line are up to date', () => {
  const stale = plan(root)
    .filter((file) => !existsSync(file.path) || readFileSync(file.path, 'utf8') !== file.content)
    .map((file) => path.relative(root, file.path));
  assert.deepEqual(stale, [], 'run node scripts/generate-utility-hint-layout.mjs --write');
});

test('every folder whose script lays parts out uses its layout partial', () => {
  const families = collect(root);
  const names = families.map(({family}) => family);
  for (const family of ['buttons', 'icon-buttons', 'badges', 'inputs', 'textarea', 'quantity', 'checkbox', 'radio', 'country-code', 'download-file']) {
    assert.ok(names.includes(family), `${family} lays its parts out with applyLayoutUtilities`);
  }
  for (const {family, folder, rules} of families) {
    assert.ok(readFileSync(path.join(folder, 'index.scss'), 'utf8').split('\n').includes(USE_LINE), `${family}: index.scss uses ${PARTIAL}`);
    for (const rule of rules) assert.doesNotThrow(() => declarationsOf(rule.classes), `${rule.file}: ${rule.selector}`);
  }
  // RG-B-53 itself: a plain button is a centred row, its icon a centred box.
  const buttons = families.find(({family}) => family === 'buttons').rules;
  assert.deepEqual(buttons.map(({selector}) => selector), ['.sf-button', '.sf-button .sf-icon', '.sf-button .sf-button-text-container']);
});

const distribution = process.env.UI_CORE_ROOT ? path.resolve(process.env.UI_CORE_ROOT, 'distr') : null;

const cssUnder = (directory) => {
  const found = [];
  if (!existsSync(directory)) return found;
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...cssUnder(full));
    else if (entry.name.endsWith('.css')) found.push(full);
  }
  return found;
};

const escape = (text) => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// The values the generator writes are the utility sheet's own: a hinted class
// that drew something else than its stand-in would make a page with the script
// and one without it differ.
test('the generator writes each class with the declarations of the built utility sheet', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const css = cssUnder(path.join(distribution, 'utility')).map((file) => readFileSync(file, 'utf8')).join('\n');
  const differs = [];
  for (const [name, declarations] of Object.entries(CLASS_DECLARATIONS)) {
    const rules = [...css.matchAll(new RegExp(`(?:^|[},\\s])\\.${escape(name)}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'gmu'))].map((match) => match[1]);
    for (const [property, value] of declarations) {
      const pattern = new RegExp(`(?:^|;|\\s)${escape(property)}\\s*:\\s*${escape(value)}\\s*(?:;|$)`, 'u');
      if (!rules.some((body) => pattern.test(body.trim()))) differs.push(`.${name} { ${property}: ${value} }`);
    }
  }
  assert.deepEqual(differs, []);
});

// The build's RTL step copies a rule with direction scaffolding -- a
// `_:-ms-input-placeholder` hack branch and an `html:not([dir="rtl"])` or
// `[dir="rtl"]` scope -- and the hint lands above the copy. The element is the
// one the source selector names.
const topLevel = (selector) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === ',' && depth === 0) { parts.push(selector.slice(start, index)); start = index + 1; }
  }
  return [...parts, selector.slice(start)];
};
const sourceSelector = (selector) => [...new Set(topLevel(selector)
  .map((part) => part.trim())
  .filter((part) => part && part !== '_:-ms-input-placeholder')
  .map((part) => part.replace(/^(?:html:not\(\[dir="rtl"\]\)|\[dir="rtl"\]|html\[dir="rtl"\])\s+/u, '')))]
  .join(', ');

// A rule body by selector inside every `@layer sf.base { ... }` of a sheet.
const baseLayerRules = (css) => {
  const rules = new Map();
  const uncommented = css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');
  for (const start of uncommented.matchAll(/@layer\s+sf\.base\s*\{/gu)) {
    let depth = 1;
    let index = start.index + start[0].length;
    let cursor = index;
    while (depth > 0 && index < uncommented.length) {
      const character = uncommented[index];
      if (character === '{') {
        if (depth === 1) {
          const selector = uncommented.slice(cursor, index).replaceAll(/\s+/gu, ' ').trim();
          const end = uncommented.indexOf('}', index);
          const body = uncommented.slice(index + 1, end);
          const declarations = new Map([...body.matchAll(/([a-z-]+)\s*:\s*([^;]+);?/gu)].map(([, property, value]) => [property, value.trim()]));
          const key = sourceSelector(selector);
          rules.set(key, new Map([...(rules.get(key) ?? []), ...declarations]));
          index = end + 1;
          cursor = index;
          continue;
        }
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        cursor = index + 1;
      }
      index += 1;
    }
  }
  return rules;
};

test('RG-B-53: every part a component script lays out has its declarations in the built sheet, hinted or not', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const folder = path.join(distribution, 'component');
  const missing = [];
  let checked = 0;
  for (const {family, rules} of collect(root)) {
    const css = path.join(folder, family, 'css');
    const sheets = existsSync(css) ? readdirSync(css).filter((file) => file.endsWith('.css') && !file.endsWith('.min.css')) : [];
    if (!sheets.length) { missing.push(`${family}: no built sheet`); continue; }
    const text = sheets.map((name) => readFileSync(path.join(css, name), 'utf8')).join('\n');
    const base = baseLayerRules(text);
    const bySelector = new Map(rules.map((rule) => [rule.selector, rule]));
    // The script's parts, and every hint in the built sheet above one of them.
    const wanted = [...rules, ...hintsOf(text).map((hint) => bySelector.get(sourceSelector(hint.selector))).filter(Boolean)];
    for (const rule of wanted) {
      const {own} = declarationsOf(rule.classes);
      checked += 1;
      const written = base.get(plainSelector(rule.selector));
      const absent = own.filter(([property, value]) => written?.get(property) !== value);
      if (absent.length) missing.push(`${family}: ${rule.selector} lacks ${absent.map(([p, v]) => `${p}: ${v}`).join('; ')}`);
    }
  }
  assert.ok(checked >= 40, `expected the laid-out parts of the kit in the build, read ${checked}`);
  assert.deepEqual(missing, []);
});
