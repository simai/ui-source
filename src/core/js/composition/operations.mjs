// Editing operations over a Composition Document (composition F3.1, draft).
//
// An editor's state is {document, selection}. Every operation is a pure
// function: it takes a state and returns {ok: true, state, ...} with a new
// state (the old one is never changed), or {ok: false, reason} and changes
// nothing. A result may carry `group` (a typing key): the history keeps a run
// of the same group as one step (history.mjs). The DOM reads the person's
// intent and calls an operation; it never edits the Document itself.
//
// selection: {block, text} - `block` is the id of the chosen block (or null),
// `text` is {id, key, offset?} when the caret is in a text field (or null).
//
// context (the last argument of each operation, optional):
//   registry    - a Composition registry (Composition.extendRegistry(...));
//                 by default the built-in types;
//   isIsland    - (node, registry) -> boolean; by default islandOf below;
//   lockOf      - (id) -> reason | null: a node the person may not change;
//   placeLock   - (parentId) -> reason | null: a place the person may not change;
//   adjust      - (parent) -> void: settles a parent after its children
//                 changed (an editor's columns), on the new Document;
//   idPrefix    - the prefix of new ids ('e').
//
// Provenance: the shared editing parts of SIMAI Editor (ui-editor EditorModel
// and tree.mjs) were moved into the SIMAI Framework core by their
// rightholder, Rim Zabarov (owner decision 2026-11-10). Written for the
// Framework and licensed with it (REUSE.toml: Apache-2.0); no SIMAI Editor
// code is imported.
import { BUILTIN_TYPE_MANIFESTS } from './builtins.mjs';
import { slotAccepts } from './catalogue.mjs';
import { textFields } from './composed.mjs';
import { INLINE_MARKS, breakSegment, inlineLength, inlineText, normalizeInline, replaceRange, safeHref, setLink as linkRange, sliceInline, toggleMark as toggleRange } from './inline-model.mjs';
import { createHistory } from './history.mjs';
import { clone, freshCopy, idMaker, idsOf, insertAt, isPlainObject, locate, removeAt, same, walk } from './tree.mjs';

export const OPERATIONS_VERSION = '0.2.0';
export const CLIPBOARD_TYPE = 'application/x-simai-composition';
export const CLIPBOARD_SCHEMA = 'simai.composition.clipboard';

/** Types edited as one closed unit: no caret inside, no formatting, moved and copied whole. */
export const ISLAND_TYPES = Object.freeze(['content.table', 'content.foreign']);

/** Text blocks Enter splits and Backspace joins. */
export const TEXT_BLOCKS = Object.freeze(['content.paragraph', 'content.heading', 'content.list-item']);

/** Text blocks setBlockType turns into each other. */
export const BLOCK_TYPES = Object.freeze(['content.paragraph', 'content.heading']);

/** Every refusal an operation gives, with what it means. */
export const REFUSALS = Object.freeze({
  unknown: 'no such node, place or input',
  place: 'the slot does not take this type, or is full; or the node or place lies inside an island, which changes only as a whole',
  required: 'the slot would hold fewer nodes than its minimum',
  'inside-itself': 'a node cannot move into its own subtree',
  same: 'the node is already there or of that type',
  edge: 'no sibling on that side',
  first: 'nothing before it to join',
  'not-text': 'not a text block or not a text field',
  island: 'an island takes no caret, typing or format; it changes only as a whole',
  mark: 'not an inline mark',
  href: 'the link is not safe',
  range: 'the offsets are outside the text',
  empty: 'nothing to undo, redo or paste',
  'would-lose': 'the block that would go holds more than its text (extensions, bindings, other data); remove it on purpose',
  'id-taken': 'an id of the inserted node is already in the Document',
});

const refused = (reason) => ({ ok: false, reason });

let builtinRegistry = null;
function registryOf(context) {
  if (context?.registry?.types instanceof Map) return context.registry;
  builtinRegistry ??= { types: new Map(BUILTIN_TYPE_MANIFESTS.map((manifest) => [manifest.type, manifest])), renderers: new Map() };
  return builtinRegistry;
}

/** The default island rule: content.table, content.foreign and every type the registry does not know. */
export function islandOf(node, registry) {
  if (!isPlainObject(node)) return false;
  return ISLAND_TYPES.includes(node.type) || !(registry?.types instanceof Map && registry.types.has(node.type));
}

