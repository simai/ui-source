/* global URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css = await readFile(new URL('../src/component/tooltip/scss/_css__tooltip_custom.scss', import.meta.url), 'utf8');
test('Tooltip retains intrinsic sizing with a containing-block bound', () => {
  assert.match(css, /inline-size: fit-content;\s*max-inline-size: 100%;\s*min-inline-size: 0;/);
  assert.match(css, /\.sf-tooltip-supporting-text\s*\{[^}]*overflow-wrap: anywhere;/);
  // At most two lines (owner decision C160 (2)): the one cut is the text's
  // line clamp; nothing else clips and nothing ends in an ellipsis.
  const clamp = css.match(/\.sf-tooltip-text:not\(:has\(> \.sf-tooltip-shortcut\)\)\s*\{[^}]*\}/u)?.[0] || '';
  assert.match(clamp, /-webkit-line-clamp: 2;/);
  assert.match(clamp, /overflow: hidden;/);
  assert.doesNotMatch(css.replace(clamp, ''), /overflow:\s*(hidden|clip)|text-overflow:\s*ellipsis/);
});
test('Tooltip arrow geometry remains token-owned and direction-aware', () => {
  assert.match(css, /--sf-tooltip-tail-size: var\(--sf-b2\)/);
  assert.match(css, /\.sf-tooltip--arrow-inline-start/);
  assert.match(css, /\.sf-tooltip--arrow-inline-end/);
});
