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
- `accepts` — группы `sf-sortable`, элементы которых можно бросить на места вставки;
- `label` — имя дерева структуры.

## Методы

`attach(canvas)`, `setDocument(document, {describe})`, `setActions(actions)`,
`setMessages(messages)`, `setDropFilter(filter)`, `setInsertionTarget(target)`,
`select(id)`. Действия — только `{id, label}` (id `^[a-z][a-z0-9-]{0,63}$`,
не больше 16).

## События

- `sf-composition-overlay-select` — `{node_id}`;
- `sf-composition-overlay-action` — `{action_id, node_id}`;
- `sf-composition-overlay-insert` — `{parent_id, slot, index}`, из библиотеки ещё `{item, from, mode}`;
- `sf-composition-overlay-move` — `{node_id, parent_id, slot, index}`.

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
