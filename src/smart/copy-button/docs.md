# Smart Copy Button

`<sf-copy-button>` копирует значение и сообщает о результате: значок на миг
становится галочкой, а «Скопировано» вежливо объявляется для чтения с экрана.

```html
<code id="token">sk_test_51H…</code>
<sf-copy-button target="#token" label="Скопировать ключ"></sf-copy-button>
<sf-copy-button value="npm i @simai/ui" text="Копировать" label="Скопировать команду"></sf-copy-button>
```

Что копируется:

- `value` — сам текст;
- `target="#id"` — значение поля или текст элемента. Пронумерованный блок кода
  копируется без номеров строк.

Если заданы и `value`, и `target` — это ошибка.

- `text` — видимая подпись. Без неё кнопка — только значок.
- `label` — доступное имя: что именно копируется («Скопировать команду»). По
  умолчанию «Копировать». Если на странице несколько кнопок, называйте каждую.
- `size` — `1/3`, `1/2` (по умолчанию), `1`, `2`. `appearance` — `link` (по
  умолчанию), `ghost`, `outline` или `tonal`. `root-style` ложится на саму
  кнопку.
- `icon` — значок в покое (по умолчанию `content_copy`): `link` для ссылки,
  `key` для ключа. `success-icon` — значок после копирования (по умолчанию `check`).
- `success-text`, `error-text` — свои сообщения. `duration` — сколько
  миллисекунд держится результат, по умолчанию 2000.

Если браузер не дал доступ к буферу (страница во фрейме, политика),
компонент выделяет текст и сообщает «Выделено — нажмите Ctrl+C» (⌘C на
macOS), чтобы человек мог скопировать сам. Пока идёт копирование, повторное
нажатие не срабатывает.

События: `sf-copy-button-copied {text, method}` — текст скопирован, и
`sf-copy-button-copy-failed {code}` — не удалось. Коды ошибок:
`empty_source`, `missing_target`, `ambiguous_source`, `denied`. Прежние имена
`sf-copy` и `sf-copy-error` приходят следом до 2026-12-01 (`aliases.json`).

Действие `copy()` копирует из кода и отвечает исходом (стандарт 1.3.8 §4.4):
`{outcome: 'applied', text, method}`, `{outcome: 'refused', reason}` (код
ошибки или `busy`, пока идёт предыдущее копирование) или `cancelled`, если
кнопку убрали со страницы.

Публичные переменные: `--sf-copy-button-display`, `--sf-copy-button-vertical-align`,
`--sf-copy-button-pending-opacity`, `--sf-copy-button-success-color`,
`--sf-copy-button-error-color`. Вид самой кнопки задают переменные `sf-button`
и `sf-icon-button`.

Интерфейс — `component.json`, примеры — `examples.json`.
