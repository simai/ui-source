# sf-modal checklist

Рабочий чек-лист переноса и доработки модального окна на базе старой модалки:
https://dev.ru.simai.io/ru/ui/component/modal/modal.php

## Done

- [x] Базовый smart-component `<sf-modal>`.
- [x] Открытие через атрибут `open`.
- [x] Методы `open()`, `close()`, `toggle()`.
- [x] Синхронизация атрибута `open` после открытия и закрытия через runtime.
- [x] `modal-id` и кнопки с `data-sf-modal-close`.
- [x] Overlay через `overlay`.
- [x] Закрытие по overlay через `close-on-overlay`.
- [x] Закрытие по Esc через `close-on-esc`.
- [x] Кнопка закрытия через `show-close`.
- [x] Scroll lock страницы при открытой модалке.
- [x] Компенсация scrollbar gap через `preserve-scroll-gap`.
- [x] Focus trap внутри открытой модалки.
- [x] Возврат фокуса на предыдущий элемент после закрытия.
- [x] События `modal:before-open`, `modal:after-open`, `modal:before-close`, `modal:after-close`.
- [x] События smart-component `modal:ready` и `modal:update`.
- [x] Слоты `header`, `content`, `footer`.
- [x] Текстовые параметры `title` и `text`.
- [x] Классы для частей модалки: `panel-class`, `header-class`, `body-class`, `content-class`, `footer-class`.
- [x] Presentation-классы: `overlay-class`, `close-class`, `surface-class`.
- [x] Position: `center`, `inline-start`, `inline-end`, `top`, `bottom`; `left` and `right` remain compatibility aliases.
- [x] Добавить `unclose` или аналогичный режим, где модалку нельзя закрыть Esc/overlay/close button.
- [x] Проверить и зафиксировать поведение при смене `placement` у уже открытой модалки.
- [x] Fullscreen через `fullscreen`.
- [x] Добавить `autoload`, если модалка должна открываться автоматически после загрузки.
- [x] Добавить `width`.
- [x] Добавить `height`.
- [x] Добавить `mode="inline|ajax|iframe"` — режим загрузки контента.
- [x] Добавить `display="modal|inline"` — режим отображения (fixed modal или inline в потоке).
- [x] Добавить `src` для ajax-режима (URL или DOM-селектор `#id`).
- [x] Добавить `preload` (по умолчанию `true` — загрузка контента при инициализации).
- [x] Добавить loading/error состояния для удаленного контента.
- [x] Добавить abort/cancel предыдущей загрузки при смене `src`.
- [x] Blur страницы через `blur`.
- [x] Тип blur через `blur-type="none|small|medium|large"`.
- [x] Тема-независимая тёмная подложка через `overlay-preset="default"`.
- [x] Фокусный preset с той же подложкой и `backdrop-blur-small`.

## Partial

- [ ] Размерные пресеты модалки.
      Есть явные `width` и `height`, но нет API `size`.
- [ ] Кастомизация content/body.
      Есть `body-class` и `content-class`, но старый API может ожидать отдельные модификаторы контента.
- [x] Nested modals.
      Обычный и Smart Modal используют общий стек, z-index, focus restore и scroll-lock lease; Escape и Tab принадлежат верхнему видимому слою.

## Todo

- [ ] Добавить `mode="iframe|image|video"` или разделить эти сценарии на отдельные компоненты.
- [ ] Добавить `size`, если нужны предустановленные размеры вместо произвольных `width/height`.
- [x] Добавить `hide` — кнопка сворачивания модалки (не закрытие, а minimise).
- [x] Добавить `hide-modifier` — кастомизация кнопки сворачивания.
- [ ] Расширить `autoload` значениями `true`/`'hide'`/`'collapsed'`.
- [ ] Добавить хук `beforeCreateWindow` — callback перед созданием DOM-структуры.
- [ ] Добавить события: `modal:before-create`, `modal:before-content-upload`, `modal:after-content-upload`, `modal:before-hide`, `modal:before-show`.
- [ ] Проверить и зафиксировать поведение при смене `overlay`, `close-on-esc`, `close-on-overlay` у уже открытой модалки.
- [x] Проверить стек нескольких открытых модалок: z-index, overlay, focus trap, Esc закрывает только верхнюю.
- [x] Добавить документационные примеры основных пользовательских осей; низкоуровневые aliases и классовые проекции не дублируются отдельными playground-копиями.
- [x] Обновить `docs.md` по принятому публичному API.
- [ ] Обновить `src/core/types/smart-components.d.ts`, если добавляем новые методы или typed helper API.

## Out Of Scope Candidates

- [ ] Tooltip/popover режим.
      Уже реализован отдельным компонентом `<sf-tooltip>`.
- [ ] Gallery/lightbox.
      Лучше вынести в отдельный smart-component `<sf-gallery>`, если нужна навигация, zoom, thumbnails и preload.
- [ ] Collapse/hide content.
      Лучше делать отдельным компонентом, если это не часть сценария modal.

## Suggested Order

1. Presentation API: `width`, `height`, `size`.
2. Behavior API: `unclose`, `autoload` (расширенный), `hide`.
3. ~~Content loading API: `mode`, `src` (URL + DOM-селектор), `preload`, loading/error, abort on `src` change.~~ ✅ DONE
4. Modal stack hardening: nested modals, z-index, focus trap, Esc behavior.
5. Events & hooks: `beforeCreateWindow`, `before/after-content-upload`, `before-hide/show`.
6. Playground and docs sync.
