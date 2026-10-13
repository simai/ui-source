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
    'composition-overlay': ['sf-composition-overlay', /defineCompositionOverlay\(\)/u],
    sortable: ['sf-sortable', /defineSortable\(\)/u],
    'inline-editor': ['sf-inline-editor', /defineInlineEditor\(\)/u],
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
  const { OVERLAY_EVENTS } = await import('../src/core/js/composition/overlay.mjs');
  const overlayManifest = JSON.parse(await readFile(new URL('../src/smart/composition-overlay/smart.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.values(OVERLAY_EVENTS).sort(), Object.keys(overlayManifest.events).sort());
  const { INLINE_EVENTS } = await import('../src/core/js/composition/inline-editor.mjs');
  const inlineManifest = JSON.parse(await readFile(new URL('../src/smart/inline-editor/smart.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.values(INLINE_EVENTS).sort(), Object.keys(inlineManifest.events).sort());
});