const islandIn = (node, context) => (context?.isIsland ?? islandOf)(node, registryOf(context));

/**
 * The island a node lies inside: its nearest ancestor that is an island, or
 * null. An island is closed as a whole, so a node inside one (a known child of
 * an unknown block too) may do nothing on its own: every operation aimed at
 * it, or at a place inside it, is refused with `place`. Copying it reads and
 * is allowed. An editor that meets this refusal chooses the island instead.
 */
export function islandAround(state, id, context) {
  const at = locate(state?.document?.root, id);
  if (!at) return null;
  for (let index = at.ancestors.length - 1; index >= 0; index -= 1) {
    if (islandIn(at.ancestors[index], context)) return at.ancestors[index].id ?? null;
  }
  return null;
}
const insideIsland = (state, id, context) => islandAround(state, id, context) !== null;
// A place is closed when its parent is an island or lies inside one.
const closedPlace = (state, parentId, context) => islandIn(locate(state?.document?.root, parentId)?.node, context) || insideIsland(state, parentId, context);
const lockOf = (id, context) => context?.lockOf?.(id) ?? null;
const placeLock = (parentId, context) => context?.placeLock?.(parentId) ?? null;

/** A new empty editing state for a Document. */
export function createState(document, selection = null) {
  return { document: clone(document), selection: normalizeSelection(selection) };
}

function normalizeSelection(selection) {
  if (!isPlainObject(selection)) return { block: null, text: null };
  const text = isPlainObject(selection.text) && selection.text.id !== undefined ? { ...selection.text } : null;
  return { block: selection.block ?? null, text };
}

// Whether a text block that an edit would take away (joined into the block
// before it, or an empty list item left by Enter) holds anything besides its
// text (and a heading's level): then the edit is refused rather than drop it.
const TEXT_DATA_KEYS = new Set(['content', 'level']);
const NODE_KEYS = new Set(['id', 'type', 'data', 'props', 'slots']);
function holdsMore(node) {
  if (!isPlainObject(node)) return false;
  if (Object.keys(node).some((key) => !NODE_KEYS.has(key))) return true;
  if (isPlainObject(node.data) && Object.keys(node.data).some((key) => !TEXT_DATA_KEYS.has(key))) return true;
  if (isPlainObject(node.props) && Object.keys(node.props).length) return true;
  return Object.values(isPlainObject(node.slots) ? node.slots : {}).some((list) => Array.isArray(list) && list.length);
}

// A draft of the next state: a deep copy of the Document to change in place.
function draft(state) {
  return { document: clone(state.document), selection: normalizeSelection(state.selection) };
}

const rootOf = (state) => state?.document?.root;
const nodeOf = (state, id) => locate(rootOf(state), id)?.node ?? null;
const manifestOf = (type, context) => registryOf(context).types.get(type);
const fieldsOf = (node, context) => textFields(manifestOf(node?.type, context));

/** Whether a slot of a node takes a type, counting its `max` (and `adding` more nodes). */
export function accepts(state, parentId, slot, type, context, adding = 1) {
  const parent = nodeOf(state, parentId);
  if (!parent) return false;
  const registry = registryOf(context);
  const manifest = registry.types.get(parent.type);
  if (!slotAccepts(registry, manifest, slot, type)) return false;
  const max = manifest.slots?.[slot]?.max;
  return !(Number.isInteger(max) && (parent.slots?.[slot]?.length ?? 0) + adding > max);
}

/** The place right after a node: {parent, slot, index}, or null for the root. */
export function placeAfter(state, id) {
  const at = locate(rootOf(state), id);
  return at?.parent ? { parent: at.parent.id, slot: at.slot, index: at.index + 1 } : null;
}

/** The place at the end of a node's slot (its first slot by default). */
export function placeInside(state, id, slot, context) {
  const node = nodeOf(state, id);
  const name = slot ?? Object.keys(manifestOf(node?.type, context)?.slots ?? {})[0];
  if (!node || !name) return null;
  return { parent: node.id, slot: name, index: node.slots?.[name]?.length ?? 0 };
}

