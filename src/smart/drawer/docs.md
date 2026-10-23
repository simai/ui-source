# sf-drawer

Drawer — боковая панель рабочего места, рядом с которой страница остаётся
доступной: закреплённая колонка (`docked`) или немодальная панель
(`modal="false"`). Он переносит живые DOM-узлы в body portal, не сериализуя их.

Для модальной боковой панели используйте `sf-modal` с
`position="inline-start|inline-end"`. Модальный режим Drawer (режим по
умолчанию) сохранён для совместимости и с версии 1.2.0 считается устаревшим.

```html
<button type="button" data-drawer="open" aria-controls="project-settings">
  Открыть параметры
</button>
<sf-drawer id="project-settings" modal="false" title="Параметры проекта">
  <p>Содержимое боковой панели.</p>
</sf-drawer>
```

Короткий публичный trigger-контракт — `data-drawer="open|toggle|close"`.
Внешний trigger указывает экземпляр нативным `aria-controls`. Прежние
`data-sf-drawer-open`, `data-sf-drawer-toggle` и `data-sf-drawer-close`
поддерживаются как алиасы совместимости.

Use `placement="inline-start|inline-end"` for direction-aware interfaces;
`placement="bottom"` opens a bottom sheet (see below).
Physical `left|right` values remain supported as compatibility aliases.

По умолчанию (устаревший режим) Drawer модальный: удерживает фокус, блокирует прокрутку страницы и
возвращает фокус инициатору. `modal="false"` создаёт немодальную панель без
overlay, scroll lock и focus trap. `overlay="false"` у модального Drawer скрывает
только scrim и не меняет модальность.

Стандартная ширина задаётся `size="1/2|1|2|full"` — это общая лестница размеров
Framework. Прежние слова `small`, `medium` и `large` продолжают работать как
legacy-значения и приводятся к ступеням `1/2`, `1` и `2`; `full` не является
ступенью лестницы: это ширина во весь экран, и она снимает радиус.
Низкоуровневый `width` сохранён для совместимости и должен получать token-based
CSS value.

Компонент поддерживает `open`, `modal`, `size`, `overlay`, `close-on-esc`,
`close-on-overlay`, `preserve-scroll-gap`, `show-close`,
`close-placement="inside|outside"`, `title`, `label`, `close-label`, `width`
and presentation class attributes. Public methods are `open()`, `close()`,
`toggle()`, `setState()` and `getState()`. Existing lifecycle events and
registration helpers (`drawer:ready`, `drawer:update`, `drawer:before-open`,
`drawer:after-open`, `drawer:before-close`, `drawer:after-close`) are preserved.

Начиная с 1.3.0 события `drawer:*` всплывают (`bubbles`, `composed`), как
остальные события `sf-*`, поэтому их можно слушать на `document`.
`event.detail.drawer` — панель, отправившая событие. Помощники `onBeforeOpen`,
`onAfterOpen`, `onBeforeClose` и `onAfterClose` по-прежнему получают только
события своей панели; слушатель, добавленный через `addEventListener` на
внешнюю панель, видит и события вложенной — проверяйте `event.detail.drawer`.

## Стопка панелей (`stack-offset`)

Если у одного края открыто несколько панелей, по умолчанию они лежат
вплотную, и верхняя закрывает нижнюю целиком. Атрибут `stack-offset` задаёт,
насколько каждая нижняя панель выглядывает из-под верхней: верхняя отступает
от края на глубина × `stack-offset`, сохраняя свою ширину. Глубину панель
считает сама — по открытым незакреплённым панелям у того же края
(`left` и `inline-start` в направлении слева направо — один край). Задайте
одно значение на всех панелях стопки:

```html
<sf-drawer placement="inline-end" stack-offset="var(--sf-space-4)"></sf-drawer>
```

## Отступ шапки и содержимого (`gutter`)

