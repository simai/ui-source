# Badges

Badge is a compact, non-interactive metadata label for a short status,
category, version or count beside another object. Use a Button or another native
control when the element performs an action.

## Public contract

- emphasis: `tonal` (the default, also the class with no look), `outline`
  (a mark beside a title), `main` (the attention count alone, with `error`;
  `sf-badge--main` with any other colour draws tonal until 2027-01-01, owner
  decision C140) (`appearance`; `type` is its former name);
- scheme: `neutral`, `primary`, `secondary`, `tertiary`, `info`, `success`,
  `warning`, `error`, `on-surface` (a status may also be given as `status`).
  `danger`, the former name of `error`, still draws the error badge and is
  noted in `SF.deprecations` until 2026-12-01 (journal `class-status-aliases`);
- hue (a colour from the static palette, owner decision C411, 1.14.0):
  `sf-badge--red`, `--orange`, `--amber`, `--yellow`, `--lime`, `--green`,
  `--teal`, `--cyan`, `--sky`, `--blue`, `--indigo`, `--violet`, `--purple`,
  `--pink`, `--brown`, `--gray` (`hue` in the constructor and on `sf-badge`);
- size: `1/3`, `1/2`, `1`;
- optional text and decorative icon at the logical start or end.

`tonal + on-surface` draws the grey tonal badge. Unknown values normalize to
the safe defaults, tonal and neutral.

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

A tonal badge on an inverse place (`bg-surface-inverse`,
`bg-surface-inverse-fixed`) draws a hairline edge in its graphic ink (1.12.0,
owner decision C208): its translucent fill alone stood 1.09-1.38:1 against
the inverse surface. The place asks for it with `--sf-place--tonal-edge`; an
opaque place on it takes the request back.

Indicator sizes: a badge is a non-interactive indicator, not a control, so its
heights may stand below the control ladder (C18): a `line-*` badge is its text
line, 16 at `line-1/2` on a phone. Sizes `1/3`, `1/2`, `1` are 24, 28, 32 on
a desktop and on a phone (C140 (5); the phone text stays 12, 12, 14), 24, 24,
28 in a compact region; nothing in a badge is a target to press. A badge that opens or removes
something is a button or a tag, and takes the control ladder (DEV, docs
precheck BG-01, 2026-11-10).

Side room: by default the text sits `--sf-space-1/2` from the badge's edges at
every size (owner decision 2026-11-07). `sf-badge--tight` takes the space step
under it, `--sf-space-1/3` (8 px, 4 in a compact region, 8 on the phone), for
dense places -- a table, a counter, a chip in a row; until 1.8.0 it took the
button's text inset (6 / 7 / 8, 5 / 6 on the phone), which is off the space
ladder. `sf-badge--figure` marks a badge of one character, a single-figure
count: it takes `--sf-space-1/4` at the sides, so it stays round (as wide as it
is high) whatever the default; a class counter (`[data-count]`) takes the same.
`sf-badge` sets it on its own; class markup adds it. `sf-badge--icon-only` (the
icon alone; `sf-badge--compact`, its former name, draws the same until
2027-01-01, owner decision C134) is unchanged, and so are anchored counts, which
have a geometry of their own. Probe:
`tests/browser/badge-geometry.browser.mjs`.

On the line of a text: `sf-badge--line-text` (`sf-badge line="text"`, owner
decision C95 point 6, 2026-11-12) sizes a badge by the text it stands beside --
a count or a mark in a contents entry, a tab or a list row. Its height is that
text's line (`1lh`), its number the text's own size (inherited), no block
padding and `--sf-space-1/4` at the sides, so one figure is a circle the line
high; it stands on the top of the line box, so it lies on the line with no
offset, and a flex row centres it. The size class is not read for the height.