/** Where the caret goes in a node: its own `content` text, else the first such text inside. */
export function typingTarget(node, context) {
  let found = null;
  walk(node, (current) => {
    if (found) return false;
    if (islandIn(current, context)) return false;
    if (fieldsOf(current, context)[0] === 'content') found = { id: current.id, key: 'content' };
    return !found;
  });
  return found;
}

// ------------------------------------------------------------------ selection

/**
 * Chooses a block, or puts the caret in one of its text fields (key). An
 * island is chosen whole: a caret inside it is refused.
 */
export function select(state, id, key = null, offset = undefined, context) {
  if (id === null) return { ok: true, state: { document: state.document, selection: { block: null, text: null } } };
  const node = nodeOf(state, id);
  if (!node) return refused('unknown');
  if (insideIsland(state, id, context)) return refused('place');
  if (key === null) return { ok: true, state: { document: state.document, selection: { block: id, text: null } } };
  if (islandIn(node, context)) return refused('island');
  if (!fieldsOf(node, context).includes(key)) return refused('not-text');
  const text = offset === undefined ? { id, key } : { id, key, offset };
  return { ok: true, state: { document: state.document, selection: { block: id, text } } };
}

// ------------------------------------------------------------------ text

function textTarget(state, id, key, context) {
  const node = nodeOf(state, id);
  if (!node) return { refusal: refused('unknown') };
  const lock = lockOf(id, context);
  if (lock) return { refusal: refused(lock) };
  if (insideIsland(state, id, context)) return { refusal: refused('place') };
  if (islandIn(node, context)) return { refusal: refused('island') };
  if (!fieldsOf(node, context).includes(key)) return { refusal: refused('not-text') };
  const value = node.data?.[key];
  return { node, content: Array.isArray(value) ? value : [] };
}

function writeText(state, id, key, content, selection) {
  const next = draft(state);
  const node = nodeOf(next, id);
  node.data = { ...(node.data ?? {}), [key]: content };
  if (selection) next.selection = selection;
  return next;
}

/** Typing: a text field's new inline content. A run of typing in one field is one history step. */
export function setText(state, id, key, content, context) {
  const target = textTarget(state, id, key, context);
  if (target.refusal) return target.refusal;
  const value = normalizeInline(content);
  if (same(value, target.content)) return { ok: true, state, same: true };
  return { ok: true, state: writeText(state, id, key, value), group: `${id}/${key}` };
}

/** A line break at an offset of a text field; typing, so one run with the letters around it. */
export function insertBreak(state, id, key, offset, context) {
  const target = textTarget(state, id, key, context);
  if (target.refusal) return target.refusal;
  if (!Number.isInteger(offset) || offset < 0 || offset > inlineLength(target.content)) return refused('range');
  const value = replaceRange(target.content, offset, offset, [breakSegment()]);
  return { ok: true, state: writeText(state, id, key, value, { block: id, text: { id, key, offset: offset + 1 } }), group: `${id}/${key}` };
}

/** Toggles an inline mark on [start, end) of a text field; one history step. */
export function toggleMark(state, id, key, start, end, mark, context) {
  if (!INLINE_MARKS.includes(mark)) return refused('mark');
  const target = textTarget(state, id, key, context);
  if (target.refusal) return target.refusal;
  const length = inlineLength(target.content);
  if (![start, end].every((at) => Number.isInteger(at) && at >= 0 && at <= length)) return refused('range');
  const value = toggleRange(target.content, start, end, mark);
  if (same(value, normalizeInline(target.content))) return { ok: true, state, same: true };
  return { ok: true, state: writeText(state, id, key, value) };
}

/** Sets a link on [start, end) of a text field, or removes it (href null); one history step. */
export function setLink(state, id, key, start, end, href, context) {
  if (href !== null && !safeHref(href)) return refused('href');
  const target = textTarget(state, id, key, context);
  if (target.refusal) return target.refusal;
  const length = inlineLength(target.content);
  if (![start, end].every((at) => Number.isInteger(at) && at >= 0 && at <= length)) return refused('range');
  const value = linkRange(target.content, start, end, href);
  if (same(value, normalizeInline(target.content))) return { ok: true, state, same: true };
  return { ok: true, state: writeText(state, id, key, value) };
}

/**
 * Enter in a text block: the words after the caret go to a new block after
 * it (a paragraph, or a new item in a list). Enter on an empty last list item
 * leaves the list: the item becomes a paragraph after the list (the list goes
 * when it held only that item). The result's id and offset say where the
 * caret goes.
 */
