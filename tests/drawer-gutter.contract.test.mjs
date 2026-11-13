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
  // C105 H6 (spacing audit D2): the window inset --sf-space-2 from the outer
  // edge, the panel's edge counted inside it, no stable scrollbar gutter.
  assert.match(styles, /--sf-drawer--inset: var\(--sf-drawer-gutter, var\(--sf-space-2\)\);/);
  assert.match(styles, /--sf-drawer--inset-start: calc\(var\(--sf-drawer--inset\) - var\(--sf-drawer--edge-start\)\);/);
  assert.equal((styles.match(/padding-inline: var\(--sf-drawer--inset-start\) var\(--sf-drawer--inset-end\);/g) || []).length, 2);
  assert.doesNotMatch(styles, /scrollbar-gutter: stable/);
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /gutter: \{default: ''\}/);
  // The property is the manifest's (standard 1.3.8 §4).
  assert.equal(JSON.parse(await read('src/smart/drawer/component.json')).settings.gutter.default, '');
  assert.match(source, /--sf-drawer-gutter:\$\{context\.gutter\};/);
  const manifest = JSON.parse(await read('src/smart/drawer/smart.manifest.json'));
  assert.equal(manifest.inputs.properties.gutter.default, '');
});
