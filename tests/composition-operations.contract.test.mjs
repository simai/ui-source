// Composition F3.1: the editing operations, the block tree and the one
// history in the Framework core (src/core/js/composition/operations.mjs,
// tree.mjs, history.mjs; contract src/core/contracts/composition-operations-v1).
//
// The first part ports the SIMAI Editor model tests that cover the moved
// parts (ui-editor package/tests/editor-model.test.mjs: "one history",
// "Enter splits ... joins back", "Enter on an empty last list item",
// "insert three ways", "move", "remove and duplicate") onto the core
// session, on the same page fixture; each port names its source test and
// what of it stays in the editor. The second part holds the island rules and
// the rest of the operations table.
import assert from 'node:assert/strict';
import test from 'node:test';

import Composition from '../src/core/js/composition/index.mjs';
import { createHistory, HISTORY_DEPTH, TYPING_PAUSE } from '../src/core/js/composition/history.mjs';
import {
  CLIPBOARD_TYPE, OPERATIONS, REFUSALS, copyNodes, createSession, createState, cutNodes, duplicateNode, insertBreak, insertNode, islandOf,
  joinBack, moveBy, moveNode, pasteNodes, placeAfter, placeInside, removeNode, select, setBlockType, setLink, setText, splitBlock, toggleMark,
} from '../src/core/js/composition/operations.mjs';
import { childrenOf, freshCopy, idMaker, idsOf, insertAt, locate, removeAt, walk, within } from '../src/core/js/composition/tree.mjs';
import cardsType from '../src/core/kits/block/sample-cards/type.json' with { type: 'json' };

const t = (value) => [{ type: 'text', value }];
const DOC = { schema: 'simai.composition.document', schema_version: 1 };

// The page of ui-editor's editor-model tests, unchanged.
function page() {
  return {
    ...DOC, id: 'home', profile: 'ui-layout', locale: 'en',
    root: { id: 'regs', type: 'layout.regions', slots: { regions: [
      { id: 'hd', type: 'layout.region', props: { name: 'header', landmark: 'banner' }, slots: { default: [{ id: 'logo', type: 'content.paragraph', data: { content: t('Site') } }] } },
      { id: 'mn', type: 'layout.region', props: { name: 'main', landmark: 'main' }, slots: { default: [
        { id: 's1', type: 'layout.section', props: { width: 'normal' }, slots: { default: [
          { id: 'a1', type: 'layout.area', slots: { default: [
            { id: 'h1', type: 'content.heading', data: { level: 1, content: t('Title') } },
            { id: 'p1', type: 'content.paragraph', data: { content: t('Hello world') } },
            { id: 'p2', type: 'content.paragraph', data: { content: t('Second') } },
          ] } },
        ] } },
        { id: 's2', type: 'layout.section', slots: { default: [
          { id: 'cards', type: 'sample.cards', props: { cols: { xs: 1, md: 2 } } },
        ] } },
      ] } },
      { id: 'ft', type: 'layout.region', props: { name: 'footer', landmark: 'contentinfo' }, slots: { default: [{ id: 'copy', type: 'content.paragraph', data: { content: t('(c)') } }] } },
    ] } },
  };
}

const registry = Composition.extendRegistry([cardsType]);
const session = (options = {}) => {
  let clock = 1000;
  const made = createSession({ document: page(), context: { registry, ...(options.context ?? {}) }, history: { now: () => clock } });
  made.tick = (ms) => { clock += ms; };
  return made;
};
const ids = (list) => list.map((node) => node.id);
const valid = (editing) => assert.deepEqual(Composition.validate(editing.document, registry).diagnostics, []);
const words = (editing, id, key = 'content') => (editing.node(id)?.data?.[key] ?? []).map((entry) => entry.value ?? '').join('');

// ------------------------------------------------------------------ ported

test('the page from the ui-editor tests is a valid Document in the core registry', () => {
  valid(session());
});

