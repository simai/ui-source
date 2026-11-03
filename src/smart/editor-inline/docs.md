# sf-editor-inline

Smart Inline editor — правка текста `content.heading` и `content.paragraph`
прямо на холсте. Поддерживает strong, em, code, ссылки и inline-атомы — то,
что есть в модели content; списков нет, потому что их нет в модели. События
несут нормализованную модель content, а не HTML.

Код загружается по требованию: достаточно поставить на странице редактора
`<sf-editor-inline>`. Элемент ничего не показывает; после загрузки
`SF.Composition.startInlineEdit` работает как раньше, до загрузки — бросает
`inline_editor_not_loaded`.

## Базовое использование

```html
<sf-editor-inline></sf-editor-inline>
```

```js
await customElements.whenDefined('sf-editor-inline');
canvas.addEventListener('dblclick', (event) => {
  const element = event.target.closest('[data-sf-composition-id]');
  const node = nodeById(element.dataset.sfCompositionId);
  SF.Composition.startInlineEdit(element, {content: node.data.content, nodeId: node.id, label: 'Абзац'});
});
document.addEventListener('sf-inline-editor-change', (event) => save(event.detail.id, event.detail.content));
```

`document.querySelector('sf-editor-inline').edit(element, options)` — тот же
вызов. Возвращает `{element, commit(), cancel(), value()}`.

## Параметры

- `content` — текущая модель content;
- `nodeId` — id узла для событий;
- `label` — доступное имя поля;
- `marks` — подмножество `strong`, `em`, `code`;
- `links: false` — без ссылок;
- `messages` — свои тексты панели;
- `toolbar` — когда видна панель форматирования: `'session'` (по умолчанию)
  — всю правку, над элементом; `'selection'` — только пока выделен текст,
  над выделением (с версии 1.3.0). Для редактора, где каждый абзац — отдельная
  правка, подходит `'selection'`: панель не закрывает набираемую строку.

## События

- `sf-inline-editor-input` — `{id, content}` после каждого изменения;
- `sf-inline-editor-change` — `{id, content}` по Enter или уходу фокуса;
- `sf-inline-editor-cancel` — `{id}` по Escape, исходный HTML восстанавливается.

`id` — это `nodeId` правки. Прежние `sf-inline-edit-input`, `-commit`
(`{node_id, content}`) и `-cancel` (`{node_id}`) приходят следом за новыми до
2026-12-01. `SF.InlineEditor.INLINE_EVENTS` — новые имена,
`INLINE_EVENTS_LEGACY` — прежние.

События отправляются на редактируемый элемент и всплывают до `document`;
сам `<sf-editor-inline>` скрыт и роли не имеет.

## Inline-атомы

С версии 1.1.0 типов `content.heading` и `content.paragraph` в тексте может
стоять атом `{type: 'component', name, props}`; `name` — один из `badge`,
`kbd`, `icon`, `button`, `props` — настройки этого компонента (например,
`{type: 'component', name: 'kbd', props: {text: 'Ctrl+S'}}`). Атом — одна
позиция курсора: внутри он не правится, оформления не принимает и в ссылку не
входит. Стрелки перешагивают его за одно нажатие, Backspace и Delete удаляют
целиком, копирование и вставка его сохраняют. Значения `props` выводятся
только как текст и значения атрибутов. Узел, которого редактор не знает,
сохраняется так же и возвращается без изменений.

## Клавиатура и доступность

Ctrl/Cmd+B, I, E — жирный, курсив, код; Ctrl/Cmd+K — ссылка (http, https,
mailto, tel, относительные и якорные; опасные адреса отклоняются с понятной
ошибкой); Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y — история. Во время правки
элемент — подписанный `role="textbox"` с видимой рамкой, панель форматирования
с `aria-pressed`. Вставка из Word и веб-страниц оставляет только разрешённое
оформление; ввод через IME не прерывается.

## Интерфейс

Интерфейс — `component.json` (стандарт simai.smart-component 1.3.8), слова —
`lang/`, примеры — `examples.json`. Публичные переменные (видны во время
правки): `--sf-inline-editor-outline-color`,
`--sf-inline-editor-toolbar-background-color`,
`--sf-inline-editor-toolbar-radius`, `--sf-inline-editor-toolbar-gap`,
`--sf-inline-editor-toolbar-padding`.
