# Composition editing operations 0.2.0 (draft, F3.1)

Status: **draft**. It is not part of a released pair. Names and results can
still change until the ui-editor thread has switched over (handoff E2) and
sf-input-rich 1.2.0 has been prototyped. Owner: ui-source.

The SIMAI Framework core holds the editing parts that every editor of a
Composition Document shares: the block tree, the operations over it, and one
undo history. SIMAI Editor (ui-editor) and sf-input-rich call the same code.
The DOM reads what the person means to do (a key, a drop, a paste) and calls
an operation. It never edits the Document itself. Contenteditable output
reaches an operation only through the html@1 cleaner (`html-subset.mjs`,
value mode) and `normalizeInline`.

## Provenance and licence

The parts were moved from SIMAI Editor by their rightholder, Rim Zabarov
(owner decision 2026-11-10, composition F1-F3 assignment). The source was
ui-editor `package/src/smart/editor/js/tree.mjs` and the history and editing
methods of `EditorModel` in `model.mjs`. They were rewritten for the
Framework and are licensed with it (REUSE.toml: Apache-2.0, © 2008-2026 Rim
Zabarov). No SIMAI Editor code is imported. SIMAI Editor keeps its own
licence for everything that stays in it.

## Modules

| Module | Role |
|---|---|
| `core/js/composition/tree.mjs` | `clone`, `same`, `isPlainObject`, `childrenOf`, `walk`, `locate`, `idsOf`, `idMaker`, `freshCopy`, `slotList`, `insertAt`, `removeAt`, `within`. Same signatures and results as ui-editor `tree.mjs`. `idMaker()` also has `next.taken(id)`. |
| `core/js/composition/history.mjs` | `createHistory({depth = 200, pause = 800, now})`: `record(state, {group})`, `undo(current)`, `redo(current)`, `amend(state)`, `endRun()`, `clear()`, `canUndo`, `canRedo`, `undoDepth`, `redoDepth`. |
| `core/js/composition/operations.mjs` | The operations below, `createState`, `createSession`, `accepts`, `placeAfter`, `placeInside`, `typingTarget`, `islandOf`, `islandAround`, `settleSelection`, `REFUSALS`, `ISLAND_TYPES`, `CLIPBOARD_TYPE`. |

## State and results

The state is `{document, selection}`:

- `document` is a Composition Document v1.
- `selection` is `{block, text}`. `block` is the id of the chosen block, or
  null. `text` is `{id, key, offset?}` when the caret is in a text field, or
  null.

An operation has the form `op(state, ...arguments, context?)`. It is pure:
the state it is given never changes.

- On success it returns `{ok: true, state, ...}` with a new state.
- When nothing changes it returns `{ok: true, state, same: true}` with the
  same state, and no history step is recorded.
- On a refusal it returns `{ok: false, reason}`, and nothing changes.

A result may carry `group`, a typing key `<id>/<field>`. The history keeps a
run of the same group as one step until the pause has passed, and any step
without a group ends the run.

The optional `context` has these fields:

- `registry`: `Composition.extendRegistry(...)`; the built-in types by default.
- `isIsland(node, registry)`: replaces the island rule.
- `lockOf(id)`, `placeLock(parentId)`: return a reason string, and that
  reason is the refusal. These hold rights and the site template.
