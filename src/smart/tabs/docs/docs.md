# Smart Tabs

`sf-tabs` presents one locally available panel at a time. The default template
supports text buttons and `variant="icons"`; icon tabs use each item's label as
their accessible name. Text slots remain the accessible label of text tabs.
Give each tablist an `aria-label`, or reference a visible heading through
`aria-labelledby`.

Tabs have two looks (owner decision C96, sf-tabs 1.3.0): the line -- no
`type`, or `type="underline"` -- and the plate, `type="pills"`.
`type="vertical"` is the menu's column. `type="full"` is retired: it draws the
line with `fit="always"`. The historical `scheme` attribute (`default`,
`outline` or `link`) no longer changes the look; it is not a selector for
arbitrary semantic colors, and custom templates may still read it. `full` and
the `outline`/`link` schemes are noted in `SF.deprecations` until 2027-01-01.
Before 1.3.0 no `type` drew filled primary buttons; that look is gone.

A nested `sf-tabs` in a panel slot keeps its own skin; parent skin selectors do
not reach into the nested header. Horizontal lists scroll locally instead of
squeezing labels into individual characters or widening the page. Default
controls can wrap a label wider than the list. Prefer concise labels.

The built-in text/icon templates have one native tab stop, unique stable
tab/panel IDs and reciprocal `aria-controls` / `aria-labelledby` relationships.
A panel is a tab stop of its own only when it holds nothing focusable (APG).
Horizontal navigation uses Left/Right (mirrored in RTL); `type="vertical"`
uses Up/Down. Home/End go to the endpoints. A disabled tab says
`aria-disabled="true"` and stays focusable: the arrows reach it, a press or a
key selects nothing, and its item `hint` says why in a tooltip. Arrows wrap
and move focus while activating the panel --
unless a panel holds a part that starts later (`data-sf-start`, an assembly's
`start: opened`): then the arrows only move the focus and Enter or Space opens
the tab (manual activation, standard 1.3.8 §7.2.1).
Perpendicular arrows retain browser behavior. Keyboard events in panel content
and nested Tabs do not navigate an outer Tabs instance.

