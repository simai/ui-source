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
  assert.ok(source.includes("import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark'"));
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

// The drawer and the modal stood back on the mark alone, so a modal opened from
// a drawer lost Escape to the drawer (simai/ui-source#36). They are layers of
// the one document stack now, as every surface is: the stack hands Escape and
// Tab to the top layer only, and nothing listens on the document for them.
test('the components that own Escape for something larger take it from the one layer stack', async () => {
  for (const path of [
    'src/smart/drawer/index.js',
    'src/smart/modal/index.js',
    'src/component/modal/js/_modal.js',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /document\.addEventListener\(['"]keydown['"], this\.onKeyDown/, `${path} must not hear Escape on its own`);
  }
  assert.match(await read('src/smart/drawer/index.js'), /onEscape: \(event\) => drawer\.onKeyDown\(event\)/);
  assert.match(await read('src/component/modal/js/_stack.js'), /onEscape: \(event\) => Boolean\(modal\.onKeyDown\?\.\(event\)\)/);
});

// Escape over an open sf-datepicker calendar closed the record panel it sat in,
// and the typed date with it (Larena admin acceptance, 2026-10-22): the calendar
// listened in the bubble phase and raised no mark. Every surface that owns Escape
// holds the mark, and the ones that listen on the document in capture act only
// as the innermost open layer, because stopPropagation cannot settle two
// listeners on the same node.
test('the holders are kept in the order they opened, and the innermost is known', async () => {
  const source = await read('src/core/js/open-surface-mark.js');
  assert.ok(source.includes('export function isTopOpenSurface'));
  // The holders are layers of the one document stack, under and over a modal
  // or a drawer alike.
  assert.ok(source.includes("openLayer(owner, {kind: 'surface'})"));
  assert.ok(source.includes('closeLayer(owner, {restoreFocus: false})'));
  assert.ok(source.includes('if (!isTopLayer(owner)) return false;'));
  // A holder only an older pair's bundle registered still stands above.
  assert.ok(source.includes('return layer === owner || hasLayer(layer);'));
  // The list a bundle of an older pair reads is kept in step.
  assert.ok(source.includes('layers.push(owner)'));
  assert.ok(source.includes('layers.splice(at, 1)'));
  assert.ok(source.includes("Symbol.for('sf.openSurfaceLayers')"));
  const stack = await read('src/core/js/layer-stack.js');
  // A holder that left the document cannot hold every Escape on the page.
  assert.ok(stack.includes('entry?.owner?.isConnected !== false'));
  // Shared across bundles: each Smart bundle carries its own copy of the module.
  assert.ok(stack.includes("Symbol.for('sf.layerStack')"));
});

test('an open calendar holds the mark and takes Escape in capture as the innermost layer', async () => {
  const source = await read('src/smart/datepicker/index.js');
  assert.ok(source.includes("import {holdOpenSurfaceMark, isTopOpenSurface} from '../../core/js/open-surface-mark'"));
  assert.ok(source.includes('holdOpenSurfaceMark(this, open)'));
  assert.ok(source.includes('holdOpenSurfaceMark(this, false)'));
  assert.ok(source.includes("document.addEventListener('keydown', this._documentKeydownHandler, true)"));
  assert.ok(source.includes("document.removeEventListener('keydown', this._documentKeydownHandler, true)"));
  assert.match(source, /handleDocumentKeydown\(event\) \{[\s\S]*?isTopOpenSurface\(this\)[\s\S]*?event\.stopPropagation\(\);[\s\S]*?this\.closePanel\(\{restoreFocus: true\}\)/);
});

test('the capture-phase surfaces act only as the innermost layer', async () => {
  for (const path of ['src/smart/popover/index.js', 'src/smart/help-mark/index.js']) {
    const source = await read(path);
    assert.match(source, /isTopOpenSurface\(this\)/, `${path} must stand back for a layer opened inside it`);
  }
});

test('the other surfaces that own Escape hold the mark too', async () => {
  for (const [path, held, released] of [
    ['src/smart/context-menu/index.js', 'holdOpenSurfaceMark(this, true)', 'holdOpenSurfaceMark(this, false)'],
    ['src/smart/profile-picker/index.js', 'holdOpenSurfaceMark(this, true)', 'holdOpenSurfaceMark(this, false)'],
    ['src/smart/help-mark/index.js', 'holdOpenSurfaceMark(this, true)', 'holdOpenSurfaceMark(this, false)'],
    ['src/component/country-code/js/_country_code.js', 'holdOpenSurfaceMark(root, open)', 'holdOpenSurfaceMark(root, false)'],
  ]) {
    const source = await read(path);
    assert.ok(source.includes(held), `${path} must raise the mark while open`);
    assert.ok(source.includes(released), `${path} must release the mark`);
  }
  // A press that closed the country list travelled on and closed the drawer.
  const country = await read('src/component/country-code/js/_country_code.js');
  assert.match(country, /event\.key === 'Escape' && root\.classList\.contains\('open'\)\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
});