- `adjust(parent)`: settles a parent whose children changed, on the new
  Document (for example, an editor's column count).
- `idPrefix`: the prefix for new ids, `'e'` by default.

`createSession({document, selection, context, history})` binds a state, one
history and a context:

- `apply(operation, ...arguments)` records the state before each change.
- `undo()` and `redo()` restore a snapshot exactly, with the same nodes and
  the same ids. They keep only selection ids that still exist.
- `select()` moves the selection and records no step.

## Operations

| Operation | Arguments | Does | History | Refusals |
|---|---|---|---|---|
| `select` | id, key?, offset? | Chooses a block, or puts the caret in one of its text fields. | none | unknown, place, island, not-text |
| `setText` | id, key, content | Writes a text field's inline content, normalised. | typing group `<id>/<key>` | unknown, lock, place, island, not-text |
| `insertBreak` | id, key, offset | Inserts a line break at the offset. The caret goes after it. | typing group | + range |
| `toggleMark` | id, key, start, end, mark | Toggles strong, em, code or strike on [start, end). | one step | + mark, range |
| `setLink` | id, key, start, end, href or null | Sets a safe link on the range, or removes it. | one step | + href, range |
| `splitBlock` | id, offset | Enter: the text after the caret goes to a new paragraph, or a new item in a list. On an empty last list item, Enter leaves the list (and removes the list when that item was its only one). Result: `id`, `offset`. | one step | unknown, lock, place, island, not-text, range, would-lose |
| `joinBack` | id | Backspace at the start of a text block joins it to the text block before it. Result: `id` of the earlier block, `offset`. | one step | unknown, lock, place, first, island, not-text, would-lose, required |
| `setBlockType` | id, type, {level} | Turns a paragraph into a heading or back. Only the type and the level change; the id, text, props, extensions and any other data are kept. | one step | unknown, lock, place, island, not-text, same |
| `insertNode` | node, {parent, slot, index} | Inserts a node whose ids are all new to the Document. The caret goes into its first `content` text. | one step | unknown, place, id-taken, lock |
| `removeNode` | id | Removes the whole node. A neighbour is chosen, otherwise the parent (never the root). | one step | unknown, lock, place, required |
| `moveNode` | id, {parent, slot, index} | Moves the node to the place; the index is read before the node leaves. The caret stays. | one step | unknown, inside-itself, place, same, required, lock |
| `moveBy` | id, delta | Moves the node one step among its siblings (Alt+arrows). | one step | + edge |
| `copyNodes` | ids | Returns a clipboard `{schema, type: 'application/x-simai-composition', nodes, text}`. A node inside another copied node goes once. The state does not change. | none | empty, unknown |
| `cutNodes` | ids | Copies, then removes. | one step | as copy and remove |
| `pasteNodes` | clipboard or nodes, place | Pastes copies with new ids all through. No id of the Document or of the clipboard is reused, and the content is unchanged. Either every node is pasted or none. | one step | empty, unknown, place, lock |
| `duplicateNode` | id | Copies the node and pastes it right after itself, in its own slot. A known type is asked the slot's whole rule, as a paste is; for a type the registry does not know only the slot's `max` is asked (it is duplicated as it moves, within its slot). | one step | unknown, lock, place |

Each refusal reason is listed with its meaning in `REFUSALS`. A place takes a
type by `slotAccepts` (types, categories, catalogue groups) and the slot's
`max`. A removal or move-out keeps the slot's `min`. Enter asks the same
rule for the block it adds (a full slot, or one that does not take a
paragraph, gives `place`), and Backspace-join asks the slot's `min` for the
block it takes away (`required`).

## Changes in 0.2.0 (round 2 of the F3.1 review)

- A child of an island may do nothing on its own: every operation aimed
  at it, or at a place inside an island, is refused `place`. New
  `islandAround(state, id)`: the outermost island a node lies in, so an
  editor can always select what it names, also when islands nest.
- `splitBlock` asks the slot rule for the block it adds (`place`);
  `joinBack` asks the slot's `min` (`required`).
- `duplicateNode` of an unknown type succeeds within its own slot; a known
  type is still asked the slot's type rule.
- Inline extension keys compare by value; key order does not count.

## Islands

An island is `content.table`, `content.foreign`, or a type the registry does
not know. The rules are those of assessment Q5:

| Action | Island behaviour | How it is expressed |
|---|---|---|
| Select | the whole island as one unit, no caret inside | `select(id)` succeeds; `select(id, key)` returns `island` |
| Type over / format | refused; the island stays unchanged | `setText`, `insertBreak`, `toggleMark`, `setLink`, `splitBlock`, `setBlockType` return `island`, and so does `joinBack` into or out of one |
| Delete | the whole node, in one undo step | `removeNode` removes the subtree |
| Move | the whole node, where the slot rules allow; an unknown type moves only within its own slot | `moveNode` and `moveBy`; for an unknown type `slotAccepts` is false, so any other slot gives `place` |
| Copy / cut | the whole node; the clipboard carries the node JSON plus a text fallback | `copyNodes` and `cutNodes` |
| Paste | a copy with fresh ids for the node and all its descendants; ids already in the Document are never reused; content unchanged | `pasteNodes` |
| Undo / redo | the exact node is restored, with the same id | the history's snapshots |
| Its children | **a child of an island may do nothing on its own** (contract call 2026-11-11). A known node inside an island, at any depth, is closed with it: no caret, typing, format, split, join, removal, move out, reorder, insert, paste, duplicate or block type change, and nothing moves in | every operation aimed at such a node, or at a place inside an island, returns `place` and changes nothing; `copyNodes` of it reads and is allowed. `islandAround(state, id)` names the outermost island a node lies in (or null); it lies inside no island, so an editor chooses it instead and `select` of it succeeds, also when islands nest |

An unknown type is accepted by no slot, so a paste of it is refused
`place` everywhere; the clipboard does not say which slot it came from. It
moves and is duplicated within its own slot, and is removed or cut whole.

## Unknown content is never lost

This rule is an owner requirement for every composition stage (DEV letter
msg-cdcb39c2). Unknown content means:

- blocks of a type the registry does not know;
- unknown inline entries: a `component` with an undeclared name, or any
  other inline `type`;
- unknown marks.

Such content survives each of these, and undo and redo of each:

- opening the Document;
- typing around it;
- marks and links over ranges that hold it;
- copy, cut and paste;
- moves;
- deleting a neighbour;
- Enter and Backspace beside it;
- a block type change.

It goes only when the person removes that node itself, or a block that holds
it (`removeNode`). Undo then returns it byte for byte.

How the operations keep it:

- The inline model (`inline-model.mjs`) carries an unknown inline entry as
  one opaque unit, and keeps an unknown mark beside the known ones.
- `toggleMark` and `setLink` never change an opaque unit, and a link stops on
  each side of an atom.
- An unknown block is an island: no typing, no join into or out of it, and
  no slot but its own. Nothing inside it changes on its own (its known
  children are closed with it).
- An edit that would take away a text block holding more than its text is
  refused with `would-lose`. "More than its text" means extensions, bindings,
  props, data other than `content` and `level`, or children. The refused
  edits are:
  - Backspace-join of such a block;
  - Enter on such a block when it is an empty last list item;
  - Enter on the only, empty item of a list that has extensions or bindings.

Extension keys on known entries (owner decision 2026-11-11):

- A key that a known inline entry does not define rides with that entry.
  The known entries are a text run, a break, a link and an atom; examples
  are a text run's `lang`, a link's `title` and `rel`, and a break's `kind`.
- The key survives every operation and the DOM inline editor. Runs merge
  only when their keys are the same. Keys compare by value: their order
  does not count, at any depth (`{lang, title}` and `{title, lang}` merge).
- Removing a link removes the link's own keys; its runs keep theirs.
  Deleting every letter of a run removes the run.
- Validation accepts a key as extension data when its name matches
  `INLINE_EXTENSION_KEY`:
  - lowercase letters, digits and `_ . :`, starting with a letter;
  - not `on*`;
  - not one of the model's own names (`type value marks href children name
    props`);
  - not a forbidden name (`style class html script ...`, F1.6 and the
    Document rule).
- A refused key is still kept by the model, so nothing is lost silently.
  Validation reports it with `schema_one_of`, plus
  `executable_or_secret_field_forbidden` for a forbidden name.
- Render never draws an extension key.
- Unsafe links are still dropped by design, and their keys go with them.
- The Markdown, Editor.js and HTML converters do not carry extension keys.
  They are serialisers with loss lists (F3), outside this module.

The fixed cases are in
`tests/composition-operations-unknown.contract.test.mjs`.

For stored Documents, `scripts/composition-roundtrip.mjs <checkout>...`
opens every stored Document in a session and then:

- runs a no-op pass;
- removes, edits and pastes, undoing each;
- compares validation before and after.

`tests/composition-roundtrip.contract.test.mjs` runs it on this repository.

## What stays in an editor

These parts are not in the core:

- choosing by depth (up, down, neighbours);
- the catalogue and its variants (`make`, `blank`, `placeFor`);
- the slash menu and Markdown shortcuts;
- columns (`splitColumns`, `dropBeside`, `insertBeside`, and `adjust` for
  syncing them);
- parameters and their origins;
- data bindings;
- rights and the template (through `lockOf` and `placeLock`);
- site blocks (drawn ids `<instance>:<part>`, `data.texts`);
- the change events;
- the three outputs.

## Checks

`tests/composition-operations.contract.test.mjs` covers the following (the unknown-content and round-trip checks are above):

- the ported SIMAI Editor model tests, on the same page fixture;
- purity;
- the refusal table;
- text, block type, copy, cut and paste;
- each island rule (and, in
  `tests/composition-operations-islands.contract.test.mjs`, every operation
  refused on a child of an island);
- the tree helpers;
- the history.
