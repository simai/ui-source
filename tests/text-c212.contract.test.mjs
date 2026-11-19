// Owner decision C212 (3), 2026-11-16 (research control/research/2026-11-15-
// utilities-sprawl.md section 3 in simai/ui-control): one way per text job --
// text-N, title-N, line-N, measure and three weights, weight-regular,
// weight-medium, weight-bold. The other spellings are dated aliases: they keep
// drawing until 2027-01-01 and the Loader notes them in SF.deprecations.
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
const {convertTailwindClasses} = await import('../src/core/js/tailwind-map.js');

const SF = {RuleLoader: {}};
const ruleOf = (folder, variant = 'default') => {
  new Function('SF', read(`src/utility/${folder}/${variant}/rule.js`))(SF);
  return SF.RuleLoader[`${folder}/${variant}`];
};
const VARIANTS = ['default', 'sm', 'md', 'lg', 'xl', 'xxl', 'hover'];
const ROLES = ['regular', 'medium', 'bold'];
const record = (id) => table.records.find((item) => item.journal === id);
const journal = JSON.parse(read('contracts/changes/journal.json'));
const entry = (id) => journal.records.find((item) => item.id === id);

const EXACT = {
  'max-w-prose': 'measure',
  regular: 'weight-regular',
  'weight-4': 'weight-regular',
  'weight-5': 'weight-medium',
  bold: 'weight-bold',
  'weight-7': 'weight-bold',
};
const NEAREST = {
  'weight-1': 'weight-regular',
  'weight-2': 'weight-regular',
  'weight-3': 'weight-regular',
  lighter: 'weight-regular',
  'weight-6': 'weight-medium',
  'weight-8': 'weight-bold',
  'weight-9': 'weight-bold',
  bolder: 'weight-bold',
  'line-tight': 'line-N',
  'line-snug': 'line-N',
  'line-normal': 'line-N',
  'line-relaxed': 'line-N',
  'line-loose': 'line-N',
  'line-none': 'line-N',
};

test('C212 (3): three weight roles on the weight family, at every breakpoint and hover:', () => {
  const vars = read('src/utility/font-weight/default/scss/_sf_var__font_weight.scss');
  for (const role of ROLES) assert.match(vars, new RegExp(`${role}:\\s+var\\(--sf-weight--${role}\\)`, 'u'), role);
  for (const variant of VARIANTS) {
    const rule = ruleOf('font-weight', variant);
    const prefix = variant === 'default' ? '' : `${variant}:`;
    for (const role of ROLES) assert.ok(rule.test(`${prefix}weight-${role}`), `${prefix}weight-${role}`);
    assert.ok(rule.test(`${prefix}weight-5`), `${prefix}weight-5 still loads`);
    assert.ok(!rule.test(`${prefix}weight-semibold`), 'three roles only');
    assert.match(read(`src/utility/font-weight/${variant}/scss/_sf_css__font_weight.scss`), /\$font-weight-role-array/u, variant);
  }
  for (const role of ROLES) assert.equal(aliases.retiredClassName(`weight-${role}`), null, `weight-${role} is public`);
});

test('C212 (3): the public text names stay; the old ones are dated aliases', () => {
  for (const name of ['text-3', 'title-3', 'line-3', 'measure', 'measure-wide', 'md:measure']) assert.equal(aliases.retiredClassName(name), null, name);
  assert.deepEqual(record('class-c212-text').names, EXACT);
  assert.deepEqual(record('class-c212-text-nearest').names, NEAREST);
  for (const [from, to] of Object.entries({...EXACT, ...NEAREST})) assert.equal(aliases.retiredClassName(from).to, to, from);
  assert.equal(aliases.retiredClassName('md:max-w-prose').to, 'md:measure');
  assert.equal(aliases.retiredClassName('hover:bold').to, 'hover:weight-bold');
  assert.equal(aliases.retiredClassName('lg:line-tight').to, 'lg:line-N');
  // The old sheets still load every old name until the date.
  assert.ok(ruleOf('max-width').test('max-w-prose'));
  assert.ok(ruleOf('line-height').test('line-tight'));
  assert.ok(ruleOf('font-weight').test('bolder'));
});

