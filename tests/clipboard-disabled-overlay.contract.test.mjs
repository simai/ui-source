import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// The copy button, owner remarks 2026-11-15 (component.clipboard 1.2.0,
// component.buttons 1.15.0, component.icon-buttons 1.10.0). The browser half is
// tests/browser/clipboard-disabled-overlay.browser.mjs.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const copy = await read('src/component/clipboard/scss/_sf_copy.scss');
const rules = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '');

test('a disabled copy button reads as disabled, not busy: no opacity, no wait cursor, the disabled ink', () => {
  const sheet = rules(copy);
  assert.doesNotMatch(sheet, /cursor:\s*wait/u);
  assert.doesNotMatch(sheet, /opacity:\s*var\(--sf-opacity/u);
  assert.match(sheet, /:is\(\[aria-disabled='true'\], :disabled\) \{\s*cursor: default;\s*pointer-events: none;/u);
  assert.match(sheet, /--sf-icon--color: var\(--sf-on-surface-disabled\);/u);
});

test('every hover and press rule of the copy surface skips a disabled one', () => {
  const sheet = rules(copy);
  const states = sheet.match(/[^{}]*:(?:hover|active)\s*\{/gu) ?? [];
  assert.ok(states.length >= 2, 'a hover and a press rule');
  for (const selector of states) assert.match(selector, /:not\(:disabled, \[aria-disabled='true'\]\)/u, selector.trim());
});

test('the overlay stands on the first line through --sf-clipboard-overlay-inset', () => {
  const sheet = rules(copy);
  assert.match(sheet, /--sf-clipboard--overlay-inset: var\(--sf-clipboard-overlay-inset, var\(--sf-space-2\)\);/u);
  assert.match(sheet, /inset-block-start: calc\(var\(--sf-clipboard--overlay-inset\) \+ \(1lh - var\(--sf-clipboard--overlay-box\)\) \/ 2\);/u);
  assert.match(sheet, /inset-inline-end: calc\(var\(--sf-clipboard--overlay-inset\) - \(var\(--sf-clipboard--overlay-box\) - var\(--sf-clipboard--overlay-glyph\)\) \/ 2\);/u);
  assert.doesNotMatch(sheet, /inset-(?:block-start|inline-end): var\(--sf-space-1\\\/4\)/u);
});

test('sf-button and sf-icon-button treat aria-disabled="true" as disabled in every state rule', async () => {
  for (const path of ['src/component/buttons/scss/_css__buttons.scss', 'src/component/buttons/scss/_css__buttons_custom.scss',
    'src/component/icon-buttons/scss/_css_icon_buttons.scss', 'src/component/icon-buttons/scss/_css_icon_buttons_custom.scss']) {
    const sheet = rules(await read(path));
    // A state guard without aria-disabled is left only before :focus-visible:
    // an aria-disabled button keeps its focus and its ring.
    assert.doesNotMatch(sheet, /:not\(:disabled\):not\(\.disabled\)(?!:focus-visible)/u, path);
    // The disabled look reads aria-disabled beside :disabled.
    assert.doesNotMatch(sheet, /(?<!\(|, ):disabled:not\(\.sf-(?:icon-)?button-state-loading/u, path);
    assert.doesNotMatch(sheet, /:is\(:disabled:not\(\.sf-(?:icon-)?button-state-loading:not\(\.disabled\)\), \.disabled\)/u, path);
  }
  assert.match(await read('src/component/buttons/scss/_css__buttons_custom.scss'), /\.sf-button\[aria-disabled="true"\] \{\s*cursor: default;/u);
  assert.match(await read('src/component/icon-buttons/scss/_css_icon_buttons_custom.scss'), /\.sf-icon-button\[aria-disabled="true"\] \{\s*cursor: default;/u);
});
