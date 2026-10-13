# sf-breadcrumbs checklist

Рабочий чеклист smart-компонента хлебных крошек.

## Готово

- [x] Smart-компонент `<sf-breadcrumbs>`.
- [x] Правило загрузчика `cl-breadcrumbs`.
- [x] Relation с базовыми стилями `breadcrumbs`.
- [x] Relation с `icons`.
- [x] Пустое состояние без demo-заглушек, если `items` и дочерние элементы не переданы.
- [x] Декларативный синтаксис через дочерние `sf-breadcrumbs-item`.
- [x] Поддержка короткого `item` для raw HTML без sanitizer.
- [x] Компактный синтаксис через атрибут `items`.
- [x] Поддержка JSON/array items через `setState`.
- [x] Автоматические разделители.
- [x] Кастомная иконка разделителя через `separator-icon`.
- [x] Поддержка иконок элементов через `icon`.
- [x] Состояние текущего элемента через `current`.
- [x] Ellipsis-элемент через `ellipsis`.
- [x] Автоматическое сворачивание середины цепочки через `max-items` по умолчанию `4`.
- [x] Дефолтное раскрытие `ellipsis`.
- [x] Ручной `ellipsis` через `hidden-items`.
- [x] Переопределение раскрытия `ellipsis` через `event.preventDefault()`.
- [x] Disabled-состояние.
- [x] Slot overrides для элементов: `item-0`, `item-1`, и так далее.
- [x] Slot overrides для разделителей: `separator-0`, `separator-1`, и так далее.
- [x] Событие `sf-breadcrumb-click`.
- [x] Хелпер `onItemClick(handler)`.
- [x] Пример в playground.

## Частично

- [ ] Публичные TypeScript declarations.
- [ ] Страница в генерируемой документации UI.
- [ ] Browser smoke после сборки компонента в distributable smart bundle.

## Дальше

- [ ] Добавить сгенерированные артефакты `smart/breadcrumbs` во внешний smart-репозиторий во время релиза.
- [ ] Добавить visual regression/screenshot coverage для default, ellipsis и custom slot cases.
- [ ] Уточнить SEO/accessibility контракт для schema markup, если компонент позже будет отвечать за structured data.
