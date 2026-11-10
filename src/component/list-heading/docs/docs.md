# Заголовок группы списка

Один заголовок группы для всех списков блока `list` (решение владельца C40):
группы `sf-list`, дни `sf-list-timeline`, панель уведомлений, разделитель дня
в переписке. Это класс, а не тег: список рисует его в своей разметке.

```html
<div class="sf-list-heading" role="heading" aria-level="3">Сегодня
  <sf-time class="sf-list-heading-date" format="date" tooltip="none"
           datetime="2026-11-09T12:00:00+03:00"></sf-time></div>

<div class="sf-list-heading sf-list-heading--sticky" role="heading" aria-level="3">Вчера</div>

<div class="sf-list-heading sf-list-heading--divider" role="separator" aria-label="Вчера">Вчера</div>
```

## Виды

- **Заголовок** `.sf-list-heading` — слова группы размером текста списка
  (ступень 1), полужирным, цветом текста; рядом тихая дата
  (`.sf-list-heading-date`, ступенью ниже) — для «Сегодня» и «Вчера». Сверху
  `--sf-space-3`, снизу `--sf-space-1/2`; у первого заголовка отступа сверху нет.
- **Прилипающий** `.sf-list-heading--sticky` — тот же заголовок остаётся на виду
  при прокрутке, под ним — сплошной цвет места (`--sf-surface-place-solid`).
- **Разделитель** `.sf-list-heading--divider` — для переписки: слова тихо по
  центру между двумя линиями; разметка — `role="separator"` со словами в
  `aria-label`.

Слова — `SF.format.relativeDay` ядра с заглавной: «Сегодня», «Вчера», день
недели в пределах недели, дальше дата («27 октября»).

## Публичные переменные

| Переменная | По умолчанию | Что задаёт |
| --- | --- | --- |
| `--sf-list-heading-date-color` | `--sf-on-surface-variant` | дата рядом и слова разделителя |
| `--sf-list-heading-margin-block-start` | `--sf-space-3` | отступ сверху |
| `--sf-list-heading-margin-block-end` | `--sf-space-1/2` | отступ снизу |
| `--sf-list-heading-background-color` | `--sf-surface-place-solid` | фон прилипающего |
| `--sf-list-heading-line-color` | `--sf-outline-variant` | линии разделителя |

Цвет самих слов — у каждого списка свой: `--sf-list-heading-color` у
`sf-list`, `--sf-list-timeline-day-color` у `sf-list-timeline`.

## Изменения

- 1.0.0 (2026-11-10) — первая версия, решение владельца C40.
