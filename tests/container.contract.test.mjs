import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('adaptive container never becomes wider than its containing block', () => {
  const css = read('src/utility/container/default/scss/_sf_css__container.scss');

  assert.match(css, /\.container\s*\{\s*width:\s*100%;/);
  assert.match(css, /max-width:\s*var\(--sf-breakpoint-#\{\$container-key\}\);/);
  assert.doesNotMatch(css, /^\s*width:\s*var\(--sf-breakpoint-#\{\$container-key\}\);/m);
});