export function splitBlock(state, id, offset, context) {
  const next = draft(state);
  const root = rootOf(next);
  const at = locate(root, id);
  if (!at?.parent) return refused('unknown');
  const lock = lockOf(id, context);
  if (lock) return refused(lock);
  if (insideIsland(state, id, context)) return refused('place');
  const node = at.node;
  if (islandIn(node, context)) return refused('island');
  if (!TEXT_BLOCKS.includes(node.type)) return refused('not-text');
  const content = Array.isArray(node.data?.content) ? node.data.content : [];
  const length = inlineLength(content);
  if (!Number.isInteger(offset) || offset < 0 || offset > length) return refused('range');
  const makeId = idMaker(root, context?.idPrefix ?? 'e');
  const items = at.parent.slots[at.slot];
  if (node.type === 'content.list-item' && !length && at.index === items.length - 1) {
    const list = locate(root, at.parent.id);
    if (!list?.parent) return refused('unknown');
    if (holdsMore(node) || (items.length === 1 && Object.keys(list.node).some((key) => !NODE_KEYS.has(key)))) return refused('would-lose');
    // The paragraph takes the list's place (its only item left) or goes after it: the slot rule decides.
    if (closedPlace(state, list.parent.id, context)) return refused('place');
    if (!accepts(state, list.parent.id, list.slot, 'content.paragraph', context, items.length === 1 ? 0 : 1)) return refused('place');
    removeAt(at.parent, at.slot, at.index);
    const paragraph = { id: makeId(), type: 'content.paragraph', data: { content: [] } };
    if (!at.parent.slots[at.slot].length) {
      removeAt(list.parent, list.slot, list.index);
      insertAt(list.parent, list.slot, list.index, paragraph);
    } else {
      insertAt(list.parent, list.slot, list.index + 1, paragraph);
    }
    context?.adjust?.(list.parent);
    next.selection = { block: paragraph.id, text: { id: paragraph.id, key: 'content', offset: 0 } };
    return { ok: true, state: next, id: paragraph.id, offset: 0 };
  }
  const type = node.type === 'content.list-item' ? 'content.list-item' : 'content.paragraph';
  if (!accepts(state, at.parent.id, at.slot, type, context)) return refused('place');
  node.data = { ...(node.data ?? {}), content: normalizeInline(sliceInline(content, 0, offset)) };
  const fresh = { id: makeId(), type, data: { content: normalizeInline(sliceInline(content, offset, length)) } };
  insertAt(at.parent, at.slot, at.index + 1, fresh);
  next.selection = { block: fresh.id, text: { id: fresh.id, key: 'content', offset: 0 } };
  return { ok: true, state: next, id: fresh.id, offset: 0 };
}

/** Backspace at a text block's start: it joins the text block before it. */
export function joinBack(state, id, context) {
  const next = draft(state);
  const at = locate(rootOf(next), id);
  if (!at?.parent) return refused('unknown');
  const lock = lockOf(id, context);
  if (lock) return refused(lock);
  if (insideIsland(state, id, context)) return refused('place');
  if (at.index === 0) return refused('first');
  const previous = at.parent.slots[at.slot][at.index - 1];
  if (islandIn(previous, context) || islandIn(at.node, context)) return refused('island');
  if (!TEXT_BLOCKS.includes(previous.type) || !TEXT_BLOCKS.includes(at.node.type)) return refused('not-text');
  if (holdsMore(at.node)) return refused('would-lose');
  // The joined block leaves its slot: the slot rule (its min) decides, as for a removal.
  const min = manifestOf(at.parent.type, context)?.slots?.[at.slot]?.min ?? 0;
  if (at.parent.slots[at.slot].length <= min) return refused('required');
  const before = Array.isArray(previous.data?.content) ? previous.data.content : [];
  const own = Array.isArray(at.node.data?.content) ? at.node.data.content : [];
  const offset = inlineLength(before);
  previous.data = { ...(previous.data ?? {}), content: normalizeInline([...before, ...own]) };
  removeAt(at.parent, at.slot, at.index);
  next.selection = { block: previous.id, text: { id: previous.id, key: 'content', offset } };
  return { ok: true, state: next, id: previous.id, offset };
}

