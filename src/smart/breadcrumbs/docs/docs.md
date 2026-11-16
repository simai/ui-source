# sf-breadcrumbs

Smart-компонент хлебных крошек поверх базового компонента `breadcrumbs`.

Тег:

- `sf-breadcrumbs`

Модель загрузки:

- определяется через `tags: ['sf-breadcrumbs']` в `src/smart/breadcrumbs/rule.js`
- загружается как smart-бандл `cl-breadcrumbs`
- базовые стили подключаются через relation с `breadcrumbs`
- иконки подключаются через relation с `icons`
- обновления проходят через общий `SfBaseElement`; шаблон использует `lit`

## Базовое использование

Основной безопасный вариант для playground, документации и HTML, который проходит через sanitizer, - дочерние узлы `sf-breadcrumbs-item`. Такой тег начинается с `sf-`, поэтому не удаляется sanitizing-слоем и доходит до `SfBaseElement`.

```html
<sf-breadcrumbs>
  <sf-breadcrumbs-item icon="home" href="/" aria-label="Home"></sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/category">Category</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/category/hidden">Hidden level</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/category/sub">Subcategory</sf-breadcrumbs-item>
  <sf-breadcrumbs-item current>Category Item</sf-breadcrumbs-item>
</sf-breadcrumbs>
```

Короткий тег `item` тоже поддерживается рантаймом, но его стоит использовать только в доверенном raw HTML, где sanitizer/editor не удаляет неизвестные теги без префикса `sf-`.

```html
<sf-breadcrumbs>
  <item href="/category">Category</item>
  <item current>Category Item</item>
</sf-breadcrumbs>
```

Атрибут `items` оставлен как компактный и программный формат:

```html
<sf-breadcrumbs
  items="::icon=home,href=/,aria-label=Home|Category::href=/category|Hidden level::href=/category/hidden|Subcategory::href=/category/sub|Category Item::current"
></sf-breadcrumbs>
```

## Атрибуты

Атрибуты корня:

- `items`
- `current`
- `siblings`
- `separator-icon`
- `home-icon`
- `home-label`
- `root-class`
- `item-class`
- `link-class`
- `current-class`
- `separator-class`
- `container-class`
- `aria-label`
- `expand-label`
- `expand-on-ellipsis`
- `max-items`

`current` — какая крошка является текущей страницей: `last` (по умолчанию) или
`none`. При `last` текущая — крошка с `current`, а если такой нет — последняя,
если только у неё не стоит `current: false` (`current="false"` у дочернего
элемента). `none` — путь только из родителей: над заголовком страницы, который
сам называет страницу (решение C93, п. 4), каждая крошка с адресом — ссылка,
`aria-current` нет. В слоте `path` у `sf-header-page` по умолчанию `none`.

```html
<sf-breadcrumbs current="none">
  <sf-breadcrumbs-item href="/">simai.ru</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/data">Данные</sf-breadcrumbs-item>
</sf-breadcrumbs>
<h1>Каталог решений</h1>
```

`siblings` (выключено по умолчанию, решение C93, п. 3) — переход к соседним
разделам: у крошки с `siblings` (список `{label, href, current}`) появляется
кнопка со стрелкой, которая открывает их меню; текущий раздел отмечен.

```html
<sf-breadcrumbs siblings items='[
  {"label": "Главная", "href": "/"},
  {"label": "Ноутбуки", "href": "/laptops", "siblings": [
    {"label": "Ноутбуки", "href": "/laptops", "current": true},
    {"label": "Планшеты", "href": "/tablets"}
  ]},
  {"label": "Игровые ноутбуки"}
]'></sf-breadcrumbs>
```

`expand-label` локализует доступное имя кнопки, которая раскрывает скрытые
уровни. Например: `expand-label="Показать скрытые уровни"`.

`home-icon` и `home-label` применяются как fallback к первому item без
собственного текста: `home-label` задаёт подпись, а `home-icon` — optional
декоративную иконку. У уже заполненного первого item содержимое не меняется.

`root-class`, `style` и `root-style` применяются к корневому `nav`, а не к
блочной оболочке Smart-элемента. Используйте утилиты и семантические токены.
Изменение оформления не сворачивает уже раскрытый путь и не вызывает событие
выбора. Это действует и для `items`, и для дочерних `sf-breadcrumbs-item`.

Атрибуты дочернего `sf-breadcrumbs-item` / `item`:

