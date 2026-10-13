# sf-toggle

Smart Toggle проецирует компактный обычный `.sf-toggle` поверх нативного
checkbox с `role="switch"`. Используйте его для немедленной бинарной настройки,
когда полный Switch с пояснением избыточен.

## Базовое использование

```html
<sf-toggle label="Default toggle"></sf-toggle>
<sf-toggle type="icon" icon="dark_mode" label="Theme"></sf-toggle>
<sf-toggle type="short" checked></sf-toggle>
```

## Атрибуты

- `size="1|2"`
- `type="simple|icon|short"`
- `label`
- `icon`
- `checked`
- `disabled`
- `name`
- `value`
- `root-class`

Встроенный шаблон применяет общие `root-class`, `style` и `root-style` к
корневому `label`. Используйте утилиты и семантические токены Framework;
настройка оформления сохраняет нативное поле и состояние формы.
Поддерживаются только типы `simple`, `icon`, `short` и размеры `1`, `2`.
Иконка декоративна и не заменяет доступное имя; `checked`, `disabled` и reset
остаются нативными состояниями.

## Методы

- `getInputElement()`
- `isChecked()`
- `setChecked(value)`
- `setDisabled(value)`
- `onChange(handler)`
- `onFocus(handler)`
- `onBlur(handler)`
