import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

for (const [owner, file] of [['step', '_css__step.scss'], ['breadcrumbs', '_css__breadcrumbs_item.scss']]) {
  test(`${owner} uses token keyboard focus and forced-color outline`, async () => {
    const css = await read(`component/${owner}/scss/${file}`);
    assert.match(css, /:focus-visible/);
    assert.doesNotMatch(css, /:focus(?:\s|,|\{)/);
    // The ring is the shared outline now, so it no longer travels through the
    // shadow property and cannot be confused with elevation.
    assert.match(css, /outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
    assert.match(css, /outline-offset: var\(--sf-focus--offset\)/);
    assert.doesNotMatch(css, /--sf-ui-focus\b/);
    assert.match(css, /@media \(forced-colors: active\)/);
    assert.match(css, /outline: var\(--sf-focus-outline-width\) solid currentColor/);
    assert.match(css, /not\(\[aria-disabled="true"\]\)/);
    assert.match(css, /overflow-wrap: anywhere/);
  });
}

test('Smart step status icons and separators are decorative', async () => {
  const template = await read('smart/steps/js/templates/default.js');
  assert.match(template, /class="sf-icon" aria-hidden="true">\$\{iconName\}/);
  assert.match(template, /'sf-steps-separator'/);
  assert.match(template, /aria-hidden="true"[\s\S]*\$\{context.separatorIcon\}/);
});
