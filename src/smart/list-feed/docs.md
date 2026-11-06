# sf-list-feed

Лента: прокручиваемая колонка записей, которую читают от новой записи внизу, —
переписка, комментарии к записи, история действий, журнал, ход выполнения
задачи. Вариант блока `list` SIMAI Framework рядом с `sf-list`: `sf-list` —
список, с которым что-то делают (открыть, переименовать, действия строки),
`sf-list-feed` — лента, которую читают.

## Что он делает и чего не делает

Он владеет **положением чтения** — и только им. Само правило — в ядре
(`core/js/reading-position.js`, `SF.readingPosition`), лента его применяет:

- более ранняя история добавляется сверху, а то, что человек читает, не
  сдвигается;
- новая запись тянет колонку вниз, только если человек уже был внизу или это его
  собственная запись;
- кнопка «К последней записи» возвращает вниз и переносит туда фокус;
- верх колонки при `has-more` один раз просит предыдущие записи.

Он ничего не загружает и ничего не решает: каждая просьба уходит событием.

**Что такое запись — решает хост.** Запись рисует функция хоста `renderItem`;
без неё — имя автора над первой записью серии и текст. Текст, никогда не
разметка: хост, у которого есть HTML, рисует его сам и сам его чистит. Автор —
это данные (`author`, `own`), а не роль: лента только объединяет подряд идущие
записи одного автора в серию и говорит рисовальщику, где серия начинается и
кончается.

## Подключение

```html
<div style="display: flex; flex-direction: column; block-size: 32rem">
  <sf-list-feed label="Комментарии">
    <div slot="empty">Комментариев пока нет</div>
  </sf-list-feed>
</div>
```

```js
const feed = document.querySelector('sf-list-feed');
feed.renderItem = (entry, {first, own, view, growing}) => {
  const node = document.createElement('article');
  node.setAttribute('aria-label', own ? 'Вы' : entry['author-name']);
  node.textContent = entry.text;
  return node;
};
feed.setItems(await api.comments(taskId), {hasMore: true});
feed.addEventListener('sf-list-feed-load-more', async (event) => {
  // {direction: 'before', before}: before — id первой показанной записи
  const page = await api.comments(taskId, {before: event.detail.before});
  feed.prependItems(page.items, {hasMore: page.hasMore});
});
feed.upsert(entry);                              // новая или изменившаяся запись
feed.upsert(saved, undefined, {replaces: localKey}); // локальный ключ получил номер сервера
```

Высоту ленте даёт контейнер: хост компонента — `display: contents`, а
`.sf-list-feed` растягивается во flex-контейнере (`flex: 1`) и прокручивается
внутри.

## Запись, которая пишется

Ответ, который приходит по частям, — поток (стандарт 1.3.8 §10.8, словарь 1.1.5
§5.2): у записи `growing: true`, пока другая сторона её пишет; каждая часть —
новое `upsert` с более длинным текстом. Лента сообщает `sf-list-feed-begun`,
`-chunk` на каждую нарисованную часть и ровно одно из `-completed`, `-failed`,
`-cancelled`. `feed.cancel({id})` перестаёт рисовать рост сразу; сказать другой
стороне остановиться — дело хоста.

Изменившаяся запись перерисовывается **на месте** (§18.4): элемент записи
остаётся тем же, а пока фокус или выделение внутри него, новый рисунок
накладывается на старые узлы — фокус на кнопке внутри растущего ответа не
сбрасывается.

## Настройки

| Атрибут | По умолчанию | Значение |
|:---|:---|:---|
| `has-more` | `false` | Есть более ранние записи: видна кнопка «Показать предыдущие», верх колонки их просит. |
| `changes` | `content` | Как сравнивать две записи одного `id` (§18.4): `content` (поля и `view`) или `revision` (хост повышает её с каждым изменением). |
| `label` | «Лента» / «Feed» | Доступное имя области. |
| `live` | `polite` | `polite`: законченная чужая запись объявляется один раз. `off`: объявляет хост через `announce()`. |

## Свойства

| Свойство | Значение |
|:---|:---|
| `items` | Записи в порядке показа. Записанные целиком, сравниваются по ключу с показанными: ушедшая снимается, новая или изменившаяся рисуется на своём месте, остальные сохраняют узлы. |
| `renderItem(entry, context)` | Возвращает `Node`, строку (рисуется как текст) или `null`. `context`: `{view, previous, next, first, last, own, growing, index, document, feed}`. |
| `announceItem(entry, context)` | Что сказать, когда запись новая или закончена; одни и те же слова для одной записи — один раз. По умолчанию `author-name: text` для законченной не своей записи. |

