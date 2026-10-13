import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read = p => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('display-table is additive, without retiring legacy table', () => {
  const map = read('utility/display/default/scss/_sf_var__display.scss');
  assert.match(map, /\bdisplay-table:\s*table/);
  assert.match(map, /^\s+table:\s*table/m);
  for (const variant of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const context = {SF: {RuleLoader: {}}};
    vm.runInNewContext(read(`utility/display/${variant}/rule.js`), context);
    const rule = context.SF.RuleLoader[`display/${variant}`];
    const prefix = variant === 'default' ? '' : `${variant}:`;
    for (const name of ['display-table', 'table', 'grid', 'flex', 'hidden']) {
      assert.equal(rule.test(prefix + name), true);
      assert.equal(rule.test(prefix + name + '-invalid'), false);
      assert.equal(rule.test('x-' + prefix + name), false);
    }
  }
});

for (const axis of ['columns', 'rows']) {
  test(`subgrid reuses the existing ${axis} generation map`, () => {
    assert.match(read(`utility/grid-template-${axis}/default/scss/_sf_var__grid_template_${axis}.scss`), /subgrid:\s*subgrid/);
    for (const variant of ['sm', 'md', 'lg', 'xl', 'xxl'])
      assert.ok(read(`utility/grid-template-${axis}/${variant}/scss/_sf_css__grid_template_${axis}.scss`).includes(`../../default/scss/sf_var__grid_template_${axis}`));
  });
}

test('viewport lengths live in semantic core tokens, legacy screen stays unchanged', () => {
  const tokens = read('core/scss/_sf_css__viewport.scss');
  for (const [dimension, axis] of [['height', 'h'], ['width', 'w']]) {
    const map = read(`utility/${dimension}/default/scss/_sf_var__${dimension}.scss`);
    assert.ok(map.includes(`100v${axis}`));
    for (const [name, unit] of [['small', 's'], ['large', 'l'], ['dynamic', 'd']]) {
      assert.ok(map.includes(`var(--sf-viewport-${dimension}-${name})`));
      assert.ok(tokens.includes(`--sf-viewport-${dimension}-${name}: 100${unit}v${axis}`));
    }
    assert.doesNotMatch(map, /\d+(?:s|l|d)v[wh]/);
  }
});

test('text-wrap owns a finite exact class vocabulary', () => {
  const context = {SF: {RuleLoader: {}}};
  vm.runInNewContext(read('utility/text-wrap/default/rule.js'), context);
  const rule = context.SF.RuleLoader['text-wrap/default'];
  for (const name of ['text-wrap', 'text-nowrap', 'text-balance', 'text-pretty']) {
    assert.equal(rule.test(name), true);
    for (const invalid of [`x-${name}`, `${name}-invalid`, `${name}\n`, `hover:${name}`])
      assert.equal(rule.test(invalid), false, invalid);
  }
});
