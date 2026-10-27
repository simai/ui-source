# Tree Item

`sf-tree-item` — узел дерева. Внутри `sf-tree` узел читается один раз как
данные и убирается: строки рисует само дерево (той же разметкой,
`js/templates/row.js`). Отдельно узел рисует свою строку и, раскрытый, —
вложенные узлы.

Индикатор вправо/вниз сообщает состояние ветви, а иконка папки или файла — тип
узла. `selected` обозначает выбор, `active` — текущий маршрут, `open` — только
раскрытие. Иконки строки — классовая разметка шрифта иконок
(`<i class="sf-icon">`), не элементы `sf-icon`.

Атрибуты: `label` (прежнее `text` — псевдоним до 2026-12-01), `value`, `href`,
`target`, `rel`, `kind` (`folder` | `file`; прежнее `type` — псевдоним),
`open`, `selected`, `active`, `disabled`, `icon` (`false` убирает значок),
`open-icon`, `closed-icon`, `chevron-open-icon`, `chevron-closed-icon`,
`open-label`, `close-label` (по умолчанию «Развернуть» и «Свернуть» из файлов
языка), `item-class`, `container-class`, `name-class`. Свойство `itemsData` —
дочерние узлы данными.

События:

- `sf-tree-item-open` `{id, value}` — нажата подпись или `Enter` на листе без
  ссылки (словарь 1.1.5, `open`). Прежнее `sf-tree-item-click`
  (`{item, value, originalEvent}`) приходит следом до 2026-12-01.
- `sf-tree-item-toggle` `{id, open, value}` — ветвь раскрыта или свёрнута. Имя
  прежнее; элемента в `detail` больше нет — это `event.target`.

Действия отвечают исходом (стандарт 1.3.8 §4.4): `expand()`, `collapse()`,
`toggleOpen()` (отказ `leaf` для файла или листа, `disabled` для недоступного),
`activate()`, `focusItem()`.

Публичные переменные: `--sf-tree-item-gap`, `--sf-tree-item-name-color` (вне
дерева; в дереве подпись берёт цвет строки), `--sf-tree-item-icon-color`,
`--sf-tree-item-drop-background-color`, `--sf-tree-item-drop-outline-color`.

Интерфейс — `component.json`, примеры — `examples.json`.
