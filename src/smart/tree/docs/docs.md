# Tree

`sf-tree` представляет иерархию как единый составной элемент. Используйте его
для файловых структур, таксономий и многоуровневой навигации. Для короткого
набора независимых раскрытий используйте Accordion.

Корню обязательно задают `aria-label`. В страницу входит одна точка Tab;
стрелки, `Home`, `End` и поиск по первым буквам перемещают фокус между видимыми
узлами. Вправо раскрывает ветвь или переходит к первому ребёнку, влево сворачивает
ветвь или возвращает к родителю. `Enter` раскрывает ветвь или открывает лист,
пробел выбирает.

## Пункты

Пункты — дочерние `<sf-tree-item>` (читаются один раз и убираются) или свойство
`items`: массив записей `{id, label, value, href, target, rel, kind, open,
selected, active, disabled, icon, open-icon, closed-icon, chevron-open-icon,
chevron-closed-icon, open-label, close-label, revision, children}`. Поля в
camelCase (`openIcon`, …) и `type` тоже читаются. Идентификатор записи — `id`,
иначе `value`, иначе место записи.

Дерево рисует записи само, плоско: строки классовой разметки (та же, что у
`sf-tree-item`: `.sf-tree-item[role=treeitem][data-value]`,
`.sf-tree-item-container`, `.sf-tree-item-name`), с `aria-level`,
`aria-setsize` и `aria-posinset`, по ключу `id` (стандарт 1.3.8 §18.4). Новый
`items` с одной изменённой записью переписывает только её строку, на месте.
Раскрытость записи — состояние дерева по `id`: она переживает новый `items`.
Больше 300 видимых записей — рисуются только строки в поле зрения ближайшей
прокрутки с запасом, остальные заменяют два пустых блока; событие
`sf-tree-window {first, last}` говорит, какие нарисованы. Дерево из 2 000
узлов рисуется за кадр (было 14 с на этой машине и 33 с в замере стенда 20,
simai/ui-source#43).

## Выбор

`selection`: `none` (по умолчанию) — нажатие открывает пункт; `one` — выбирает
один; `many` — переключает каждый. Прежние `single` и `multiple` — псевдонимы
до 2026-12-01. Значение `selected` — id текущего пункта, `selectedIds` — все
выбранные при `many`; оба можно задать. `items`, в котором записи говорят
`selected: true`, задаёт выбор.

## События

| Событие | Когда | `event.detail` | Прежнее имя (до 2026-12-01) |
|:---|:---|:---|:---|
| `sf-tree-open` | нажата подпись или `Enter` на листе | `id`, `value` | `sf-tree-item-click` |
| `sf-tree-select` | выбор изменён | `ids`, `id`, `selected` | `sf-tree-selection-change` |
| `sf-tree-toggle` | ветвь раскрыта или свёрнута | `id`, `open`, `value` | `sf-tree-item-toggle` |
| `sf-tree-move` | на пункт перетащены записи списка (`accept-records`) | `ids`, `parent`, `before`, `source` | `sf-tree-records-drop` |
| `sf-tree-attach` | на пункт перетащены файлы (`accept-files`) | `files`, `parent` | `sf-tree-files-drop` |
| `sf-tree-window` | изменилось окно длинного дерева | `first`, `last` | — |

Прежние имена приходят следом со старым `detail`; `item` в нём — элемент
строки. `onToggle(handler)` передаёт обработчику строку первым аргументом.
Классовое дерево (`.sf-tree` без `sf-tree`) шлёт те же новые имена и после них
прежние `sf-tree:toggle`, `sf-tree:activate`, `sf-tree:selection-change`.

Действия: `expand({id})`, `collapse({id})`, `focusEntry({id})` — отвечают
исходом; `focusEntry` сначала рисует запись, если окно её не держит.

Публичные переменные: `--sf-tree-gap`, `--sf-tree-padding-inline`,
`--sf-tree-indent`, `--sf-tree-radius`, `--sf-tree-color`,
`--sf-tree-selected-background-color`.

Компонент не загружает данные, не хранит выбор и не решает, какие маршруты или
узлы доступны пользователю. Интерфейс — `component.json`, примеры —
`examples.json`.
