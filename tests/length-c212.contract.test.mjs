// Owner decision C212 (4), 2026-11-16 (`#q-us-length`, research
// control/research/2026-11-15-utilities-sprawl.md section 4 in simai/ui-control):
// spacing and sizes only in the system steps, one name per length. g-* is an
// alias of gap-*; a fraction is written in lowest terms; space-x/y, the raw
// rungs of the spacing ladders and w-1 ... w-99 are deprecated with the nearest
// step as the hint. Old names keep drawing what they drew until 2027-01-01.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const {default: table} = await import('../src/core/js/retired-classes.table.js');
const aliases = await import('../src/core/js/utility-class-aliases.js');
const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');

const SF = {RuleLoader: {}};
const ruleOf = (folder, variant = 'default') => {
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  return SF.RuleLoader[`${folder}/${variant}`];
};
const record = (id) => table.records.find(({journal}) => journal === id);
const journal = JSON.parse(read('contracts/changes/journal.json'));
const to = (name) => aliases.retiredClassName(name)?.to;

// The value each fraction draws, from the sheet's own array.
const fractions = (path) => Object.fromEntries([...read(path).matchAll(/"((?:screen-)?\d+)\\\\\/(\d+)"\s*:\s*([\d.]+v?[h%]?)/gu)]
  .map(([, n, d, value]) => [`${n}/${d}`, value]));

test('C212 (4): two dated records, recorded in the change journal', () => {
  for (const [id, rewrite] of [['class-c212-length', 'rename-class'], ['class-c212-length-nearest', 'manual']]) {
    const entry = record(id);
    assert.ok(entry, `${id} is in the retired-classes table`);
    assert.equal(entry.decision, 'C212 (4)');
    assert.equal(entry.since, '2026-11-16');
    assert.equal(entry.remove_after, '2027-01-01');
    const recorded = journal.records.find((item) => item.id === id);
    assert.ok(recorded, `${id} is in the journal`);
    assert.equal(recorded.rewrite, rewrite);
    assert.equal(recorded.deprecated_on, '2026-11-16');
  }
});

