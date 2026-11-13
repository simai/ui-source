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