test('port "one history": a run of typing is one step, structure is one step each, and undo returns both', () => {
  const editing = session();
  editing.select('p1', 'content');
  editing.apply(setText, 'p1', 'content', t('Hello world!'));
  editing.tick(100);
  editing.apply(setText, 'p1', 'content', t('Hello world!!'));
  assert.equal(editing.history.undoDepth, 1, 'letters typed in one run are one step');
  editing.tick(5000);
  editing.apply(setText, 'p1', 'content', t('Hello world!!!'));
  assert.equal(editing.history.undoDepth, 2, 'a pause starts a new step');
  // ui-editor inserts a choice ({type}) made by its catalogue; the core inserts a node.
  editing.apply(insertNode, { id: 'new', type: 'content.paragraph', data: { content: [] } }, placeAfter(editing.state, 'p1'));
  assert.equal(editing.history.undoDepth, 3);
  editing.undo();
  assert.equal(words(editing, 'p1'), 'Hello world!!!');
  assert.equal(editing.node('a1').slots.default.length, 3);
  editing.undo();
  editing.undo();
  assert.equal(words(editing, 'p1'), 'Hello world');
  editing.redo();
  assert.equal(words(editing, 'p1'), 'Hello world!!');
  assert.equal(editing.canRedo, true);
});

test('port "Enter splits ... joins back": Enter splits a paragraph at the caret, Backspace at its start joins it, in one history', () => {
  const editing = session();
  const split = editing.apply(splitBlock, 'p1', 5);
  assert.equal(split.ok, true);
  assert.equal(words(editing, 'p1'), 'Hello');
  assert.equal(words(editing, split.id), ' world');
  assert.deepEqual(editing.selection.text, { id: split.id, key: 'content', offset: 0 });
  const joined = editing.apply(joinBack, split.id);
  assert.deepEqual({ id: joined.id, offset: joined.offset }, { id: 'p1', offset: 5 });
  assert.equal(words(editing, 'p1'), 'Hello world');
  editing.undo();
  editing.undo();
  assert.equal(editing.node('a1').slots.default.length, 3);
  valid(editing);
});

test('port "Enter on an empty last list item leaves the list"', () => {
  // ui-editor makes the list with its Markdown shortcut ("- a"); the shortcut
  // stays in the editor, so the list is written here as the shortcut leaves it.
  const editing = session();
  editing.apply(removeNode, 'p2');
  editing.apply(insertNode, { id: 'p2', type: 'content.list', slots: { items: [{ id: 'i1', type: 'content.list-item', data: { content: t('a') } }] } }, { parent: 'a1', slot: 'default', index: 2 });
  const second = editing.apply(splitBlock, 'i1', 1);
  const left = editing.apply(splitBlock, second.id, 0);
  assert.equal(left.ok, true);
  assert.equal(editing.node(left.id).type, 'content.paragraph');
  assert.equal(editing.node('p2').slots.items.length, 1);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['h1', 'p1', 'p2', left.id]);
  valid(editing);
});

test('an empty only list item leaves the list and the list goes with it', () => {
  const editing = session();
  editing.apply(insertNode, { id: 'l1', type: 'content.list', slots: { items: [{ id: 'i1', type: 'content.list-item', data: { content: [] } }] } }, { parent: 'a1', slot: 'default', index: 3 });
  const left = editing.apply(splitBlock, 'i1', 0);
  assert.equal(editing.node('l1'), null);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['h1', 'p1', 'p2', left.id]);
  valid(editing);
});

test('port "insert three ways": after a block, the caret goes into its text, and a text area takes no section', () => {
  // The slash line and the default place (placeFor) stay in ui-editor.
  const editing = session();
  const quote = { id: 'q1', type: 'content.quote', slots: { default: [{ id: 'q1p', type: 'content.paragraph', data: { content: [] } }] } };
  const after = editing.apply(insertNode, quote, placeAfter(editing.state, 'h1'));
  assert.equal(after.ok, true);
  assert.equal(editing.node('a1').slots.default[1].id, after.id);
  assert.equal(editing.selection.text.key, 'content', 'the caret goes into the new block\'s text');
  assert.equal(editing.selection.text.id, 'q1p');
  const refused = editing.apply(insertNode, { id: 'sx', type: 'layout.section' }, placeAfter(editing.state, 'p1'));
  assert.deepEqual(refused, { ok: false, reason: 'place' }, 'a text area takes no section');
  const section = editing.apply(insertNode, { id: 's3', type: 'layout.section' }, placeAfter(editing.state, 's2'));
  assert.equal(locate(editing.document.root, section.id).parent.id, 'mn');
  assert.deepEqual(placeInside(editing.state, 's2', undefined, editing.context), { parent: 's2', slot: 'default', index: 1 });
  valid(editing);
});

