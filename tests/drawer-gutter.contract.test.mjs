import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* The drawer's head and body share one inline gutter, so a title and the
   content start on one axis. A property view inset its own content inside the
   body and put its title, control row and field labels on three axes (13, 37
   and 62px at 390). tests/browser/drawer-gutter.browser.mjs measures it. */
test('drawer gutter: one gutter for head and body, declared', async () => {
  const styles = await read('src/smart/drawer/scss/_smart__drawer.scss');
  assert.match(styles, /padding: var\(--sf-space-1\) var\(--sf-drawer-gutter, var\(--sf-space-1\)\) var\(--sf-space-1\\\/2\);/);
  assert.match(styles, /padding: var\(--sf-space-1\\\/2\) var\(--sf-drawer-gutter, var\(--sf-space-1\)\) var\(--sf-space-3\);/);
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /gutter: \{default: ''\}/);
  assert.match(source, /get gutter\(\) \{/);
  assert.match(source, /--sf-drawer-gutter:\$\{context\.gutter\};/);
  const manifest = JSON.parse(await read('src/smart/drawer/smart.manifest.json'));
  assert.equal(manifest.inputs.properties.gutter.default, '');
});
