import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* Two drawers open at one edge used to lie exactly on top of each other, so
   the one below was hidden. stack-offset (default empty: flush, as before)
   lets each drawer below show past the one above by that length; the drawer
   counts its depth itself from the open, undocked drawers at the same edge. */
test('drawer stack: a declared offset, applied per depth at one edge', async () => {
  const source = await read('src/smart/drawer/index.js');
  assert.match(source, /stackOffset: \{attribute: 'stack-offset', default: ''\}/);
  assert.match(source, /get stackOffset\(\) \{/);
  assert.match(source, /drawer\.openState && !drawer\.docked && drawer\.stackEdge === edge/);
  assert.match(source, /root\.style\.setProperty\('--sf-drawer-stack-depth', String\(depth\)\)/);
  const styles = await read('src/smart/drawer/scss/_smart__drawer.scss');
  assert.match(styles, /@property --sf-drawer-stack-offset \{\n {2}syntax: "<length>";/);
  for (const side of ['left', 'right', 'inset-inline-start', 'inset-inline-end']) {
    assert.ok(styles.includes(`    ${side}: var(--sf-drawer-stack-inset);`), side);
  }
  // A drawer at an inline edge opens on screen in a right-to-left page: the
  // closed transform must not outrank .is-open there.
  for (const side of ['inline-start', 'inline-end']) {
    assert.ok(styles.includes(`.sf-drawer:not(.is-open)[data-sf-drawer-placement='${side}']:dir(rtl) .sf-drawer-panel {`), side);
  }
  const manifest = JSON.parse(await read('src/smart/drawer/smart.manifest.json'));
  assert.equal(manifest.inputs.properties['stack-offset'].default, '');
  const upload = JSON.parse(await read('src/smart/file-upload/smart.manifest.json'));
  assert.equal(upload.inputs.properties.formats.default, '', 'a file control names no formats it cannot know');
  assert.ok((await read('docs/developer/smart-component-authoring.md')).includes('instanceof File'));
});
