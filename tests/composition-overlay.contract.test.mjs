import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { checkOverlayActions, overlayNodes } from '../src/core/js/composition/overlay.mjs';
import { Composition } from '../src/core/js/composition/index.mjs';

const regions = JSON.parse(await readFile(new URL('./fixtures/composition/regions.json', import.meta.url), 'utf8'));

test('overlay nodes follow document order with parent, slot, index and level', () => {
  const nodes = overlayNodes(regions);
  assert.equal(nodes[0].id, 'shell');
  assert.equal(nodes[0].parent, null);
  assert.deepEqual(nodes[0].slots.regions, ['shell-header', 'shell-navigation', 'shell-main', 'shell-aside', 'shell-footer']);
  const inner = nodes.find(({ id }) => id === 'inner-facts');
  assert.deepEqual({ parent: inner.parent, slot: inner.slot, index: inner.index, level: inner.level }, { parent: 'main-inner', slot: 'regions', index: 1, level: 4 });
  assert.equal(nodes.length, new Set(nodes.map(({ id }) => id)).size);
  assert.deepEqual(overlayNodes(null), []);
  assert.deepEqual(overlayNodes({ root: { id: 'x', slots: { default: 'bad' } } }).map(({ id }) => id), ['x']);
});

test('overlay actions are opaque ids with labels only', () => {
  assert.deepEqual(checkOverlayActions([{ id: 'move-up', label: 'Выше' }]), [{ id: 'move-up', label: 'Выше' }]);
  for (const bad of [[{ id: 'Move', label: 'x' }], [{ id: 'x', label: '' }], [{ id: 'x', label: 'x', href: '/delete' }], [{ id: 'x', label: 'x', handler: 'run()' }], 'x', Array.from({ length: 17 }, (_, index) => ({ id: `a-${index}`, label: 'x' }))]) {
    assert.throws(() => checkOverlayActions(bad), TypeError);
  }
});

