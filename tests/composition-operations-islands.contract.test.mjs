// An island is closed as a whole (contract call 2026-11-11, review M1 of
// composition F3.1): a child of an island may do nothing on its own. A known
// node inside an unknown block (or inside content.table or content.foreign)
// takes no caret, typing, split, join, removal, move, reorder, insert,
// duplicate or block type change; each is refused with `place`, and the
// Document stays byte for byte. The island itself is still selected, moved,
// duplicated, cut and pasted and removed whole. Splitting and joining also
// ask the slot rule, as an insert and a removal do.
import assert from 'node:assert/strict';
import test from 'node:test';

import Composition from '../src/core/js/composition/index.mjs';
import {
  copyNodes, createSession, cutNodes, duplicateNode, insertBreak, insertNode, islandAround, joinBack, moveBy, moveNode, pasteNodes,
  removeNode, select, setBlockType, setLink, setText, splitBlock, toggleMark,
} from '../src/core/js/composition/operations.mjs';
import { walk } from '../src/core/js/composition/tree.mjs';
import cardsType from '../src/core/kits/block/sample-cards/type.json' with { type: 'json' };

const t = (value) => [{ type: 'text', value }];
const json = (value) => JSON.stringify(value);
const registry = Composition.extendRegistry([cardsType]);

// vendor.card is a type the registry does not know: an island. Its children
// are known types, a quote and a list among them.
const CARD = { id: 'card', type: 'vendor.card', props: { tone: 'warm' }, slots: { body: [
  { id: 'c1', type: 'content.paragraph', data: { content: t('one') } },
  { id: 'c2', type: 'content.paragraph', data: { content: t('two') } },
  { id: 'cq', type: 'content.quote', slots: { default: [{ id: 'cq1', type: 'content.paragraph', data: { content: t('quoted') } }] } },
  { id: 'cl', type: 'content.list', slots: { items: [{ id: 'cli1', type: 'content.list-item', data: { content: [] } }] } },
] } };

function page() {
  return {
    schema: 'simai.composition.document', schema_version: 1, id: 'doc', profile: 'ui-layout', locale: 'en',
    root: { id: 'a1', type: 'layout.area', slots: { default: [
      { id: 'p0', type: 'content.paragraph', data: { content: t('before') } },
      CARD,
      { id: 'p9', type: 'content.paragraph', data: { content: t('after') } },
    ] } },
  };
}

const session = () => createSession({ document: page(), context: { registry }, history: { now: () => 0 } });
const fresh = (id) => ({ id, type: 'content.paragraph', data: { content: t('new') } });
const clipboard = { nodes: [fresh('n2')] };

// Every operation aimed at a known child of the island, or at a place inside it.
const INSIDE = [
  ['select a child as a block', select, ['c1']],
  ['put the caret in a child', select, ['c1', 'content', 0]],
  ['type in a child', setText, ['c1', 'content', t('changed')]],
  ['a line break in a child', insertBreak, ['c1', 'content', 1]],
  ['a mark in a child', toggleMark, ['c1', 'content', 0, 3, 'strong']],
  ['a link in a child', setLink, ['c1', 'content', 0, 3, 'https://example.com']],
  ['split a child (Enter)', splitBlock, ['c1', 1]],
  ['Enter on the empty last item of a list inside', splitBlock, ['cli1', 0]],
  ['join two children (Backspace)', joinBack, ['c2']],
  ['a child becomes a heading', setBlockType, ['c1', 'content.heading', { level: 2 }]],
  ['remove a child', removeNode, ['c1']],
  ['cut a child', cutNodes, [['c1']]],
  ['move a child out', moveNode, ['c1', { parent: 'a1', slot: 'default', index: 0 }]],
  ['reorder children', moveBy, ['c2', -1]],
  ['reorder inside a nested quote', moveNode, ['cq1', { parent: 'cq', slot: 'default', index: 1 }]],
  ['move a node in', moveNode, ['p0', { parent: 'cq', slot: 'default', index: 0 }]],
  ['insert into the island', insertNode, [fresh('n1'), { parent: 'card', slot: 'body', index: 0 }]],
  ['insert into a quote inside', insertNode, [fresh('n1'), { parent: 'cq', slot: 'default', index: 1 }]],
  ['paste into a quote inside', pasteNodes, [clipboard, { parent: 'cq', slot: 'default', index: 1 }]],
  ['duplicate a child', duplicateNode, ['c1']],
  ['duplicate a node in a quote inside', duplicateNode, ['cq1']],
];

test('a child of an island may do nothing on its own: every operation aimed inside is refused with place', () => {
  const editing = session();
  const before = json(editing.document);
  for (const [label, operation, args] of INSIDE) {
    const result = editing.apply(operation, ...args);
    assert.equal(result.ok, false, `${label}: refused`);
    assert.equal(result.reason, 'place', `${label}: the reason is place`);
    assert.equal(json(editing.document), before, `${label}: the Document is unchanged`);
  }
  assert.equal(editing.canUndo, false, 'no history step was recorded');
  // A selection that names a child is refused too (the session's own select).
  assert.equal(editing.select('c1', 'content', 0).reason, 'place');
});

test('islandAround names the island a node lies in, at any depth, and nothing for a node outside', () => {
  const state = session().state;
  for (const id of ['c1', 'c2', 'cq', 'cq1', 'cl', 'cli1']) assert.equal(islandAround(state, id, { registry }), 'card', id);
  for (const id of ['a1', 'p0', 'card', 'p9', 'missing']) assert.equal(islandAround(state, id, { registry }), null, id);
});

test('copying a child reads and is allowed; the Document does not change', () => {
  const editing = session();
  const before = json(editing.document);
  const copied = editing.apply(copyNodes, ['c1']);
  assert.equal(copied.ok, true);
  assert.equal(copied.clipboard.nodes[0].id, 'c1');
  assert.equal(json(editing.document), before);
});

