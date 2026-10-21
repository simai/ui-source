# Sortable drag and drop

`<sf-sortable>` (Smart component `smart.sortable`, loaded on demand when the
tag is on the page) lets people reorder
items inside one list, move them between lists of one group and copy them
from a source list, by mouse, pen, touch and keyboard. It reports intent only
and never moves host DOM or data.

```html
<sf-sortable id="library" group="blocks" mode="copy" label="Библиотека блоков">
  <div data-sf-sortable-item="content.heading">Заголовок</div>
</sf-sortable>
<sf-sortable id="column-a" group="sections" label="Колонка А">
  <div data-sf-sortable-item="s1"><span data-sf-sortable-handle aria-hidden="true">⠿</span>Секция 1</div>
</sf-sortable>
```

```js
document.addEventListener('sf-sortable-intent', (event) => {
  const {item, from, to, index, mode} = event.detail; // index is the final position
  // Apply with the expected revision; on refusal leave the page unchanged.
});
```

Attributes: `group` (`^[a-z][a-z0-9-]{0,31}$`), `accepts` (extra groups),
`mode="move|copy"` (a copy source keeps its item and accepts nothing),
`orientation="vertical|horizontal"`, `label`. Items are descendants with
`data-sf-sortable-item`; they become focusable and are announced with
instructions. A `data-sf-sortable-handle` limits dragging to the handle and is
the touch target; without a handle the whole item is draggable.

Pointer: a drag starts after 4px, shows a ghost and a drop indicator, and
auto-scrolls the nearest scroll container near its edges (even when the
pointer is held still). Escape cancels. Keyboard: Space or Enter picks up,
ArrowUp/ArrowDown move inside a list, ArrowLeft/ArrowRight move to the
previous/next accepting list and to external targets, Space or Enter drops,
Escape or Tab cancels. Every step is announced in the current language.

## Applying an intent in an editor

The component reports intent and the host redraws its own list. Four rules, from
the first editor built on it (ui-mail, 2026-10-21):

1. **Give every list an `id`.** `from` and `to` in `sf-sortable-intent` are the
   list element's `id` (the group name only when it has none), so a host that
   reads `to` to find the target list needs ids to compare.
2. **Redraw the items, not the list.** `list.replaceChildren(…)` also removes
   the two nodes the component keeps among its children — its `aria-live`
   region and the instructions items point at through `aria-describedby`.
   Replace only `[data-sf-sortable-item]` children. The component puts both
   nodes back if they do go (and keeps the same instructions id), so
   announcements survive a full redraw, but a redraw of the items alone never
   disturbs them.
3. **Keyboard focus comes back by itself.** After a keyboard drop the component
   focuses the item with the same id, in the list it landed in, two frames
   later — the host has redrawn by then. A host that restores focus itself
   keeps it: the component only acts when focus fell to the body.
4. **Apply with the expected revision.** The index is final: positions after
   the source have already shifted. On refusal leave the page as it is; the
   component moved nothing.

```js
list.addEventListener('sf-sortable-intent', (event) => {
  const {item, from, to, index, mode} = event.detail;
  if (!model.apply({item, from, to, index, mode})) return; // refused: no redraw
  for (const element of list.querySelectorAll('[data-sf-sortable-item]')) element.remove();
  list.append(...model.items(to).map(renderItem));   // the live region stays
});
```

External targets such as the editor overlay join the same session through
`SF.Sortable.registerSortableDropTarget({resolve, keyboardTargets, drop, leave})`.
The session is shared across Smart bundles, so a library drag lands on the
overlay whichever bundle loaded first.
`<sf-composition-overlay accepts="blocks">` accepts library items on its
insertion places and emits `sf-composition-overlay-insert` with
`{parent_id, slot, index, item, from, mode}`. Canvas nodes move by dragging the
selected frame label or, from the overlay tree, Space → arrows → Enter; the
overlay emits `sf-composition-overlay-move` with `{node_id, parent_id, slot,
index}`. `overlay.setDropFilter((place, item) => boolean)` hides places the host
would refuse.
