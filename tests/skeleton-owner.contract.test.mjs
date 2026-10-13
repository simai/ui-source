import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ordinary Skeleton owns decorative content-matched geometry', async () => {
  const [runtime, docs] = await Promise.all([
    read('src/component/skeleton/js/_skeleton.js'),
    read('src/component/skeleton/docs/docs.md'),
  ]);

  assert.match(runtime, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(runtime, /Math\.min\(20, Math\.max\(1, Math\.trunc\(total\)\)\)/);
  assert.match(docs, /not a progress indicator, an empty state or an error message/);
  assert.match(docs, /aria-busy="true"/);
});

test('ordinary Skeleton uses logical token geometry and semantic paint', async () => {
  const styles = await read('src/component/skeleton/scss/_skeleton.scss');

  assert.match(styles, /block-size: var\(--sf-skeleton-text--height\)/);
  assert.match(styles, /inline-size: var\(--sf-skeleton-text--height\)/);
  assert.match(styles, /border-radius: var\(--sf-radius--ui\)/);
  assert.match(styles, /\.sf-skeleton-rounded[\s\S]*var\(--sf-radius--ui\)/);
  assert.match(styles, /--sf-skeleton-base: var\(--sf-ui-skeleton\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /(?:^|[\s:(])\d+(?:\.\d+)?(?:px|rem)(?:[\s;,)])/m);
});

test('ordinary Skeleton motion is bounded and respects user preference', async () => {
  const styles = await read('src/component/skeleton/scss/_skeleton.scss');

  assert.match(styles, /sf-skeleton--animation-pulse/);
  assert.match(styles, /sf-skeleton--animation-wave/);
  assert.match(styles, /sf-skeleton--animation-none/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /--sf-skeleton-duration: calc\(var\(--sf-duration-slow\) \* 3\)/);
});

test('ordinary and Smart constructors project physical API dimensions logically', async () => {
  const [ordinary, smartTemplate] = await Promise.all([
    read('src/component/skeleton/js/_skeleton.js'),
    read('src/smart/skeleton/js/templates/default.js'),
  ]);

  assert.match(ordinary, /style\.inlineSize/);
  assert.match(ordinary, /style\.blockSize/);
  assert.match(smartTemplate, /'inline-size'/);
  assert.match(smartTemplate, /'block-size'/);
  assert.doesNotMatch(smartTemplate, /\n\s+width:/);
  assert.doesNotMatch(smartTemplate, /\n\s+height:/);
});