A person's choice (a press, a key, «Ещё») sends `sf-tabs-change` with
`{selected, previous, current, item, items}` -- data only -- after the tabs
and panels show the new selection (`aria-selected`, `hidden`); with `lazy`,
after a panel opened for the first time is drawn. The old name
`sf-tab-change` follows until 2026-12-01 with its old detail (`component`,
`tagName`, `template` added), each use noted in `SF.deprecations` with its
dates. `goTo(index)` (the action `go-to`), `active-index` and `selected` (the
entry's id) select a tab without the event, as a native field does, and
`goTo()` answers `{outcome: 'applied'}` or `{outcome: 'refused', reason}`.
Programmatic selection does not move focus. Rendering style changes preserves
tab identity, IDs and selection. If an author selects a disabled item, its panel
selection is preserved, but the first enabled tab is the tablist entry point;
an entirely disabled list has no tab stop. Prefer an enabled initial selection.
Use the Smart host's `goTo()` method for imperative selection, not the ordinary
`SF.Tabs.activate()` helper. The ordinary runtime skips the built-in Smart root
and restricts its queries/clicks to the nearest ordinary Tabs owner.

A panel can be the page's own `<div role="tabpanel">` written inside the host
(or placed there by an assembly, with `data-entry="<id>"` per entry): it is
moved, not copied, into the panel row, and shown or closed by its `hidden`
attribute. A slotted panel (`<p slot="panel-0">`) keeps its slot name on the
panel it becomes. Tab, panel and label ids are the host's path id and a local name
(`<id>--tab-1`), never a counter.

`root-class`, author `style` and `root-style` apply to the visible root. Use
Framework semantic tokens and utilities rather than fixed sizes or colors.
The shared Tabs skin uses an inset keyboard focus indicator, a semantic gap
between the vertical list and panel, and the same selected foreground/background
pair for text and icon tabs. This does not constitute acceptance of every skin,
size, overflow strategy or arbitrary custom template.

Inset focus uses the foreground role belonging to its control surface, rather
than the translucent external focus halo. Its width follows
`--sf-focus-outline-width`. `--sf-tabs--focus-color` is an optional local override
for a custom surface; use a semantic role and recheck its contrast. Forced-colors
mode retains an inset system outline. The shared base component owns this skin.

Arbitrary custom tab component descriptors render without requiring the Loader.
The owned wrapper remains the single named tab and keyboard-focus target; its
rendered Smart visual is inert and hidden from the accessibility tree. Use a
descriptor only as presentation, not to place a second interactive control in
the tab. External custom templates still own their semantic markup.

Reference pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

## Pills, and what a two-option switch is

`type="pills"` draws rounded tabs where the selected one is the only filled
tab: a plate of `--sf-primary-container` with its ink, the selected role every
component takes (C16). The others are text on the surface with no fill and no
border, whatever `scheme` says, painted only by the surface state layer of what
the pointer does (4 % on hover, 8 % with keyboard focus, 12 % pressed), in the
light and dark themes and with any theme colour. Until 2026-11-01 the
unselected pills took the `scheme` fill; `scheme="outline"`, once the advice
for this, is no longer needed and gives the same pills.

```html
<sf-tabs type="pills" aria-label="Разделы"></sf-tabs>
```

Tabs are not a switch. For a two-option segmented switch — two choices, no
panels — use the segmented control, `sf-segmented`:

```html
<sf-segmented aria-label="Вид" value="edit"
  items='[{"value":"edit","label":"Редактор"},{"value":"code","label":"Код"}]'></sf-segmented>
```

It is a `radiogroup` with one tab stop, arrows, Home and End, and its track is
the height of an `sf-button` of the same `size`. A pill is that height too
(40 px on a desktop, 36 px on a phone at the default size), so a pill row
lines up with the header's buttons. Tabs are for panels: each tab shows its own
panel, and the switch only reports a value.

## Подчёркнутые вкладки: размеры

Вкладки стоят встык, без пустого промежутка: нажимается вся строка. Поле
вкладки по бокам — поле кнопки того же размера (`--sf-ui-<size>--space-x`:
14, 16 и 20px при `size="1/2"`, `1` и `2`; на телефоне 12, 14 и 18px), у
подписи своего поля нет, поэтому между подписями 28, 32 и 40px. У первой
вкладки нет поля в начале, у последней — в конце: буквы первой вкладки стоят
на краю текста, как заголовок над ними. Если вкладки делят строку поровну
(`fit`), поля остаются у всех. Высота вкладки — высота контрола своего
размера (32, 40, 48px; в плотной области `data-sf-density="compact"` — на
ступень ниже, как у кнопок), и вся она нажимается. Линия 2px на любом
размере, ровно под буквами, и переходит к другой вкладке сразу, без
скольжения. Поле вкладки меняется одной переменной `--sf-tabs-padding-inline`.

Выбранная вкладка — подпись цветом `--sf-on-surface` и линия цветом темы
(`--sf-primary`, меняется через `--sf-tabs-indicator-color`); остальные
подписи спокойнее — `--sf-on-surface-variant`. Полужирная только подпись
выбранной вкладки, и место под полужирную подпись занято у каждой вкладки
заранее: при выборе соседние вкладки не сдвигаются. Под указателем подпись
только темнеет — серой линии нет.

## Вертикальные вкладки

`type="vertical"` — колонка, как у `sf-menu`: строки через
`--sf-space-1/4` (шаг 44px при `size="1"`), буквы в 16px от края колонки
(`--sf-space-1`), подписи от начала строки,
текущая вкладка залита (`--sf-primary-container-active`), под указателем —
слой состояния поверхности. На телефоне (уже ступени `md`) вертикальные
вкладки становятся рядом с линией и «Ещё».

## Когда вкладки не помещаются

`overflow="more"` (по умолчанию) убирает не поместившиеся вкладки целиком в
кнопку «Ещё (n)» в конце ряда: она открывает стандартное меню с ними.
Вкладки уходят по порядку, с конца ряда; закреплённые (`pinned`) и выбранная
остаются в ряду. Если закреплённые и выбранная вместе не помещаются рядом с
«Ещё», закреплённая уступает место выбранной и уходит в «Ещё» (с последней
закреплённой). Выбранная вкладка, оставшаяся в ряду одна и всё равно шире
ряда, — единственная, которую можно сократить многоточием; любая другая
вкладка либо целиком в ряду, либо в «Ещё». Обрезанной вкладки, затухания у
края и стрелок прокрутки нет.
`overflow="scroll"` прокручивает ряд, как раньше было по умолчанию,
`overflow="wrap"` переносит вкладки на следующие строки.

`fit` делит ряд поровну, когда все вкладки помещаются: `auto` (по умолчанию) —
на телефоне, если вкладок от двух до четырёх; `always` — всегда; `never` —
никогда. Не поместившиеся вкладки и с `fit` уходят в «Ещё (n)».

## Список вкладок

Атрибут `items` принимает короткую строку — подписи через `|`, флаги после
`::` (`Главная::icon-start=home|Архив::disabled`) — или JSON-массив, тот же,
что свойство `items` и `setItems()`. Подпись, в которой есть `|` или `::`,
пишите только в JSON, без похожих символов на замену:

```html
<sf-tabs aria-label="Разделы"
  items='[{"id":"io","label":"Ввод | вывод"},{"id":"ns","label":"a::b","hint":"Пространство имён"}]'></sf-tabs>
```

## Значок, счётчик, ошибки и подсказка

У вкладки есть `id` (прежнее имя — `key`), а также могут быть `icon`, `count`
(небольшой счётчик после подписи), `errors`, `hint` и `href`.

```js
tabs.items = [
  {id: 'all', label: 'Все', count: 128},
  {id: 'mine', label: 'Мои', count: 7, icon: 'person'},
  {id: 'billing', label: 'Оплата', disabled: true, hint: 'Доступно владельцу'},
];
```

`hint` — короткий текст во всплывающей подсказке вкладки; у выключенной
вкладки — почему она выключена. Подсказку читает экранный диктор как описание
вкладки.

`errors` — число ошибок в панели вкладки. Вкладка показывает его отметкой
цвета ошибки, размером с подпись, и диктор читает его вместе с названием:
«Доступ, 2 ошибки». Форма после неудачной проверки передаёт ошибки по `id`
вкладок и вызывает действие `go-to-error` — открывается первая по порядку
вкладка с ошибкой, и фокус встаёт на первое неверное поле её панели
(`aria-invalid="true"`, `invalid` или `:invalid`):

```js
tabs.setErrors({profile: 0, access: 2});
tabs.goToError(); // {outcome: 'applied'} или {outcome: 'refused', reason: 'no-errors'}
```

## Ссылки вместо вкладок

Если `href` есть у каждой вкладки, ряд — это навигация, а не вкладки: `<nav>`
со ссылками того же вида, у текущей `aria-current="page"`, без ролей вкладок и
без стрелок. Ссылку можно открыть в новой вкладке браузера (Cmd/Ctrl, средняя
кнопка), нажатие переходит по адресу. Панели у такого ряда не рисуются, если
их не дали.

```js
tabs.items = [
  {id: 'orders', label: 'Заказы', href: '/orders'},
  {id: 'archive', label: 'Архив', href: '/archive'},
];
```

## Ленивые панели, адрес и закреплённый ряд

- `lazy` — панель рисуется, когда её вкладку открыли впервые, и дальше
  остаётся нарисованной.
- `hash` — выбранная вкладка пишется в адрес (`#<id>`): «Назад» возвращает
  прежнюю вкладку, а ссылка на `#<id>` вкладки или элемента внутри её панели
  открывает эту вкладку.
- `sticky` — ряд вкладок остаётся на виду, пока панель прокручивается, ниже
  верха окна на `--sf-tabs-sticky-top` (высота закреплённой шапки).

```html
<sf-tabs aria-label="Профиль" lazy hash sticky
  items="Профиль|Доступ|Уведомления"></sf-tabs>
```

## Настройка вкладок

С атрибутом `configurable` в конце ряда появляется шестерёнка «Настроить
вкладки». Она открывает меню со списком вкладок: их можно переставлять
(мышью, пальцем или клавиатурой) и показывать или скрывать флажком.
Закреплённые вкладки (`pinned: true`) скрыть нельзя. Изменения применяются
сразу, в подвале меню только «Сбросить».

Компонент выбор не хранит. Он сообщает `sf-tabs-settings-change {order,
hidden, reason}` и `sf-tabs-settings-reset` (в `detail` только данные), а
сохранённое берёт от сайта через свойство `settings` или
`setSettings({order, hidden})`. Ключ, которого уже нет среди вкладок,
пропускается. Вкладка, которой нет в сохранённом порядке, встаёт на своё место
и видна. Скрытая вкладка в «Ещё» не попадает — её возвращают в настройках. Но
если скрытая вкладка активна (открыта по ссылке или из кода), она видна на
своём месте, пока активна.