test('C212 (3): every retired text name is in its journal record, with the same date', () => {
  for (const id of ['class-c212-text', 'class-c212-text-nearest']) {
    const listed = new Set(entry(id).items.map(({from}) => from));
    const item = record(id);
    for (const from of [...Object.keys(item.names), ...Object.keys(item.modifiers || {})]) assert.ok(listed.has(from), `${id} lists ${from}`);
    assert.equal(entry(id).remove_after, '2027-01-01');
    assert.equal(item.since, '2026-11-16');
  }
  assert.equal(entry('class-c212-text').rewrite, 'rename-class');
  assert.equal(entry('class-c212-text-nearest').rewrite, 'manual', 'the nearest role looks different: a person chooses');
});

test('C212 (3): heading is noted only beside a text-N, with the title-N to write', () => {
  const list = (classes) => ({contains: (name) => classes.includes(name), [Symbol.iterator]: () => classes[Symbol.iterator]()});
  clearDeprecations();
  assert.equal(aliases.noteRetiredModifiers(list(['heading'])), null, 'a bare .heading is the page\'s own');
  assert.equal(aliases.noteRetiredModifiers(list(['text-1/2', 'heading'])), null, 'text-1/2 has no title line');
  assert.equal(aliases.noteRetiredModifiers(list(['text-3', 'heading', 'm-0'])), 'title-3');
  assert.equal(aliases.noteRetiredModifiers(list(['heading', 'text-12'])), 'title-12');
  const notes = listDeprecations();
  assert.deepEqual(notes.map(({from, to}) => [from, to]), [['text-3 heading', 'title-3'], ['text-12 heading', 'title-12']]);
  assert.ok(notes.every((note) => note.kind === 'class' && note.remove_after === '2027-01-01'));
  clearDeprecations();
  // text-N heading and title-N write the same size and line.
  const fontSize = read('src/utility/font-size/default/scss/_sf_css__font_size.scss');
  const title = read('src/utility/title/default/scss/_sf_css__title.scss');
  assert.match(fontSize, /\.#\{\$infix\}text-#\{\$size\}\.heading \{\s*line-height: var\(--sf-title--height-#\{\$size\}\);/u);
  assert.match(title, /font-size: var\(--sf-text--size-#\{\$size\}\);\s*line-height: var\(--sf-title--height-#\{\$size\}\);/u);
});

test('C212 (3), RG-TW-4: the Tailwind conversion writes a role where the weight is the same, and nothing new', () => {
  assert.equal(convertTailwindClasses('font-normal'), 'weight-regular');
  assert.equal(convertTailwindClasses('font-medium'), 'weight-medium');
  assert.equal(convertTailwindClasses('font-bold'), 'weight-bold');
  assert.equal(convertTailwindClasses('md:font-bold'), 'md:weight-bold');
  // No role of their weight: the dated alias draws the same weight.
  assert.equal(convertTailwindClasses('font-semibold'), 'weight-6');
  assert.equal(convertTailwindClasses('font-light'), 'weight-3');
  assert.equal(convertTailwindClasses('leading-tight'), 'line-tight');
  assert.equal(convertTailwindClasses('max-w-prose'), 'max-w-prose', 'the same name in both: not converted');
});

test('C212 (3): the old classes draw as before (values untouched)', () => {
  const vars = read('src/utility/font-weight/default/scss/_sf_var__font_weight.scss');
  assert.match(vars, /regular: normal,\s*bold:\s+bold,\s*lighter: lighter,\s*bolder:\s+bolder,/u);
  for (let step = 1; step <= 9; step++) assert.match(vars, new RegExp(`${step}: ${step}00`, 'u'));
  // C396 (2026-11-19) moved the reading measure, and its alias max-w-prose with it, to the step of 80 characters (65ch before).
  assert.match(read('src/utility/max-width/default/scss/_sf_var__width_max.scss'), /prose : var\(--sf-measure-80\),/u);
  assert.match(read('src/utility/text-max-width/default/scss/_sf_var__text_measure.scss'), /'': var\(--sf-measure-80\),/u);
  assert.match(read('src/utility/line-height/default/scss/_sf_var__line_height.scss'), /tight:\s+1\.25,\s*snug:\s+1\.375,\s*relaxed: 1\.625,\s*loose:\s+2,\s*none:\s+1,\s*normal:\s+1\.5/u);
});
