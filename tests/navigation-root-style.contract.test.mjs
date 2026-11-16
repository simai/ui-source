import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

for (const [owner, tag] of [['breadcrumbs', 'nav'], ['steps', 'div']]) {
  test(`${owner} consumes shared root style on the existing semantic root`, async () => {
    const template = await readFile(new URL(`../src/smart/${owner}/js/templates/default.js`, import.meta.url), 'utf8');
    assert.match(template, new RegExp(`<${tag}[\\s\\S]*?class=\\$\\{rootClasses\\}[\\s\\S]*?style=\\$\\{context.rootStyle \\|\\| nothing\\}`));
    assert.match(template, /context.rootClass/);
    assert.match(template, /import \{ html, nothing \} from 'lit'/);
  });
}

test('steps ahead use readable text and a disabled step is on the disabled roles whatever its state', async () => {
  const source = await readFile(new URL('../src/component/step/scss/_css__step.scss', import.meta.url), 'utf8');
  // The public --sf-steps-step-color (standard 1.3.8 §6) reads the role token as its fallback.
  assert.match(source, /\.sf-step\.sf-step--state-ahead \.sf-step-container,\n\.sf-step\.sf-step--state-skipped \.sf-step-container \{\n  color: var\(--sf-steps-step-color, var\(--sf-on-surface-variant\)\);/);
  assert.doesNotMatch(source, /--sf-on-surface-muted/);
  assert.match(source, /\.sf-step\.sf-step--disabled \.sf-step-container,\n\.sf-step\.sf-step--disabled \.sf-step-text,\n\.sf-step\.sf-step--disabled \.sf-step-marker \{\n  color: var\(--sf-on-surface-disabled\);/);
  assert.match(source, /\.sf-steps--marker-number \.sf-step\.sf-step--disabled \.sf-step-marker,[^{]*\{\n  border-color: var\(--sf-outline-disabled\);/);
});
