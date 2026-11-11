# Composition editing operations 0.1.0 (draft, F3.1)

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
| `core/js/composition/operations.mjs` | The operations below, `createState`, `createSession`, `accepts`, `placeAfter`, `placeInside`, `typingTarget`, `islandOf`, `settleSelection`, `REFUSALS`, `ISLAND_TYPES`, `CLIPBOARD_TYPE`. |

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
| `select` | id, key?, offset? | Chooses a block, or puts the caret in one of its text fields. | none | unknown, island, not-text |
| `setText` | id, key, content | Writes a text field's inline content, normalised. | typing group `<id>/<key>` | unknown, island, not-text, lock |
| `insertBreak` | id, key, offset | Inserts a line break at the offset. The caret goes after it. | typing group | + range |
| `toggleMark` | id, key, start, end, mark | Toggles strong, em, code or strike on [start, end). | one step | + mark, range |
| `setLink` | id, key, start, end, href or null | Sets a safe link on the range, or removes it. | one step | + href, range |
| `splitBlock` | id, offset | Enter: the text after the caret goes to a new paragraph, or a new item in a list. On an empty last list item, Enter leaves the list (and removes the list when that item was its only one). Result: `id`, `offset`. | one step | unknown, island, not-text, range, lock |
| `joinBack` | id | Backspace at the start of a text block joins it to the text block before it. Result: `id` of the earlier block, `offset`. | one step | unknown, first, island, not-text, lock |
| `setBlockType` | id, type, {level} | Turns a paragraph into a heading or back. The id and text are kept. | one step | unknown, island, not-text, same, place, lock |
| `insertNode` | node, {parent, slot, index} | Inserts a node whose ids are all new to the Document. The caret goes into its first `content` text. | one step | unknown, place, id-taken, lock |
| `removeNode` | id | Removes the whole node. A neighbour is chosen, otherwise the parent (never the root). | one step | unknown, required, lock |
| `moveNode` | id, {parent, slot, index} | Moves the node to the place; the index is read before the node leaves. The caret stays. | one step | unknown, inside-itself, place, same, required, lock |
| `moveBy` | id, delta | Moves the node one step among its siblings (Alt+arrows). | one step | + edge |
| `copyNodes` | ids | Returns a clipboard `{schema, type: 'application/x-simai-composition', nodes, text}`. A node inside another copied node goes once. The state does not change. | none | empty, unknown |
| `cutNodes` | ids | Copies, then removes. | one step | as copy and remove |
| `pasteNodes` | clipboard or nodes, place | Pastes copies with new ids all through. No id of the Document or of the clipboard is reused, and the content is unchanged. Either every node is pasted or none. | one step | empty, unknown, place, lock |
| `duplicateNode` | id | Copies the node and pastes it right after itself. | one step | unknown, place |

Each refusal reason is listed with its meaning in `REFUSALS`. A place takes a
type by `slotAccepts` (types, categories, catalogue groups) and the slot's
`max`. A removal or move-out keeps the slot's `min`.

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

`tests/composition-operations.contract.test.mjs` covers:

- the ported SIMAI Editor model tests, on the same page fixture;
- purity;
- the refusal table;
- text, block type, copy, cut and paste;
- each island rule;
- the tree helpers;
- the history.
