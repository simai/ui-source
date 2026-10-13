import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Placeholder is a CSS-only empty-state owner, distinct from loading', async () => {
  const [rule, docs] = await Promise.all([
    read('src/component/placeholder/rule.js'),
    read('src/component/placeholder/docs/docs.md'),
  ]);
  assert.match(rule, /css:\s*true/);
  assert.match(rule, /js:\s*false/);
  assert.match(docs, /empty-state composition/i);
  assert.match(docs, /Skeleton or Spinner/i);
  assert.match(docs, /aria-labelledby/);
});

test('Placeholder owns intrinsic layouts and explicit BEM anatomy', async () => {
  const css = await read('src/component/placeholder/scss/_css__placeholder.scss');
  for (const selector of ['__visual', '__content', '__header', '__title', '__description', '__actions', '--column', '--row']) {
    assert.ok(css.includes(`sf-placeholder${selector}`), selector);
  }
  assert.match(css, /\.sf-placeholder\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.sf-placeholder--row\s*\{[\s\S]*flex-flow:\s*row wrap/);
  assert.match(css, /min-inline-size:\s*var\(--sf-0\)/);
  assert.match(css, /max-inline-size:\s*100%/);
});

test('Placeholder typography and geometry use high-level Framework tokens', async () => {
  const css = await read('src/component/placeholder/scss/_css__placeholder.scss');
  for (const token of ['--sf-text--size', '--sf-text--height', '--sf-heading--family', '--sf-heading--weight', '--sf-on-surface', '--sf-on-surface-variant', '--sf-space-1', '--sf-space-1\\/3', '--sf-space-1\\/2']) {
    assert.ok(css.includes(token), token);
  }
  assert.doesNotMatch(css, /(?:^|[:(,\s])-?\d+(?:\.\d+)?(?:px|rem|em)\b/m);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\brgba?\(/i);
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right|min-width|max-width/);
});

test('Placeholder retains legacy anatomy without making it canonical', async () => {
  const [css, docs] = await Promise.all([
    read('src/component/placeholder/scss/_css__placeholder.scss'),
    read('src/component/placeholder/docs/docs.md'),
  ]);
  for (const alias of ['sf-placeholder-right', 'sf-placeholder-top', 'sf-placeholder-top-text']) {
    assert.ok(css.includes(alias), alias);
    assert.ok(docs.includes(alias), alias);
  }
  for (const property of ['--sf-placeholder-right--gap', '--sf-placeholder-top--gap', '--sf-placeholder-top-text--font-size']) {
    assert.ok(css.includes(property), property);
  }
  assert.match(docs, /New markup should use the explicit BEM elements/i);
});