Заголовок и содержимое панели стоят на одной вертикальной оси: у шапки и тела
один внутренний отступ. Атрибут `gutter` задаёт его, например
`gutter="var(--sf-space-3)"`; тема может задать `--sf-drawer-gutter` для всех
панелей. Не добавляйте свой отступ внутри тела панели: заголовок останется на
прежней оси, и части разъедутся.

## Закреплённая панель (`docked`)

`docked` превращает Drawer в колонку страницы: панель немодальная, без scrim,
focus trap и блокировки прокрутки, а страница сдвигается и остаётся видна
целиком. Хост помечает контейнер страницы атрибутом `data-sf-drawer-dock-host`;
Framework задаёт ему `padding-inline-start/end` по сумме ширин открытых
закреплённых панелей каждой стороны (переменные
`--sf-drawer-dock-inline-start` и `--sf-drawer-dock-inline-end` на корне
документа). Одновременно можно открыть панели с обеих сторон.

```html
<div data-sf-drawer-dock-host>…страница…</div>
<sf-drawer id="library" docked placement="inline-start" size="1/2" label="Библиотека блоков">…</sf-drawer>
<sf-drawer id="settings" docked placement="inline-end" label="Настройки элемента">…</sf-drawer>
```

Отдавать ли место странице, решает ширина хоста `data-sf-drawer-dock-host`:
при 48rem и шире панель сдвигает страницу, уже — ложится поверх. Без хоста
решает ширина окна.

