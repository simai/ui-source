import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Material Symbols are served from the local component font asset', async () => {
  const source = await read('src/component/icons/scss/_css__icons.scss');

  assert.match(source, /@font-face\s*\{/);
  assert.match(source, /font-family:\s*'Material Symbols Outlined'/);
  assert.match(source, /url\('\.\.\/fonts\/MaterialSymbols-Outlined\.woff2'\)/);
  assert.doesNotMatch(source, /https?:\/\//);
});
