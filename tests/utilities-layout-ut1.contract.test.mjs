// Utilities joint pass, layout group (RG-UT-L, pair 5.20261115.1622; study
// pages ui-control prototypes/utilities-*-study.html): the Framework defects
// fixed without an owner question. Each test reads the source the built sheet
// is made of; the browser probe of the branch checks the built sheets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const journal = JSON.parse(read('contracts/changes/journal.json'));
const BREAKPOINTS = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];
const record = (id) => table.records.find((item) => item.journal === id);
const entry = (id) => journal.records.find((item) => item.id === id);
const rules = (folder, bps = BREAKPOINTS) => {
  const SF = {RuleLoader: {}};
  for (const bp of bps) new Function('SF', read(`src/utility/${folder}/${bp}/rule.js`))(SF);
  return (token) => Object.entries(SF.RuleLoader).filter(([, re]) => re.test(token)).map(([key]) => key);
};
const dated = (id, names) => {
  const rec = record(id);
  assert.ok(rec, `${id} in the retired-classes table`);
  assert.equal(rec.remove_after, '2027-01-01');
  const item = entry(id);
  assert.ok(item, `${id} in the change journal`);
  assert.equal(item.remove_after, '2027-01-01');
  for (const [from, to] of Object.entries(names)) {
    assert.equal(rec.names[from], to, `${from} -> ${to}`);
    assert.deepEqual(aliases.retiredClassName(from), {found: aliases.retiredClassName(from).found, from, to: to ?? ''});
  }
};

test('LY-9: clear-inline-start/-end write the logical sides', () => {
  const vars = read('src/utility/clear/default/scss/_sf_var__clear.scss');
  assert.match(vars, /inline-start\s*:\s*inline-start\s*,/u);
  assert.match(vars, /inline-end\s*:\s*inline-end\s*,/u);
  assert.doesNotMatch(vars, /:\s*(?:left|right)\b/u);
});

test('LB-2: layout-col-auto is a dated deprecated name and still draws', () => {
  dated('class-ut1-layout-col-auto', {'layout-col-auto': null});
  assert.deepEqual(rules('column')('layout-col-auto'), ['column/default']);
});

