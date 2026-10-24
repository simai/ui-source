# sf-composition-overlay

Smart Composition overlay — слой редактора поверх отрисованного Composition
Document: рамки при наведении и выборе, подпись и бейджи узла, панель действий,
места вставки, перенос узлов мышью и клавиатурой и дерево структуры для
клавиатуры. HTML холста не меняется, поэтому публичный вывод и его digest
одинаковы с открытым и закрытым редактором.

Код загружается по требованию: загрузчик Framework подключает
`smart/composition-overlay` только на страницах с тегом `sf-composition-overlay`.

## Базовое использование

```html
<sf-composition-overlay id="overlay" for="canvas" accepts="blocks"></sf-composition-overlay>
<div id="canvas"><!-- SF.Composition.render(document).html --></div>
```

```js
await customElements.whenDefined('sf-composition-overlay');
overlay.attach(canvas);
overlay.setDocument(document, {describe: (node) => ({label: titleOf(node), badges: node.shared ? ['Общий'] : []})});
overlay.setActions([{id: 'move-up', label: 'Выше'}, {id: 'remove', label: 'Удалить'}]);
overlay.setDropFilter((place, item) => place.slot === 'default');
```

После загрузки `SF.CompositionOverlay` даёт `OVERLAY_EVENTS`, `overlayNodes(document)`
и `checkOverlayActions(actions)`.

Если после `setDocument` выбранного узла больше нет, выбор снимается
(`node_id: null`); если фокус был на панели действий, выбирается родитель и
фокус переходит в дерево.

Оверлей ставится перед холстом, чтобы дерево шло первым в порядке Tab.

## Атрибуты

- `for` — id холста;
- `frame` — id iframe-холста того же origin (рамочный режим, вместо `for`);
- `accepts` — группы `sf-sortable`, элементы которых можно бросить на места вставки;
- `label` — имя дерева структуры.

## Методы

`attach(canvas)`, `setDocument(document, {describe})`, `setActions(actions)`,
`setMessages(messages)`, `setDropFilter(filter)`, `setInsertionTarget(target)`,
`select(id)`; в рамочном режиме ещё `attachFrame(iframe)`, `setNodes(nodes, {describe})`,
`edit(id)` и `refresh()` (см. «Framed canvas» ниже). Действия — только `{id, label}` (id `^[a-z][a-z0-9-]{0,63}$`,
не больше 16).

## События

- `sf-composition-overlay-select` — `{node_id}`;
- `sf-composition-overlay-action` — `{action_id, node_id}`;
- `sf-composition-overlay-insert` — `{parent_id, slot, index}`, из библиотеки ещё `{item, from, mode}`;
- `sf-composition-overlay-move` — `{node_id, parent_id, slot, index}`.
- `sf-composition-overlay-edit` — `{node_id, value, previous}`, только в рамочном режиме, отменяемое.

События несут только намерение. Хост меняет Document, сохраняет его с
ожидаемой ревизией, проверяет и перерисовывает; `setDropFilter` лишь скрывает
места, окончательную проверку делает Document.

## Клавиатура и доступность

Дерево (`role="tree"`): стрелки вверх/вниз — порядок документа, влево — к
родителю, вправо — к первому ребёнку, Home/End, Enter — к панели действий,
Escape — назад. Пробел начинает перенос, стрелки выбирают место, Enter кладёт,
Escape отменяет. Выбор и перенос объявляются. Место вставки — тонкая линия с круглой кнопкой «+» 24px; указатель
ловит только кнопка, поэтому блоки под линией остаются доступными для щелчка.
Слой лежит ниже drawer и modal
(`--sf-composition-overlay-z-index`), цвета берутся из токенов темы.

## Framed canvas (same-origin iframe)

For a canvas that must stay isolated in its own document — a mail letter, for
example — the overlay works in framed mode: it is drawn over a same-origin
iframe and fed a flat node list instead of a Composition Document. The frame
needs no script of its own (`sandbox="allow-same-origin"` is enough): the
overlay listens to the frame's document from the host page.

```html
<sf-composition-overlay id="overlay" frame="letter" label="Letter"></sf-composition-overlay>
<iframe id="letter" sandbox="allow-same-origin" tabindex="-1" title="Letter"></iframe>
```

