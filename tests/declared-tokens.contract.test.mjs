import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A utility that reads a token nobody declares does nothing, and says nothing
// about it. `--sf-current` and `--sf-inherit` were missing for the whole
// *-current and *-inherit family: bg-current painted a transparent background,
// fill-current painted black, and the classes whose property happens to start at
// currentColor worked by luck. This walks the built sheets and requires every
// token they read to exist.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const smartDistribution = process.env.UI_SMART_ROOT ?? resolve(root, '../ui-smart');

function builtSheets(directory) {
  if (!existsSync(directory)) return [];
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) out.push(...builtSheets(path));
    else if (entry.name.endsWith('.css') && !entry.name.endsWith('.min.css')) out.push(path);
  }
  return out;
}

const declaredBy = (css) => new Set([...css.matchAll(/(--sf-[a-z0-9\\/-]+)\s*:/gu)].map(([, name]) => name.replace(/\\/g, '')));
const bareReads = (css) => new Set(
  [...css.matchAll(/var\(\s*(--sf-[a-z0-9\\/-]+)\s*([,)])/gu)]
    .filter(([, , next]) => next === ')')
    .map(([, name]) => name.replace(/\\/g, '')),
);

const sheets = ['distr/core/css/core.css', 'distr/core/css/utility.full.css']
  .map((file) => resolve(distribution, file))
  .filter((file) => existsSync(file));

test('every token the built sheets read is declared by them', { skip: sheets.length === 0 && 'the distribution is not beside the source' }, () => {
  const css = sheets.map((file) => readFileSync(file, 'utf8')).join('\n');
  const declared = new Set([...css.matchAll(/(--sf-[a-z0-9\\/-]+)\s*:/gu)].map(([, name]) => name.replace(/\\/g, '')));
  // A read that carries a fallback still paints when the token is absent — the
  // loader does that on purpose for names it once used. Only a bare read breaks.
  const used = new Set(
    [...css.matchAll(/var\(\s*(--sf-[a-z0-9\\/-]+)\s*([,)])/gu)]
      .filter(([, , next]) => next === ')')
      .map(([, name]) => name.replace(/\\/g, '')),
  );

  // Discrepancies already found and described, waiting on an owner's decision:
  // a state-variant naming mistake and a set of roles the utilities offer but the
  // theme never declares. They are listed so they stay visible; anything new fails.
  const known = JSON.parse(readFileSync(resolve(root, 'contracts/undeclared-tokens.json'), 'utf8'));
  const pending = new Set(Object.values(known.groups).flatMap((group) => group.tokens));

  const missing = [...used].filter((name) => !declared.has(name) && !pending.has(name)).sort();
  assert.deepEqual(missing, [], 'these tokens are read but never declared');
});

test('the two keyword tokens carry the CSS keywords', () => {
  const source = readFileSync(resolve(root, 'src/core/scss/_sf_figma_colors_variables.scss'), 'utf8');
  assert.match(source, /--sf-current: currentColor;/u, 'the current colour, not a copy of some colour');
  assert.match(source, /--sf-inherit: inherit;/u);
});

// The same hole in a component sheet is just as silent. --sf-surface is not a
// token -- the scale is --sf-surface-0 ... --sf-surface-5 -- and the download
// card and the reference link painted no surface at all; the carousel controls
// turned transparent on hover through hover roles the theme never had. Component
// hooks (--sf-<component>--<part>) are meant to be set from outside, and a
// sheet may declare its own tokens, so only global names not declared by the
// core, the utilities or the sheet itself fail.
// Tokens a component script writes onto its own elements -- the modal's size,
// the spinner's dot count and step -- are declared at run time, not in a sheet.
function scriptDeclared(directory) {
  const out = new Set();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { for (const name of scriptDeclared(path)) out.add(name); continue; }
    if (!/\.m?js$/u.test(entry.name)) continue;
    const source = readFileSync(path, 'utf8');
    for (const [, name] of source.matchAll(/setProperty\(\s*['"`](--sf-[a-z0-9-]+)/gu)) out.add(name);
    // `--sf-color-chip: ${value}` writes the token just as `--sf-x:${value}`
    // does; requiring no space between the colon and the expression read
    // sf-color's chip as undeclared when the template sets it on every preset
    // (owner, 2026-10-09).
    for (const [, name] of source.matchAll(/[`'";\s](--sf-[a-z0-9-]+):\s*\$\{/gu)) out.add(name);
  }
  return out;
}
const RUNTIME_DECLARED = scriptDeclared(resolve(root, 'src'));

const OPTIONAL_HOOKS = new Set([
  // Placement hooks for the modal's close and hide buttons: unset means the
  // initial value, which is the intended default side.
  'sf-modal-close-left', 'sf-modal-close-bottom', 'sf-modal-hide-left', 'sf-modal-hide-bottom',
]);

const componentSheets = [
  ...builtSheets(resolve(distribution, 'distr/component')),
  ...builtSheets(resolve(smartDistribution, 'smart')),
];

test('every global token a component sheet reads is declared', { skip: (sheets.length === 0 || componentSheets.length === 0) && 'the distribution is not beside the source' }, () => {
  const core = declaredBy(sheets.map((file) => readFileSync(file, 'utf8')).join('\n'));
  const missing = [];
  for (const file of componentSheets) {
    const css = readFileSync(file, 'utf8');
    const own = declaredBy(css);
    for (const name of bareReads(css)) {
      if (name.slice(5).includes('--') || OPTIONAL_HOOKS.has(name.slice(2))) continue;
      if (!core.has(name) && !own.has(name) && !RUNTIME_DECLARED.has(name)) missing.push(`${file.slice(file.indexOf(file.includes('/ui-smart/') ? 'smart/' : 'distr/'))}: ${name}`);
    }
  }
  assert.deepEqual(missing.sort(), [], 'these component sheets read tokens nobody declares');
});

// A slash in a token name has to be escaped where it is read. Unescaped,
// var(--sf-space-1/2) is not a reference at all and the declaration is dropped
// at parse time; the spinner's text gap was lost that way.
test('fractional token names are escaped where a built sheet reads them', { skip: (sheets.length === 0 || componentSheets.length === 0) && 'the distribution is not beside the source' }, () => {
  const wrong = [];
  for (const file of [...sheets, ...componentSheets]) {
    const css = readFileSync(file, 'utf8');
    for (const [match] of css.matchAll(/var\(\s*--sf-[a-z0-9-]*[^\\a-z0-9-]\/[^)]*\)|var\(\s*--sf-[a-z0-9-]*[0-9]\/[0-9][^)]*\)/gu)) wrong.push(`${file.slice(file.lastIndexOf('/') + 1)}: ${match}`);
  }
  assert.deepEqual(wrong, []);
});