test('port "move": by drop line, by Alt+arrows, and nothing moves into itself', () => {
  const editing = session();
  assert.equal(editing.apply(moveBy, 'p2', -1).ok, true);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['h1', 'p2', 'p1']);
  assert.equal(editing.apply(moveBy, 'h1', -1).reason, 'edge');
  assert.equal(editing.apply(moveNode, 'p1', { parent: 'a1', slot: 'default', index: 0 }).ok, true);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['p1', 'h1', 'p2']);
  assert.equal(editing.apply(moveNode, 's1', { parent: 'a1', slot: 'default', index: 0 }).reason, 'inside-itself');
  assert.equal(editing.apply(moveNode, 's2', { parent: 'mn', slot: 'default', index: 0 }).ok, true);
  assert.deepEqual(ids(editing.node('mn').slots.default), ['s2', 's1']);
  editing.select('p2', 'content');
  editing.apply(moveBy, 'p2', -1);
  assert.deepEqual(editing.selection.text, { id: 'p2', key: 'content' }, 'Alt+Shift+arrows keep typing');
  valid(editing);
});

test('port "remove and duplicate": the slot rules hold and a neighbour is chosen', () => {
  const editing = session();
  const copy = editing.apply(duplicateNode, 'p1');
  assert.deepEqual(ids(editing.node('a1').slots.default), ['h1', 'p1', copy.id, 'p2']);
  editing.apply(removeNode, copy.id);
  assert.equal(editing.selection.block, 'p2');
  valid(editing);
});

// ------------------------------------------------------------------ the rest of the table

test('operations are pure: the state they are given never changes, a refusal changes nothing', () => {
  const state = createState(page());
  const before = JSON.stringify(state);
  const context = { registry };
  for (const result of [
    setText(state, 'p1', 'content', t('changed'), context),
    splitBlock(state, 'p1', 3, context),
    joinBack(state, 'p2', context),
    removeNode(state, 'p1', context),
    moveBy(state, 'p2', -1, context),
    pasteNodes(state, copyNodes(state, ['p1'], context).clipboard, placeAfter(state, 'p2'), context),
    toggleMark(state, 'p1', 'content', 0, 5, 'strong', context),
    removeNode(state, 'regs', context),
  ]) assert.ok(result.ok === true || typeof result.reason === 'string');
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(Object.keys(OPERATIONS).sort(), ['copyNodes', 'cutNodes', 'duplicateNode', 'insertBreak', 'insertNode', 'joinBack', 'moveBy', 'moveNode', 'pasteNodes', 'removeNode', 'select', 'setBlockType', 'setLink', 'setText', 'splitBlock', 'toggleMark']);
});