Порог задаёт сама панель — атрибут `dock-breakpoint` — или переменная
`--sf-drawer-dock-breakpoint` там, где панель стоит (на корне, на хосте или
его предке); атрибут сильнее переменной, без обоих — 48rem. Значение — длина в
`rem`, `em` или `px`. Чату с колонкой чтения и панелями по бокам нужно 64rem
(simai/ui-source#25): уже этой ширины панели ложатся поверх переписки, а не
сжимают её. Порог считается для каждой панели отдельно.

```html
<html style="--sf-drawer-dock-breakpoint: 64rem">
<sf-drawer id="chats" docked placement="inline-start" label="Чаты">…</sf-drawer>
<sf-drawer id="details" docked dock-breakpoint="80rem" placement="inline-end" label="Сведения">…</sf-drawer>
```

### Скрыть закреплённую панель кнопкой

Закреплённая панель скрывается и возвращается кнопкой-переключателем вне её:
`data-drawer="toggle"` и `aria-controls` с `id` панели. Скрытая панель
возвращает странице своё место. Переключатель получает `aria-expanded`: `true`,
пока панель показана, `false`, когда скрыта, — и читается как нажатая кнопка
(так же для прежнего `data-sf-drawer-toggle`). Своя кнопка закрытия у
закреплённой панели тоже есть; с `controlled` она уступает место внешнему
переключателю, пока тот виден.

```html
<button type="button" data-drawer="toggle" aria-controls="chats">Чаты</button>
<sf-drawer id="chats" docked open controlled placement="inline-start" label="Чаты">…</sf-drawer>
```

Размеры колонки чтения и плавающей панели — токены
`--sf-layout-reading-width`, `--sf-layout-floating-panel-width` и
`--sf-layout-floating-panel-height` (`docs/foundation-layout-tokens.md`).

Колонка страницы окрашена как страница: фон закреплённой панели —
`--sf-surface-0`, без тени и без поднятой поверхности; от страницы её отделяет
граница. Поднятая поверхность (`--sf-elevation-4--surface`) в тёмной теме была
самой светлой плоскостью экрана: поля на ней читались как провалы, наведение
и выбор было не различить (simai/ui-source#26). Когда хосту не хватает
ширины и панель ложится поверх страницы, она снова плавающая: поднятая
поверхность и тень. Корень панели сообщает состояние атрибутом
`data-sf-drawer-column="true|false"`. Свой фон задаёт `--sf-drawer-background`
(для обеих форм); в светлой теме обе поверхности белые.

## Панель внутри блока (`data-sf-overlay-container`)

Обычно панель выводится в конце `body` и стоит над всей страницей. Если
Drawer находится внутри элемента с атрибутом `data-sf-overlay-container`,
панель выводится внутри этого элемента и встаёт по его границам: так панель
редактора или пример в документации держат свой Drawer без отдельной сцены.
Высота панели — высота этого блока, прокрутка страницы не блокируется. Тот же
атрибут работает для `sf-modal`. Прежнее имя `data-sf-drawer-container`
читается до 2026-12-01.

```html
<div data-sf-overlay-container style="block-size: 24rem">
  <sf-drawer id="preview" open modal="false" title="Пример">…</sf-drawer>
</div>
```

Логические `inline-start|inline-end` зеркалируются в RTL; физические
`left|right` переводятся в логическую сторону по направлению документа.
Закреплённая панель имеет `role="region"` и требует `label` или `title`.
Высоту шапки сайта над закреплёнными панелями задаёт
`--sf-drawer-dock-block-start` (если он не задан — `--sf-drawer-block-start`). На
экранах уже порога (48rem или `dock-breakpoint`) страница не сужается, а
панель перекрывает её. Escape
закрывает верхнюю панель, фокус не удерживается. При `prefers-reduced-motion`
сдвиг происходит без анимации.

## Панели под шапкой приложения (`--sf-drawer-block-start`, `block-start`)

Выезжающая панель по умолчанию встаёт от верхнего края окна и закрывает шапку
приложения: кнопку «назад», название, действия. Переменная
`--sf-drawer-block-start` задаёт высоту шапки, и все панели — выезжающие,
модальные, нижний лист — начинаются под ней; scrim тоже, поэтому шапка
остаётся доступной (simai/ui-source#29). Атрибут `block-start` задаёт отступ
одной панели.

```html
<html style="--sf-drawer-block-start: var(--app-bar-height)">
<sf-drawer id="structure" modal="false" placement="inline-start" title="Структура">…</sf-drawer>
<sf-drawer id="preview" block-start="4rem" placement="inline-end" title="Просмотр">…</sf-drawer>
```

## Панель с внешним переключателем (`controlled`)

Если панель открывает и закрывает переключатель вне её — нижняя навигация
телефона, кнопка в шапке, — второй способ закрыть её лишний. С атрибутом
`controlled` панель не рисует кнопку закрытия, пока на экране виден элемент
с её `id` в `aria-controls` (вне самой панели). Когда переключатель скрыт
(другая раскладка, другая ширина окна), кнопка возвращается. Escape закрывает
панель как обычно. Чтобы убрать кнопку всегда, есть `show-close="false"`.

```html
<nav><button type="button" aria-controls="structure" data-drawer="toggle">Структура</button></nav>
<sf-drawer id="structure" controlled modal="false" placement="inline-start" title="Структура">…</sf-drawer>
```

## Нижний лист (`placement="bottom"`)

Для телефона: панель выезжает снизу во всю ширину, со скруглением сверху и
ручкой-кнопкой (simai/ui-source#20).

- `snap="auto|half|full"` — высота покоя: по содержимому (не выше места под
  шапкой), половина места или всё место под шапкой (`--sf-drawer-block-start`);
- ручка — кнопка высотой с элемент управления 1/2: нажатие или Enter
  переключает половину и всё место, стрелки вверх и вниз — между `auto`,
  `half` и `full`; каждое изменение — событие `drawer:snap`, метод `setSnap()`;
- смахивание вниз по ручке или шапке закрывает лист (из `full` — переводит в
  `half`), вверх — открывает на всё место; лист следует за пальцем;
- модальный лист удерживает фокус и возвращает его, Escape закрывает только
  верхний слой;
- снизу сохраняется безопасная зона (`env(safe-area-inset-bottom)`);
- при `prefers-reduced-motion` лист появляется без анимации.

`docked` у нижнего листа не действует: лист всегда поверх страницы.

```html
<button type="button" aria-controls="blocks" data-drawer="open">Блоки</button>
<sf-drawer id="blocks" placement="bottom" snap="half" title="Блоки">…</sf-drawer>
```

Проба: `tests/browser/drawer-sheet.browser.mjs`.
