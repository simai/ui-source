# Badges

Badge is a compact, non-interactive metadata label for a short status,
category, version or count beside another object. Use a Button or another native
control when the element performs an action.

## Public contract

- emphasis: `main`, `tonal`, `outline` (`appearance`; `type` is its former name);
- scheme: `neutral`, `primary`, `secondary`, `tertiary`, `info`, `success`,
  `warning`, `error`, `on-surface` (a status may also be given as `status`).
  `danger`, the former name of `error`, still draws the error badge and is
  noted in `SF.deprecations` until 2026-12-01 (journal `class-status-aliases`);
- size: `1/3`, `1/2`, `1`;
- optional text and decorative icon at the logical start or end.

`tonal + on-surface` is not a designed pair and normalizes to
`main + on-surface`. Unknown values normalize to the safe neutral defaults.

## Semantics

Use an inline `span` for ordinary markup. The root is `inline-flex`, as wide as
its text, in the constructor and in `sf-badge` alike; a badge that must fill its
row takes a width utility through `utilities` (for example `w-full`). The visible word or number provides
the default accessible content, and an icon is `aria-hidden="true"`. An
icon-only or abbreviated value needs a full text equivalent using an `sr-only`
child. A badge with neither visible nor screen-reader text is decorative.

Colour reinforces meaning but never replaces the written status. Badge is not
focusable and does not own hover, live-region or announcement behavior. A host
that updates a time-sensitive status owns `aria-live` or `role="status"`.

## Presentation

The pill radius distinguishes Badge from controls and surfaces. All geometry
uses the corresponding typography and UI-spacing tokens. The outline variant
uses the Framework pixel token and a solid semantic outline. Labels remain
short; use normal content or a different component for sentences.

Every badge of one size has one height and the same side room, whatever its
look: the outline's border (and a border given through
`--sf-badge-border-width`) is drawn inside the size, its width taken from the
padding, so `main`, `tonal` and `outline` badges standing side by side line up.
On a `line-*` size, which has no block padding, the text line gives up the
border instead.

Indicator sizes: a badge is a non-interactive indicator, not a control, so its
heights may stand below the control ladder (C18): a `line-*` badge is its text
line, 16 at `line-1/2` on a phone. Size `1/3` is 24 on a desktop and 20 on a
phone; nothing in a badge is a target to press. A badge that opens or removes
something is a button or a tag, and takes the control ladder (DEV, docs
precheck BG-01, 2026-11-10).

Side room: by default the text sits `--sf-space-1/2` from the badge's edges at
every size (owner decision 2026-11-07). `sf-badge--tight` keeps the size's own text inset
(`--sf-ui-*--text-space-x`, the room badges had before 2026-11-07) for dense
places -- a table, a counter, a chip in a row. `sf-badge--figure` marks a badge
of one character, a single-figure count: it keeps the tight room, so it stays
round (as wide as it is high) whatever the default. `sf-badge` sets it on its
own; class markup adds it. `sf-badge--compact` (the icon alone) is unchanged,
and so are anchored counts, which have a geometry of their own. Probe:
`tests/browser/badge-geometry.browser.mjs`.

Disabled: `sf-badge--disabled` gives a badge the disable roles (`--sf-disable`
fill, `--sf-on-disable` text, `--sf-outline-disable` edge) whatever its look,
for a badge inside a control that cannot be used now -- a choice card, a menu
row. It is a state and draws over the public variables; `sf-badge` takes it
through `root-class` (component.badges 1.4.0, owner decision C28).

On a translucent fill: a selected, open or current row draws an alpha of
primary over its place, and a tonal badge is an alpha of its own colour, so on
such a row it used to come out as the one alpha over the other -- a warning or
an error badge on the open record read as a grey fact. A row like that declares
`--sf-surface-underlay`, which equals the place colour and is set only under a
translucent fill (core mix `sf-place-fill`, from `--sf-surface-place-solid`; a
soft coloured place has no solid colour, so a row on it leaves the role off;
the selected rows of lists, menus, the tree, the admin menu's search and the
checked choice card do), and
a tonal badge lays its own tone over that colour, so it reads as it does on the
place itself (component.badges 1.5.0, owner decision C43). Off such a row the
role is `initial` and the badge is drawn as before, its `background-color`
untouched. A row of your own with a translucent fill declares
`--sf-surface-underlay: var(--sf-surface-place-solid)` with the fill. Probe:
`tests/browser/badge-on-fill.browser.mjs`.

## Бейдж на якоре: счётчик и точка