test('refusals: every reason an operation gives is in the table', () => {
  const state = createState(page());
  const context = { registry };
  const reasons = [
    insertNode(state, null, null, context).reason,
    insertNode(state, { id: 'x', type: 'layout.section' }, placeAfter(state, 'p1'), context).reason,
    insertNode(state, { id: 'p1', type: 'content.paragraph' }, placeAfter(state, 'p2'), context).reason,
    removeNode(createState({ ...DOC, id: 'one', profile: 'ui-layout', root: { id: 'r', type: 'content.list', slots: { items: [{ id: 'i', type: 'content.list-item' }] } } }), 'i', context).reason,
    moveNode(state, 'a1', { parent: 'p1', slot: 'default', index: 0 }, context).reason,
    moveNode(state, 'p1', { parent: 'a1', slot: 'default', index: 1 }, context).reason,
    moveBy(state, 'p2', 1, context).reason,
    joinBack(state, 'h1', context).reason,
    splitBlock(state, 'a1', 0, context).reason,
    toggleMark(state, 'p1', 'content', 0, 2, 'underline', context).reason,
    setLink(state, 'p1', 'content', 0, 2, 'javascript:alert(1)', context).reason,
    splitBlock(state, 'p1', 99, context).reason,
    pasteNodes(state, { nodes: [] }, placeAfter(state, 'p1'), context).reason,
  ];
  assert.deepEqual(reasons, ['unknown', 'place', 'id-taken', 'required', 'inside-itself', 'same', 'edge', 'first', 'not-text', 'mark', 'href', 'range', 'empty']);
  for (const reason of reasons) assert.ok(Object.hasOwn(REFUSALS, reason), reason);
  // A lock comes from the context and is the refusal.
  assert.equal(removeNode(state, 'logo', { registry, placeLock: (id) => (id === 'hd' ? 'template' : null) }).reason, 'template');
  assert.equal(setText(state, 'logo', 'content', t('x'), { registry, lockOf: (id) => (id === 'logo' ? 'template' : null) }).reason, 'template');
});

test('text: marks, links and line breaks go through the inline model; formatting is one step, a break types with the letters', () => {
  const editing = session();
  const bold = editing.apply(toggleMark, 'p1', 'content', 0, 5, 'strong');
  assert.equal(bold.ok, true);
  assert.deepEqual(editing.node('p1').data.content, [{ type: 'text', value: 'Hello', marks: ['strong'] }, { type: 'text', value: ' world' }]);
  assert.equal(editing.history.undoDepth, 1);
  editing.apply(setLink, 'p1', 'content', 6, 11, '/about');
  assert.equal(editing.history.undoDepth, 2);
  assert.equal(editing.node('p1').data.content.at(-1).type, 'link');
  editing.apply(setLink, 'p1', 'content', 6, 11, null);
  assert.equal(editing.node('p1').data.content.at(-1).type, 'text');
  editing.apply(setText, 'p2', 'content', t('Second!'));
  const broke = editing.apply(insertBreak, 'p2', 'content', 7);
  assert.equal(broke.ok, true);
  assert.equal(editing.node('p2').data.content.at(-1).type, 'break');
  assert.deepEqual(editing.selection.text, { id: 'p2', key: 'content', offset: 8 });
  assert.equal(editing.history.undoDepth, 4, 'typing and the break are one run');
  editing.undo();
  assert.equal(words(editing, 'p2'), 'Second');
  valid(editing);
});

test('setBlockType turns a paragraph into a heading and back, the text and id kept, one undo', () => {
  const editing = session();
  assert.equal(editing.apply(setBlockType, 'p1', 'content.heading', { level: 2 }).ok, true);
  assert.deepEqual(editing.node('p1'), { id: 'p1', type: 'content.heading', data: { level: 2, content: t('Hello world') } });
  assert.equal(editing.apply(setBlockType, 'p1', 'content.heading', { level: 2 }).reason, 'same');
  assert.equal(editing.apply(setBlockType, 'p1', 'content.paragraph').ok, true);
  assert.deepEqual(editing.node('p1'), { id: 'p1', type: 'content.paragraph', data: { content: t('Hello world') } });
  assert.equal(editing.apply(setBlockType, 'a1', 'content.heading').reason, 'not-text');
  editing.undo();
  editing.undo();
  assert.deepEqual(editing.node('p1'), page().root.slots.regions[1].slots.default[0].slots.default[0].slots.default[1]);
  valid(editing);
});

