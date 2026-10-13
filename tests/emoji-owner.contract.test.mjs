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

test('Emoji owns stable token-backed inline geometry', async () => {
  const css = await read('src/component/emoji/scss/_css_emoji.scss');

  assert.match(css, /--sf-emoji--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-emoji--line-height: var\(--sf-text-height-1\)/);
  assert.match(css, /display: inline-flex/);
  assert.match(css, /flex: none/);
  assert.match(css, /block-size: var\(--sf-emoji--line-height\)/);
  assert.match(css, /inline-size: var\(--sf-emoji--line-height\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('Emoji publishes one closed typography size scale', async () => {
  const css = await read('src/component/emoji/scss/_css_emoji.scss');

  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(css.includes(`sf-emoji--size-${size}`));
  }
});

test('Emoji constructor supports meaningful and decorative semantics', async () => {
  const js = await read('src/component/emoji/js/_emoji.js');
  const rule = await read('src/component/emoji/rule.js');

  assert.match(js, /size = '1'/);
  assert.match(js, /decorative = false/);
  assert.match(js, /getAttribute\('aria-hidden'\) === 'true'/);
  assert.match(js, /getAttribute\('aria-labelledby'\)/);
  assert.match(js, /setAttribute\('role', 'img'\)/);
  assert.match(js, /removeAttribute\('role'\)/);
  assert.match(rule, /\(\?:\^\|\["'/);
});

test('Emoji documentation covers meaning, decoration and every size', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, semantics, sizes] = await Promise.all([
    readUiDoc('content/ru/components/content/emoji.md'),
    readUiDoc('examples/components/emoji/overview/index.html'),
    readUiDoc('examples/components/emoji/semantics/index.html'),
    readUiDoc('examples/components/emoji/sizes/index.html'),
  ]);

  assert.match(page, /emoji берёт ступень `1`, как обычный текст/);
  assert.match(page, /`1\/3`, `1\/2`, `1`, `2` и `3`/);
  // Every emoji is either a named image or hidden as decoration.
  assert.match(overview, /class="sf-emoji[^"]*" (?:role="img" aria-label="[^"]+"|aria-hidden="true")/);
  assert.match(semantics, /role="img" aria-label=/);
  assert.match(semantics, /aria-hidden="true"/);
  for (const size of ['1/3', '1/2', '1', '2', '3']) {
    assert.ok(sizes.includes(`sf-emoji--size-${size}`));
  }
  assert.doesNotMatch(`${overview}${semantics}${sizes}`, /style=/);
});
