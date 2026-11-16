// Owner decision C212 (6), 2026-11-16 (research control/research/2026-11-15-
// utilities-sprawl.md, section 6, in simai/ui-control): one set to hide --
// hidden, invisible, sr-only with not-sr-only, and on paper print-hidden,
// print-only, print-invisible. sr-only is in the core sheet; the old print
// names keep drawing until 2027-01-01 and are noted in SF.deprecations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');

const SF = {RuleLoader: {}};
const ruleOf = (folder) => {
  new Function('SF', read(`src/utility/${folder}/default/rule.js`))(SF);
  return SF.RuleLoader[`${folder}/default`];
};
const body = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is in the sheet`);
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at)).trim().split(/;\s*/u).filter(Boolean).sort();
};

const OLD_PRINT = {
  'print-block': 'print-only',
  'print-inline': 'print-only',
  'print-inline-block': 'print-only',
  'print-flex': 'print-only',
  'print-inline-flex': 'print-only',
  'print-table': 'print-only',
  'print-visible-none': 'print-invisible',
};

test('C212 (6): sr-only and not-sr-only are in the core sheet, drawn as the sr-only utility draws them', () => {
  const index = read('src/core/scss/index.scss');
  assert.match(index, /@use 'sf_css__hide';/u);
  const core = read('src/core/scss/_sf_css__hide.scss');
  const utility = read('src/utility/sr-only/default/scss/_sf_css__sr_only.scss').replace(/\.#\{\$infix\}/gu, '.');
  assert.match(core, /@layer sf\.utilities \{/u, 'same layer as the utility');
  for (const selector of ['.sr-only', '.not-sr-only']) assert.deepEqual(body(core, selector), body(utility, selector), selector);
  const passport = JSON.parse(read('src/core/passports/core.styles.json'));
  assert.ok(passport.files.includes('src/core/scss/_sf_css__hide.scss'));
});

test('C212 (6): the print set loads; print-only hides on screen only, print-hidden removes on paper, print-invisible keeps the room', () => {
  const rule = ruleOf('display-print');
  for (const name of ['print-hidden', 'print-only', 'print-invisible', 'print-visible', ...Object.keys(OLD_PRINT)]) {
    assert.ok(rule.test(name), `${name} loads`);
  }
  assert.ok(!rule.test('print-onlyx') && !rule.test('print-invisiblex'));
  const css = read('src/utility/display-print/default/scss/_sf_css__display_print.scss');
  assert.match(css, /\.#\{\$infix\}print-only \{\s*@media not print \{ display: none; \}\s*\}/u);
  // print-hidden removes the element on paper, as hidden does on screen (dispatcher decision on C212 (6)).
  assert.match(css, /\.#\{\$infix\}print-hidden \{\s*@media print \{ display: none; \}\s*\}/u);
  assert.match(css, /\.#\{\$infix\}print-invisible,\s*\.#\{\$infix\}print-visible-none \{\s*@media print \{ visibility: hidden; \}/u);
  assert.equal(JSON.parse(read('src/utility/display-print/passport.json')).version, '1.1.0');
});

test('C212 (6): the old print names are retired with a hint until 2027-01-01 and noted once', () => {
  const record = table.records.find(({journal}) => journal === 'class-c212-hide-print');
  assert.ok(record);
  assert.equal(record.decision, 'C212 (6)');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.names, OLD_PRINT);
  for (const [from, to] of Object.entries(OLD_PRINT)) {
    assert.deepEqual({to: aliases.retiredClassName(from)?.to}, {to}, from);
  }
  for (const name of ['hidden', 'invisible', 'sr-only', 'not-sr-only', 'print-hidden', 'print-only', 'print-invisible', 'print-visible']) {
    assert.equal(aliases.retiredClassName(name), null, `${name} stays`);
  }
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const entry = journal.records.find(({id}) => id === 'class-c212-hide-print');
  assert.deepEqual(Object.fromEntries(entry.items.map(({from, to}) => [from, to])), OLD_PRINT);
});