/**
 * Turns a text block into another (paragraph <-> heading); the text stays.
 * A heading takes `level` (2 by default). One history step.
 */
export function setBlockType(state, id, type, { level } = {}, context) {
  const next = draft(state);
  const at = locate(rootOf(next), id);
  if (!at?.parent) return refused('unknown');
  const lock = lockOf(id, context);
  if (lock) return refused(lock);
  if (insideIsland(state, id, context)) return refused('place');
  if (islandIn(at.node, context)) return refused('island');
  if (!BLOCK_TYPES.includes(at.node.type) || !BLOCK_TYPES.includes(type)) return refused('not-text');
  const wantLevel = type === 'content.heading' ? (Number.isInteger(level) ? level : at.node.data?.level ?? 2) : undefined;
  if (at.node.type === type && (type !== 'content.heading' || at.node.data?.level === wantLevel)) return refused('same');
  if (at.node.type !== type && !accepts(next, at.parent.id, at.slot, type, context, 0)) return refused('place');
  // Only the type and the level change: every other part of the node (its
  // props, extensions, data a newer producer wrote) stays as it was.
  const { level: _level, ...rest } = isPlainObject(at.node.data) ? at.node.data : {};
  at.node.type = type;
  at.node.data = type === 'content.heading' ? { level: wantLevel, ...rest } : rest;
  if (!Array.isArray(at.node.data.content)) at.node.data.content = [];
  return { ok: true, state: next, id };
}

// ------------------------------------------------------------------ structure

/**
 * Inserts a node at a place {parent, slot, index}. Its ids must be new to the
 * Document. The caret goes into its first text when it has one.
 */
export function insertNode(state, node, place, context) {
  if (!isPlainObject(node) || !place) return refused('unknown');
  if (!nodeOf(state, place.parent)) return refused('unknown');
  const lock = placeLock(place.parent, context);
  if (lock) return refused(lock);
  if (closedPlace(state, place.parent, context)) return refused('place');
  if (!accepts(state, place.parent, place.slot, node.type, context)) return refused('place');
  const taken = idsOf(rootOf(state));
  for (const id of idsOf(node)) if (taken.has(id)) return refused('id-taken');
  const next = draft(state);
  const parent = nodeOf(next, place.parent);
  const copy = clone(node);
  insertAt(parent, place.slot, place.index, copy);
  context?.adjust?.(parent);
  const typing = typingTarget(copy, context);
  next.selection = { block: copy.id, text: typing };
  return { ok: true, state: next, id: copy.id, typing: Boolean(typing) };
}

/** Removes a node (an island too: whole). The selection goes to a neighbour, else to the parent. */
export function removeNode(state, id, context) {
  const at = locate(rootOf(state), id);
  if (!at?.parent) return refused('unknown');
  const lock = placeLock(at.parent.id, context) ?? lockOf(id, context);
  if (lock) return refused(lock);
  if (insideIsland(state, id, context)) return refused('place');
  const min = manifestOf(at.parent.type, context)?.slots?.[at.slot]?.min ?? 0;
  if (at.parent.slots[at.slot].length <= min) return refused('required');
  const next = draft(state);
  const parent = nodeOf(next, at.parent.id);
  removeAt(parent, at.slot, at.index);
  context?.adjust?.(parent);
  const list = parent.slots[at.slot];
  let chosen = (list[Math.min(at.index, list.length - 1)] ?? parent).id;
  if (chosen === rootOf(next).id) chosen = null;
  next.selection = { block: chosen, text: null };
  return { ok: true, state: next, id: chosen };
}

/**
 * Moves a node to a place {parent, slot, index}; the index is read before
 * the node leaves. A type the registry does not know moves only within its
 * own slot. The caret stays where it was.
 */
