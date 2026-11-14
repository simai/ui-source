import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {exactClassPattern} from '../scripts/utility-exact-rule.mjs';

// Fluid grid (owner decision C181 (1), 2026-11-14; ui-control
// prototypes/foundation-names-demo.html): beside the fixed-count grid-col-1..12,
// grid-col-fit lays out as many columns as fit, none narrower than a step of
// the size scale -- 12rem (f2) by default, grid-col-fit-<step> for another.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unit = join(root, 'src/utility/grid-template-columns/default');
const read = (path) => readFileSync(path, 'utf8');
const vars = read(join(unit, 'scss/_sf_var__grid_template_columns.scss'));
const FIT = Object.fromEntries([...vars.match(/\$grid-template-columns-fit-array: \(([\s\S]*?)\);/u)[1]
  .matchAll(/'([a-z0-9-]+)': ([a-i]\d),/gu)].map(([, name, step]) => [name, step]));
const FIXED = [...vars.match(/\$grid-template-columns-array: \(([\s\S]*?)\);/u)[1].matchAll(/^\s*([a-z0-9]+):/gmu)].map(([, name]) => name);
const sizeSource = read(join(root, 'src/core/scss/vars/_sf_var__size.scss'));
const rem = (step) => Number(sizeSource.match(new RegExp(`\\b${step[0]}: \\(([\\s\\S]*?)\\)`, 'u'))[1].match(new RegExp(`\\b${step[1]}: ([0-9.]+)rem`, 'u'))[1]);

test('C181: grid-col-fit takes 12rem (f2) by default, every other minimum a step of the size scale', () => {
  assert.equal(FIT.fit, 'f2');
  assert.equal(rem(FIT.fit), 12);
  for (const [name, step] of Object.entries(FIT)) {
    if (name !== 'fit') assert.equal(name, `fit-${step}`, `${name} names its step`);
    assert.ok(rem(step) > 0, `${step} is a step of the size scale`);
  }
  const steps = Object.values(FIT).slice(1).map(rem);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'the steps rise');
});

test('C181: the fluid columns are auto-fit, never overflow a narrow place, and only the plain class has them', () => {
  const css = read(join(unit, 'scss/_sf_css__grid_template_columns.scss'));
  assert.match(css, /repeat\(auto-fit, minmax\(min\(100%, var\(--sf-#\{\$grid-template-columns-step\}\)\), 1fr\)\)/u);
  assert.match(css, /@if \$infix == '' \{/u);
  for (const variant of ['sm', 'md', 'lg', 'xl', 'xxl']) {
    const rule = read(join(root, `src/utility/grid-template-columns/${variant}/rule.js`));
    assert.doesNotMatch(rule, /fit/u, `${variant}: no screen variant of the fluid grid`);
  }
});

test('C181: the Loader rule reaches every class of the unit and nothing else', () => {
  const context = {SF: {RuleLoader: {}}};
  vm.runInNewContext(read(join(unit, 'rule.js')), context);
  const rule = context.SF.RuleLoader['grid-template-columns/default'];
  const classes = [...FIXED, ...Object.keys(FIT)].map((name) => `grid-col-${name}`);
  assert.equal(rule.source, new RegExp(exactClassPattern(classes)).source);
  for (const name of ['grid-col-fit', 'grid-col-fit-g2', 'grid-col-4']) assert.equal(rule.test(name), true, name);
  for (const name of ['grid-col-fit-g9', 'grid-col-fit-', 'grid-col-fits', 'md:grid-col-fit']) assert.equal(rule.test(name), false, name);
});

const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
test('C181: the build ships the fluid grid', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const sheet = join(distribution, 'utility/grid-template-columns/default/css/default.css');
  assert.ok(existsSync(sheet), sheet);
  const css = read(sheet);
  for (const [name, step] of Object.entries(FIT)) {
    const escaped = name.replace(/[-]/gu, '\\-');
    assert.match(css, new RegExp(`\\.grid-col-${escaped}\\s*\\{\\s*grid-template-columns: repeat\\(auto-fit, minmax\\(min\\(100%, var\\(--sf-${step}\\)\\), 1fr\\)\\)`, 'u'), name);
  }
});
