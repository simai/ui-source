import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The muted ink is the disabled ink (C43, owner 2026-11-10; journal
// token-c43-muted-is-disabled). It is not in the C16 alias list: that list
// holds pure renames with the same value, and this one changes the value. An
// alias resolves where it is declared, so every rule that declares
// --sf-on-surface-disabled declares --sf-on-surface-muted: var(--sf-on-surface-disabled)
// beside it -- the theme, every place, the popover's own sheet -- and nothing
// in the Framework paints with the deprecated name. Read from the built
// sheets (UI_CORE_ROOT / UI_SMART_ROOT, as tests/token-aliases.contract.test.mjs);
// a distribution from before the change is skipped, not passed.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const journal = JSON.parse(readFileSync(resolve(root, 'contracts/changes/journal.json'), 'utf8')).records;
const ALIAS = '--sf-on-surface-muted: var(--sf-on-surface-disabled)';

const files = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return files(path);
  return extname(entry.name) === '.css' && !entry.name.endsWith('.min.css') ? [path] : [];
});

const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');
const smartDistribution = process.env.UI_SMART_ROOT ?? resolve(root, '../ui-smart');
const built = [resolve(distribution, 'distr'), resolve(smartDistribution, 'smart')]
  .filter((directory) => existsSync(directory))
  .flatMap((directory) => files(directory));
const core = built.find((path) => path.endsWith('/core/css/core.css'));
const changed = core && readFileSync(core, 'utf8').includes(ALIAS);

const declares = (name) => new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;}]*)`, 'u');
const DISABLED = declares('--sf-on-surface-disabled');
const MUTED = declares('--sf-on-surface-muted');

test('the journal records muted as the disabled ink, deprecated', () => {
  const record = journal.find((entry) => entry.id === 'token-c43-muted-is-disabled');
  assert.ok(record, 'token-c43-muted-is-disabled');
  assert.equal(record.stage, 'compat');
  assert.equal(record.rewrite, 'rename-token');
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), [['--sf-on-surface-muted', '--sf-on-surface-disabled']]);
  assert.equal(record.remove_after, '2027-01-01');
});

test('in the built sheets every rule with the disabled ink declares muted beside it, and nothing reads muted', {skip: !changed && 'the built sheets predate C43 muted'}, () => {
  const missing = [];
  const readers = [];
  let rules = 0;
  for (const path of built) {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
    const short = path.slice(path.lastIndexOf('/', path.lastIndexOf('/css/') - 1) + 1);
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      const where = `${short}: ${selector.trim().split(/\s+/u).join(' ').slice(-120)}`;
      if (DISABLED.test(body)) {
        rules += 1;
        if (MUTED.exec(body)?.[1].trim() !== 'var(--sf-on-surface-disabled)') missing.push(where);
      }
      for (const [, property] of body.matchAll(/([a-z-]+)\s*:[^;]*var\(--sf-on-surface-muted[,)]/gu)) {
        if (property !== '--sf-on-surface-muted') readers.push(`${where} { ${property} }`);
      }
    }
  }
  assert.ok(rules >= 4, `only ${rules} rules declare the disabled ink`);
  assert.deepEqual(missing, [], 'a rule that re-declares the disabled ink leaves muted on the root value');
  assert.deepEqual(readers, [], 'the deprecated name is read nowhere in the Framework');
});
