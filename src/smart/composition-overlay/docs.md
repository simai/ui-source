# sf-composition-overlay

Smart Composition overlay — слой редактора поверх отрисованного Composition
Document: рамки при наведении и выборе, панель действий над блоком, одно место
вставки у стыка под указателем, плавный перенос блоков мышью и клавиатурой и
дерево структуры для клавиатуры. HTML холста не меняется, поэтому публичный вывод
и его digest одинаковы с открытым и закрытым редактором.

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

Оверлей ставится перед холстом, внутри той же прокручиваемой области: дерево идёт
первым в порядке Tab, а рамки и панель лежат в прокручиваемом содержимом и едут
вместе с ним, без скрипта на прокрутке (см. «Where the parts live»). Это блок нулевого
размера: в родителе с `gap` (flex, grid) он прибавит один `gap`, поэтому родителем
лучше сделать обычный блок.

## Атрибуты

- `for` — id холста;
- `frame` — id iframe-холста того же origin (рамочный режим, вместо `for`);
- `accepts` — группы `sf-sortable`, элементы которых можно бросить на места вставки;
- `label` — имя дерева структуры;
- `placement` — где стоит панель действий: `top` или `side` (см. «Which placement to choose»).

## Методы

`attach(canvas)`, `setDocument(document, {describe})`, `setActions(actions)`,
`setMessages(messages)`, `setDropFilter(filter)`, `setInsertionTarget(target)`,
`select(id)`; в рамочном режиме ещё `attachFrame(iframe)`, `setNodes(nodes, {describe})`,
`edit(id)` и `refresh()` (см. «Framed canvas» ниже).

## Actions

`setActions` takes up to 16 actions `{id, label, icon, shortcut, disabled, tone}`.
Only `id` (`^[a-z][a-z0-9-]{0,63}$`) and `label` are required, so `{id, label}` works
as it always did: a text button.

- `icon` is an icon name: the button becomes `sf-icon-button` at size 1/2 (32 px),
  icon only, with `label` as its accessible name and `sf-tooltip` holding the label
  and the shortcut;
- `shortcut` is the keys as the tooltip shows them: `⌥↑`, `⌥↓`, `⌘D`, `⌫`, `Enter`.
  While focus is in the tree, on the toolbar or in the frame, the key sends the same
  `sf-composition-overlay-apply` as the button, for the selected node. `⌘` is Command
  or Control and `⌫` is Backspace or Delete. What the action does is the host's;
- `disabled` dims the button where it stands, so its neighbours do not move; its key
  sends nothing;
- `tone: 'danger'` colours the hover only;
- the action whose icon is `drag_indicator` is the grip a block is dragged by. The
  block dims, one line shows where it lands, the canvas scrolls near its edges and
  Escape cancels. A drop sends `sf-composition-overlay-move`, whose `position` is the
  place among the other siblings, without the block itself. A press without a move
  sends nothing; from the keyboard it is an ordinary `apply`. Without a grip, a canvas
  bound with `for` is still dragged by the selected node's label.

The toolbar updates its buttons in place, by `id`: another `setActions` loses neither
focus nor a tooltip, so a host may call it on every change.

## Which placement to choose

Choose `top`, the default: the toolbar stands above the block, right-aligned. It
needs no room beside the block, works at any width and never covers the selected
block, only the one above it. So the first block has room too, give the scroller a
top padding of at least the toolbar's height (40 px and the gap); without it the
toolbar of a block that fits stands under the block.

Choose `side` for a host that always has free room beside the block, such as a narrow
paper on a wide canvas: the toolbar never overlaps a neighbouring block but takes a
column. Where the room is missing it stands above the block, as `top` does.

A block too tall to show with its toolbar keeps the toolbar on screen, stuck to the
scroller's edge, while the block is on screen. While the top of such a block shows,
the toolbar stands above it; once the top has gone past the edge it lies over the
block, because no other place on screen is left. A block that fits is never covered,
and its toolbar scrolls away with it.

## Where the parts live

In the same scroller as its canvas, the overlay's frames, toolbar and insertion point
lie in the scrolled content and travel with it: nothing runs on scroll and a frame
never trails its block. A script measures only when geometry changes: the size of the
canvas, its document, the scroller, the selected block or the window, a new node list,
or `refresh()`. The element carries `data-sf-overlay-place="content"`.

Outside that scroller the parts stay fixed to the viewport and follow its scroll by
script, a frame late (`data-sf-overlay-place="viewport"`). The same goes for scrolling
inside the canvas itself: an iframe that scrolls within itself moves its nodes by
script. So make a frame as tall as its letter and scroll the area around it.

## События

- `sf-composition-overlay-select` — `{ids, id}` (словарь 1.1.5, `select`), и
  прежнее `node_id`;
- `sf-composition-overlay-apply` — `{action, scope: 'entry', ids}`: действие
  панели для выбранного узла (словарь, `apply`). Прежнее
  `sf-composition-overlay-action` (`{action_id, node_id}`) приходит следом до
  2026-12-01;
- `sf-composition-overlay-insert` — `{parent, slot, index}` и прежнее
  `parent_id`, из библиотеки ещё `{item, from, mode}`;