test('copy and paste: the clipboard carries the node JSON and a text fallback; a paste gets new ids all through and keeps the content', () => {
  const editing = session();
  const copied = copyNodes(editing.state, ['a1', 'p1'], editing.context);
  assert.equal(copied.clipboard.type, CLIPBOARD_TYPE);
  assert.deepEqual(ids(copied.clipboard.nodes), ['a1'], 'a node inside a copied node goes with it once');
  assert.equal(copied.clipboard.text, 'Title\nHello world\nSecond');
  assert.equal(copied.state, editing.state, 'copy changes nothing');
  const before = idsOf(editing.document.root);
  const pasted = editing.apply(pasteNodes, copied.clipboard, { parent: 's1', slot: 'default', index: 1 });
  assert.equal(pasted.ok, true);
  const fresh = idsOf(editing.node(pasted.ids[0]));
  assert.equal(fresh.size, 4);
  for (const id of fresh) assert.equal(before.has(id), false, `${id} is new`);
  const strip = (node) => JSON.parse(JSON.stringify(node, (key, value) => (key === 'id' ? undefined : value)));
  assert.deepEqual(strip(editing.node(pasted.ids[0])), strip(editing.node('a1')));
  assert.equal(editing.history.undoDepth, 1, 'a paste is one step');
  const again = editing.apply(pasteNodes, copied.clipboard, { parent: 's1', slot: 'default', index: 2 });
  for (const id of idsOf(editing.node(again.ids[0]))) assert.equal(fresh.has(id) || before.has(id), false, 'a second paste reuses no id either');
  assert.equal(editing.apply(pasteNodes, copied.clipboard, placeAfter(editing.state, 'p1')).reason, 'place', 'an area takes no area');
  valid(editing);
});

test('cut is copy and remove in one step; undo returns the exact nodes with the same ids', () => {
  const editing = session();
  const original = JSON.stringify(editing.document);
  const cut = editing.apply(cutNodes, ['p1', 'p2']);
  assert.deepEqual(ids(cut.clipboard.nodes), ['p1', 'p2']);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['h1']);
  assert.equal(editing.history.undoDepth, 1);
  editing.undo();
  assert.equal(JSON.stringify(editing.document), original);
});

// ------------------------------------------------------------------ islands (assessment Q5)

const table = { id: 'tb', type: 'content.table', props: { caption: 'Prices' }, data: { head: [['a']], rows: [['1']] } };
const foreign = { id: 'fx', type: 'vendor.widget', data: { any: 'thing' }, slots: { inner: [{ id: 'fx1', type: 'vendor.part' }] } };
function islands() {
  const editing = session();
  const doc = editing.document;
  // An unknown type cannot be inserted (no slot takes it): it comes in a Document.
  const area = doc.root.slots.regions[1].slots.default[0].slots.default[0];
  area.slots.default.push(clone(table), clone(foreign));
  return createSession({ document: doc, context: { registry }, history: { now: () => 0 } });
}
const clone = (value) => JSON.parse(JSON.stringify(value));

test('island: content.table, content.foreign and unknown types are islands, other types are not', () => {
  assert.equal(islandOf({ type: 'content.table' }, registry), true);
  assert.equal(islandOf({ type: 'content.foreign' }, registry), true);
  assert.equal(islandOf({ type: 'vendor.widget' }, registry), true);
  assert.equal(islandOf({ type: 'content.paragraph' }, registry), false);
  assert.equal(islandOf({ type: 'sample.cards' }, registry), false);
});

test('island select: chosen whole, no caret inside', () => {
  const editing = islands();
  assert.equal(editing.select('tb').ok, true);
  assert.deepEqual(editing.selection, { block: 'tb', text: null });
  assert.equal(editing.select('tb', 'rows').reason, 'island');
  assert.equal(editing.select('fx', 'any').reason, 'island');
  assert.equal(editing.select('p1', 'content', 2).ok, true);
});

test('island type over / format: refused, the island unchanged', () => {
  const editing = islands();
  const before = JSON.stringify(editing.document);
  for (const result of [
    editing.apply(setText, 'tb', 'rows', t('x')),
    editing.apply(toggleMark, 'tb', 'rows', 0, 1, 'strong'),
    editing.apply(setLink, 'fx', 'any', 0, 1, '/a'),
    editing.apply(insertBreak, 'fx', 'any', 0),
    editing.apply(splitBlock, 'tb', 0),
    editing.apply(setBlockType, 'tb', 'content.paragraph'),
  ]) assert.deepEqual(result, { ok: false, reason: 'island' });
  assert.equal(editing.apply(joinBack, 'tb').reason, 'island', 'Backspace after an island does not join into it');
  assert.equal(JSON.stringify(editing.document), before);
  assert.equal(editing.history.undoDepth, 0);
});