Name and value (component.badges 1.13.0, owner decisions C317-C319): one
badge holds a name and a value, «sf-wizard | 1.5.3». After the name's
`.sf-badge-text-container` come `.sf-badge-divider` (one pixel wide, as high
as the text line, `aria-hidden="true"`) and `.sf-badge-value`; a visually
hidden word before the value makes a screen reader say «sf-wizard, версия
1.5.3». `--sf-space-1/3` stands on each side of the divider (`--sf-badge-gap`
on a badge with a divider). The badge does not wrap inside: a long name
truncates with an ellipsis, the value never. The name stops at the width
ladder's 28 characters (`--sf-measure-28`, component.badges 1.15.0) and
truncates there, inline in a line of text too, where its container is the
whole line; a badge without a value has no cap. A page that wants another
cap sizes `.sf-badge-text`. Every size and look keeps its
height (C01, C140 (5)). The divider is the badge's border colour on an outline
badge and `--sf-outline` on a fill, the text colour on the filled error count;
`--sf-badge-divider-color` sets it. The value takes the text colour. A badge
without the parts draws exactly as before. It is a static mark: no copy on a
click (C319).

```html
<span class="sf-badge sf-badge--outline sf-badge--on-surface sf-badge--size-1/2 inline-flex flex-row flex-nowrap justify-center items-center">
  <span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">sf-wizard</span></span>
  <span class="sf-badge-divider" aria-hidden="true"></span>
  <span class="sf-badge-value"><span class="sf-badge-value-label">, версия </span>1.5.3</span>
</span>
```

The hidden word is a part of its own, `.sf-badge-value-label` (component.badges
1.15.0): the first child of `.sf-badge-value`, its text a comma, a space, the
word and a space (`, <word> `). The badge sheet hides it from sight and keeps
it for a screen reader, so the class form needs no utility beside it
(`sr-only` may stay; sf-badge prints both). The word is the page's own
(«версия» for a version) or sf-badge's word `value-label` in the page
language, the one sf-badge says when its `value-label` is empty: in a pair,
`distr/smart/badge/lang/<lang>.json` → `runtime.value-label` («значение» in
`ru`, «value» in `en`), the same word as in the language pack
`distr/core/lang/<lang>/badge.json` → `words["sf-badge"]["value-label"]`.

A colour from the palette (component.badges 1.14.0, owner decision C411): a
badge whose colour comes from data -- a section, a tag, a choice in a table
cell -- takes a hue class, `sf-badge--<hue>`, for the sixteen static palette
names (`red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`,
`sky`, `blue`, `indigo`, `violet`, `purple`, `pink`, `brown`, `gray`). The
class sets the fill, the hue's tone 50 at the fill step 24
(`--sf-<hue>-50--alfa-24`), and the text `--sf-on-surface`, the same in light
and dark; on an inverse place its edge is the hue's graphic ink. It replaces
the two public variables a page wrote for it before. Status colours stay with
the status classes: with `sf-badge--info`, `--success`, `--warning` or
`--error` on the same badge the status wins. The hue draws on the tonal looks;
`sf-badge--outline` and the error count keep their own colours. The public
`--sf-badge-background-color` and `--sf-badge-color` still win. No raw colour
is drawn in a badge. `BADGE_HUES` in `js/contract.js` lists the names.

```html
<span class="sf-badge sf-badge--teal sf-badge--size-1/3 inline-flex flex-row flex-nowrap justify-center items-center">
  <span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">Дизайн</span></span>
</span>
```

Disabled: `sf-badge--disabled` gives a badge the disable roles (`--sf-surface-disabled`
fill, `--sf-on-surface-disabled` text, `--sf-outline-disabled` edge) whatever its look,
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
| Цвет | роль ошибки (`--sf-error` / `--sf-on-error`): число на якоре — внимание (C140); публичные `--sf-badge-background-color`, `--sf-badge-color` |
| Кольцо | `--sf-badge-ring-color` — цвет поверхности под якорем |

Скрипт компонента (`SF.AnchoredBadge`) держит бейджи с `data-count` и
`data-dot` сам, в том числе добавленные и изменённые позже: рисует число с
порогом, прячет нуль, скрывает цифры от вспомогательных технологий, ставит
фразу во всплывающую подсказку (`title`) и в доступное имя. Пакету достаточно
менять атрибуты. Точку рисует общая точка Framework (решение C185 (8)): скрипт кладёт в бейдж на якоре
и в бейдж-точку `<span class="sf-dot"><span class="sf-dot-item"></span></span>` после цифр, лист
бейджа показывает её там, где бейдж — точка, цветом бейджа и размером точки ступени.
`SF.AnchoredBadge.init(scope)` обрабатывает поддерево сразу,
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

