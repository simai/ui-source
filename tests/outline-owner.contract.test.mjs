import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Outline keeps semantic native navigation and a CSS-only owner boundary', async () => {
  const [rule, source, docs] = await Promise.all([
    read('src/component/outline/rule.js'),
    read('src/component/outline/index.js'),
    read('src/component/outline/docs/docs.md'),
  ]);
  assert.match(rule, /type:\s*'component'/);
  assert.match(rule, /css:\s*true/);
  assert.doesNotMatch(rule, /js:\s*true/);
  assert.doesNotMatch(source, /\.\/js\//);
  assert.match(docs, /aria-current="location"/);
  assert.match(docs, /host application owns that synchronization/i);
});

test('Outline uses Framework roles and reserves stable current geometry', async () => {
  const css = await read('src/component/outline/scss/_outline.scss');
  for (const token of [
    '--sf-text--size',
    '--sf-text--height',
    '--sf-radius--ui',
    '--sf-surface-container-hover',
    '--sf-surface-container-active',
    '--sf-focus--width',
    '--sf-focus--color',
    '--sf-focus-outline-width',
  ]) {
    assert.ok(css.includes(token), token);
  }
  assert.match(css, /border-inline-start:\s*var\(--sf-outline--indicator-width\) solid var\(--sf-transparent\)/);
  assert.match(css, /\[aria-current="location"\][\s\S]*border-inline-start-color:/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /(?:^|[:(,\s])-?\d+(?:\.\d+)?(?:px|rem|em)\b/m);
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right|min-width/);
});

test('Outline preserves only the old custom-state selector as compatibility input', async () => {
  const [css, docs] = await Promise.all([
    read('src/component/outline/scss/_outline.scss'),
    read('src/component/outline/docs/docs.md'),
  ]);
  assert.match(css, /data-sf-outline-active/);
  assert.match(docs, /compatibility selector/i);
  assert.match(docs, /New markup should\s+prefer the native `aria-current="location"` state/i);
});
