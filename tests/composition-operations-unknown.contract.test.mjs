// Owner requirement for every composition stage (DEV letter msg-cdcb39c2):
// content the Framework does not know - unknown blocks, unknown inline
// components and nodes, unknown marks - survives not only opening but
// editing, copying, cutting and pasting, moving, deleting a neighbour,
// Enter and Backspace beside it, and undo / redo of each. It goes only when
// the person removes that node itself (removeNode of it, or of a block that
// holds it). Fixed cases over src/core/js/composition/operations.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';

import Composition from '../src/core/js/composition/index.mjs';
import { replaceRange, toSegments } from '../src/core/js/composition/inline-model.mjs';
import {
  copyNodes, createSession, cutNodes, duplicateNode, insertBreak, joinBack, moveBy, moveNode, pasteNodes, removeNode, setBlockType,
  setLink, setText, splitBlock, toggleMark,
} from '../src/core/js/composition/operations.mjs';
import { walk } from '../src/core/js/composition/tree.mjs';

const registry = Composition.extendRegistry([]);
const MENTION = { type: 'mention', user: 'u-7', label: '@Rim' };
const CHIP = { type: 'component', name: 'future-chip', props: { tone: 'warm', count: 3 } };
const NOTE = { type: 'footnote', ref: 'n1', children: [{ type: 'text', value: 'inner' }] };
const WIDGET = { id: 'w1', type: 'vendor.widget', props: { mode: 'x' }, data: { rows: [1, 2, 3] }, extensions: { 'vendor:meta': { v: 2 } }, slots: { inner: [{ id: 'w1a', type: 'vendor.part', data: { a: 1 } }, { id: 'w1b', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'inside' }] } }] } };
const GADGET = { id: 'g1', type: 'vendor.gadget', data: { any: true } };

// p1: "Hi " underline "there" [mention] " and " [chip] " end" [footnote]
const P1 = [
  { type: 'text', value: 'Hi ' },
  { type: 'text', value: 'there', marks: ['underline'] },
  MENTION,
  { type: 'text', value: ' and ', marks: ['strong', 'x-glow'] },
  CHIP,
  { type: 'text', value: ' end' },
  NOTE,
];

function page() {
  return {
    schema: 'simai.composition.document', schema_version: 1, id: 'doc', profile: 'ui-layout', locale: 'en',
    root: { id: 'mn', type: 'layout.region', props: { name: 'main', landmark: 'main' }, slots: { default: [
      { id: 's1', type: 'layout.section', slots: { default: [
        { id: 'a1', type: 'layout.area', slots: { default: [
          { id: 'h1', type: 'content.heading', data: { level: 1, content: [{ type: 'text', value: 'Title' }] } },
          { id: 'p1', type: 'content.paragraph', data: { content: P1 } },
          { id: 'p2', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'Before the widget' }] } },
          WIDGET,
          { id: 'p3', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'After' }, CHIP] } },
          { id: 'q1', type: 'content.quote', slots: { default: [GADGET, { id: 'q1p', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'quoted' }] } }] } },
        ] } },
      ] } },
      { id: 's2', type: 'layout.section', slots: { default: [{ id: 'a2', type: 'layout.area', slots: { default: [] } }] } },
    ] } },
  };
}

const json = (value) => JSON.stringify(value);
const strip = (value) => JSON.parse(JSON.stringify(value, (key, entry) => (key === 'id' ? undefined : entry)));
const UNKNOWN_MARKS = ['underline', 'x-glow'];

/** What the Framework does not know in a Document, as multisets: blocks (without ids), inline entries, characters per unknown mark. */
function unknowns(document) {
  const blocks = [];
  const inline = [];
  const marks = Object.fromEntries(UNKNOWN_MARKS.map((mark) => [mark, 0]));
  walk(document.root, (node) => {
    if (!registry.types.has(node.type)) {
      blocks.push(json(strip(node)));
      return false;
    }
    for (const value of Object.values(node.data ?? {})) {
      if (!Array.isArray(value)) continue;
      for (const segment of toSegments(value)) {
        if (segment.node) inline.push(json(segment.node));
        for (const mark of segment.marks) if (mark in marks) marks[mark] += segment.text.length;
      }
    }
  });
  return { blocks: blocks.sort(), inline: inline.sort(), marks };
}

