# sf-checkbox

Smart checkbox built on top of the base `.sf-checkbox` component.

## Tag

- `sf-checkbox`

## Attributes

- `size`
- `label`
- `description`
- `help`
- `position="start|end"`
- `checked`
- `disabled`
- `indeterminate`
- `name`
- `value`
- `error`

The default template applies the shared `root-class`, `style` and `root-style`
attributes to its label root. Use Framework utilities and semantic tokens for
customization; changing root styling preserves the native input and form state.

## Methods

- `getInputElement()`
- `isChecked()`
- `setState({ checked, indeterminate, disabled })`
- `setChecked(value)`
- `setIndeterminate(value)`
- `setDisabled(value)`
- `onChange(handler)`

## State model

`sf-checkbox` is controlled through smart-component state. Use
`setState(...)`, `setChecked(...)`, `setIndeterminate(...)`, or
`setDisabled(...)` for programmatic changes.

The base `.sf-checkbox` DOM component still supports direct input updates
through `SF.Checkbox.setState(input, state)`. Smart `sf-checkbox` renders its
state icon through nested `sf-icon`, while the base DOM component updates the
standalone `.sf-icon` text content.

The base indicator styles also cover the nested Smart icon. Checked and mixed
non-error enabled states use the `on-primary` role on the primary box; state and size
styling must not depend on whether the icon has a Smart wrapper.

The native input remains the value, keyboard and form owner. `indeterminate`
is a mixed visual state for a checkbox that summarizes related choices; it is
not a third submitted value. `error` publishes `aria-invalid="true"`, and the
author must provide a specific visible explanation.

Use logical `position="start"` for normal forms. The retained `end` option is
for layouts that intentionally place the indicator after its label. Related
choices still need a host-owned `fieldset` and `legend`.

## Example

```html
<sf-checkbox
  label="Default"
  description="Description"
  checked
></sf-checkbox>
```
