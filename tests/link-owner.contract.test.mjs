import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Link has a bounded CSS-only Loader rule and complete root geometry', async () => {
  const [rule, css] = await Promise.all([
    read('src/component/link/rule.js'),
    read('src/component/link/scss/_css__link.scss'),
  ]);

  assert.match(rule, /\\bsf-link\\b/);
  assert.match(rule, /css:\s*true/);
  assert.match(rule, /js:\s*false/);
  assert.match(css, /\.sf-link\s*\{[\s\S]*display:\s*inline-flex/);
  assert.match(css, /max-inline-size:\s*100%/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('Link preserves semantic state colors through canonical and legacy content', async () => {
  const css = await read('src/component/link/scss/_css__link.scss');

  for (const token of [
    '--sf-link',
    '--sf-link-hover',
    '--sf-link-active',
    '--sf-link-visited',
    '--sf-on-disable',
  ]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  assert.match(css, /:where\(\.sf-link__content, \.sf-link-content\)/);
  assert.match(css, /:where\(\.sf-link__icon, \.sf-link-icon\)/);
  assert.match(css, /color:\s*inherit/);
});

test('Link uses keyboard-visible focus without pointer-only residue', async () => {
  const css = await read('src/component/link/scss/_css__link.scss');

  assert.match(css, /\.sf-link:focus\s*\{[\s\S]*outline:\s*none/);
  assert.match(css, /\.sf-link:focus-visible\s*\{[\s\S]*--sf-focus/);
  assert.match(css, /@media \(forced-colors:\s*active\)/);
  assert.doesNotMatch(css, /pointer-events:\s*none/);
});

test('Link documentation distinguishes navigation, actions and disabled destinations', async () => {
  const docs = await read('src/component/link/docs/docs.md');

  for (const phrase of ['нативную ссылку', 'Button', 'sf-link__content', 'Удалите `href`']) {
    assert.match(docs, new RegExp(phrase));
  }
});
