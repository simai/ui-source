import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A Smart host carries an inline `display: contents`, which outranks the user
// agent's [hidden] rule, so `hidden` on a Smart element did nothing. The base
// layer restores it with the one declaration that outranks a normal inline one.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('the base preset makes hidden hide even over an inline display', () => {
  const source = read('src/core/scss/_sf_css__preset.scss');
  const match = source.match(/\[hidden\]:not\(\[hidden="until-found"\]\)\s*\{([^}]*)\}/u);
  assert.ok(match, 'the hidden rule is declared');
  assert.match(match[1], /display:\s*none\s*!important/u);
});

test('Smart hosts still set display: contents inline, which is why the rule is important', () => {
  assert.match(read('src/core/js/smart-base.js'), /display: contents;/u);
});
