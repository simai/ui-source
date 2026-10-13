import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const source = async (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('core exposes one token-based focus geometry for joined surfaces', async () => {
  const styles = await source('src/core/scss/_sf_css__border.scss');

  assert.match(
    styles,
    /--sf-ui-focus-inset:\s*inset 0 0 0 var\(--sf-focus-outline-width\) var\(--sf-focus\)/,
  );
});
