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

`aria-label` называет группу шагов. `completed-label` и `error-label` задают
локализованные подписи состояний, которые добавляются к доступному имени шага.
Текущий шаг использует `aria-current="step"`.

Шаги наследуют `:focus-visible` и forced-colors-контур базового компонента.
Иконки состояния и разделители декоративные (`aria-hidden="true"`), поэтому
доступное имя содержит подпись шага, а не название глифа. Длинные подписи
переносятся без уменьшения индикаторов; для ясности сохраняйте названия короткими.

## Формат items

Строка через `|`:

```html
items="Account|Profile|Verification::disabled|Done"
```

Поддерживаемые flags:

- `disabled`

## Методы

- `goToStep(index)`
- `onStepChange(handler)`