test('island delete: the whole node, one undo step; undo restores the exact node, same id', () => {
  const editing = islands();
  const exact = JSON.stringify(editing.node('fx'));
  assert.equal(editing.apply(removeNode, 'fx').ok, true);
  assert.equal(editing.node('fx'), null);
  assert.equal(editing.node('fx1'), null);
  assert.equal(editing.history.undoDepth, 1);
  editing.undo();
  assert.equal(JSON.stringify(editing.node('fx')), exact);
  editing.redo();
  assert.equal(editing.node('fx'), null);
});

test('island move: the whole node where the slot rules allow; an unknown type only within its own slot', () => {
  const editing = islands();
  assert.equal(editing.apply(moveNode, 'tb', { parent: 'a1', slot: 'default', index: 0 }).ok, true);
  assert.deepEqual(ids(editing.node('a1').slots.default), ['tb', 'h1', 'p1', 'p2', 'fx']);
  assert.equal(editing.apply(moveBy, 'fx', -1).ok, true, 'within its own slot');
  assert.equal(editing.apply(moveNode, 'fx', { parent: 'a1', slot: 'default', index: 0 }).ok, true);
  const area = editing.apply(insertNode, { id: 'a2', type: 'layout.area' }, placeAfter(editing.state, 'a1'));
  assert.equal(area.ok, true);
  assert.equal(editing.apply(moveNode, 'fx', { parent: 'a2', slot: 'default', index: 0 }).reason, 'place', 'an unknown type leaves no slot');
  assert.equal(editing.apply(moveNode, 'tb', { parent: 'a2', slot: 'default', index: 0 }).ok, true, 'a known island goes where its slot rules allow');
  assert.deepEqual(editing.node('tb'), table, 'moved whole and unchanged');
});

test('island copy / cut / paste: the whole node; a paste gets fresh ids for it and all its descendants, content unchanged', () => {
  const editing = islands();
  const copied = copyNodes(editing.state, ['fx'], editing.context);
  assert.deepEqual(copied.clipboard.nodes, [foreign]);
  const pasted = editing.apply(pasteNodes, copied.clipboard, { parent: 'a1', slot: 'default', index: 5 });
  assert.equal(pasted.reason, 'place', 'an unknown type is pasted into no slot');
  const cutTable = editing.apply(cutNodes, ['tb']);
  assert.deepEqual(cutTable.clipboard.nodes, [table]);
  const back = editing.apply(pasteNodes, cutTable.clipboard, { parent: 'a1', slot: 'default', index: 0 });
  assert.equal(back.ok, true);
  const node = editing.node(back.ids[0]);
  assert.notEqual(node.id, 'tb', 'never the old id, even after a cut');
  assert.deepEqual({ ...node, id: 'tb' }, table);
  assert.equal(editing.history.undoDepth, 2);
});

// ------------------------------------------------------------------ the tree and the history

