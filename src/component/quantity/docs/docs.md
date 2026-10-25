# Quantity Component

`Quantity` is a numeric stepper component with:
- label + required marker
- minus/plus icon buttons
- numeric input in the middle

JS class: `Quantity` (`src/component/quantity/js/_quantity.js`)  
Registration: `registerComponent('Quantity', Quantity)`

## Supported params (component constructor)

- `size`: `1/2 | 1 | 2` (default: `1`). Form fields have three sizes; a retired `1/3` or `3` renders as `1/2` or `2` with a console warning.
- `label`: string (default: `Label`)
- `required`: boolean (default: `true`)
- `value`: initial value (if omitted, value is taken from input attrs or left empty)
- `min`: minimum value
- `max`: maximum value
- `step`: increment/decrement step (default: `1`)
- `name`: input `name`
- `disabled`: boolean (default: `false`)
- `readonly`: boolean (default: `false`)
- `placeholder`: native input placeholder
- `decrementLabel`: accessible name of the decrement button
- `incrementLabel`: accessible name of the increment button
- `decrementIcon`: icon name for minus button (default: `remove`)
- `incrementIcon`: icon name for plus button (default: `add`)
- `precision`: decimal digits for display/rounding
- `grouping`: thousands grouping in UI (`true/false`, default: `true`)
- `locale`: locale for formatting (for example `ru-RU`, `en-US`)
- `inputMode`: `soft | strict` (default: `soft`)
- `allowNegative`: allow minus sign (`true/false`, default: `false`)
- `allowDecimal`: allow decimal separator (`true/false`, default: `precision > 0`)
- `mask`: enable Framework mask for this input (`true/false`, default: `false`)

## Runtime formatting attributes

You can configure formatting from markup as well:

- `data-precision="0|1|2|..."`
- `data-grouping="true|false"`
- `data-locale="ru-RU"`
- `data-input-mode="soft|strict"`
- `data-allow-negative="true|false"`
- `data-allow-decimal="true|false"`
- `data-mask="true|false"`

They can be set on `.sf-quantity` or on the internal `<input>`.

When `data-mask="true"` (or `mask: true`), the component uses `window.SF.Mask`
(project-owned mask runtime) for numeric typing. The mask runtime is loaded only when needed.

## Value behavior

- Internal editable text can contain grouped values (`2 567`, `2,567.50`, etc.).
- Component stores normalized number in `input.dataset.rawValue`.
- On `blur` and `+/-` clicks value is formatted according to:
  - `precision`
  - `grouping`
  - `locale`
- `+/-` respects `step`, `min`, `max`; a no-op boundary action does not emit
  an extra `change` event.
- A direct value is clamped to `min/max` on blur without implicit step-grid
  snapping.
- Buttons are auto-disabled when the input is disabled or readonly, and the
  corresponding button is disabled at its numeric boundary.

## Events

After `+/-` actions component dispatches on input:
- `change`

This allows external listeners to react without additional integration code.
Direct editing retains the browser's native `input` and `change` events.

## Focus and geometry

The field is on the size ladder: the box is `--sf-ui-<size>--control-height`
tall, exactly as an Input of the same size, with the same block padding, and
the value shares the Input's text line. The steppers are icon buttons one rung
down (a size `1` field carries size `1/2` steppers) whatever size class the
markup gives them, and stand as far from the field's side as from its top and
bottom.

The composite control uses the UI radius token `--sf-radius--ui`, the hairline
token `--sf-px`, semantic typography and spacing tokens. Pointer activation
does not leave a focus ring. Keyboard focus is visible on the actual field or
button, including forced-colors mode. Disabled and readonly states do not alter
the selected size geometry.

## Input mode behavior

- `soft`:
  - user can type freely,
  - value is softly sanitized on `input`,
  - full formatting is applied on `blur` and on `+/-`.

- `strict`:
  - invalid symbols are blocked during typing (`beforeinput`),
  - paste is sanitized/validated before insertion,
  - full formatting is applied on `blur` and on `+/-`.

## Markup example

```html
<label class="sf-quantity sf-quantity--size-1">
  <span class="sf-quantity-label">
    <span class="sf-quantity-text">Label</span>
    <span class="sf-quantity-required">*</span>
  </span>

  <span class="sf-quantity-wrap">
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3">
      <i class="sf-icon">remove</i>
    </button>
    <input
      type="text"
      value="2567.5"
      step="0.01"
      min="0"
      data-precision="2"
      data-grouping="true"
      data-locale="ru-RU"
    />
    <button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3">
      <i class="sf-icon">add</i>
    </button>
  </span>
</label>
```