- `href`
- `url`
- `icon`
- `label`
- `text`
- `title`
- `current`
- `active`
- `disabled`
- `ellipsis`
- `target`
- `rel`
- `item-class`
- `container-class`
- `aria-label`
- `value`
- `hidden-items`

`hidden-items` используется для ручного `ellipsis`. Формат такой же, как у корневого `items`.

Поддерживаемые источники item:

- `sf-breadcrumbs-item`
- `item` в raw HTML без sanitizer
- любой элемент с `data-sf-breadcrumb-item`

## Формат Items

Элементы разделяются символом `|`.

Параметры элемента можно передавать после `::`:

```text
Label::href=/path,icon=home,current
```

Также можно разделять параметры несколькими `::`, если так удобнее:

```text
Label::icon=settings::disabled
```

Частые параметры:

- `href=/path`
- `url=/path`
- `icon=name`
- `aria-label=Text`
- `current`
- `active`
- `disabled`
- `ellipsis`
- `target=_blank`
- `rel=noopener`

`items` также принимает JSON-массив при обновлении через JS:

```js
breadcrumbs.setState({
  items: [
    { icon: 'home', href: '/', ariaLabel: 'Home' },
    { label: 'Category', href: '/category' },
    { label: 'Current page', current: true },
  ],
});
```

## Слоты

Контент конкретного элемента можно переопределить слотами:

- `item-0`
- `item-1`
- `item-2`
- и так далее

Контент конкретного разделителя можно переопределить слотами:

- `separator-0`
- `separator-1`
- `separator-2`
- и так далее

Пример:

```html
<sf-breadcrumbs items="Home::href=/|Products::href=/products|Current::current">
  <span slot="item-1" class="flex items-cross-center gap-1/4">
    <i class="sf-icon">inventory_2</i>
    <span>Products</span>
  </span>
</sf-breadcrumbs>
```

## Методы

- `setState(nextState)`
- `onItemClick(handler, options)`

Пример:

```js
const breadcrumbs = document.querySelector('sf-breadcrumbs');

breadcrumbs.onItemClick((item, detail, event) => {
  console.log(item, detail, event);
});
```

## События

Хостовый элемент наследует lifecycle-события `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

Нажатие на хлебную крошку:

- `sf-breadcrumbs-press`

Событие `sf-breadcrumbs-press` является cancelable. Если вызвать `event.preventDefault()` во внешнем обработчике, дефолтное раскрытие `ellipsis` не выполнится.

`event.detail` — только данные:

- `item`
- `index`
- `items`

Старое имя `sf-breadcrumb-click` работает до 2026-12-01: оно приходит следом
с прежним `detail` (`component`, `tagName`, `template`, `originalEvent`) и тем
же отказом — `preventDefault()` на любом из имён отменяет раскрытие. Каждое
использование старого имени записывается в `SF.deprecations` с датами.

Публичные переменные: `--sf-breadcrumbs-gap`, `--sf-breadcrumbs-color`,
`--sf-breadcrumbs-link-color`, `--sf-breadcrumbs-link-hover-color`,
`--sf-breadcrumbs-current-color`, `--sf-breadcrumbs-separator-color`.

## Ellipsis

Путь — одна строка, и сворачивается он только когда ему не хватает места
(решение C93, п. 1), на любой ширине: строка шире своего места или название
крошки обрезано уже, чем его собственный предел. Середина уходит в «…», потом
и первая крошка — самый узкий путь читается «… › родитель › текущая» (п. 2).
Родитель и текущая страница (в пути из родителей — родитель) не прячутся, и
за «…» никогда не прячется одна крошка: сворачиваются хотя бы две. Если и в
самом узком пути название крошки обрезано короче трёх букв (меньше `3em` её
текста), в «…» уходит и родитель: «… › текущая». Кнопка «…» не сжимается
никогда. Путь,
который помещается, остаётся целым и на телефоне: «Главная › Раздел» не
становится «… › Раздел». Новая ширина пересчитывает путь от полного.

Строка не переносится, поэтому строка никогда не начинается с «›». Текущая
страница занимает остаток строки и переносится там по словам (п. 6), первая
её строка — рядом с крошками; предки при нехватке места сжимаются и
обрезаются. Переносится только путь, раскрытый на месте (`expandEllipsis()`).

`max-items` — дополнительный предел по числу (3 и больше), по умолчанию `0`
(предела нет). С `max-items="4"` и пятью элементами:

```html
<sf-breadcrumbs>
  <sf-breadcrumbs-item href="/">Home</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog">Catalog</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog/section">Section</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog/section/group">Group</sf-breadcrumbs-item>
  <sf-breadcrumbs-item current>Product</sf-breadcrumbs-item>