export function moveNode(state, id, place, context) {
  const at = locate(rootOf(state), id);
  if (!at?.parent || !place) return refused('unknown');
  if (!nodeOf(state, place.parent)) return refused('unknown');
  const lock = placeLock(at.parent.id, context) ?? placeLock(place.parent, context);
  if (lock) return refused(lock);
  if (insideIsland(state, id, context) || closedPlace(state, place.parent, context)) return refused('place');
  if (locate(at.node, place.parent)) return refused('inside-itself');
  const sameSlot = place.parent === at.parent.id && place.slot === at.slot;
  if (!sameSlot && !accepts(state, place.parent, place.slot, at.node.type, context)) return refused('place');
  const index = sameSlot && place.index > at.index ? place.index - 1 : place.index;
  if (sameSlot && index === at.index) return refused('same');
  const min = manifestOf(at.parent.type, context)?.slots?.[at.slot]?.min ?? 0;
  if (!sameSlot && at.parent.slots[at.slot].length <= min) return refused('required');
  const next = draft(state);
  const from = nodeOf(next, at.parent.id);
  const moved = removeAt(from, at.slot, at.index);
  const to = nodeOf(next, place.parent);
  insertAt(to, place.slot, index, moved);
  context?.adjust?.(from);
  if (to !== from) context?.adjust?.(to);
  next.selection = { block: id, text: next.selection.text };
  return { ok: true, state: next, id, index };
}

/** One step among the siblings (Alt+arrows); the caret stays. */
export function moveBy(state, id, delta, context) {
  const at = locate(rootOf(state), id);
  if (!at?.parent) return refused('unknown');
  const to = at.index + delta;
  if (to < 0 || to >= at.parent.slots[at.slot].length) return refused('edge');
  return moveNode(state, id, { parent: at.parent.id, slot: at.slot, index: delta > 0 ? to + 1 : to }, context);
}

// ------------------------------------------------------------------ copy and paste

function topmost(root, ids) {
  const unique = [...new Set(ids)];
  return unique.filter((id) => !unique.some((other) => other !== id && locate(locate(root, other)?.node, id)));
}

function plainText(node, context) {
  const lines = [];
  walk(node, (current) => {
    for (const key of fieldsOf(current, context)) {
      const value = current.data?.[key];
      if (Array.isArray(value)) {
        const words = inlineText(value).trim();
        if (words) lines.push(words);
      }
    }
  });
  return lines.join('\n');
}

/**
 * Copies whole nodes (an island too) into a clipboard value:
 * {schema, type: 'application/x-simai-composition', nodes, text}. A node
 * inside another copied node goes with it, once. The state does not change.
 */
export function copyNodes(state, ids, context) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return refused('empty');
  const root = rootOf(state);
  if (list.some((id) => !locate(root, id))) return refused('unknown');
  const nodes = topmost(root, list).map((id) => clone(locate(root, id).node));
  return {
    ok: true,
    state,
    clipboard: { schema: CLIPBOARD_SCHEMA, type: CLIPBOARD_TYPE, nodes, text: nodes.map((node) => plainText(node, context)).filter(Boolean).join('\n\n') },
  };
}

/** Cut: copy, then remove the nodes, in one history step. */
export function cutNodes(state, ids, context) {
  const copied = copyNodes(state, ids, context);
  if (!copied.ok) return copied;
  let current = state;
  for (const node of copied.clipboard.nodes) {
    const removed = removeNode(current, node.id, context);
    if (!removed.ok) return removed;
    current = removed.state;
  }
  return { ok: true, state: current, clipboard: copied.clipboard };
}

/**
 * Pastes clipboard nodes at a place {parent, slot, index}: each a copy with
 * new ids for the node and all its descendants; no id already in the
 * Document is reused; the content is unchanged. All or nothing, one step.
 */
export function pasteNodes(state, clipboard, place, context) {
  return pasteInto(state, clipboard, place, context, false);
}

// ownSlot: the copies go into the slot their original stands in (a
// duplicate), so the slot's type rule is not asked again; its max still is.
// That lets an unknown type, which no slot takes, be duplicated beside itself,
// as it may move within its own slot.
function pasteInto(state, clipboard, place, context, ownSlot) {
  const nodes = Array.isArray(clipboard) ? clipboard : clipboard?.nodes;
  if (!Array.isArray(nodes) || !nodes.length) return refused('empty');
  if (!nodes.every(isPlainObject) || !place || !nodeOf(state, place.parent)) return refused('unknown');
  const lock = placeLock(place.parent, context);
  if (lock) return refused(lock);
  if (closedPlace(state, place.parent, context)) return refused('place');
  if (ownSlot) {
    const max = manifestOf(nodeOf(state, place.parent).type, context)?.slots?.[place.slot]?.max;
    if (Number.isInteger(max) && (nodeOf(state, place.parent).slots?.[place.slot]?.length ?? 0) + nodes.length > max) return refused('place');
  } else {
    for (const node of nodes) if (!accepts(state, place.parent, place.slot, node.type, context, nodes.length)) return refused('place');
  }
  const next = draft(state);
  const makeId = idMaker(rootOf(next), context?.idPrefix ?? 'e');
  // Ids of the clipboard are never given again in this paste either.
  for (const node of nodes) makeId.reserve(node);
  const parent = nodeOf(next, place.parent);
  const ids = [];
  nodes.forEach((node, offset) => {
    const copy = freshCopy(node, makeId);
    insertAt(parent, place.slot, place.index + offset, copy);
    ids.push(copy.id);
  });
  context?.adjust?.(parent);
  next.selection = { block: ids[ids.length - 1], text: null };
  return { ok: true, state: next, ids };
}

