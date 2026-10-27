# Smart Tabs

`sf-tabs` presents one locally available panel at a time. The default template
supports text buttons and `variant="icons"`; icon tabs use each item's label as
their accessible name. Text slots remain the accessible label of text tabs.
Give each tablist an `aria-label`, or reference a visible heading through
`aria-labelledby`.

The historical `scheme` attribute selects built-in button appearance:
`default`, `outline` or `link`, with the primary semantic color pair. It is not
a selector for arbitrary semantic colors. `type` separately selects the Tabs
skin (`underline`, `pills`, `full`, `vertical`, or the default). Existing attribute
values and custom-template forwarding are preserved.

A nested `sf-tabs` in a panel slot keeps its own skin; parent skin selectors do
not reach into the nested header. Horizontal lists scroll locally instead of
squeezing labels into individual characters or widening the page. Default
controls can wrap a label wider than the list. Prefer concise labels.

The built-in text/icon templates have one enabled native tab stop, unique stable
tab/panel IDs and reciprocal `aria-controls` / `aria-labelledby` relationships.
Panels are keyboard-focusable. Horizontal navigation uses Left/Right (mirrored
in RTL); `type="vertical"` uses Up/Down. Home/End select enabled endpoints.
Arrows skip disabled tabs, wrap and move focus while activating the panel --
unless a panel holds a part that starts later (`data-sf-start`, an assembly's
`start: opened`): then the arrows only move the focus and Enter or Space opens
the tab (manual activation, standard 1.3.8 §7.2.1).
Perpendicular arrows retain browser behavior. Keyboard events in panel content
and nested Tabs do not navigate an outer Tabs instance.

A person's choice (a press, a key, «Ещё») sends `sf-tabs-change` with
`{selected, previous, current, item, items}` -- data only. The old name
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
attribute. Tab, panel and label ids are the host's path id and a local name
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

`type="pills"` only rounds the tabs; their paint comes from `scheme`, which
selects the button appearance. With the default `scheme` every pill is a filled
button, the selected one in its selected state — a row where nothing stands
out. For pills where only the selected tab is filled use `scheme="outline"`
(or `link`):

```html
<sf-tabs type="pills" scheme="outline" aria-label="Разделы"></sf-tabs>
```

Tabs are not a switch. For a two-option segmented switch — two choices, no
panels — use the segmented button group:

```html
<sf-button-group appearance="segmented" aria-label="Вид" value="edit"
  items='[{"value":"edit","label":"Редактор"},{"value":"code","label":"Код"}]'></sf-button-group>
```

It is a `radiogroup` with one tab stop, arrows, Home and End, and its track is
the height of an `sf-button` of the same `size`, so it stands in a row with the
header's buttons. Pills are a tablist of button-shaped tabs and do not follow
the button height ladder; a pill row beside buttons will not line up with them.
Tabs are for panels: each tab shows its own panel, and the switch only reports
a value.

## Подчёркнутые вкладки: размеры

У `type="underline"` вкладка — это её подпись и линия, без отступов по бокам.
Между вкладками один промежуток по размеру: 20px при `size="1/2"`, 24px при
`1`, 32px при `2`. Высота вкладки — высота контрола своего размера (32, 40,
48px), и вся она нажимается. Линия 2, 2 и 3px.

## Когда вкладки не помещаются

`overflow="scroll"` (по умолчанию) прокручивает ряд, `overflow="wrap"`
переносит вкладки на следующие строки. `overflow="more"` убирает не
поместившиеся вкладки в кнопку «Ещё (n)» в конце ряда: она открывает
стандартное меню с ними. Активная вкладка всегда остаётся на месте.

## Значок, счётчик и ссылка

У вкладки, заданной через свойство `items` (или `setItems`), есть `id`
(прежнее имя — `key`), а также могут быть `icon`, `count` (небольшой
счётчик после подписи) и `href`. Вкладка с `href` — ссылка: при выборе она
переходит по адресу, с Cmd/Ctrl — в новой вкладке браузера, а у активной стоит
`aria-current="page"`.

```js
tabs.items = [
  {id: 'all', label: 'Все', count: 128},
  {id: 'mine', label: 'Мои', count: 7, icon: 'person'},
  {id: 'archive', label: 'Архив', href: '/archive'},
];
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
