import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

// Escape over an open dropdown list closed the record panel behind it: the panel,
// the drawer and the modal all listen on the document in capture and stand back
// only while the root says a surface is open, and that mark was written by
// sf-popover alone (Larena storage QA, 2026-10-22). The mark is a protocol, so it
// lives in core and every surface that owns Escape holds it.
test('the open-surface mark is one counted holder in core', async () => {
  const source = await read('src/core/js/open-surface-mark.js');
  assert.ok(source.includes("const OPEN_MARK = 'sfPopoverOpen'"));
  assert.ok(source.includes('export function holdOpenSurfaceMark'));
  assert.ok(source.includes('export function isOpenSurfaceMarked'));
  // A count, so a dropdown inside a popover closing first cannot clear the mark
  // the popover still needs.
  assert.ok(source.includes('Math.max(0, Number(root.dataset[OPEN_MARK] || 0) + delta)'));
  // Idempotent per owner: a component syncs it from its own state on every
  // update and only a change moves the count.
  assert.ok(source.includes('new WeakSet()'));
  assert.ok(source.includes('if (wanted === held.has(owner)) return'));
});

test('sf-popover holds the shared mark and writes no mark of its own', async () => {
  const source = await read('src/smart/popover/index.js');
  assert.ok(source.includes("import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark'"));
  assert.ok(source.includes('holdOpenSurfaceMark(this, true)'));
  assert.ok(source.includes('holdOpenSurfaceMark(this, false)'));
  assert.doesNotMatch(source, /dataset\[OPEN_MARK\]/);
  assert.doesNotMatch(source, /function markOpen/);
});

test('an open dropdown list raises the same mark, and releases it', async () => {
  const base = await read('src/component/dropdown/js/_dropdown.js');
  assert.ok(base.includes("import { holdOpenSurfaceMark } from '../../../core/js/open-surface-mark'"));
  assert.ok(base.includes('holdOpenSurfaceMark(root, true)'));
  assert.ok(base.includes('holdOpenSurfaceMark(root, false)'));
  // The class is the state and a consumer may toggle it directly.
  assert.ok(base.includes('holdOpenSurfaceMark(root, root.classList.contains("sf-dropdown--open"))'));
  // Removed while open, it cannot leave the mark raised for the whole page.
  assert.match(base, /function unbindDropdown\(root\) \{[^}]*holdOpenSurfaceMark\(root, false\)/);

  const smart = await read('src/smart/dropdown/index.js');
  assert.ok(smart.includes("import { holdOpenSurfaceMark } from '../../core/js/open-surface-mark'"));
  assert.ok(smart.includes('holdOpenSurfaceMark(this, this._open)'));
  // Synced on every render, because `_open` is set from several places.
  assert.match(smart, /afterRender\(\)[\s\S]*this\.syncOpenSurfaceMark\(\)/);
  assert.match(smart, /onDisconnected\(\)\s*\{\s*holdOpenSurfaceMark\(this, false\)/);
});

test('the components that own Escape for something larger read the same mark', async () => {
  for (const path of [
    'src/smart/drawer/index.js',
    'src/smart/modal/index.js',
    'src/component/modal/js/_modal.js',
  ]) {
    const source = await read(path);
    assert.match(source, /dataset\?\.sfPopoverOpen/, `${path} must stand back while a surface is open`);
  }
});