Счётчик или точка ставится внутрь якоря — аватара, кнопки-иконки или обёртки
`.sf-badge-anchor` вокруг иконки или любого элемента пакета, — и Framework сам
ставит его на место: утилиты `relative`, `absolute`, `top-0`, `inline-end-0` не
нужны (simai/ui-source#12).

```html
<!-- аватар -->
<span class="sf-avatar sf-avatar--size-2 sf-avatar--text inline-flex items-cross-center content-main-center"
      role="img" aria-label="Анна Белова">
  <span class="sf-avatar-text" aria-hidden="true">АБ</span>
  <span class="sf-badge sf-badge--anchored" data-count="3"></span>
</span>

<!-- кнопка-иконка -->
<button type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center"
        aria-label="Уведомления">
  <i class="sf-icon" aria-hidden="true">notifications</i>
  <span class="sf-badge sf-badge--anchored" data-count="120"></span>
</button>

<!-- иконка или элемент пакета: якорь-обёртка с шагом и формой -->
<span class="sf-badge-anchor sf-badge-anchor--size-1 sf-badge-anchor--square" role="img" aria-label="Почта">
  <i class="sf-icon" aria-hidden="true">mail</i>
  <span class="sf-badge sf-badge--anchored" data-dot></span>
</span>
```

Smart-элементы: у `sf-avatar`, `sf-icon` и `sf-icon-button` есть входы
`badge-count`, `badge-dot`, `badge-cap` и `badge-label` с тем же поведением.

### Разметка

| Что | Как |
| --- | --- |
| Бейдж | `span.sf-badge.sf-badge--anchored` — прямой потомок якоря |
| Счёт | `data-count="<целое>"`; `0`, пусто или отрицательное прячут бейдж |
| Точка | `data-dot`; показывается, когда `data-count` не задан |
| Порог | `data-cap="<целое>"`, по умолчанию `99`: больше порога — `99+` |
| Слова | `data-label` — текстовый эквивалент точки; для счёта — фраза в формах множественного числа через `\|` с `{count}` на месте числа (`{count} заявка\|{count} заявки\|{count} заявок`) |
| Якорь | `.sf-avatar`, `.sf-icon-button` или `.sf-badge-anchor` |
| Шаг якоря-обёртки | `sf-badge-anchor--size-1/3\|1/2\|1\|2\|3`, без класса — `1` |
| Форма якоря-обёртки | `sf-badge-anchor--round`, `--rounded` (радиус `--sf-radius--ui`), `--square` (по умолчанию) |
| Цвет | по умолчанию роль ошибки (`--sf-error` / `--sf-on-error`); `sf-badge--main sf-badge--primary` и другие схемы бейджа меняют его; публичные `--sf-badge-background-color`, `--sf-badge-color` |
| Кольцо | `--sf-badge-ring-color` — цвет поверхности под якорем |

Скрипт компонента (`SF.AnchoredBadge`) держит бейджи с `data-count` и
`data-dot` сам, в том числе добавленные и изменённые позже: рисует число с
порогом, прячет нуль, скрывает цифры от вспомогательных технологий, ставит
фразу во всплывающую подсказку (`title`) и в доступное имя. Пакету достаточно
менять атрибуты. `SF.AnchoredBadge.init(scope)` обрабатывает поддерево сразу,
`update(badge)` — один бейдж, `state({count, dot, cap, label}, node)` отвечает,
что бейдж покажет и скажет, не трогая страницу.

На странице работает один такой скрипт, сколько бы копий файла ни было
подключено: первая копия ставит общий обработчик, остальные пользуются им.
Имя владельца пишется, только когда оно меняется, и его исходная подпись
хранится один раз — повторное подключение не дописывает фразу второй раз.

### Место

- Счётчик и точка — в верхнем конце якоря (справа в LTR, слева в RTL) и
  перекрывают его.
- Круглый якорь: центр бейджа на окружности под 45°, на r·(1 − 1/√2) внутрь от
  угла рамки, а не в самом углу.
- Скруглённый квадрат: та же точка дуги угла, ρ·(1 − 1/√2), где ρ — радиус угла.
- Квадрат: сам угол.
- Индикатор присутствия (`.sf-online-indicator`) остаётся в нижнем конце; оба
  могут быть показаны сразу.
- Бейдж выходит за якорь не больше чем на половину своего размера.

### Размер: шаг якоря решает

Размер не выбирается свободно — его задаёт шаг якоря на лестнице. Якоря `1/3` и
`1/2` (строки, списки, строки текста) несут только точку: число на них рисуется
точкой, а само число уходит в доступное имя и подсказку. Размеры не зависят от
ширины экрана; значения в px — при 1rem = 16px.

| Шаг якоря | Счёт: высота | Цифры | Внутренний отступ | Точка | Кольцо |
| --- | --- | --- | --- | --- | --- |
| `1/3` | только точка | — | — | `--sf-a6` (6px) | `--sf-a1` (1px) |
| `1/2` | только точка | — | — | `--sf-a8` (8px) | `--sf-a2` (2px) |
| `1` | `--sf-b6` (16px) | `--sf-text-size-1/4` | `--sf-a4` | `--sf-b0` (10px) | `--sf-a2` |
| `2` | `--sf-c0` (20px) | `--sf-text-size-1/3` | `--sf-a5` | `--sf-b2` (12px) | `--sf-a2` |
| `3` | `--sf-c2` (24px) | `--sf-text-size-1/2` | `--sf-a6` | `--sf-b4` (14px) | `--sf-a2` |

Какой шаг у якоря:

| Якорь | Шаг |
| --- | --- |
| `sf-avatar--size-1/4`, `--size-1/3`, `--line-1/2`, `--line-1` | `1/3` |
| `sf-avatar--size-1/2`, `--line-2` | `1/2` |
| `sf-avatar--size-1`, `2`, `3` | `1`, `2`, `3` |
| `sf-icon-button--size-N` | `N` |
| `sf-badge-anchor--size-N` | `N` (по умолчанию `1`) |
| Smart `sf-icon` по `size`: `1/4`…`1` | `1/3` |
| Smart `sf-icon`: `2` | `1/2` |
| Smart `sf-icon`: `3` и без размера | `1` |
| Smart `sf-icon`: `4`, `5` | `2` |
| Smart `sf-icon`: `6`, `7` | `3` |

Число табличными цифрами; один знак — круг, два и три — бейдж растёт вширь,
высота та же.

### Кольцо

Бейдж и точку отделяет от якоря кольцо цвета поверхности, на которой стоит
якорь. Цвет берётся так: публичная `--sf-badge-ring-color`, если её задала
страница; иначе `--sf-badge--surface`, которую ставят поверхности Framework —
выпадающие списки, контекстное меню, горизонтальное подменю, панель админ-меню,
шторка, поповер, модальное окно, тост; иначе поверхность страницы
`--sf-surface-page`. Все они через `light-dark()`, поэтому кольцо верно в светлой и
тёмной теме и на поднятой поверхности. Страница, рисующая свою поверхность,
ставит на ней `--sf-badge-ring-color`.

### Доступность

Цифры и точка скрыты от вспомогательных технологий (`aria-hidden="true"`),
число не читается отдельно. Фраза присоединяется к доступному имени якоря:

- у владельца с `aria-label` (сам якорь, ссылка или кнопка вокруг) имя
  становится «Анна Белова, 3 непрочитанных»; при нуле возвращается исходное;
  если владелец сам перепишет `aria-label`, новое значение считается исходным;
- иначе фраза добавляется скрытым текстом в конец ссылки или кнопки вокруг
  (или родителя), и имя из содержимого заканчивается ею.

Фразы по умолчанию по языку страницы:

| Язык | Счёт | Точка |
| --- | --- | --- |
| ru | 1 непрочитанное · 2–4 непрочитанных · 5–20 непрочитанных · 21 непрочитанное | есть новое |
| en | 1 unread · 3 unread | new |

В имени всегда точное число: при `99+` на экране имя говорит «120
непрочитанных». Другой язык добавляется так:
`SF.language.register('sf-badge', 'de', {count: '{count} ungelesen', dot: 'neu'})`.

### Компактное меню

`sf-menu sf-menu--compact` — рельс разделов первого уровня: в строке видна
только иконка или аватар, слова строки скрыты, но остаются в её имени. Счётчик
строки — `.sf-badge` с `data-count` внутри `.sf-menu-element-wrap` — переходит
на иконку с той же геометрией, размером шага `1` и кольцом. Ветки в компактном
меню не раскрываются. В развёрнутом меню тот же счётчик стоит в конце строки.

```html
<ul class="sf-menu sf-menu--compact">
  <li class="sf-menu-item">
    <a href="/inbox" class="sf-menu-element sf-menu-element--level-1">
      <span class="sf-menu-element-wrap">
        <i class="sf-icon sf-menu-element-icon" aria-hidden="true">inbox</i>
        <span class="sf-menu-element-text">Входящие</span>
        <span class="sf-badge" data-count="3"></span>
      </span>
    </a>
  </li>
</ul>
```

Админ-меню (`.sf-admin-menu-panel.small`) делает то же со `.sf-badge` внутри
`.sf-admin-menu-item-container`.
