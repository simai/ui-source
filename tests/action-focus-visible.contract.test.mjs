import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

for (const [component, file, selector] of [
  ['icon-buttons', '_css_icon_buttons.scss', 'sf-icon-button'],
  ['fab', '_css_fab.scss', 'sf-fab'],
]) {
  test(`${component}: pointer focus does not activate keyboard treatment`, async () => {
    const styles = await readFile(new URL(
      `../src/component/${component}/scss/${file}`, import.meta.url,
    ), 'utf8');
    assert.match(styles, new RegExp(
      `\\.${selector}:not\\(:disabled\\):not\\(\\.disabled\\):focus-visible\\s*\\{\\s*outline: var\\(--sf-focus--width\\) var\\(--sf-focus--style\\) var\\(--sf-focus--color\\);\\s*outline-offset: var\\(--sf-focus--offset\\)`,
    ));
    // The ring is an outline, so it never travels through the shadow property.
    assert.doesNotMatch(styles, /--sf-ui-focus/);
    // Includes variant backgrounds, not only the final focus shadow rule.
    assert.doesNotMatch(styles, /:focus(?![\w-])/);
    // Retain the native high-contrast indicator; do not suppress focus globally.
    assert.doesNotMatch(styles, /outline:\s*(?:none|0)(?:\s|;)/);
    assert.match(styles, /@media\s*\(forced-colors:\s*active\)/);
    assert.match(styles, /outline:\s*var\(--sf-focus-outline-width\) solid currentColor/);
    assert.match(styles, /outline-offset:\s*calc\(var\(--sf-focus-outline-width\) \* -1\)/);
  });
}

test('joined icon buttons keep the focus indicator inside each segment', async () => {
  const styles = await readFile(new URL(
    '../src/component/icon-buttons/scss/_css_icon_buttons.scss', import.meta.url,
  ), 'utf8');
  // Flush against its neighbours, the same ring turns inwards.
  assert.match(styles, /outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  for (const position of ['start', 'middle', 'end']) {
    assert.match(styles, new RegExp(
      `\\.sf-icon-button\\.segment-${position}:not\\(:disabled\\):not\\(\\.disabled\\):focus-visible`,
    ));
  }
});
