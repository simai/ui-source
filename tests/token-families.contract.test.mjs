import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {extname, resolve} from 'node:path';
import test from 'node:test';

// One family per kind of value (owner decision C178, 2026-11-14; research
// ui-control control/research/2026-11-14-standards-tokens-utilities.md §2).
// The weights, the focus width, the blur and the shadows each had two or
// three families naming the same values. The survivor is the name the
// standard and the docs promise, family-first; it holds the value in core,
// and every former name reads it until 2027-01-01
// (src/core/contracts/token-aliases.v1.json, families; the journal records
// token-c178-one-family-names and token-c178-blur-filter-values). A token is
// not dead until the built sheets agree: these tests read the built core
// sheet of the candidate (UI_CORE_ROOT), not only src.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const aliases = JSON.parse(read('src/core/contracts/token-aliases.v1.json'));
const families = aliases.families;
const byFamily = Object.fromEntries(families.families.map((entry) => [entry.family, entry]));
const renames = [...byFamily.weight.tokens, ...byFamily['focus width'].tokens];
const filters = byFamily.blur.former;
// The shadow former names: C16 and C20 (the shadows section and the C16
// tokens whose successor is a shadow).
const shadowFormer = [
  ...aliases.shadows.tokens.filter(({from, to}) => /shadow/u.test(from) && /shadow/u.test(to)),
  ...aliases.tokens.filter(({to}) => /^--sf-shadow-/u.test(to)),
].map(({from}) => from);

const files = (directory, extensions) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return files(path, extensions);
  return extensions.includes(extname(entry.name)) ? [path] : [];
});
const escape = (name) => name.replace(/[/\\^$*+?.()|[\]{}]/gu, '\\$&');
const reads = (text, name) => (text.match(new RegExp(`var\\(${escape(name)}(?![a-z0-9-])`, 'gu')) ?? []).length;
const declarations = (css, name) => [...css.matchAll(new RegExp(`(?<![a-z0-9-])${escape(name)}\\s*:\\s*([^;}]+)`, 'gu'))].map(([, value]) => value.trim());

test('C178 families: the list names one survivor per family, with dates and the journal', () => {
  assert.equal(families.remove_after, aliases.remove_after);
  assert.deepEqual(families.families.map(({family}) => family), ['weight', 'focus width', 'blur', 'shadow']);
  for (const {from, to} of renames) assert.match(to, /^--sf-(weight|focus)--[a-z-]+$/u, `${from}: the survivor is family-first, --sf-<family>--<role>`);
  const journal = JSON.parse(read('contracts/changes/journal.json')).records;
  const names = journal.find((record) => record.id === 'token-c178-one-family-names');
  assert.deepEqual(names.items.map(({from, to}) => [from, to]), renames.map(({from, to}) => [from, to]));
  assert.equal(names.remove_after, families.remove_after);
  const blur = journal.find((record) => record.id === 'token-c178-blur-filter-values');
  assert.deepEqual(blur.items.map(({from, to}) => [from, to]), filters.map(({name, write}) => [name, write]));
});

test('C178 families: core declares each survivor with a value and each former name as the survivor', () => {
  const core = files(resolve(root, 'src/core'), ['.scss']).map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const {from, to} of renames) {
    const own = declarations(core, to);
    assert.ok(own.length, `${to} is declared in core`);
    assert.ok(own.every((value) => !/^var\(/u.test(value)), `${to} holds its value: ${own.join(' | ')}`);
  }
  for (const {from, to} of byFamily['focus width'].tokens.concat(byFamily.weight.tokens.filter(({from}) => from.startsWith('--sf-font-weight-')))) {
    assert.deepEqual([...new Set(declarations(core, from))], [`var(${to})`], `${from} reads ${to}`);
  }
  // the numbered weights come out of one loop over the nine steps
  assert.match(core, /--sf-text--font-weight-#\{\$font-weight-name\}: var\(--sf-weight--#\{\$weight-step\}\);/u);
  for (const {name, value} of filters) assert.deepEqual([...new Set(declarations(core, name))], [value], `${name} keeps blur() of the survivor`);
});

// The candidate's built core sheet: what a page gets.
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const builtCore = [resolve(distribution, 'distr/core/css/core.css')].find((path) => existsSync(path));
const built = builtCore ? readFileSync(builtCore, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '') : '';
const flipped = built.includes('--sf-focus-outline-width: var(--sf-focus--width)');

test('C178 families: in the built core sheet every former name is still there and reads its survivor',
  {skip: !flipped && 'the built sheets predate C178 (UI_CORE_ROOT names a pair without the one-family names)'}, () => {
    const wrong = [];
    for (const {from, to} of renames) {
      const values = [...new Set(declarations(built, from))];
      if (!values.length) wrong.push(`${from}: not declared (a former name stays until ${families.remove_after})`);
      else if (values.some((value) => value !== `var(${to})`)) wrong.push(`${from}: ${values.join(' | ')}`);
      const own = declarations(built, to);
      if (!own.length || own.some((value) => /^var\(--sf-(font-weight|text--font-weight|focus-outline)/u.test(value))) wrong.push(`${to}: ${own.join(' | ')}`);
    }
    for (const {name, value} of filters) {
      const values = [...new Set(declarations(built, name))];
      if (values.length !== 1 || values[0] !== value) wrong.push(`${name}: ${values.join(' | ')}`);
    }
    for (const name of shadowFormer) if (!declarations(built, name).length) wrong.push(`${name}: not declared`);
    assert.deepEqual(wrong, []);
  });

// What the sources still read under a former name, 2026-11-14 (group build 4,
// after core moved its own reads to the survivors).
// Every read keeps working through the alias; a source moves to the survivor
// at its next change. The count may only fall: a new read of a former name
// fails here; a count that fell is lowered when it is seen (a diagnostic).
const READS_LEFT = {
  '--sf-font-weight-light': 0,
  '--sf-font-weight-regular': 103,
  '--sf-font-weight-medium': 83,
  '--sf-font-weight-bold': 16,
  '--sf-text--font-weight-5': 3,
  '--sf-text--font-weight-6': 3,
  '--sf-focus-outline-width': 68,
  '--sf-ui-blur-medium': 7,
};

test('C178 families: the sources read a former name no more than they did, and no former shadow at all', (context) => {
  const sources = files(resolve(root, 'src'), ['.scss', '.css', '.js', '.mjs']).map((path) => readFileSync(path, 'utf8')).join('\n');
  const grown = [];
  const fell = [];
  for (const name of [...renames.map(({from}) => from), ...filters.map(({name}) => name)]) {
    const count = reads(sources, name);
    const left = READS_LEFT[name] ?? 0;
    if (count > left) grown.push(`${name}: ${count} reads, ${left} allowed -- read ${renames.find(({from}) => from === name)?.to ?? 'blur(var(--sf-blur-*))'}`);
    if (count < left) fell.push(`${name}: ${count} (lower READS_LEFT)`);
  }
  assert.deepEqual(grown, [], 'a new read of a former name');
  // A count that fell is a source that moved: a reminder to lower it, not a
  // failure, so a merge of two branches that each moved one stays green.
  if (fell.length) context.diagnostic(`lower READS_LEFT: ${fell.join(', ')}`);
  assert.deepEqual(shadowFormer.filter((name) => reads(sources, name)), [], 'the shadows are the four places (C20)');
});