const count = (list) => list.reduce((map, entry) => map.set(entry, (map.get(entry) ?? 0) + 1), new Map());
/** Every unknown thing of `before` is still in `after` (as many times or more). */
function survives(before, after, label) {
  for (const kind of ['blocks', 'inline']) {
    const have = count(after[kind]);
    for (const [entry, times] of count(before[kind])) assert.ok((have.get(entry) ?? 0) >= times, `${label}: ${kind} ${entry} lost`);
  }
  for (const mark of UNKNOWN_MARKS) assert.ok(after.marks[mark] >= before.marks[mark], `${label}: mark ${mark} lost (${before.marks[mark]} -> ${after.marks[mark]})`);
}
/** Unknown blocks by id: each still there, byte for byte. */
function sameById(before, after, ids, label) {
  for (const id of ids) {
    const find = (document) => { let found = null; walk(document.root, (node) => { if (node.id === id) found = node; }); return found; };
    assert.equal(json(find(after)), json(find(before)), `${label}: ${id} changed`);
  }
}

const session = () => createSession({ document: page(), context: { registry }, history: { now: () => 0 } });
const content = (editing, id) => editing.node(id).data.content;
const run = (value, marks = []) => ({ text: value, marks, href: null });

/**
 * One case: runs `act` in a fresh session, checks that every unknown thing
 * survives, then that undo returns the Document before byte for byte, redo
 * the one after, and undo again the one before.
 */
function check(label, act, { byId = ['w1', 'g1'], steps = null, unchanged = false } = {}) {
  const editing = session();
  const start = json(editing.document);
  const before = unknowns(editing.document);
  const outcome = act(editing);
  const after = json(editing.document);
  if (unchanged) assert.equal(after, start, `${label}: back where it started`);
  else assert.notEqual(after, start, `${label}: the edit changed the Document`);
  survives(before, unknowns(editing.document), label);
  if (byId) sameById(JSON.parse(start), editing.document, byId, label);
  const depth = editing.history.undoDepth;
  if (steps !== null) assert.equal(depth, steps, `${label}: history steps`);
  for (let index = 0; index < depth; index += 1) assert.equal(editing.undo().ok, true);
  assert.equal(json(editing.document), start, `${label}: undo returns the Document exactly`);
  survives(before, unknowns(editing.document), `${label} after undo`);
  for (let index = 0; index < depth; index += 1) assert.equal(editing.redo().ok, true);
  assert.equal(json(editing.document), after, `${label}: redo returns the edit exactly`);
  survives(before, unknowns(editing.document), `${label} after redo`);
  for (let index = 0; index < depth; index += 1) editing.undo();
  assert.equal(json(editing.document), start, `${label}: undo after redo`);
  return outcome;
}

const ok = (result, label) => {
  assert.equal(result.ok, true, `${label}: ${result.reason ?? ''}`);
  return result;
};

test('the fixture holds every kind of unknown content, and opening it changes nothing', () => {
  const editing = session();
  assert.equal(json(editing.document), json(page()));
  const found = unknowns(editing.document);
  assert.equal(found.blocks.length, 2, 'vendor.widget (with its parts) and vendor.gadget');
  assert.equal(found.inline.length, 4, 'mention, chip (twice) and footnote');
  assert.deepEqual(found.marks, { underline: 5, 'x-glow': 5 });
});

test('setText around unknown inline content and marks: typing before, between and after keeps every entry', () => {
  check('type before', (editing) => ok(editing.apply(setText, 'p1', 'content', replaceRange(content(editing, 'p1'), 0, 0, [run('>> ')])), 'type before'), { steps: 1 });
  check('type between', (editing) => ok(editing.apply(setText, 'p1', 'content', replaceRange(content(editing, 'p1'), 9, 9, [run('!')])), 'between'));
  check('type after the last atom', (editing) => ok(editing.apply(setText, 'p1', 'content', replaceRange(content(editing, 'p1'), 20, 20, [run(' more')])), 'after'));
  check('delete plain letters next to atoms', (editing) => ok(editing.apply(setText, 'p1', 'content', replaceRange(content(editing, 'p1'), 0, 3, [])), 'delete'));
  check('a run of typing', (editing) => {
    for (const letter of ['a', 'b', 'c']) editing.apply(setText, 'p1', 'content', replaceRange(content(editing, 'p1'), 0, 0, [run(letter)]));
  }, { steps: 1 });
  check('insertBreak beside an atom', (editing) => ok(editing.apply(insertBreak, 'p1', 'content', 8), 'break'));
});

