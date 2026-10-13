import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Dot owns visible inline geometry without utility classes', async () => {
  const css = await read('src/component/dot/scss/_css_dot.scss');

  assert.match(css, /display: inline-flex/);
  assert.match(css, /display: block/);
  assert.match(css, /flex: 0 0 auto/);
  assert.match(css, /--sf-dot-item--size: var\(--sf-a8\)/);
  assert.match(css, /block-size: var\(--sf-dot-item--height, var\(--sf-dot-item--size\)\)/);
  assert.match(css, /inline-size: var\(--sf-dot-item--width, var\(--sf-dot-item--size\)\)/);
  assert.doesNotMatch(css, /utility-hint/);
});

test('Dot publishes a closed semantic size and tone matrix', async () => {
  const css = await read('src/component/dot/scss/_css_dot.scss');

  for (const size of ['1\\/3', '1\\/2', '1', '2']) {
    assert.ok(css.includes(`sf-dot--size-${size}`));
  }
  for (const [tone, token] of [
    ['primary', 'primary'],
    ['info', 'info'],
    ['success', 'success'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['neutral', 'on-surface-variant'],
  ]) {
    assert.match(css, new RegExp(`sf-dot\\.sf-dot--${tone}[\\s\\S]*var\\(--sf-${token}\\)`));
  }
  assert.match(css, /--sf-radius-circle/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('Dot Loader rule is bounded and CSS-only', async () => {
  const rule = await read('src/component/dot/rule.js');

  assert.match(rule, /\(\?:\^\|\["'/);
  assert.match(rule, /sf-dot/);
  assert.match(rule, /css: true/);
  assert.match(rule, /js: false/);
});

test('Dot documentation covers size, tone and accessible naming', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, basic, sizes, tones, label] = await Promise.all([
    readUiDoc('content/ru/components/feedback/dot.md'),
    readUiDoc('examples/components/dot/basic/index.html'),
    readUiDoc('examples/components/dot/overview/index.html'),
    readUiDoc('examples/components/dot/tones/index.html'),
    readUiDoc('examples/components/dot/label/index.html'),
  ]);

  assert.match(page, /неинтерактивный индикатор/);
  assert.match(page, /`sf-dot--size-1\/3`, `sf-dot--size-1\/2`, `sf-dot--size-1` и\s+`sf-dot--size-2`/);
  // A dot beside a visible label is hidden; a dot without one is a named image.
  assert.match(basic, /<span class="sf-dot [^"]*" aria-hidden="true">[\s\S]*Сервис доступен/);
  assert.match(label, /class="sf-dot [^"]*" role="img" aria-label="[^"]+"><span class="sf-dot-item" aria-hidden="true">/);
  assert.match(sizes, /sf-dot--size-1\/3/);
  assert.match(sizes, /sf-dot--size-2/);
  for (const tone of ['info', 'success', 'warning', 'error', 'neutral']) {
    assert.match(tones, new RegExp(`sf-dot--${tone}`));
  }
  assert.doesNotMatch(`${basic}${sizes}${tones}${label}`, /style=/);
});
