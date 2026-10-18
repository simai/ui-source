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

Use `placement="inline-start|inline-end"` for direction-aware interfaces.
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
Высоту шапки сайта над панелями задаёт `--sf-drawer-dock-block-start`. На
экранах уже 48rem страница не сужается, а панель перекрывает её. Escape
закрывает верхнюю панель, фокус не удерживается. При `prefers-reduced-motion`
сдвиг происходит без анимации.
