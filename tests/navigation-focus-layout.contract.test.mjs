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
    // A step stands at --sf-focus--offset (C212); a crumb is a link and keeps
    // two pixels (C186 (4), the named exception, dispatcher 2026-11-18).
    assert.match(css, owner === 'step' ? /outline-offset: var\(--sf-focus--offset\)/ : /outline-offset: var\(--sf-a2\)/);
    assert.doesNotMatch(css, /--sf-ui-focus\b/);
    assert.match(css, /@media \(forced-colors: active\)/);
    assert.match(css, /outline: var\(--sf-focus--width\) solid currentColor/);
    assert.match(css, /not\(\[aria-disabled="true"\]\)/);
    // A step label breaks between words only (sf-steps 1.3.0, R185 ST-1);
    // a breadcrumb may still break anywhere.
    assert.match(css, owner === 'step' ? /overflow-wrap: normal/ : /overflow-wrap: anywhere/);
  });
}

test('Smart step markers are decorative and there is no separator glyph (sf-steps 1.4.0, C101)', async () => {
  const template = await read('smart/steps/js/templates/default.js');
  assert.match(template, /<span class="sf-step-marker" aria-hidden="true">/);
  assert.doesNotMatch(template, /sf-steps-separator/);
  assert.doesNotMatch(template, /separatorIcon/);
  // The state is said in words, for a screen reader, in every item.
  assert.match(template, /<span class="sr-only">, \$\{word\}<\/span>/);
});
