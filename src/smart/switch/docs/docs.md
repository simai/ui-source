# sf-switch

Smart Switch проецирует обычный `.sf-switch` поверх нативного checkbox с
`role="switch"`. Используйте его для бинарной настройки, которая применяется
сразу; для отложенного выбора в форме используйте Checkbox.

## Базовое использование

```html
<sf-switch
  label="Default switch"
  description="Description text"
  help="info"
></sf-switch>
```

## Атрибуты

- `size`
- `label`
- `description`
- `help`
- `checked`
- `disabled`
- `name`
- `value`

## Слоты

- `label`
- `description`
- `help`

Встроенный шаблон применяет общие `root-class`, `style` и `root-style` к
корневому `label`. Используйте утилиты и семантические токены Framework;
настройка оформления сохраняет нативное поле и состояние формы.
Размеры ограничены значениями `1` и `2`. Подпись называет настройку, а
description поясняет результат; `checked`, `disabled` и reset остаются
нативными состояниями.

## Методы

- `getInputElement()`
- `isChecked()`
- `setChecked(value)`
- `setDisabled(value)`
- `onChange(handler)`
- `onFocus(handler)`
- `onBlur(handler)`
