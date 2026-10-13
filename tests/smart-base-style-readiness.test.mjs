import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Smart base retains the style-readiness contract used by released components', async () => {
  const source = await readFile(
    path.join(root, 'src/core/js/smart-base.js'),
    'utf8',
  );

  assert.match(source, /static waitForStylesBeforeRenderReady = true/);
  assert.match(source, /static ensureStyleReadinessCss\(\)/);
  assert.match(source, /this\.constructor\.ensureStyleReadinessCss\(\)/);
  assert.match(source, /this\.markStylePending\(this\)/);
  assert.match(source, /await this\.whenRenderedStylesReady\(this\)/);
  assert.match(source, /markStylePending\(target = this\)/);
  assert.match(source, /markStyleReady\(target = this\)/);
  assert.match(source, /async whenRenderedStylesReady\(target = this\)/);
  assert.match(source, /loader\.ensureStylesReady\(target \|\| this/);
});