test('the island itself is selected, moved, duplicated, cut, pasted and removed whole, and undo is exact', () => {
  const editing = session();
  const start = json(editing.document);
  const card = (document) => { let found = null; walk(document.root, (node) => { if (node.type === 'vendor.card' && !found) found = node; }); return found; };
  const body = (node) => json({ ...node, id: undefined, slots: { body: node.slots.body.map((child) => ({ ...child, id: undefined, slots: child.slots && Object.fromEntries(Object.entries(child.slots).map(([slot, list]) => [slot, list.map((one) => ({ ...one, id: undefined }))])) })) } });
  assert.equal(editing.select('card').ok, true);
  assert.equal(editing.select('card', 'content').reason, 'island');
  assert.equal(editing.apply(moveBy, 'card', 1).ok, true);
  assert.equal(editing.apply(moveBy, 'card', -1).ok, true);
  const copy = editing.apply(duplicateNode, 'card');
  assert.equal(copy.ok, true);
  assert.equal(body(editing.node(copy.id)), body(CARD), 'the duplicate holds the island byte for byte, with fresh ids');
  const cut = editing.apply(cutNodes, [copy.id]);
  assert.equal(cut.ok, true, 'cut takes the island whole');
  assert.equal(body(cut.clipboard.nodes[0]), body(CARD), 'the clipboard holds it whole');
  // An unknown type is taken by no slot: pasting it anywhere is the slot rule's place.
  assert.equal(editing.apply(pasteNodes, cut.clipboard, { parent: 'a1', slot: 'default', index: 0 }).reason, 'place');
  assert.equal(editing.apply(removeNode, 'card').ok, true);
  assert.equal(card(editing.document), null, 'removed whole');
  while (editing.canUndo) editing.undo();
  assert.equal(json(editing.document), start, 'undo returns the Document byte for byte');
});

test('a known island (a context rule) is cut and pasted whole, with fresh ids', () => {
  const editing = createSession({ document: page(), context: { registry, isIsland: (node) => node.type === 'content.quote' || !registry.types.has(node.type) } });
  const before = editing.node('p9');
  const quote = { id: 'q', type: 'content.quote', slots: { default: [{ id: 'q1', type: 'content.paragraph', data: { content: t('q') } }] } };
  assert.equal(editing.apply(insertNode, quote, { parent: 'a1', slot: 'default', index: 3 }).ok, true);
  assert.equal(editing.apply(splitBlock, 'q1', 0).reason, 'place', 'its child is closed');
  const cut = editing.apply(cutNodes, ['q']);
  assert.equal(cut.ok, true);
  const pasted = editing.apply(pasteNodes, cut.clipboard, { parent: 'a1', slot: 'default', index: 0 });
  assert.equal(pasted.ok, true);
  assert.equal(json(editing.node(pasted.ids[0]).slots.default[0].data), json(quote.slots.default[0].data));
  assert.equal(json(editing.node('p9')), json(before));
});

test('an island named by the context rule (content.foreign here) closes its children the same way', () => {
  const document = { ...page(), root: { id: 'a1', type: 'layout.area', slots: { default: [
    { id: 'f', type: 'content.foreign', data: { source: 'x' }, slots: { default: [{ id: 'f1', type: 'content.paragraph', data: { content: t('kept') } }] } },
  ] } } };
  // A context island rule may name any type: here content.foreign's child is inside one.
  const editing = createSession({ document, context: { registry, isIsland: (node) => node.type === 'content.foreign' } });
  const before = json(editing.document);
  for (const [label, result] of [
    ['type', editing.apply(setText, 'f1', 'content', t('x'))],
    ['split', editing.apply(splitBlock, 'f1', 1)],
    ['remove', editing.apply(removeNode, 'f1')],
  ]) assert.equal(result.reason, 'place', label);
  assert.equal(json(editing.document), before);
});

test('splitBlock asks the slot rule: a full slot, or one that does not take the new block, refuses with place', () => {
  const heading = (id) => ({ id, type: 'content.heading', data: { level: 2, content: t(id) } });
  const document = { ...page(), root: { id: 'a1', type: 'layout.area', slots: { default: [
    { id: 'cards', type: 'sample.cards', slots: { intro: ['h1', 'h2', 'h3', 'h4', 'h5'].map(heading) } },
  ] } } };
  const editing = createSession({ document, context: { registry } });
  const before = json(editing.document);
  assert.equal(editing.apply(splitBlock, 'h3', 1).reason, 'place', 'intro holds its max (5)');
  assert.equal(json(editing.document), before);
  assert.equal(editing.apply(removeNode, 'h5').ok, true);
  assert.equal(editing.apply(splitBlock, 'h3', 1).ok, true, 'with room, Enter splits');
});

test('joinBack asks the slot rule: a join that would leave a slot under its min refuses with required', () => {
  const pair = { ...cardsType, type: 'sample.pair', variants: [], slots: { intro: { ...cardsType.slots.intro, min: 2 } } };
  const pairRegistry = Composition.extendRegistry([cardsType, pair]);
  const document = { ...page(), root: { id: 'a1', type: 'layout.area', slots: { default: [
    { id: 'pr', type: 'sample.pair', slots: { intro: [
      { id: 'x1', type: 'content.paragraph', data: { content: t('one') } },
      { id: 'x2', type: 'content.paragraph', data: { content: t('two') } },
    ] } },
  ] } } };
  const editing = createSession({ document, context: { registry: pairRegistry } });
  const before = json(editing.document);
  assert.equal(editing.apply(joinBack, 'x2').reason, 'required');
  assert.equal(json(editing.document), before);
});
