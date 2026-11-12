# sf-steps

Smart-обертка над `steps + step` component.

## Базовое использование

```html
<sf-steps
  items="Account|Profile|Verification|Done"
  current="1"
  error-step="2"
  aria-label="Account setup"
  completed-label="Completed"
  error-label="Error"
></sf-steps>
```

## Атрибуты

- `size="1/2|1"`
- `items`
- `current`
- `error-step`
- `separator-icon`
- `aria-label`
- `completed-label`
- `error-label`
- `skipped-label`
- `running-label`
- `root-class`

`root-class`, `style` и `root-style` применяются к видимому корню `.sf-steps`.
Для размеров используйте семантические токены Framework. Изменение оформления
не выбирает шаг и не сбрасывает `current`; оболочка остаётся `display: contents`.

Цвета состояний наследуются от базового `step`: доступный текст использует
`on-surface-variant`, текущий — `on-surface`, недоступный текст и индикатор —
`on-disable`. Ошибка недоступного шага не отменяет его disabled-оформление.

Каждый доступный шаг рендерится нативной кнопкой `type="button"`; отключённый
шаг получает нативный `disabled`. Поэтому Enter и Space работают без
синтетической клавиатурной обработки, а компонент не отправляет форму.

Шаги — нумерованный список: `<ol role="list">`, в каждом `<li>` кнопка шага
и разделитель после неё; программа чтения с экрана называет число шагов и
место текущего (с версии 1.3.0; раньше — группа кнопок).

`aria-label` называет список шагов. `completed-label`, `skipped-label` и `error-label` задают
локализованные подписи состояний, которые добавляются к доступному имени шага.
Текущий шаг использует `aria-current="step"`.

Шаги наследуют `:focus-visible` и forced-colors-контур базового компонента.
Иконки состояния и разделители декоративные (`aria-hidden="true"`), поэтому
доступное имя содержит подпись шага, а не название глифа. Подпись не разрывается внутри слова: шаг, которому не хватает места в ряду,
целиком переходит на следующую строку вместе с разделителем, а подпись
переносится по словам, только если шаг один шире ряда. Для ясности сохраняйте
названия короткими.

## Формат items

Строка через `|`:

```html
items="Account|Profile|Verification::disabled|Done"
```

Поддерживаемые flags:

- `disabled`
- `completed`, `skipped`, `running`, `error` — состояние шага (с версии 1.2.0)

Тот же список можно передать массивом в свойство `items` или как JSON в
атрибуте: `items='[{"label": "Account"}, {"label": "Done", "disabled": true}]'`.

## Состояние шага

С версии 1.2.0 у элемента списка может быть собственное состояние `state`:

| `state` | Что значит | Значок |
|---|---|---|
| `default` | ещё не начат | — |
| `completed` | сделан | `check_circle`, цвет успеха |
| `skipped` | пропущен намеренно | `do_not_disturb_on`, `on-surface-variant` |
| `running` | выполняется действие шага | `progress_activity`, `on-surface-variant`, вращается |
| `error` | ошибка | `error`, цвет ошибки |

Состояние, заданное в элементе, важнее вычисленного по месту: без него шаг до
`current` считается сделанным, а `error-step` отмечает ошибку. Мастер
(`sf-wizard`) передаёт состояние каждому шагу, поэтому шаг до текущего,
который не сделали, читается как «ещё не начат». Подпись пропущенного шага в
доступном имени — `skipped-label` («Пропущен» / «Skipped»), выполняющегося —
`running-label` («Выполняется» / «In progress»). При `prefers-reduced-motion: reduce`
значок выполнения не вращается.

```html
<sf-steps current="2" items='[
  {"label": "Вход", "state": "completed"},
  {"label": "Уведомления", "state": "skipped"},
  {"label": "Защита"},
  {"label": "Копии", "state": "default"}
]'></sf-steps>
```

## События и действия

Когда человек нажимает шаг, компонент отправляет `sf-steps-change` с
`{previous, current, item, items}` — только данные, без самого элемента.
Старое имя `sf-step-change` работает до 2026-12-01: оно приходит следом с
прежним `detail` (с `component`, `tagName`, `template`), и каждое его
использование записывается в `SF.deprecations` с датами.

- `goToStep(index)` — действие `go-to-step`: переходит к шагу и отвечает
  `{outcome: 'applied'}` или `{outcome: 'refused', reason}` (`disabled`,
  `current`, `out-of-range`). Как и у обычных полей, событие при этом не
  отправляется: `sf-steps-change` сообщает о действии человека.
- `onStepChange(handler)` — подписка на `sf-steps-change`.

## Внешний вид

Публичные переменные: `--sf-steps-gap`, `--sf-steps-separator-color`,
`--sf-steps-step-color`, `--sf-steps-step-border-color`,
`--sf-steps-step-radius`, `--sf-steps-current-border-color`,
`--sf-steps-completed-icon-color`.