test('toggleMark and setLink over ranges that hold unknown inline content and marks keep it', () => {
  check('strong over everything', (editing) => ok(editing.apply(toggleMark, 'p1', 'content', 0, 20, 'strong'), 'strong'));
  check('strong on and off', (editing) => {
    ok(editing.apply(toggleMark, 'p1', 'content', 0, 20, 'em'), 'em on');
    ok(editing.apply(toggleMark, 'p1', 'content', 0, 20, 'em'), 'em off');
  }, { steps: 2, unchanged: true });
  check('code over the underlined word and the mention', (editing) => ok(editing.apply(toggleMark, 'p1', 'content', 3, 9, 'code'), 'code'));
  check('link over everything', (editing) => ok(editing.apply(setLink, 'p1', 'content', 0, 20, 'https://example.com/a'), 'link'));
  check('link on and off', (editing) => {
    ok(editing.apply(setLink, 'p1', 'content', 0, 20, '/a'), 'link on');
    ok(editing.apply(setLink, 'p1', 'content', 0, 20, null), 'link off');
  }, { steps: 2, unchanged: true });
  const editing = session();
  editing.apply(toggleMark, 'p1', 'content', 0, 20, 'strong');
  editing.apply(toggleMark, 'p1', 'content', 0, 20, 'strong');
  const unknownMarks = toSegments(content(editing, 'p1')).filter((segment) => segment.marks.some((mark) => UNKNOWN_MARKS.includes(mark)));
  assert.deepEqual(unknownMarks.map((segment) => [segment.text, segment.marks]), [['there', ['underline']], [' and ', ['x-glow']]], 'strong toggled away over the range; the unknown marks stay on their letters');
});

test('copy, cut and paste carry unknown blocks and inline content whole', () => {
  const copied = copyNodes(session().state, ['p1', 'w1', 'q1'], { registry });
  assert.deepEqual(copied.clipboard.nodes.map((node) => node.id), ['p1', 'w1', 'q1']);
  assert.equal(json(copied.clipboard.nodes[1]), json(WIDGET), 'the unknown block, byte for byte');
  check('paste a paragraph with unknown inline content', (editing) => {
    const clip = copyNodes(editing.state, ['p1'], editing.context).clipboard;
    ok(editing.apply(pasteNodes, clip, { parent: 'a2', slot: 'default', index: 0 }), 'paste');
    const pasted = editing.node('a2').slots.default[0];
    assert.equal(json(pasted.data.content), json(content(editing, 'p1')));
  });
  check('paste an area that holds an unknown block', (editing) => {
    const clip = copyNodes(editing.state, ['a1'], editing.context).clipboard;
    ok(editing.apply(pasteNodes, clip, { parent: 's2', slot: 'default', index: 1 }), 'paste area');
    const copy = editing.node('s2').slots.default[1];
    const widget = copy.slots.default.find((node) => node.type === 'vendor.widget');
    assert.notEqual(widget.id, 'w1', 'fresh id');
    assert.equal(json(strip(widget)), json(strip(WIDGET)), 'unknown block content unchanged');
  });
  check('cut a quote that holds an unknown block and paste it back', (editing) => {
    const cut = ok(editing.apply(cutNodes, ['q1']), 'cut');
    ok(editing.apply(pasteNodes, cut.clipboard, { parent: 'a2', slot: 'default', index: 0 }), 'paste back');
  }, { byId: null, steps: 2 });
  check('duplicate the paragraph with atoms', (editing) => ok(editing.apply(duplicateNode, 'p3'), 'duplicate'));
});

test('moving around and with unknown content keeps it', () => {
  check('move a neighbour over the unknown block', (editing) => ok(editing.apply(moveNode, 'p2', { parent: 'a1', slot: 'default', index: 5 }), 'move p2'));
  check('the unknown block one step up (its own slot)', (editing) => ok(editing.apply(moveBy, 'w1', -1), 'moveBy w1'));
  check('the paragraph with atoms into another area', (editing) => ok(editing.apply(moveNode, 'p1', { parent: 'a2', slot: 'default', index: 0 }), 'move p1'));
  check('the area holding the unknown block into another section', (editing) => ok(editing.apply(moveNode, 'a1', { parent: 's2', slot: 'default', index: 1 }), 'move a1'));
  const editing = session();
  assert.equal(editing.apply(moveNode, 'w1', { parent: 'a2', slot: 'default', index: 0 }).reason, 'place', 'an unknown block leaves no slot of its own');
  assert.equal(json(editing.document), json(page()));
});

test('deleting a neighbour never takes unknown content with it', () => {
  check('the paragraph before the unknown block', (editing) => ok(editing.apply(removeNode, 'p2'), 'remove p2'));
  check('the next section', (editing) => ok(editing.apply(removeNode, 's2'), 'remove s2'));
  check('the paragraph beside the unknown block in a quote', (editing) => ok(editing.apply(removeNode, 'q1p'), 'remove q1p'));
  check('the heading', (editing) => ok(editing.apply(removeNode, 'h1'), 'remove h1'));
});