test('C212 (4): g-* is gap-*, the same rule of the same sheet', () => {
  const sheet = read('src/utility/gap/default/scss/_sf_css__gap.scss');
  assert.match(sheet, /\.#\{\$infix\}gap-#\{\$size\},\s*\.#\{\$infix\}g-#\{\$size\} \{/u);
  assert.match(sheet, /\.#\{\$infix\}gap-x-#\{\$size\},\s*\.#\{\$infix\}g-x-#\{\$size\} \{/u);
  assert.match(sheet, /\.#\{\$infix\}gap-y-#\{\$size\},\s*\.#\{\$infix\}g-y-#\{\$size\} \{/u);
  for (const step of ['0', '1/4', '1/3', '1/2', '1', '4', '8']) {
    for (const axis of ['', 'x-', 'y-']) assert.equal(to(`g-${axis}${step}`), `gap-${axis}${step}`);
  }
  assert.equal(to('md:g-x-1/2'), 'md:gap-x-1/2');
  for (const kept of ['gap-2', 'gap-x-1/2', 'col-gap-2', 'row-gap-1']) assert.equal(aliases.retiredClassName(kept), null, kept);
  for (const name of ['g-2', 'g-x-1/2', 'gap-2']) assert.ok(ruleOf('gap').test(name), `${name} still loads`);
});

test('C212 (4): a fraction is written in lowest terms, and the alias draws the same length', () => {
  const families = [
    ['w', 'src/utility/width/default/scss/_sf_var__width.scss'],
    ['basis', 'src/utility/flex-basis/default/scss/_sf_var__flex_basis.scss'],
    ['h', 'src/utility/height/default/scss/_sf_var__height.scss'],
    ['top', 'src/utility/element-position/default/scss/_sf_var__absolute.scss'],
    ['inline-end', 'src/utility/element-position/default/scss/_sf_var__absolute.scss'],
  ];
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let reducible = 0;
  for (const [prefix, path] of families) {
    const values = fractions(path);
    for (const [fraction, value] of Object.entries(values)) {
      const [n, d] = fraction.replace('screen-', '').split('/').map(Number);
      const screen = fraction.startsWith('screen-') ? 'screen-' : '';
      const name = `${prefix}-${fraction}`;
      if (n === d) {
        assert.equal(to(name), `${prefix}-full`, name);
        continue;
      }
      const g = gcd(n, d);
      if (g === 1) {
        assert.equal(aliases.retiredClassName(name), null, `${name} is in lowest terms`);
        continue;
      }
      reducible++;
      const lowest = `${screen}${n / g}/${d / g}`;
      assert.equal(to(name), `${prefix}-${lowest}`, name);
      assert.equal(values[lowest], value, `${name} draws what ${prefix}-${lowest} draws`);
    }
  }
  assert.ok(reducible >= 40, `${reducible} reducible fractions`);
  assert.equal(to('h-screen-2/4'), 'h-screen-1/2');
  assert.equal(to('lg:bottom-6/12'), 'lg:bottom-1/2');
  assert.equal(to('inline-start-4/12'), 'inline-start-1/3');
  for (const name of ['w-1/2', 'w-1/12', 'w-5/12', 'w-full', 'basis-1/3', 'h-screen-1/2', 'top-1/2']) assert.equal(aliases.retiredClassName(name), null, name);
  assert.ok(ruleOf('width').test('w-2/4'), 'the old fraction still loads');
});

test('C212 (4): w-1 ... w-99 are deprecated; a percent that is a fraction is that fraction, the rest name the nearest', () => {
  const exact = {20: '1/5', 25: '1/4', 40: '2/5', 50: '1/2', 60: '3/5', 75: '3/4', 80: '4/5'};
  for (let k = 1; k <= 99; k++) {
    const hint = to(`w-${k}`);
    assert.match(hint, /^w-(?:\d+\/\d+|full)$/u, `w-${k}`);
    if (exact[k]) assert.equal(hint, `w-${exact[k]}`);
    const inExact = Object.hasOwn(record('class-c212-length').names, `w-${k}`);
    assert.equal(inExact, Boolean(exact[k]), `w-${k} is in the ${exact[k] ? 'exact' : 'nearest'} record`);
  }
  assert.equal(to('w-33'), 'w-1/3');
  assert.equal(to('w-10'), 'w-1/12');
  assert.equal(to('md:w-66'), 'md:w-2/3');
  assert.equal(to('w-99'), 'w-full');
  assert.ok(ruleOf('width-ext').test('w-33'), 'w-33 still loads');
  assert.equal(aliases.retiredClassName('w-b6'), null, 'the size rungs stay extended (C187 (2))');
});

test('C212 (4): space-x / space-y name gap-x / gap-y; reverse has no twin', () => {
  for (const step of ['0', '1/4', '1/2', '1', '8']) {
    assert.equal(to(`space-x-${step}`), `gap-x-${step}`);
    assert.equal(to(`space-y-${step}`), `gap-y-${step}`);
  }
  assert.equal(to('md:space-y-3'), 'md:gap-y-3');
  assert.equal(to('space-x-reverse'), '');
  assert.equal(to('space-y-reverse'), '');
  assert.ok(ruleOf('space').test('space-x-2'), 'space-x-2 still loads');
});

test('C212 (4): a raw spacing rung names the nearest space step (desktop, 16px rem)', () => {
  const cases = {
    'm-a0': 'm-0', 'm-a4': 'm-1/4', 'm-a8': 'm-1/3', 'm-b2': 'm-1/2', 'm-b6': 'm-1', 'm-c0': 'm-2', 'm-c2': 'm-3',
    'm-c6': 'm-4', 'm-d0': 'm-5', 'm-d2': 'm-6', 'm-d6': 'm-7', 'm-e0': 'm-8', 'm-i9': 'm-8',
    'm-b4': 'm-1', 'm-a2': 'm-1/4', // a tie takes the larger step
    '-m-top-b6': '-m-top-1', 'md:p-inline-end-c2': 'md:p-inline-end-3', 'p-b6': 'p-1',
    'scroll-mt-b6': 'scroll-mt-1', 'scroll-m-inline-start-c0': 'scroll-m-inline-start-2',
    'scroll-p-inline-start-b6': 'scroll-pl-1', 'scroll-p-inline-end-b6': 'scroll-pr-1', 'scroll-pb-b6': 'scroll-pb-1',
    '-scroll-m-b6': '', '-scroll-pt-a4': '',
  };
  for (const [name, hint] of Object.entries(cases)) assert.equal(to(name), hint, name);
  // Every step a hint names is a class of the step sheet.
  const steps = new Set(Object.values(record('class-c212-length-nearest').patterns.find(({values}) => values).values[2]));
  for (const step of steps) {
    for (const [folder, name] of [['margin', `m-${step}`], ['margin', `-m-top-${step}`], ['padding', `p-inline-start-${step}`], ['scroll-margin', `scroll-mt-${step}`], ['scroll-padding', `scroll-pl-${step}`]]) {
      assert.ok(ruleOf(folder).test(name), `${name} is a step class`);
    }
  }
  for (const kept of ['m-1', 'p-top-1/2', 'scroll-mt-2', 'm-auto', 'h-d0', 'top-b6']) assert.equal(aliases.retiredClassName(kept), null, kept);
});

test('C212 (4): the Loader notes the hint before the retired sheet, once', () => {
  clearDeprecations();
  assert.equal(aliases.noteUtilityClassAlias('m-b6'), 'm-1');
  assert.equal(aliases.noteRetiredUtilitySheets('m-b6', ['margin-ext/default']), true);
  assert.equal(aliases.noteUtilityClassAlias('g-2'), 'gap-2');
  const notes = listDeprecations().filter(({from}) => from === 'm-b6');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].to, 'm-1');
  assert.ok(listDeprecations().some((note) => note.from === 'g-2' && note.to === 'gap-2' && note.remove_after === '2027-01-01'));
  clearDeprecations();
});

test('C212 (4): the sheets are unchanged but for comments; the versions move', () => {
  for (const unit of ['gap', 'space', 'width', 'width-ext', 'height', 'flex-basis', 'element-position']) {
    const passport = JSON.parse(read(`src/utility/${unit}/passport.json`));
    assert.equal(passport.version, '1.1.0', unit);
  }
  assert.match(read('src/utility/width-ext/default/scss/_sf_css__width.scss'), /@for \$k from 1 through 99 \{\s*\.#\{\$infix\}w-#\{\$k\} \{\s*width: \$k \* 1%;/u);
});