</sf-breadcrumbs>
```

```html
<sf-breadcrumbs max-items="4">…</sf-breadcrumbs>
```

Для этого примера будет показано 4 элемента: первый, `…`, предпоследний и
последний. Нажатие на `…` открывает меню скрытых крошек рядом с кнопкой
(`sf-menu-context`, решение C93, п. 1): фокус уходит в меню, Escape или выбор
возвращают его на `…`. У кнопки `aria-haspopup="menu"` и `aria-expanded`; она —
квадрат высоты элемента 1/3 (28 на компьютере, 24 на телефоне и в компактной
плотности). На телефоне путь — одна строка (п. 2): что помещается, остаётся
целым; что нет, сворачивается до «… › родитель › текущая», а затем место
делится поровну, более короткое из
двух названий остаётся целым, более длинное обрезается многоточием — на
телефоне и название текущей страницы — с полным названием в подсказке.

Ссылки пути серые (`on-surface-variant`), под указателем темнеют и
подчёркиваются; текущая страница — `on-surface`, средняя жирность (п. 5).
Длинное название предка обрезается многоточием на 12rem (`--sf-f2`), полное
название — подсказка крошки и остаётся в тексте для чтеца; название текущей
страницы на компьютере переносится (п. 6).

Если нужно задать `ellipsis` вручную, используйте `hidden-items`:

```html
<sf-breadcrumbs max-items="0">
  <sf-breadcrumbs-item href="/">Home</sf-breadcrumbs-item>
  <sf-breadcrumbs-item
    ellipsis
    hidden-items="Catalog::href=/catalog|Section::href=/catalog/section"
  >…</sf-breadcrumbs-item>
  <sf-breadcrumbs-item current>Product</sf-breadcrumbs-item>
</sf-breadcrumbs>
```

`expand-on-ellipsis="false"` оставляет нажатие странице. Внешний обработчик
может переопределить поведение:

```js
breadcrumbs.onItemClick((item, detail, event) => {
  if (!item.ellipsis) return;

  event.preventDefault();
  // открыть context-menu/dropdown или выполнить свой сценарий
});
```

## Доступность

- Корень рендерится как `<nav>`, крошки — список `<ol>`, по `<li>` на крошку
  с разделителем перед ней: чтец называет «список, N пунктов».
- `aria-label` по умолчанию — слово языка страницы: «Хлебные крошки», `Breadcrumb`.
- Текущий элемент получает `aria-current="page"`.
- Разделители рендерятся с `aria-hidden="true"`.
- Для элемента с одной иконкой нужно задавать `aria-label`.
- Предкам с реальным URL задавайте `href`: они остаются нативными ссылками.
  Крошка без `href` — текст вне порядка Tab. Кнопкой она становится только с
  `value`, который обрабатывает страница через `sf-breadcrumbs-press` (путь в
  окне выбора папки, где крошки меняют окно, а не адрес).
- Arrow-key модель не добавляется: ссылки используют Tab/Enter, ellipsis-кнопка
  — Tab/Enter/Space.
- Рамка базового компонента включается через `:focus-visible`, не обычный клик.
  В forced-colors остаётся контур; окружающая область не должна его обрезать.
- Рамка фокуса скруглена `--sf-radius--ui`, как у ссылок и кнопок Framework.
- Текст пути — 14/20 везде: на компьютере шаг под основным текстом, на
  телефоне и в компактной плотности (C22) — шаг основного текста; ссылка — цель
  высоты элемента 1/3 (28 / 24).
- Длинные подписи предков обрезаются, текущая страница на компьютере переносится, на телефоне путь — одна строка; размер разделителя и «…» сохраняется.

## Первая отрисовка

Шаблон не использует утилитарные классы: строку пути рисует лист стилей
`breadcrumbs`. Напечатанной разметке (`static/default/*.html`) нужны
`component/breadcrumbs`, `component/icons` и `core.css`. Пустой тег без
напечатанной разметки занимает место, которое задаёт страница
(`data-sf-skeleton="line"` и `--sf-skeleton-block-size`, правило ядра о коробке
до кода); иначе путь появляется вместе со скриптом.

## Playground

Пример для playground:

- `examples/smart-components/breadcrumbs/default`
