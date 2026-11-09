import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The former names of the background system (C16, 2026-11-08). A renamed
// theme role keeps its former name as var() of the new one until the alias
// list's remove_after. An alias resolves where it is declared: a rule that
// sets --sf-surface-state-hover alone leaves a reader of
// --sf-surface-transparent-hover inside it on the value the root computed. So
// every rule that re-declares a renamed role re-declares its alias with it
// (the sf-role-aliases mixin), and nothing writes a former name any other way.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const aliases = JSON.parse(read('src/core/contracts/token-aliases.v1.json'));
const mixin = read('src/core/scss/mix/_mix__role_aliases.scss');
const theme = read('src/core/scss/_sf_css__theme.scss');
const pairs = aliases.tokens.map(({from, to}) => [from, to]);
const byOld = new Map(pairs);
const byNew = new Map(pairs.map(([from, to]) => [to, from]));

const files = (directory, extensions) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return files(path, extensions);
  return extensions.includes(extname(entry.name)) ? [path] : [];
});

test('the alias list and the mixin are one list, and the dates follow the change journal', () => {
  const declared = [...mixin.matchAll(/^ {2}'([a-z0-9-]+)': \('([a-z0-9-]+)',\),$/gmu)].map(([, to, from]) => [`--sf-${from}`, `--sf-${to}`]);
  assert.deepEqual(declared, pairs);
  assert.equal(pairs.length, 51);
  const journal = JSON.parse(read('contracts/changes/journal.json')).records;
  const tokens = journal.find((record) => record.id === 'token-c16-theme-role-names');
  assert.deepEqual(tokens.items.map(({from, to}) => [from, to]), pairs);
  assert.equal(tokens.remove_after, aliases.remove_after);
  const variables = journal.find((record) => record.id === 'token-component-background-color-names');
  assert.deepEqual(variables.items.map(({from, to}) => [from, to]), aliases.component_variables.map(({from, to}) => [from, to]));
});

test('the theme declares every new name, and every former name only through the mixin', () => {
  const missing = pairs.filter(([, to]) => !new RegExp(`^\\s*${to}:`, 'mu').test(theme)).map(([, to]) => to);
  assert.deepEqual(missing, [], 'a new name holds the value');
  assert.match(theme, /@include aliases\.sf-role-aliases;/u, 'the theme root declares every alias');
  for (const {from} of aliases.held) assert.match(theme, new RegExp(`^\\s*${from}:`, 'mu'), `${from} is held with its own value`);
});

test('no source writes a former name; a rule that writes a renamed role includes its alias', () => {
  const wrong = [];
  for (const path of files(resolve(root, 'src'), ['.scss', '.css'])) {
    if (!statSync(path).isFile() || path.endsWith('_mix__role_aliases.scss')) continue;
    const css = readFileSync(path, 'utf8');
    const short = path.slice(root.length + 1);
    // A plain CSS sheet (a Smart template) cannot include the mixin: it writes
    // the alias out, the former name as exactly var() of the new one (C16
    // places; tests/surface-places.contract.test.mjs holds the block equal to
    // the mixin). Anything else written to a former name is wrong.
    const literal = path.endsWith('.css');
    const bare = css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    for (const [from, to] of pairs) {
      const writes = [...bare.matchAll(new RegExp(`${from}\\s*:\\s*([^;]+);`, 'gu'))].map(([, value]) => value.trim());
      if (writes.some((value) => !(literal && value === `var(${to})`))) wrong.push(`${short}: writes ${from}`);
    }
    // Every block that declares a new name of a renamed role names it to the mixin.
    for (const [, body] of css.matchAll(/\{([^{}]*)\}/gu)) {
      const written = [...body.matchAll(/(--sf-[a-z0-9-]+)\s*:/gu)].map(([, name]) => name).filter((name) => byNew.has(name));
      if (!written.length) continue;
      const all = /sf-role-aliases;/u.test(body);
      const spelled = (name) => literal && new RegExp(`${byNew.get(name)}\\s*:\\s*var\\(${name}\\)`, 'u').test(body);
      const named = new Set([...(body.match(/sf-role-aliases\(([^;]*)\);/u)?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/gu)].map(([, name]) => `--sf-${name}`));
      for (const name of written) if (!all && !named.has(name) && !spelled(name)) wrong.push(`${short}: writes ${name} without its alias ${byNew.get(name)}`);
    }
  }
  assert.deepEqual(wrong, []);
});

// The built sheets are what a page gets: every rule there that declares a new
// name declares the former one as var() of it, and a former name is declared
// nowhere else. Read from the candidate (UI_CORE_ROOT / UI_SMART_ROOT); a
// distribution from before the rename is skipped, not passed.
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const smartDistribution = process.env.UI_SMART_ROOT ?? resolve(root, '../ui-smart');
const built = [resolve(distribution, 'distr'), resolve(smartDistribution, 'smart')]
  .filter((directory) => existsSync(directory))
  .flatMap((directory) => files(directory, ['.css']))
  .filter((path) => !path.endsWith('.min.css'));
const core = built.find((path) => path.endsWith('/core/css/core.css'));
const named = core && readFileSync(core, 'utf8').includes('--sf-surface-page:');

test('in the built sheets every renamed role travels with its alias', {skip: !named && 'the built sheets predate the C16 names'}, () => {
  const wrong = [];
  let rules = 0;
  for (const path of built) {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      const declarations = new Map([...body.matchAll(/(--sf-[a-z0-9-]+)\s*:\s*([^;]+)/gu)].map(([, name, value]) => [name, value.trim()]));
      for (const [name, value] of declarations) {
        if (byOld.has(name) && value !== `var(${byOld.get(name)})`) wrong.push(`${path}: ${selector.trim()} writes ${name}: ${value}`);
        if (byNew.has(name)) {
          rules += 1;
          if (declarations.get(byNew.get(name)) !== `var(${name})`) wrong.push(`${path}: ${selector.trim()} writes ${name} without ${byNew.get(name)}`);
        }
      }
    }
  }
  assert.ok(rules >= pairs.length, `only ${rules} declarations of new names were read`);
  assert.deepEqual(wrong, []);
});

test('a renamed component variable is read first, the former name under it', () => {
  const sources = files(resolve(root, 'src'), ['.scss', '.css']).map((path) => readFileSync(path, 'utf8')).join('\n');
  const publicVariables = JSON.stringify(JSON.parse(read('src/core/contracts/public-variables.v1.json')));
  const wrong = [];
  for (const {from, to} of aliases.component_variables) {
    const reads = [...sources.matchAll(new RegExp(`var\\(${from}\\s*,`, 'gu'))].length;
    const wrapped = [...sources.matchAll(new RegExp(`var\\(${to}, var\\(${from},`, 'gu'))].length;
    if (!reads || reads !== wrapped) wrong.push(`${from}: ${reads} reads, ${wrapped} under ${to}`);
    if (!publicVariables.includes(`"${to}"`) || publicVariables.includes(`"${from}"`)) wrong.push(`${to}: public variables list`);
  }
  assert.deepEqual(wrong, []);
});