test('editor surfaces are Smart components, not part of Core', async () => {
  // core.js bundles composition/index.mjs; the editor code loads on demand.
  const core = await readFile(new URL('../src/core/js/composition/index.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(core, /from '\.\/(overlay|sortable|inline-editor)\.mjs'/u);
  for (const name of ['defineCompositionOverlay', 'defineSortable', 'registerSortableDropTarget', 'overlayNodes']) assert.equal(name in Composition, false, name);
  assert.throws(() => Composition.startInlineEdit({}, {}), /inline_editor_not_loaded/u);
  const entries = {
    // Each over the class its component.json makes (standard 1.3.8,
    // core/js/composition/manifest-host.mjs).
    'composition-overlay': ['sf-composition-overlay', /defineCompositionOverlay\(globalThis\.customElements, \{base: manifestHost\(manifest/u],
    sortable: ['sf-sortable', /defineSortable\(inserterRegistry\(\), \{base: manifestHost\(manifest/u],
    'inline-editor': ['sf-inline-editor', /defineInlineEditor\(globalThis\.customElements, \{base: manifestHost\(manifest/u],
  };
  for (const [name, [tag, define]] of Object.entries(entries)) {
    const rule = await readFile(new URL(`../src/smart/${name}/rule.js`, import.meta.url), 'utf8');
    assert.match(rule, new RegExp(`SF\\.RuleLoader\\['cl-${name}'\\][^]*tags: \\['${tag}'\\]`, 'u'));
    assert.match(await readFile(new URL(`../src/smart/${name}/index.js`, import.meta.url), 'utf8'), define);
  }
});

test('overlay nodes are read without touching Documents', () => {
  const before = JSON.stringify(regions);
  overlayNodes(regions);
  assert.equal(JSON.stringify(regions), before);
});

test('sortable index follows item midpoints', async () => {
  const { sortableIndexAt } = await import('../src/core/js/composition/sortable.mjs');
  const boxes = [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }];
  assert.equal(sortableIndexAt(boxes, 2), 0);
  assert.equal(sortableIndexAt(boxes, 6), 1);
  assert.equal(sortableIndexAt(boxes, 16), 2);
  assert.equal(sortableIndexAt(boxes, 29), 3);
  assert.equal(sortableIndexAt([], 5), 0);
});

test('drop targets require resolve and drop', async () => {
  const { registerSortableDropTarget } = await import('../src/core/js/composition/sortable.mjs');
  assert.throws(() => registerSortableDropTarget({ resolve() {} }), TypeError);
  const unregister = registerSortableDropTarget({ resolve: () => null, drop() {} });
  assert.equal(typeof unregister, 'function');
  unregister();
});

test('separate bundles share one drag session and target list', async () => {
  // Each Smart bundle carries its own copy of sortable.mjs.
  const first = await import('../src/core/js/composition/sortable.mjs?bundle=sortable');
  const second = await import('../src/core/js/composition/sortable.mjs?bundle=overlay');
  assert.notEqual(first.registerSortableDropTarget, second.registerSortableDropTarget);
  const target = { resolve: () => null, drop() {} };
  const unregister = second.registerSortableDropTarget(target);
  assert.equal(globalThis.__sfSortableSharedV1.targets.has(target), true);
  globalThis.__sfSortableSharedV1.session = { item: 'a', from: 'list', group: 'blocks', mode: 'copy', input: 'pointer' };
  assert.deepEqual(first.activeSortableSession(), second.activeSortableSession());
  assert.equal(first.activeSortableSession().item, 'a');
  globalThis.__sfSortableSharedV1.session = null;
  unregister();
  assert.equal(globalThis.__sfSortableSharedV1.targets.has(target), false);
});

test('Core startInlineEdit delegates to the loaded Smart editor', () => {
  const calls = [];
  const previous = globalThis.SF?.InlineEditor;
  globalThis.SF = globalThis.SF || {};
  globalThis.SF.InlineEditor = { startInlineEdit: (element, options) => { calls.push([element, options]); return { ok: true }; } };
  try {
    const element = {};
    assert.deepEqual(Composition.startInlineEdit(element, { nodeId: 'p1' }), { ok: true });
    assert.deepEqual(calls, [[element, { nodeId: 'p1' }]]);
  } finally {
    globalThis.SF.InlineEditor = previous;
  }
});

test('Smart manifests declare every event state the code emits', async () => {
  const sortable = await readFile(new URL('../src/core/js/composition/sortable.mjs', import.meta.url), 'utf8');
  const emitted = new Set([...sortable.matchAll(/state: '([a-z]+)'|finish\([^,]+, '([a-z]+)'\)/gu)].map((match) => match[1] || match[2]));
  const manifest = JSON.parse(await readFile(new URL('../src/smart/sortable/smart.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...emitted].sort(), [...manifest.events['sf-sortable-state'].payload.properties.state.enum].sort());
  const { OVERLAY_EVENTS, OVERLAY_EVENTS_LEGACY } = await import('../src/core/js/composition/overlay.mjs');
  const overlayManifest = JSON.parse(await readFile(new URL('../src/smart/composition-overlay/smart.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...Object.values(OVERLAY_EVENTS), ...Object.values(OVERLAY_EVENTS_LEGACY)].sort(), Object.keys(overlayManifest.events).sort());
  // The inline editor sends its names and, until 2026-12-01, the former ones
  // after them (standard 1.3.8 §16.20): the manifest names both.
  const { INLINE_EVENTS, INLINE_EVENTS_LEGACY } = await import('../src/core/js/composition/inline-editor.mjs');
  const inlineManifest = JSON.parse(await readFile(new URL('../src/smart/inline-editor/smart.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...Object.values(INLINE_EVENTS), ...Object.values(INLINE_EVENTS_LEGACY)].sort(), Object.keys(inlineManifest.events).sort());
});

// Framed canvas (simai/ui-source#22): a same-origin iframe fed a flat node list.
const frameElement = (name = 'div') => ({ nodeType: 1, localName: name, getBoundingClientRect: () => ({}) });

test('framed node lists are checked: id, kind, rect or element, label, parent, editable', async () => {
  const { checkOverlayNodes } = await import('../src/core/js/composition/overlay.mjs');
  const title = frameElement('h1');
  const list = checkOverlayNodes([
    { id: 'hero', kind: 'block', element: frameElement(), label: 'Cover' },
    { id: 'hero-title', kind: 'text', element: title, parent: 'hero', editable: true },
    { id: 'footer', kind: 'footer', rect: { x: 0, y: 900, width: 600, height: 80 } },
  ]);
  assert.deepEqual(list.map(({ id, parent, editable }) => [id, parent, editable]), [['hero', null, false], ['hero-title', 'hero', true], ['footer', null, false]]);
  assert.equal(list[1].element, title, 'the element is kept by reference: it lives in the frame document');
  assert.deepEqual(list[2].rect, { x: 0, y: 900, width: 600, height: 80 });
  assert.ok(Object.isFrozen(list) && list.every(Object.isFrozen));
  assert.deepEqual(checkOverlayNodes([]), []);
  const bad = [
    'x',
    [{ id: '', kind: 'block', rect: { x: 0, y: 0, width: 1, height: 1 } }],
    [{ id: 'a', kind: 'block', rect: { x: 0, y: 0, width: 1, height: 1 } }, { id: 'a', kind: 'block', rect: { x: 0, y: 0, width: 1, height: 1 } }],
    [{ id: 'a', rect: { x: 0, y: 0, width: 1, height: 1 } }],
    [{ id: 'a', kind: 'block' }],
    [{ id: 'a', kind: 'block', rect: { x: 0, y: 0, width: -1, height: 1 } }],
    [{ id: 'a', kind: 'block', rect: { x: 0, y: Number.NaN, width: 1, height: 1 } }],
    [{ id: 'a', kind: 'block', element: { nodeType: 3 } }],
    [{ id: 'a', kind: 'block', rect: { x: 0, y: 0, width: 1, height: 1 }, editable: true }],
    [{ id: 'a', kind: 'block', element: frameElement(), parent: 'missing' }],
    [{ id: 'a', kind: 'block', element: frameElement(), parent: 'a' }],
    [{ id: 'a', kind: 'block', element: frameElement(), parent: 'b' }, { id: 'b', kind: 'block', element: frameElement(), parent: 'a' }],
    [{ id: 'a', kind: 'block', element: frameElement(), onclick: 'run()' }],
    [{ id: 'a', kind: 'block', element: frameElement(), label: 5 }],
  ];
  for (const nodes of bad) assert.throws(() => checkOverlayNodes(nodes), TypeError, JSON.stringify(nodes));
});

test('framed nodes keep list order, with sibling index and level from parent', async () => {
  const { checkOverlayNodes, flatOverlayNodes } = await import('../src/core/js/composition/overlay.mjs');
  const nodes = flatOverlayNodes(checkOverlayNodes([
    { id: 'a', kind: 'block', element: frameElement() },
    { id: 'a-text', kind: 'text', element: frameElement(), parent: 'a', editable: true },
    { id: 'b', kind: 'block', element: frameElement() },
    { id: 'b-1', kind: 'item', element: frameElement(), parent: 'b' },
    { id: 'b-1-text', kind: 'text', element: frameElement(), parent: 'b-1' },
    { id: 'b-2', kind: 'item', element: frameElement(), parent: 'b' },
  ]));
  assert.deepEqual(nodes.map(({ id, parent, slot, index, level }) => [id, parent, slot, index, level]), [
    ['a', null, 'default', 0, 1], ['a-text', 'a', 'default', 0, 2], ['b', null, 'default', 1, 1],
    ['b-1', 'b', 'default', 0, 2], ['b-1-text', 'b-1', 'default', 0, 3], ['b-2', 'b', 'default', 1, 2],
  ]);
  assert.deepEqual(nodes.find(({ id }) => id === 'b').slots, { default: ['b-1', 'b-2'] });
  assert.equal(nodes[0].type, 'block');
});

test('frame coordinates map to the host through position, border, padding, scale and scroll', async () => {
  const { frameRectToHost, frameViewport } = await import('../src/core/js/composition/overlay.mjs');
  const sides = (value) => ({ top: value, right: value, bottom: value, left: value });
  // A 600 x 360 border box at (40, 100) with a 3px border and 5px padding.
  const plain = frameViewport({ rect: { left: 40, top: 100, width: 600, height: 360 }, layout: { width: 600, height: 360 }, border: sides(3), padding: sides(5), inner: { width: 584, height: 344 }, scroll: { x: 0, y: 250 } });
  assert.deepEqual([plain.left, plain.top, plain.width, plain.height, plain.scaleX, plain.scrollY], [48, 108, 584, 344, 1, 250]);
  assert.deepEqual(frameRectToHost({ x: 24, y: 16, width: 100, height: 20 }, plain), { x: 72, y: 124, left: 72, top: 124, width: 100, height: 20, right: 172, bottom: 144 });
  // The same frame under scale(0.8): the border box shrinks, the layout size does not.
  const scaled = frameViewport({ rect: { left: 40, top: 100, width: 480, height: 288 }, layout: { width: 600, height: 360 }, border: sides(3), padding: sides(5), inner: { width: 584, height: 344 } });
  assert.equal(scaled.scaleX, 0.8);
  const box = frameRectToHost({ x: 24, y: 16, width: 100, height: 20 }, scaled);
  assert.deepEqual([box.left, box.top, box.width, box.height].map((value) => Math.round(value * 1000) / 1000), [65.6, 119.2, 80, 16]);
  // Without a layout size the scale comes from the parts.
  assert.equal(frameViewport({ rect: { left: 0, top: 0, width: 1200, height: 720 }, border: sides(3), padding: sides(5), inner: { width: 584, height: 344 } }).scaleX, 2);
  // A collapsed frame keeps scale 1 rather than dividing by zero.
  assert.equal(frameViewport({ rect: { left: 0, top: 0, width: 0, height: 0 }, layout: { width: 0, height: 0 }, border: sides(0), padding: sides(0), inner: { width: 0, height: 0 } }).scaleX, 1);
});

test('framed mode is an opt-in beside the Composition Document mode', async () => {
  const source = await readFile(new URL('../src/core/js/composition/overlay.mjs', import.meta.url), 'utf8');
  // Escape gives way to an inner open surface, and an edit in progress is one.
  assert.match(source, /event\.key === 'Escape' && this\.selectedId !== null && \(!this\.iframe \|\| isTopOpenSurface\(this\)\)/u);
  assert.match(source, /holdOpenSurfaceMark\(this, true\);\n      this\.setAttribute\('data-sf-overlay-editing', ''\);/u);
  assert.match(source, /finishEdit\(commit\) \{[^]*holdOpenSurfaceMark\(this, false\);/u);
  // The edit's change is cancelable; the overlay never writes the host's model.
  assert.match(source, /this\.sendRenamed\('edit', \{ id: editing\.id, value, previous: editing\.previous \}, true\)/u);
  // Disconnect stops listening to the frame's document and window.
  assert.match(source, /unbind\(\) \{\n\s+this\.finishEdit\(false\);\n\s+this\.frameConnection\?\.abort\(\);/u);
  const entry = await readFile(new URL('../src/smart/composition-overlay/index.js', import.meta.url), 'utf8');
  assert.match(entry, /SF\.CompositionOverlay = Object\.freeze\(\{ OVERLAY_EVENTS, OVERLAY_EVENTS_LEGACY, checkOverlayActions, checkOverlayNodes, overlayNodes \}\)/u);
  const manifest = JSON.parse(await readFile(new URL('../src/smart/composition-overlay/smart.manifest.json', import.meta.url), 'utf8'));
  for (const method of ['attach', 'attachFrame', 'setDocument', 'setNodes', 'edit', 'refresh', 'select']) assert.ok(manifest.methods[method], method);
  assert.equal(manifest.inputs.properties.frame.type, 'string');
  // The former edit event keeps its payload beside the new change (standard 1.3.8 §16.20).
  assert.deepEqual(manifest.events['sf-composition-overlay-edit'].payload.required, ['node_id', 'value', 'previous']);
  assert.deepEqual(manifest.events['sf-composition-overlay-change'].payload.required, ['id', 'value', 'previous']);
  assert.deepEqual(Object.keys(manifest.contracts.nodes.items.properties).sort(), ['editable', 'element', 'id', 'kind', 'label', 'parent', 'rect']);
  // The Document mode's events keep their payloads.
  assert.deepEqual(manifest.events['sf-composition-overlay-insert'].payload.required, ['parent_id', 'slot', 'index']);
});
