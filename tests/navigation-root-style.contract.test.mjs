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

test('available steps use readable text and disabled error preserves the disabled role', async () => {
  const source = await readFile(new URL('../src/component/step/scss/_css__step.scss', import.meta.url), 'utf8');
  assert.match(source, /--sf-step-container--color: var\(--sf-on-surface-variant\)/);
  assert.doesNotMatch(source, /--sf-on-surface-muted/);
  assert.match(source, /\.sf-step.disabled.sf-step--stage-error \.sf-step-container\s*\{\s*--sf-step-container--color: var\(--sf-on-disable\)/);
  assert.match(source, /\.sf-step.disabled.sf-step--stage-error \.sf-icon\s*\{\s*--sf-icon--color: var\(--sf-on-disable\)/);
});