```js
await customElements.whenDefined('sf-composition-overlay');
const frame = document.getElementById('letter');
frame.addEventListener('load', () => {
  const doc = frame.contentDocument;
  overlay.setNodes(blocks.flatMap((block) => [
    {id: block.id, kind: 'block', element: doc.querySelector(`[data-block="${block.id}"]`), label: block.title},
    {id: `${block.id}/title`, kind: 'text', parent: block.id, editable: true,
      element: doc.querySelector(`[data-block="${block.id}"] [data-field="title"]`)},
  ]));
});
overlay.setActions([{id: 'move-up', label: 'Up'}, {id: 'move-down', label: 'Down'}, {id: 'duplicate', label: 'Duplicate'}, {id: 'remove', label: 'Delete'}]);
```

`attachFrame(iframe)` binds the overlay from script (the `frame` attribute does
the same by id). A cross-origin frame cannot be read; nothing is drawn over it
and the overlay carries `data-sf-overlay-frame="unreachable"`.

### Node list

`setNodes(nodes, {describe})` takes the nodes in selection order:

- `id` — unique, non-empty string;
- `kind` — the host's kind of node (`block`, `text`, …), the default label;
- `element` — an element inside the frame document, or
- `rect` — `{x, y, width, height}` in frame-document coordinates (the
  element's viewport box plus the frame's scroll), for a part that has no
  element of its own;
- `label` — the frame label and the tree item's name;
- `parent` — the id of another node in the list; nodes with the same parent
  are siblings, and a node without one is on the top level;
- `editable` — allows plain-string inline editing (needs `element`).

The list is checked (`SF.CompositionOverlay.checkOverlayNodes`): an unknown
key, a duplicate id, a missing rect and element or a parent cycle is a
`TypeError`. `describe(node)` returning `{label, badges}` works as with
`setDocument`. The selection survives a new list when its id is still there.
After the frame reloads (a new `srcdoc`), call `setNodes` with the new
document's elements.

### What it draws and raises

- A hover frame under the pointer and a selection frame on click: the
  innermost node (the smallest element or rect) under the pointer wins. A
  click on no node clears the selection. A click never follows a link in the
  frame.
- The toolbar (`setActions`) above the selection, or below it, inside the
  visible part of the frame; `sf-composition-overlay-action` with
  `{action_id, node_id}`.
- Insertion points among the selected node's siblings and at the end of its
  children; `sf-composition-overlay-insert` with `{parent_id, slot, index}`,
  where the top level is `parent_id: ""` and the slot is always `"default"`.
  `setDropFilter((place) => boolean)` hides places the host would refuse.
- Plain-string inline editing: Enter on a selected editable node (or a
  double-click) makes its element `contenteditable="plaintext-only"` and
  selects its text. Enter or leaving the field commits, Escape cancels and
  puts the text back. A commit with a changed value raises
  `sf-composition-overlay-edit` with `{node_id, value, previous}` — strings
  with whitespace collapsed. The event is cancelable: `preventDefault()` puts
  the previous text back. Otherwise the typed text stays until the host
  re-renders the frame from its model. `edit(id)` starts editing from script.

The overlay never changes the host's model: every event is intent, and the
host updates the letter and re-renders.

### Position and sync

Frame coordinates are mapped to the host page through the iframe's position,
its border and padding, a transform or CSS zoom on it or an ancestor, and the
frame's own scroll. The overlay follows the frame's scroll (including scrolled
elements inside it), the frame's and its document's size, the host page's
scroll and the window's size. Frames are clipped to the part of the iframe that
the host's scrolling containers and the window show. A transform changed on an
ancestor is seen by no observer: call `refresh()` after it. Removing the
overlay stops every listener on the frame.

### Keyboard

The tree follows the node list order: ArrowDown and ArrowUp move through the
list, ArrowLeft goes to the parent, ArrowRight to the first child, Home and End
to the ends. The same keys work while focus is inside the frame (after a
click). Enter edits an editable node, otherwise moves to the toolbar. Escape
closes the innermost layer: while editing it cancels the edit (an edit in
progress is an open surface, `isTopOpenSurface`); otherwise it clears the
selection unless another open surface (a popover, a list) is above it. Nodes
are not dragged or moved by keyboard (Space) in framed mode.
