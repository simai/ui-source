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
- `aria-label` — accessible name for a switch with no visible label. A host that
  draws the label itself -- a record panel does -- passes this instead of
  `label`, and the name lands on the native input rather than being printed a
  second time.
- `inherited-value`, `inherited-text`, `reset-label` — see «Inherited value».

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

## Inherited value

`inherited-value` (`true`/`on` or `false`/`off`) is whether the switch is on
while it holds no value of its own. The knob stands where it says, quieter,
with a «наследуется» marker after the label, and the checkbox submits nothing.
With `inherited-value` set, «off» chosen by a person is a value of its own and
is kept as `checked="false"`; no `checked` at all means the inherited state.
A flip gives the switch its own value and the marker gives way to a reset
button.

```html
<sf-switch name="notify" label="Notifications" inherited-value="true"></sf-switch>
```

The reset is a native button named by `reset-label` («Сбросить к наследуемому»,
"Reset to inherited"); the marker's words are `inherited-text` («наследуется»,
"inherited"). Both follow the page's language when unset. Pressing the reset
fires `sf-field-reset` on the host -- bubbling, composed and **cancellable** --
before anything changes:

```js
field.addEventListener('sf-field-reset', (event) => {
  const {value, inheritedValue, name} = event.detail; // value: the own value being dropped
  if (!confirm(`Return ${name} to ${inheritedValue}?`)) event.preventDefault();
});
```

Not prevented, the field empties, says so with its ordinary `change` on the host, shows the
inherited value again and takes focus back on the control. `element.resetToInherited()`
does the same from code and returns whether it reset. While inherited, the
control carries the value as `aria-description` («Наследуется: …»); the visible
marker is hidden from assistive technology so it is not read twice.

The state is shared by sf-input, sf-textarea, sf-dropdown, sf-color and
sf-switch (`src/smart/helpers/inherited-value.js`), so a field reads and resets
the same way whichever control it is. The marker and the reset are one step
down the size ladder and sit inside the field's box with the same gap above,
below and after them.

## Методы

- `getInputElement()`
- `isChecked()`
- `setChecked(value)`
- `setDisabled(value)`
- `onChange(handler)`
- `onFocus(handler)`
- `onBlur(handler)`
- `resetToInherited()`
