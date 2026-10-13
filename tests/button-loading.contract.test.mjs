import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const css = (await readFile(new URL('../src/component/buttons/scss/_css__buttons_custom.scss', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');

/* The stripes repeat every --sf-space-1 across their own axis at 135deg, which
   is that times the square root of two along x. A loop that travels any other
   distance ends on a different picture than it starts, and the pattern jumps
   back once per cycle: measured, a mean pixel difference of 65 between the end
   and the start of a loop before, under 1 after. */
test('button loading: one loop travels exactly one period of the stripes', () => {
  assert.match(css, /repeating-linear-gradient\(\s*135deg,/);
  assert.match(css, /transparent var\(--sf-space-1\)\s*\)/, 'the pattern period is --sf-space-1');
  assert.match(css, /to\s*\{\s*transform: translateX\(calc\(var\(--sf-space-1\) \* 1\.41421356\)\);\s*\}/);
});

/* A loading button is disabled, so every emphasis wears the same disabled fill
   while it works. Stripes coloured for the enabled fill -- near-opaque primary
   over a grey disabled button -- were the high-contrast bars. One neutral alpha
   step, no per-variant colour. */
test('button loading: the stripes are one neutral alpha step for every emphasis', () => {
  assert.match(css, /--sf-button-loading-stripe: var\(--sf-alpha-\d+\);/);
  assert.doesNotMatch(css, /--sf-button-loading-stripe-[12]/, 'no per-variant stripe colours');
  assert.doesNotMatch(css, /loading-stripe[^;]*(primary|secondary|on-surface)/);
});
