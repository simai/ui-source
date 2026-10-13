import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesUrl = new URL(
  '../src/component/buttons/scss/_css__buttons.scss',
  import.meta.url,
);

test('buttons expose their focus treatment only for keyboard-visible focus', async () => {
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(
    styles,
    /\.sf-button:not\(:disabled\):not\(\.disabled\):focus-visible\s*\{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);\s*outline-offset: var\(--sf-focus--offset\)/,
  );
  // The elevation shadow stays the button's own; the ring does not borrow it.
  assert.doesNotMatch(styles, /--sf-ui-focus/);
  assert.doesNotMatch(
    styles,
    /\.sf-button:not\(:disabled\):not\(\.disabled\):focus\s*\{\s*--sf-button--box-shadow:/,
  );
  assert.doesNotMatch(
    styles,
    /\.sf-button\.sf-button--(?:outline|link)[^\n]+:focus(?:,|\s*\{)/,
  );
});