Размер не выбирается свободно — его задаёт шаг якоря на лестнице, через одну
таблицу мелких ступеней 4 · 6 · 8 · 12 · 16 (решение C132). Якоря `1/4`, `1/3` и
`1/2` (строки, списки, строки текста) несут только точку: число на них рисуется
точкой, а само число уходит в доступное имя и подсказку. Счёт — 16 на любом
якоре `1`, `2`, `3`. Точка та же, что точка присутствия на аватаре того же
шага. Кольцо рисуется снаружи цветного круга, поэтому цветной диаметр равен
ступени. Размеры не зависят от ширины экрана и плотности; значения в px — при
1rem = 16px.

| Шаг якоря | Счёт: высота | Цифры | Внутренний отступ | Точка | Кольцо |
| --- | --- | --- | --- | --- | --- |
| `1/3` | только точка | — | — | 6px | 1px |
| `1/2` | только точка | — | — | 8px | 2px |
| `1` | 16px | `--sf-text-size-1/4` | `--sf-a4` | 12px | 2px |
| `2` | 16px | `--sf-text-size-1/4` | `--sf-a4` | 12px | 2px |
| `3` | 16px | `--sf-text-size-1/4` | `--sf-a4` | 16px | 2px |

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

На строке с заливкой — выбранной, открытой, текущей или под указателем
(миксин ядра `sf-place-fill`) — под бейджем лежит сама строка: её
полупрозрачная заливка поверх цвета места. Строка объявляет заливку ролью
`--sf-surface-place-fill`, и кольцо кладёт её поверх цвета места, поэтому
кольцо совпадает со строкой, а не светится вокруг бейджа цветом места (C43 D3,
2026-11-11). Каждое место сбрасывает эту роль, мягкое цветное и стекло тоже,
поэтому на строке мягкого места кольцо тоже цвета строки, а у поповера или
места, открытого из выбранной строки, заливки строки нет.

Под кольцом лежит ближайшее непрозрачное место (`--sf-surface-place-ground`).
На мягком цветном месте кольцо — его тон поверх этой основы, то есть ровно
вид самого места, а не тон, положенный дважды. На стекле основа чёрная, как
под точкой статуса аватара. На сплошном месте кольцо непрозрачно, и основы не
видно. `--sf-badge-ring-color` — само кольцо, поэтому в покое видно его.

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

### Узкая колонка (рельс)

`sf-menu sf-menu--rail` — рельс разделов первого уровня: в строке видна
только иконка или аватар, слова строки скрыты, но остаются в её имени. Счётчик
строки — `.sf-badge` с `data-count` внутри `.sf-menu-element-wrap` — переходит
на иконку с той же геометрией, размером шага `1` и кольцом. Ветки в рельсе не
раскрываются. Прежний класс `sf-menu--compact` работает так же до 2027-01-01:
слово «compact» означает только плотность (решение C134). В развёрнутом меню тот же счётчик стоит в конце строки.

```html
<ul class="sf-menu sf-menu--rail">
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

Layout without the script (1.10.0, RG-B-53): the layout the component's
script gives the parts it builds (`json/*.utility.json`) is in the stylesheet
too, so markup a page writes draws the same without the script and where the
script never builds the part: `.sf-badge`, `.sf-badge .sf-badge-icon-container`, `.sf-badge .sf-badge-text-container`. It stands in `@layer sf.base`, under
the utilities and the component rules, so a utility class on the element still
wins; a root a Smart element drew (a child of `[data-sf-started]`, or printed
`[data-sf-static]`) is left as it was. Generated by
`scripts/generate-utility-hint-layout.mjs` into
`scss/_css__utility_hint_layout.scss`.

Слово счётчика (1.10.2, C177): `count` в языковых файлах — слово с формами
множественного числа (`{"one": …, "few": …, "many": …, "other": …}`), как во
всех пакетах; подпись автора в формах через «|» (`label`) читается по-прежнему.