test('GR-2: grid-row-auto and grid-row-span-* are dated aliases of row-*, one rule', () => {
  const values = ['auto', 'span-1', 'span-2', 'span-3', 'span-4', 'span-5', 'span-6', 'span-full'];
  dated('class-ut1-grid-row', Object.fromEntries(values.map((v) => [`grid-row-${v}`, `row-${v}`])));
  assert.equal(aliases.retiredClassName('md:grid-row-span-2').to, 'md:row-span-2');
  for (const v of values) assert.equal(aliases.retiredClassName(`row-${v}`), null, `row-${v} is public`);
  for (const bp of BREAKPOINTS) {
    const css = read(`src/utility/grid-row/${bp}/scss/_sf_css__grid_row.scss`);
    assert.match(css, /\.#\{\$infix\}row-#\{\$grid-row-name\},\s*\.#\{\$infix\}grid-row-#\{\$grid-row-name\}/u);
    assert.match(css, /dated alias until 2027-01-01/u, bp);
  }
});

test('IN-4: no negative auto margin is written or loaded; the names are noted', () => {
  const sides = ['', 'top-', 'bottom-', 'inline-start-', 'inline-end-', 'inline-', 'block-'];
  dated('class-ut1-negative-auto', Object.fromEntries(sides.map((s) => [`-m-${s}auto`, null])));
  const match = rules('margin');
  for (const bp of BREAKPOINTS) {
    const css = read(`src/utility/margin/${bp}/scss/_sf_css__margin.scss`);
    assert.equal((css.match(/@if \$size != 'auto' \{\n\s*\.-#\{\$infix\}m-/gu) || []).length, 7, `${bp}: seven negative rules skip auto`);
    const neg = bp === 'default' ? '-' : `-${bp}:`;
    const pos = bp === 'default' ? '' : `${bp}:`;
    for (const s of sides) {
      assert.deepEqual(match(`${neg}m-${s}auto`), [], `${neg}m-${s}auto loads no sheet`);
      assert.equal(match(`${pos}m-${s}auto`).length, 1, `${pos}m-${s}auto still loads`);
      assert.equal(match(`${neg}m-${s}2`).length, 1, `${neg}m-${s}2 still loads`);
    }
  }
});

test('SZ-7: max-w-sm ... max-w-xxl read the ladder steps of the thresholds', () => {
  const vars = read('src/utility/max-width/default/scss/_sf_var__width_max.scss');
  const steps = Object.fromEntries([...vars.matchAll(/^\s*(sm|md|lg|xl|xxl)\s*:\s*([a-z]\d)\s*,/gmu)].map((m) => [m[1], m[2]]));
  const core = read('src/core/scss/_sf_css__breakpoint.scss');
  const named = Object.fromEntries([...core.matchAll(/'(sm|md|lg|xl|xxl)'\s*:\s*'([a-z]\d)'/gu)].map((m) => [m[1], m[2]]));
  assert.deepEqual(steps, named, 'the same steps --sf-breakpoint-* name');
  for (const bp of BREAKPOINTS) {
    const css = read(`src/utility/max-width/${bp}/scss/_sf_css__width_max.scss`);
    assert.match(css, /max-width: var\(--sf-#\{map\.get\(\$with-max-breakpoint-steps, \$breakpoint-name\)\}\);/u, bp);
    assert.doesNotMatch(css, /max-width: #\{\$breakpoint-value\}/u, bp);
  }
});

test('OS-4: the axis and the strictness are separate; strictness never names an axis', () => {
  const vars = read('src/utility/scroll-snap-type/default/scss/_sf_var__scroll_snap_type.scss');
  const css = read('src/utility/scroll-snap-type/default/scss/_sf_css__scroll_snap_type.scss');
  assert.doesNotMatch(vars, /:\s*x (?:mandatory|proximity)\s*,/u);
  assert.match(css, /scroll-snap-type: #\{\$snap-value\} var\(--sf-snap-strictness, proximity\);/u);
  assert.match(css, /--sf-snap-strictness: #\{\$snap-value\};/u);
  assert.match(css, /@property --sf-snap-strictness \{\s*syntax: "\*";\s*inherits: false;\s*\}/u);
  const match = rules('scroll-snap-type', ['default']);
  for (const name of ['snap-x', 'snap-y', 'snap-both', 'snap-mandatory', 'snap-proximity', 'snap-none']) assert.equal(match(name).length, 1, name);
});

test('IA-2, IA-3: sr-only beats the component layer and cuts the box with clip-path', () => {
  for (const [path, prefix] of [['src/core/scss/_sf_css__hide.scss', '.'], ['src/utility/sr-only/default/scss/_sf_css__sr_only.scss', '.#{$infix}']]) {
    const text = read(path);
    assert.doesNotMatch(text, /^\s*clip:/mu, `${path}: no clip property`);
    for (const [name, clip] of [['sr-only', 'inset(50%)'], ['not-sr-only', 'none']]) {
      const at = text.indexOf(`${prefix}${name} {`);
      assert.ok(at >= 0, `${path} ${name}`);
      const open = at + `${prefix}${name} {`.length;
      const body = text.slice(open, text.indexOf('}', open));
      const decls = body.split('\n').filter((line) => /^\s*[a-z-]+:/u.test(line));
      assert.ok(decls.length >= 8, `${name} declarations`);
      for (const line of decls) assert.match(line, /!important;$/u, `${path} ${name}: ${line.trim()}`);
      assert.ok(body.includes(`clip-path: ${clip} !important;`), `${name}: clip-path ${clip}`);
    }
  }
});

test('TB-6: the table sheet has no bare type rule', () => {
  const css = read('src/utility/table/default/scss/_sf_css__table.scss');
  assert.doesNotMatch(css, /^\s*table\s*\{/mu, 'no bare table rule');
  assert.doesNotMatch(css, /^\s*tbody,\s*td,/mu, 'no bare cell rule');
  assert.match(css, /:where\(\.table\) \{\s*caption-side: bottom;\s*border-collapse: collapse;/u);
  assert.match(css, /:where\(\.table\) :where\(tbody, td, tfoot, th, thead, tr\) \{/u);
});
