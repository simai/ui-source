import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishes generic documentation primitives without a product namespace', async () => {
  const [menu, highlight, highlightRuntime, kbd, outline, breadcrumbs, radio] = await Promise.all([
    read('src/component/menu/scss/_css__menu.scss'),
    read('src/component/highlight/scss/_default.scss'),
    read('src/component/highlight/js/index.js'),
    read('src/component/kbd/scss/_kbd.scss'),
    read('src/component/outline/scss/_outline.scss'),
    read('src/component/breadcrumbs/scss/_css__breadcrumbs.scss'),
    read('src/component/radio/scss/_css_radio.scss'),
  ]);

  assert.match(menu, /\.sf-menu\.sf-menu--documentation-tree/);
  assert.match(highlight, /\.sf-code-surface/);
  assert.match(highlightRuntime, /dataset\.lineNumbers === 'true'/);
  assert.match(highlightRuntime, /languageAliases/);
  assert.match(highlightRuntime, /registerAliases/);
  assert.doesNotMatch(highlightRuntime, /highlight\.js/);
  assert.match(kbd, /\.sf-kbd/);
  assert.match(outline, /\.sf-outline__link\[aria-current="location"\]/);
  assert.match(breadcrumbs, /overscroll-behavior-inline: contain/);
  assert.match(radio, /:focus-visible/);
  for (const source of [menu, highlight, kbd, outline]) {
    assert.doesNotMatch(source, /docara/i);
  }
});