Запись — простые данные. Лента читает `id` (обязательно), `author`, `own`,
`growing`, `revision`, `wait` (`delayed`, `stopped`, `network`, `none`), `error`
(`{reason, message}`), а для рисунка и объявления по умолчанию — `author-name` и
`text`. Остальные поля — рисовальщика.

## Действия

Каждое отвечает исходом (`{outcome: 'applied'}` или `{outcome: 'refused', reason}`).

| Действие | Значение |
|:---|:---|
| `setItems(items, {hasMore})` | Заменить ленту и показать её конец. Ничего из неё не объявляется. |
| `prependItems(items, {hasMore})` | Ранняя история сверху, не сдвигая читаемое; завершает запрос. |
| `upsert(entry, view?, {replaces?})` | Добавить в конец или перерисовать на месте. |
| `setView(id, view)` | Дописать в `view` показанной записи. |
| `detach(id)` | Снять одну запись; её поток кончается `cancelled`. `remove()` без аргумента — браузерный. |
| `cancel(id)` | Перестать рисовать растущую запись. |
| `redraw(id?)` | Нарисовать заново одну запись или все. |
| `requestEarlier()` | Попросить ранние записи, как кнопка. Отказ `loading`, `no-more`, `prevented`. |
| `earlierFailed()` | Хост не смог загрузить: кнопка снова нажимается. |
| `scrollToLatest({instant, focus})` | К последней записи; с `focus` фокус переходит на неё. |
| `announce(text)` | Сказать один раз через вежливую живую область (до 240 символов). |

`isAtLatest()` говорит, виден ли конец ленты.

## События

| Событие | Detail | Когда |
|:---|:---|:---|
| `sf-list-feed-load-more` | `{direction: 'before', before}` | Кнопка, ArrowUp на первой записи, верх колонки при `has-more`. Отмена — то же, что `earlierFailed()`. |
| `sf-list-feed-begun` | `{id}` | Пришла растущая запись. |
| `sf-list-feed-chunk` | `{id, revision?}` | Растущая запись изменилась и перерисована. |
| `sf-list-feed-completed` | `{id}` | Закончила расти целиком. |
| `sf-list-feed-failed` | `{id, reason, message}` | Закончила с ошибкой. |
| `sf-list-feed-cancelled` | `{id}` | Поток остановлен. |

## Слот

`empty` — показывается вместо колонки, пока записей нет.

## Клавиатура и доступность

Прокручиваемая область — одна остановка Tab, у неё имя (`label`). Внутри — журнал
(`role="log"`) с выключенным `aria-live`; что нового, говорит одна вежливая живая
область. От записи в фокусе ArrowUp и ArrowDown ведут к соседней, Home и End — к
первой и последней загруженной; ArrowUp на первой просит более ранние. Клавиши на
собственных кнопках записи остаются их.

## Переменные

| Переменная | По умолчанию |
|:---|:---|
| `--sf-list-feed-column-width` | `var(--sf-layout-reading-width)` |
| `--sf-list-feed-inset` | `var(--sf-space-3)` |
| `--sf-list-feed-run-gap` | `var(--sf-space-1\/4)` |
| `--sf-list-feed-turn-gap` | `var(--sf-space-1\/2)` |
| `--sf-list-feed-fade-size` | `var(--sf-space-1)` |

Классы, на которые может опираться рисовальщик: `.sf-list-feed__item` с
`--own`, `--first`, `--last` (серии) и `--end` (последняя запись).

## Переход с sf-message-log

`sf-message-log` из пакета pro — датированный псевдоним `sf-list-feed` (с пакета
pro-db5cc2a375bd); он работает до 1 января 2027 года, после этой даты его
удалят. Соответствия: `messages` → `items`, `renderMessage` → `renderItem`,
`announceMessage` → `announceItem`, `setMessages` → `setItems`, `prependMessages` →
`prependItems`, события `sf-message-log-*` → `sf-list-feed-*`, переменные
`--sf-message-log-*` → `--sf-list-feed-*`, классы `.sf-message-log__*` →
`.sf-list-feed__*` (`__message` → `__entry`). Остальное — то же.
