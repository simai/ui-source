#!/usr/bin/env node
// The built sheets carry no copies a browser never applies (sheet weight,
// 2026-11-19). Run on a build output (the directory with core/, component/,
// utility/, smart/) or any folder of sheets:
//
//   node scripts/check-sheet-weight.mjs <build> [--json <file>] [--top <n>]
//
// Every component rule stands in @layer, and only a browser that reads
// cascade layers (Chrome 99, Safari 15.4, Firefox 97) reads such a rule. Inside
// @layer the check fails on what the builder used to write for older browsers:
//
//   is      a rule spelt out from an :is() list (":not(.does-not-exist)"
//           pads its weight) -- every such browser reads :is() itself;
//   ie      the IE copy of a direction rule ("_:-ms-input-placeholder, ...");
//   supports an "@supports not (<logical property>)" copy -- every such
//           browser has the logical spacing, border, inset and radius
//           properties (float and clear inline-start/end came later: kept);
//   var     a declaration written again below with var() -- the later one
//           always wins in a browser with custom properties.
//
// The builder stopped writing them in ui-builder fix/sheet-weight
// (libs/postcssPolicy.js "is-pseudo-class": false, libs/postcssLateLogicalFallbacks.js);
// a build by an older builder fails here. It also prints the heaviest sheets.
import fs from 'node:fs';
import path from 'node:path';

// The builder's direction copies test one logical property (": initial") or
// text-align start/end; a sheet's own @supports not (selector(...), grid-lanes)
// is a feature query of its author and is not read here.
const DIRECTION_COPY = /^not \((?:(?:margin|padding|inset|border)-[a-z-]+: initial|text-align: (?:start|end))\)$/u;

function* sheets(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sheets(full);
    else if (entry.name.endsWith('.css')) yield full;
  }
}

// Top-level comma split (outside brackets and strings).
function splitTop(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) { if (char === '\\') index += 1; else if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === separator && depth === 0) { parts.push(text.slice(start, index)); start = index + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Each block of a sheet: its prelude, the preludes it stands in, and its own declarations. */
export function blocks(css) {
  const found = [];
  const stack = [];
  let text = '';
  let quote = '';
  let paren = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (quote) { text += char; if (char === '\\') { text += css[index + 1] ?? ''; index += 1; } else if (char === quote) quote = ''; continue; }
    if (char === '/' && css[index + 1] === '*') { const end = css.indexOf('*/', index + 2); index = end < 0 ? css.length : end + 1; continue; }
    if (char === '"' || char === "'") { quote = char; text += char; continue; }
    if (char === '(') paren += 1;
    if (char === ')') paren -= 1;
    if (char === '{' && paren === 0) {
      const own = {prelude: text.trim(), parents: stack.map((one) => one.prelude), body: ''};
      stack.push(own);
      found.push(own);
      text = '';
    } else if (char === '}' && paren === 0) {
      const own = stack.pop();
      if (own) own.body += text;
      text = '';
    } else if (char === ';' && paren === 0) {
      // A declaration of the open block, or a statement (@layer a, b;) at the top.
      if (stack.length) stack[stack.length - 1].body += `${text};`;
      text = '';
    } else text += char;
  }
  return found;
}

export function deadCopies(css) {
  const out = {is: 0, ie: 0, supports: 0, var: 0, examples: []};
  const note = (kind, text) => { out[kind] += 1; if (out.examples.length < 5) out.examples.push(`${kind}: ${text.slice(0, 160)}`); };
  for (const block of blocks(css)) {
    if (!block.parents.some((one) => /^@layer\b/iu.test(one))) continue;
    if (/^@supports\s+not\b/iu.test(block.prelude)) {
      const condition = block.prelude.replace(/^@supports\s+/iu, '');
      if (DIRECTION_COPY.test(condition)) note('supports', block.prelude);
      continue;
    }
    if (block.prelude.startsWith('@')) continue;
    if (/^_:-ms-input-placeholder\s*,/u.test(block.prelude)) note('ie', block.prelude);
    if (block.prelude.includes(':not(.does-not-exist)')) note('is', block.prelude);
    const declarations = splitTop(block.body, ';').map((one) => one.trim()).filter(Boolean).map((one) => {
      const colon = one.indexOf(':');
      return {prop: one.slice(0, colon).trim().toLowerCase(), value: one.slice(colon + 1), important: /!important\s*$/iu.test(one)};
    });
    declarations.forEach((declaration, index) => {
      if (declaration.prop.startsWith('--')) return;
      if (declarations.slice(index + 1).some((later) => later.prop === declaration.prop && (later.important || !declaration.important) && /var\(/iu.test(later.value))) {
        note('var', `${block.prelude} { ${declaration.prop}:${declaration.value} }`);
      }
    });
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const root = args.find((arg) => !arg.startsWith('--') && fs.existsSync(arg));
  const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  if (!root) {
    console.error('usage: check-sheet-weight.mjs <build output> [--json <file>] [--top <n>]');
    process.exit(2);
  }
  const top = Number(value('--top') || 10);
  const report = {root: path.resolve(root), sheets: 0, bytes: 0, failures: [], heaviest: []};
  for (const file of sheets(root)) {
    const css = fs.readFileSync(file, 'utf8');
    const size = Buffer.byteLength(css);
    report.sheets += 1;
    report.bytes += size;
    report.heaviest.push([size, path.relative(root, file)]);
    const dead = deadCopies(css);
    if (dead.is + dead.ie + dead.supports + dead.var) {
      report.failures.push({file: path.relative(root, file), is: dead.is, ie: dead.ie, supports: dead.supports, var: dead.var, examples: dead.examples});
    }
  }
  report.heaviest.sort((a, b) => b[0] - a[0]);
  report.heaviest = report.heaviest.slice(0, top);
  if (value('--json')) fs.writeFileSync(value('--json'), `${JSON.stringify(report, null, 1)}\n`);
  for (const [size, file] of report.heaviest) console.log(`${String(size).padStart(10)}  ${file}`);
  for (const failure of report.failures.slice(0, 20)) {
    console.log(`dead copies in ${failure.file}: is ${failure.is}, ie ${failure.ie}, supports ${failure.supports}, var ${failure.var}`);
    for (const example of failure.examples) console.log(`  ${example}`);
  }
  console.log(`sheet weight: ${report.sheets} sheets, ${report.bytes} bytes, ${report.failures.length} with dead copies`);
  process.exit(report.failures.length ? 1 : 0);
}