test('Enter and Backspace next to unknown content keep it', () => {
  check('Enter right before the mention', (editing) => {
    const split = ok(editing.apply(splitBlock, 'p1', 8), 'split');
    assert.equal(json(content(editing, split.id)[0]), json(MENTION), 'the mention starts the new block');
  });
  check('Enter right after the chip', (editing) => ok(editing.apply(splitBlock, 'p1', 15), 'split after chip'));
  check('Enter at the end of the paragraph before the unknown block', (editing) => ok(editing.apply(splitBlock, 'p2', 17), 'split p2'));
  check('Enter and Backspace back: the atoms are where they were', (editing) => {
    const split = ok(editing.apply(splitBlock, 'p1', 9), 'split');
    ok(editing.apply(joinBack, split.id), 'join');
    assert.equal(json(content(editing, 'p1')), json(page().root.slots.default[0].slots.default[0].slots.default[1].data.content));
  }, { steps: 2, unchanged: true });
  check('Backspace into the paragraph with atoms', (editing) => ok(editing.apply(joinBack, 'p2'), 'join p2 into p1'));
  const editing = session();
  assert.equal(editing.apply(joinBack, 'p3').reason, 'island', 'Backspace after an unknown block does not join into it');
  assert.equal(editing.apply(splitBlock, 'w1', 0).reason, 'island');
  assert.equal(json(editing.document), json(page()));
});

test('changing a block type keeps unknown inline content and every other part of the node', () => {
  check('paragraph with atoms to heading', (editing) => {
    ok(editing.apply(setBlockType, 'p1', 'content.heading', { level: 2 }), 'heading');
    assert.equal(json(content(editing, 'p1')), json(P1));
  });
  const editing = createSession({ document: { ...page(), root: { id: 'r', type: 'layout.area', slots: { default: [{ id: 'x', type: 'content.paragraph', props: { align: 'end' }, extensions: { 'vendor:note': 1 }, data: { content: [CHIP], future: 'kept' } }] } } }, context: { registry } });
  ok(editing.apply(setBlockType, 'x', 'content.heading', { level: 3 }), 'to heading');
  ok(editing.apply(setBlockType, 'x', 'content.paragraph'), 'back');
  assert.deepEqual(editing.node('x'), { id: 'x', type: 'content.paragraph', props: { align: 'end' }, extensions: { 'vendor:note': 1 }, data: { content: [CHIP], future: 'kept' } });
});

test('an edit that would take away a block holding more than its text is refused, not lossy', () => {
  const document = { ...page(), root: { id: 'r', type: 'layout.area', slots: { default: [
    { id: 'a', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'one' }] } },
    { id: 'b', type: 'content.paragraph', extensions: { 'vendor:meta': true }, data: { content: [{ type: 'text', value: 'two' }] } },
    { id: 'c', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'three' }], future: 1 } },
    { id: 'l', type: 'content.list', slots: { items: [
      { id: 'i1', type: 'content.list-item', data: { content: [{ type: 'text', value: 'x' }] } },
      { id: 'i2', type: 'content.list-item', bindings: [{ owner: 'host', ref: 'v#open' }], data: { content: [] } },
    ] } },
    { id: 'm', type: 'content.list', extensions: { 'vendor:list': 1 }, slots: { items: [{ id: 'j1', type: 'content.list-item', data: { content: [] } }] } },
  ] } } };
  const editing = createSession({ document, context: { registry } });
  assert.equal(editing.apply(joinBack, 'b').reason, 'would-lose', 'an extension');
  assert.equal(editing.apply(joinBack, 'c').reason, 'would-lose', 'data a newer producer wrote');
  assert.equal(editing.apply(splitBlock, 'i2', 0).reason, 'would-lose', 'an empty list item with a binding');
  assert.equal(editing.apply(splitBlock, 'j1', 0).reason, 'would-lose', 'the only item of a list with an extension');
  assert.equal(json(editing.document), json(document));
  assert.equal(editing.apply(removeNode, 'b').ok, true, 'the person removes it on purpose');
});

test('unknown content goes only when the person removes that node (or a block holding it), and undo brings it back exactly', () => {
  for (const id of ['w1', 'g1', 'p1', 'q1']) {
    const editing = session();
    const start = json(editing.document);
    ok(editing.apply(removeNode, id), `remove ${id}`);
    assert.equal(editing.node(id), null);
    editing.undo();
    assert.equal(json(editing.document), start, `undo restores ${id} exactly`);
  }
});
