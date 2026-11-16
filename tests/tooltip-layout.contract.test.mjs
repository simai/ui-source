/* global URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css = await readFile(new URL('../src/component/tooltip/scss/_css__tooltip_custom.scss', import.meta.url), 'utf8');
test('Tooltip retains intrinsic sizing with a containing-block bound', () => {
  assert.match(css, /inline-size: fit-content;\s*max-inline-size: 100%;\s*min-inline-size: 0;/);
  assert.match(css, /\.sf-tooltip-supporting-text\s*\{[^}]*overflow-wrap: anywhere;/);
  // At most two lines (owner decision C160 (2)), the whole tooltip's: the
  // cuts are the text's and the supporting text's line clamps -- two lines
  // alone, one each together (component.tooltip 1.6.0); nothing else clips
  // and nothing ends in an ellipsis.
  const clamp = css.match(/\.sf-tooltip-text:not\(:has\(> \.sf-tooltip-shortcut\)\)\s*\{[^}]*\}/u)?.[0] || '';
  assert.match(clamp, /-webkit-line-clamp: 2;/);
  assert.match(clamp, /overflow: hidden;/);
  const supporting = css.match(/\.sf-tooltip \.sf-tooltip-supporting-text\s*\{[^}]*line-clamp[^}]*\}/u)?.[0] || '';
  assert.match(supporting, /-webkit-line-clamp: 2;/);
  assert.match(supporting, /overflow: hidden;/);
  const together = css.match(/\.sf-tooltip \.sf-tooltip-text:has\(\+ \.sf-tooltip-supporting-text\)[^{]*\{[^}]*\}/u)?.[0] || '';
  assert.match(together, /\.sf-tooltip-text \+ \.sf-tooltip-supporting-text/);
  assert.match(together, /-webkit-line-clamp: 1;/);
  assert.doesNotMatch(css.replace(clamp, '').replace(supporting, ''), /overflow:\s*(hidden|clip)|text-overflow:\s*ellipsis/);
});

test('Every tooltip carries the window shadow, and a tail keeps its point clear of the trigger', async () => {
  const look = await readFile(new URL('../src/component/tooltip/scss/_css__tooltip.scss', import.meta.url), 'utf8');
  // C20, C59: the dark tooltip (the default) too, not the light one alone.
  assert.match(look, /\n\.sf-tooltip \{\s*filter: var\(--sf-shadow-overlay-filter\);/u);
  assert.doesNotMatch(look, /\.sf-tooltip\.sf-tooltip--light \{\s*filter/u);
  // The turned tail reaches half its diagonal; the gap is that plus 1/4.
  assert.match(css, /--sf-tooltip--tail-gap: calc\(var\(--sf-tooltip-tail-half\) \* 1\.4142 \+ var\(--sf-space-1\\\/4\)\);/u);
  assert.doesNotMatch(css, /calc\(100% \+ var\(--sf-tooltip-tail-half\)\)/u);
});
test('Tooltip arrow geometry remains token-owned and direction-aware', () => {
  assert.match(css, /--sf-tooltip-tail-size: var\(--sf-b2\)/);
  assert.match(css, /\.sf-tooltip--arrow-inline-start/);
  assert.match(css, /\.sf-tooltip--arrow-inline-end/);
});