- `sf-composition-overlay-move` — `{ids, id, parent, position}` (словарь,
  `move`: одно перемещение) и прежние `node_id`, `parent_id`, `slot`, `index`;
- `sf-composition-overlay-change` — `{id, value, previous}`, только в рамочном
  режиме, отменяемое. Прежнее `sf-composition-overlay-edit`
  (`{node_id, value, previous}`) приходит следом до 2026-12-01; отмена любого
  из двух отменяет оба.

`SF.CompositionOverlay.OVERLAY_EVENTS` — новые имена,
`OVERLAY_EVENTS_LEGACY` — прежние.

События несут только намерение. Хост меняет Document, сохраняет его с
ожидаемой ревизией, проверяет и перерисовывает; `setDropFilter` лишь скрывает
места, окончательную проверку делает Document.

## Клавиатура и доступность

Дерево (`role="tree"`): стрелки вверх/вниз — порядок документа, влево — к
родителю, вправо — к первому ребёнку, Home/End, Enter — к панели действий,
Escape — назад. Пробел начинает перенос, стрелки выбирают место, Enter кладёт,
Escape отменяет. Выбор и перенос объявляются. Сочетания действий (`shortcut`, см. «Actions»)
проверяются раньше этих клавиш.

Наведение — рамка 1 px без подписи и заливки, выбор — рамка 2 px без оттенка: оттенок
меняет вид содержимого. Место вставки одно: тонкая линия и круглая кнопка «+» 24 px
появляются только у стыка блоков под указателем (примерно 10 px в обе стороны) и
держатся 140 мс после ухода указателя, чтобы до кнопки можно было дотянуться.
Указатель ловит только кнопка, поэтому блоки под линией остаются доступными для
щелчка. На выбранном блоке постоянно ничего не показано; с клавиатуры после панели
идёт одно место вставки за выбранным блоком, оно видно, пока в нём фокус.
`setInsertionTarget` оставляет место, которое хост отметил сам.

Когда новый список узлов меняет их порядок, добавляет или убирает узел, блоки и рамка
одновременно приезжают на место за 180 мс; с `prefers-reduced-motion` движения нет.
Правка текста, меняющая высоту, не анимируется.

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
- The toolbar (`setActions`) above the selection, or below it where it has no
  room; `sf-composition-overlay-apply` with `{action, scope: 'entry', ids}` (the
  former `sf-composition-overlay-action` with `{action_id, node_id}` follows until
  2026-12-01).
- One insertion point, at the seam under the pointer among any nodes that are
  siblings (the outer lists first); `sf-composition-overlay-insert` with
  `{parent, parent_id, slot, index}`, where the top level is `parent: ""` and the
  slot is always `"default"`. `setDropFilter((place) => boolean)` hides places the
  host would refuse.
- Dragging by the grip action, as on any canvas: `sf-composition-overlay-move` with
  `{ids, id, parent, position, slot}`, among the node's siblings.
- Plain-string inline editing: Enter on a selected editable node (or a
  double-click) makes its element `contenteditable="plaintext-only"` and
  selects its text. Enter or leaving the field commits, Escape cancels and
  puts the text back. A commit with a changed value raises
  `sf-composition-overlay-change` with `{id, value, previous}` — strings
  with whitespace collapsed (the former `sf-composition-overlay-edit` with
  `{node_id, value, previous}` follows until 2026-12-01). The event is
  cancelable: `preventDefault()` on either puts the previous text back. Otherwise the typed text stays until the host
  re-renders the frame from its model. `edit(id)` starts editing from script.

The overlay never changes the host's model: every event is intent, and the
host updates the letter and re-renders. A host that patches the frame's document
in place rather than reloading it calls `setNodes` afterwards: the nodes glide from
where they were, and the frame never loads.

### Position and sync

Frame coordinates are mapped to the host page through the iframe's position,
its border and padding, a transform or CSS zoom on it or an ancestor, and the
frame's own scroll. The overlay follows the frame's scroll (including scrolled
elements inside it), the frame's and its document's size and the window's size;
the host's scroller carries the overlay's parts when they lie in it, and otherwise
the overlay follows that scroll too. Frames are clipped to the part of the iframe
that shows. A transform changed on an
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
are not moved by Space in framed mode: the keys of a host-mapped action (⌥↑, ⌥↓)
do that.

## Интерфейс

Интерфейс — `component.json` (стандарт simai.smart-component 1.3.8), слова —
`lang/`, примеры — `examples.json`. Настройки — свойства элемента: `for`,
`frame`, `accepts`, `label`, `placement`, `actions` (через ту же проверку, что
`setActions`), `messages`, `insertionTarget`. Методы `attach`, `attachFrame`,
`setDocument`, `setNodes`, `setDropFilter`, `setActions`, `setMessages`,
`setInsertionTarget`, `select`, `edit`, `refresh` по-прежнему возвращают
элемент. Публичные переменные: `--sf-composition-overlay-frame-color`,
`--sf-composition-overlay-z-index`,
`--sf-composition-overlay-toolbar-background-color`,
`--sf-composition-overlay-toolbar-radius`, `--sf-composition-overlay-toolbar-gap`.
