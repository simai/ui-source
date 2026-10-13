import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Kbd is a CSS-only semantic primitive with a neutral chord group', async () => {
  const [rule, css] = await Promise.all([
    read('src/component/kbd/rule.js'),
    read('src/component/kbd/scss/_kbd.scss'),
  ]);

  assert.match(rule, /<kbd\\b/);
  assert.match(rule, /\\bsf-kbd\\b/);
  assert.match(rule, /css:\s*true/);
  assert.match(rule, /js:\s*false/);
  assert.match(css, /:where\(kbd:not\(\.sf-kbd--group\), \.sf-kbd:not\(\.sf-kbd--group\)\)/);
  assert.match(css, /kbd:has\(> kbd\),\s*\n\s*\.sf-kbd--group/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.doesNotMatch(css, /cursor:\s*pointer/);
  assert.doesNotMatch(css, /:focus/);
});

test('Kbd presentation is composed only from semantic Framework tokens', async () => {
  const css = await read('src/component/kbd/scss/_kbd.scss');

  for (const token of [
    '--sf-text-size-1\\/3',
    '--sf-text-height-1\\/3',
    '--sf-radius--ui',
    '--sf-space-1\\/4',
    '--sf-space-1\\/2',
    '--sf-surface-container',
    '--sf-outline-variant',
    '--sf-on-surface',
    '--sf-mono',
  ]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }

  assert.doesNotMatch(css, /(?:^|[\s:(])-?\d*\.?\d+(?:px|rem|em)\b/m);
});

test('Kbd owner documentation covers every semantic scenario', async (context) => {
  let docs;
  try {
    docs = await read('src/component/kbd/docs/docs.md');
  } catch {
    context.skip('owner documentation is not present in this projection');
    return;
  }

  for (const phrase of ['Одна клавиша', 'Сочетание', 'Последовательность', 'sf-kbd--group']) {
    assert.match(docs, new RegExp(phrase));
  }
});
