import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const sizeTokens = ['h5', 'h6', 'h8', 'i0', 'i1', 'i2', 'i3', 'i4'];

test('max-container roles resolve through the Framework size system', async () => {
  const variables = await read('src/core/scss/vars/_sf_var__max_container.scss');

  for (const [index, sizeToken] of sizeTokens.entries()) {
    assert.match(
      variables,
      new RegExp(`'${index + 1}': '${sizeToken}'`),
      `max-container-${index + 1} must resolve to --sf-${sizeToken}`,
    );
  }

  assert.doesNotMatch(variables, /(?:px|rem)/);
});

test('max-container makes the nested container fluid up to its token maximum', async () => {
  const styles = await read('src/utility/max-container/default/scss/_sf_css__container.scss');

  assert.match(
    styles,
    /\.max-container-#\{\$m-container-var\} \.container \{\s+width: 100%;\s+\}/s,
  );
  assert.match(
    styles,
    /@include breakpoint-device-media\(\$breakpoint\).*\.max-container-#\{\$m-container-var\} \.container \{\s+max-width: var\(--sf-container-#\{\$m-container-value\}--size-max\);/s,
  );
  assert.doesNotMatch(styles, /(?:\d+(?:\.\d+)?)(?:px|rem)/);
});
