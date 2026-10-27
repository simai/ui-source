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

По умолчанию `max-items="4"`. Если элементов больше, компонент скрывает середину цепочки в `...`:

```html
<sf-breadcrumbs>
  <sf-breadcrumbs-item href="/">Home</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog">Catalog</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog/section">Section</sf-breadcrumbs-item>
  <sf-breadcrumbs-item href="/catalog/section/group">Group</sf-breadcrumbs-item>
  <sf-breadcrumbs-item current>Product</sf-breadcrumbs-item>
</sf-breadcrumbs>
```

Для этого примера будет показано 4 элемента: первый, `…`, предпоследний и
последний. Клик по `…` по умолчанию раскрывает полный путь.

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

Внешний обработчик может переопределить поведение:

```js
breadcrumbs.onItemClick((item, detail, event) => {
  if (!item.ellipsis) return;

  event.preventDefault();
  // открыть context-menu/dropdown или выполнить свой сценарий
});
```

## Доступность

- Корень рендерится как `<nav>`.
- `aria-label` по умолчанию — слово языка страницы: «Хлебные крошки», `Breadcrumb`.
- Текущий элемент получает `aria-current="page"`.
- Разделители рендерятся с `aria-hidden="true"`.
- Для элемента с одной иконкой нужно задавать `aria-label`.
- Предкам с реальным URL задавайте `href`: они остаются нативными ссылками.
  URL-less item сохраняет legacy Button fallback для host-owned client-side
  navigation intent и требует обработчика `sf-breadcrumbs-press`.
- Arrow-key модель не добавляется: ссылки используют Tab/Enter, ellipsis-кнопка
  — Tab/Enter/Space.
- Рамка базового компонента включается через `:focus-visible`, не обычный клик.
  В forced-colors остаётся контур; окружающая область не должна его обрезать.
- Длинные подписи переносятся, а минимальный размер разделителя сохраняется.

Нативный ordered-list wrapper не включён в текущий default: это изменило бы
публичную Smart DOM-анатомию и требует отдельной миграции. Landmark, current
page, native actions и скрытые разделители при этом реализованы без подмены
ролей.

## Playground

Пример для playground:

- `examples/smart-components/breadcrumbs/default`
