# Button Group

Button Group соединяет связанные нативные кнопки в один компактный UI-силуэт.
Компонент владеет только расположением, внешним контуром и сегментами; действие,
disabled- и toggle-состояние остаются у каждой кнопки.

## Семантика

- Для обычных связанных команд используйте `role="group"` и обязательное
  `aria-label` или `aria-labelledby`. Каждая кнопка остаётся в Tab-порядке.
- `aria-pressed` ставится только на настоящую независимую toggle-кнопку.
- Для единственного выбора используйте Smart Button Group: он проецирует
  `radiogroup`, `radio`, `aria-checked` и roving tabindex.
- `role="toolbar"` задаётся автором только для настоящей панели из трёх и более
  часто используемых контролов вместе с полной arrow-key моделью Toolbar.

## Ориентация

Горизонтальная группа используется по умолчанию. Вертикальная задаётся
`data-orientation="vertical"`. Старый `aria-orientation="vertical"` остаётся
input alias; runtime переносит геометрию в `data-orientation` и сохраняет ARIA
orientation только для ролей, которые её поддерживают.

## Визуальная модель

Соседние кнопки образуют общий внешний контур. Внутренний стык рисуется одной
границей `--sf-px`, внешний радиус наследуется от Button и UI radius. Pointer
focus не оставляет кольца; `:focus-visible` рисует inset focus token внутри
сегмента и не перекрывает соседей.

A segmented track is as wide as its labels (owner decision C47 A, 1.3.0): in full-width each segment starts at its own width (flex 1 1 auto) and the rest is shared; a label stays on one line and is cut with «…» only as the last step. sf-segmented folds a track whose labels do not fit into an sf-dropdown (C47 C): .sf-button-group--folded and [data-sf-measure] lay the track out of sight at its one-line width for measuring; .sf-button-group-narrow holds the dropdown.

A segment is a step tighter than a button of its size, on the sides as well as above and below (R191 HS-11, 1.3.1): its side padding is the button's less the track's padding, so a 32 px segment of a size-1 track has the side padding of a 32 px button (letters 20 from the segment, 24 from the track; before, 24 and 28 with the 40 px button's 16). An icon-only segment stays square.

## Кнопки-значки в группе (1.5.0)

Прямые дети группы — `sf-button`, `.sf-button`, кнопки-значки `.sf-icon-button`
и `sf-button-icon` — соединяются одинаково (RG-BG-1): группа даёт им позиции
segment-start/middle/end, на стыке одна линия, внутренние углы прямые, снаружи
радиус кнопок, общий контур группы, кольцо фокуса внутрь. Так собирают панель
форматирования (жирный · курсив · подчёркнутый) и смешанную группу.

## Группа, которая не помещается по ширине (1.5.0)

Если группа шире своего контейнера, она сама встаёт в столбец на всю ширину и
рисуется как вертикальная группа: общий контур, одна линия на стыке, радиус
только снаружи (решение владельца C215). Когда места снова хватает, группа
возвращается в ряд. Вбок группа не прокручивается. Состояние пишет скрипт в
`data-sf-stacked`; `data-orientation`, заданную автором, он не меняет и такую
группу не переставляет. Сегментный переключатель
(`sf-button-group--segmented`, `sf-segmented`) сохраняет свою прокрутку, а
группа с `overflow="more"` — свой ряд с «Ещё».

## «Ещё» для ряда, который не помещается (1.4.0)

Атрибут `overflow="more"` у горизонтальной группы (решение владельца C155):
группа остаётся в один ряд, а кнопки, которые не влезают, уходят в «Ещё» —
последний сегмент ⋯ (`more_horiz`) того же размера и вида, что кнопки группы,
с подсказкой и именем «Ещё». Уходят с конца; порядок задаёт атрибут
`priority` у кнопки: `priority="1"` — самая важная, чем больше число, тем
раньше уходит, кнопка без него уходит первой; `priority="pin"` не уходит
никогда. Главная (залитая) и нажатая кнопки тоже не уходят. ⋯ открывает
стандартное меню со значками и названиями ушедших кнопок, нажатая отмечена
галочкой; пункт меню нажимает саму кнопку. Без атрибута группа, которая не
помещается, встаёт в столбец (C215).

```html
<div class="sf-button-group" role="group" aria-label="Вид" overflow="more">
  <sf-button appearance="outline" icon-start="table_rows" text="Таблица" pressed="true"></sf-button>
  <sf-button appearance="outline" icon-start="view_list" text="Список" pressed="false"></sf-button>
  <sf-button appearance="outline" icon-start="map" text="Карта" pressed="false" priority="2"></sf-button>
</div>
```

The shared row engine (`core/js/overflow-row.js`) lays the row out; the menu is
sf-menu-context, loaded when ⋯ is first pressed.