test('tree: locate, walk, insertAt clamps, removeAt, within, idMaker and freshCopy follow the ui-editor helpers', () => {
  const doc = page();
  const at = locate(doc.root, 'p1');
  assert.deepEqual({ parent: at.parent.id, slot: at.slot, index: at.index, ancestors: ids(at.ancestors) }, { parent: 'a1', slot: 'default', index: 1, ancestors: ['regs', 'mn', 's1', 'a1'] });
  assert.equal(locate(doc.root, 'none'), null);
  const seen = [];
  walk(doc.root, (node) => { seen.push(node.id); return node.id !== 's1'; });
  assert.deepEqual(seen, ['regs', 'hd', 'logo', 'mn', 's1', 's2', 'cards', 'ft', 'copy']);
  assert.deepEqual(childrenOf(locate(doc.root, 'a1').node).map((entry) => `${entry.slot}:${entry.index}:${entry.node.id}`), ['default:0:h1', 'default:1:p1', 'default:2:p2']);
  const area = locate(doc.root, 'a1').node;
  insertAt(area, 'default', 99, { id: 'z', type: 'content.paragraph' });
  insertAt(area, 'default', -5, { id: 'y', type: 'content.paragraph' });
  assert.deepEqual(ids(area.slots.default), ['y', 'h1', 'p1', 'p2', 'z']);
  assert.equal(removeAt(area, 'default', 0).id, 'y');
  assert.equal(removeAt(area, 'none', 0), null);
  assert.equal(within(doc.root, 's1', 'p1'), true);
  assert.equal(within(doc.root, 's2', 'p1'), false);
  assert.equal(within(doc.root, 'p1', 'p1'), true);
  const size = idsOf(doc.root).size;
  const next = idMaker(doc.root, 'e');
  assert.equal(next(), `e${(size + 1).toString(36)}`, 'the count starts at the number of ids, base 36');
  next.reserve({ id: `e${(size + 2).toString(36)}` });
  assert.equal(next(), `e${(size + 3).toString(36)}`, 'a reserved id is never given');
  const bound = { id: 'b', type: 'layout.section', slots: { default: [{ id: 'c', type: 'sample.cards', bindings: [{ owner: 'section', ref: 'b#open' }, { owner: 'host', ref: 'b#open' }] }] } };
  const copy = freshCopy(bound, idMaker(bound, 'n'));
  assert.notEqual(copy.id, 'b');
  assert.equal(copy.slots.default[0].bindings[0].ref, `${copy.id}#open`, 'a section link follows the copy');
  assert.equal(copy.slots.default[0].bindings[1].ref, 'b#open', 'other links stay');
});

test('history: depth, pause and groups as in ui-editor (200 steps, 800 ms)', () => {
  assert.deepEqual([HISTORY_DEPTH, TYPING_PAUSE], [200, 800]);
  let clock = 0;
  const history = createHistory({ depth: 3, now: () => clock });
  assert.deepEqual(history.undo({ n: 0 }), { ok: false, reason: 'empty' });
  history.record({ n: 1 }, { group: 'p/content' });
  clock += 799;
  history.record({ n: 2 }, { group: 'p/content' });
  assert.equal(history.undoDepth, 1, 'within the pause the run goes on');
  clock += 801;
  history.record({ n: 3 }, { group: 'p/content' });
  history.record({ n: 4 }, { group: 'q/content' });
  history.record({ n: 5 });
  assert.equal(history.undoDepth, 3, 'the depth drops the oldest');
  history.record({ n: 6 }, { group: 'q/content' });
  assert.equal(history.undoDepth, 3, 'structure ends a run');
  const back = history.undo({ n: 7 });
  assert.deepEqual(back, { ok: true, state: { n: 6 } });
  assert.equal(history.canRedo, true);
  history.record({ n: 8 }, { group: 'q/content' });
  assert.equal(history.canRedo, false, 'a new step clears redo');
  assert.equal(history.undoDepth, 3, 'undo ended the run: the typing after it is a new step');
  assert.deepEqual(history.amend({ n: 'before both' }), { ok: true });
  assert.deepEqual(history.undo({ n: 9 }).state, { n: 'before both' }, 'amend keeps the state before two changes made as one');
  history.clear();
  assert.deepEqual(history.amend({}), { ok: false, reason: 'empty' });
});

test('undo keeps a selection only on ids the restored Document holds', () => {
  const editing = session();
  editing.apply(splitBlock, 'p1', 5);
  editing.undo();
  assert.deepEqual(editing.selection, { block: null, text: null });
  editing.select('p2', 'content', 1);
  editing.apply(setText, 'p2', 'content', t('Second!'));
  editing.undo();
  assert.deepEqual(editing.selection, { block: 'p2', text: { id: 'p2', key: 'content', offset: 1 } });
});

test('pure functions accept no context and read the built-in types', () => {
  const state = createState(page());
  assert.equal(select(state, 'p1', 'content').ok, true);
  assert.equal(splitBlock(state, 'p1', 5).ok, true);
  assert.equal(moveBy(state, 'p2', -1).ok, true);
});