/** A copy of a node right after it (copy and paste in one step). */
export function duplicateNode(state, id, context) {
  const at = locate(rootOf(state), id);
  if (!at?.parent) return refused('unknown');
  const copied = copyNodes(state, [id], context);
  const pasted = pasteInto(state, copied.clipboard, { parent: at.parent.id, slot: at.slot, index: at.index + 1 }, context, true);
  return pasted.ok ? { ...pasted, id: pasted.ids[0] } : pasted;
}

// ------------------------------------------------------------------ history

/** After undo or redo: a selection keeps only ids the restored Document holds. */
export function settleSelection(state) {
  const selection = normalizeSelection(state.selection);
  const root = rootOf(state);
  return {
    document: state.document,
    selection: {
      block: selection.block !== null && locate(root, selection.block) ? selection.block : null,
      text: selection.text && locate(root, selection.text.id) ? selection.text : null,
    },
  };
}

/**
 * An editing session: a state, one history and the operations bound to them.
 * session.apply(operation, ...args) runs an operation (a function of this
 * module or OPERATIONS[name]) on the current state with the session's
 * context; a change is recorded first (typing by its group), a refusal or a
 * result with no change leaves state and history as they were.
 */
export function createSession({ document, selection = null, context = {}, history = {} } = {}) {
  const steps = createHistory(history);
  let state = createState(document, selection);
  const travel = (move) => {
    const result = move(state);
    if (!result.ok) return result;
    state = settleSelection(result.state);
    return { ok: true, state };
  };
  return {
    get state() {
      return state;
    },
    get document() {
      return state.document;
    },
    get selection() {
      return state.selection;
    },
    get context() {
      return context;
    },
    node(id) {
      return nodeOf(state, id);
    },
    apply(operation, ...args) {
      const run = typeof operation === 'function' ? operation : OPERATIONS[operation];
      if (typeof run !== 'function') return refused('unknown');
      const result = run(state, ...args, context);
      if (!result.ok) return result;
      if (result.state !== state && result.state.document !== state.document) steps.record(state, { group: result.group ?? '' });
      state = result.state;
      return result;
    },
    /** Moves the selection without a history step. */
    select(id, key = null, offset = undefined) {
      const result = select(state, id, key, offset, context);
      if (result.ok) state = result.state;
      return result;
    },
    undo() {
      return travel((current) => steps.undo(current));
    },
    redo() {
      return travel((current) => steps.redo(current));
    },
    endRun() {
      steps.endRun();
    },
    get history() {
      return steps;
    },
    get canUndo() {
      return steps.canUndo;
    },
    get canRedo() {
      return steps.canRedo;
    },
  };
}

export const OPERATIONS = Object.freeze({
  select, setText, insertBreak, toggleMark, setLink, splitBlock, joinBack, setBlockType,
  insertNode, removeNode, moveNode, moveBy, copyNodes, cutNodes, pasteNodes, duplicateNode,
});

export default {
  BLOCK_TYPES, CLIPBOARD_SCHEMA, CLIPBOARD_TYPE, ISLAND_TYPES, OPERATIONS, OPERATIONS_VERSION, REFUSALS, TEXT_BLOCKS,
  accepts, copyNodes, createSession, createState, cutNodes, duplicateNode, insertBreak, insertNode, islandAround, islandOf, joinBack, moveBy, moveNode,
  pasteNodes, placeAfter, placeInside, removeNode, select, setBlockType, setLink, setText, settleSelection, splitBlock, toggleMark, typingTarget,
};
